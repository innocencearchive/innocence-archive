"""
Daily Podcast Capture Pipeline for Innocence Archive.

Checks RSS feeds in feeds.json for new episodes, downloads each new MP3 to a
temporary file, uploads it to the Gemini File API, asks gemini-3.8-flash to
transcribe and extract structured database fields in one shot, and stages the
result as UNVERIFIED via POST /api/admin/podcast-ingest.
"""

import argparse
import hashlib
import json
import os
import tempfile
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import List, Optional

import feedparser
import requests
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
FEEDS_FILE = BASE_DIR / "feeds.json"
STATE_FILE = BASE_DIR / "state.json"
STAGED_DIR = BASE_DIR / "staged"


# --- Structured Output Schema for Gemini ---

class ExtractedIndividual(BaseModel):
    firstName: str
    middleName: Optional[str] = None
    lastName: str
    suffix: Optional[str] = None
    status: Optional[str] = Field(
        default="UNKNOWN",
        description=(
            "One of: EXONERATED, RELEASED_ALFORD_PLEA, RELEASED_CLEMENCY, "
            "RELEASED_TIME_SERVED, CONVICTION_OVERTURNED, EXECUTED, CONVICTED, OTHER, UNKNOWN"
        ),
    )
    claimStrength: Optional[str] = Field(
        default="UNASSESSED",
        description=(
            "One of: FORMALLY_EXONERATED, OFFICIAL_RELIEF_NO_EXONERATION, "
            "STRONG_NEW_EVIDENCE, CREDIBLE_CLAIM, UNASSESSED"
        ),
    )
    convictionYear: Optional[int] = None
    exonerationOrReleaseYear: Optional[int] = None
    timeServed: Optional[str] = None
    sentence: Optional[str] = None
    caseLocationCity: Optional[str] = None
    caseLocationState: Optional[str] = None
    caseLocationCountry: Optional[str] = "USA"
    narrativeSummary: Optional[str] = None


class ExtractedOrganization(BaseModel):
    name: str
    type: Optional[str] = Field(
        default="OTHER",
        description=(
            "One of: INNOCENCE_ORG, LEGAL_AID, LAW_FIRM, LAW_ENFORCEMENT, "
            "GOVERNMENT_AGENCY, SUPPORT_GROUP, MEDIA_ORG, UNIVERSITY, OTHER, UNKNOWN"
        ),
    )


class ExtractedInvolvedPerson(BaseModel):
    firstName: str
    lastName: str
    role: Optional[str] = Field(
        default="OTHER",
        description=(
            "One of: LAWYER_DEFENSE, LAWYER_PROSECUTION, JUDGE, WITNESS_EYEWITNESS, "
            "WITNESS_ALIBI, WITNESS_EXPERT, WITNESS_INFORMANT, POLICE_DETECTIVE, "
            "POLICE_OFFICER, VICTIM, FAMILY_MEMBER, JOURNALIST, AUTHOR, DIRECTOR, HOST, "
            "ACTIVIST, ACCUSER, ACTUAL_PERPETRATOR, CO_DEFENDANT, SUBJECT_EXONEREE, "
            "SUBJECT_OTHER, OTHER, UNKNOWN"
        ),
    )
    notes: Optional[str] = None


class ExtractedLink(BaseModel):
    url: str
    description: Optional[str] = None


class PodcastExtraction(BaseModel):
    episodeNumber: Optional[str] = None
    hostOrNarrator: Optional[str] = None
    focusOrTheme: Optional[str] = None
    summaryNotes: str = Field(
        description="Executive summary of the episode (1 paragraph, max 8 sentences) followed by key case details."
    )
    keyQuotes: Optional[str] = None
    transcript: str = Field(description="Full verbatim transcript of the podcast episode audio.")
    individuals: List[ExtractedIndividual] = Field(default_factory=list)
    contributingFactors: List[str] = Field(default_factory=list)
    organizations: List[ExtractedOrganization] = Field(default_factory=list)
    involvedPersons: List[ExtractedInvolvedPerson] = Field(default_factory=list)
    externalLinks: List[ExtractedLink] = Field(default_factory=list)


# --- Helpers ---

def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {"processed": {}}


def save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")


def get_mp3_url(entry) -> Optional[str]:
    for enc in entry.get("enclosures", []):
        href = enc.get("href") or enc.get("url")
        if href and ("audio" in enc.get("type", "") or href.lower().endswith(".mp3")):
            return href
    for link in entry.get("links", []):
        if link.get("rel") == "enclosure" and link.get("href"):
            return link["href"]
    return None


def parse_release_date(entry) -> Optional[str]:
    published = entry.get("published") or entry.get("updated")
    if not published:
        return None
    try:
        return parsedate_to_datetime(published).isoformat()
    except Exception:
        return None


def parse_duration_seconds(entry) -> Optional[int]:
    raw = entry.get("itunes_duration")
    if not raw:
        return None
    raw = str(raw).strip()
    if raw.isdigit():
        return int(raw)
    parts = [int(p) for p in raw.split(":") if p.isdigit()]
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    return None


def download_temp_mp3(url: str) -> Path:
    resp = requests.get(url, stream=True, timeout=120)
    resp.raise_for_status()
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
    with tmp as f:
        for chunk in resp.iter_content(chunk_size=1024 * 1024):
            if chunk:
                f.write(chunk)
    return Path(tmp.name)


def wait_for_gemini_file(client: genai.Client, file_obj):
    while getattr(file_obj.state, "name", None) == "PROCESSING":
        time.sleep(5)
        file_obj = client.files.get(name=file_obj.name)
    if getattr(file_obj.state, "name", None) == "FAILED":
        raise RuntimeError(f"Gemini file processing failed: {file_obj.name}")
    return file_obj


def process_episode(
    client: genai.Client,
    model_name: str,
    feed_cfg: dict,
    entry,
    dry_run: bool,
    api_base_url: str,
    ingest_key: str,
) -> dict:
    title = entry.get("title", "Untitled Episode").strip()
    description = entry.get("summary") or entry.get("description") or ""
    mp3_url = get_mp3_url(entry)
    if not mp3_url:
        raise ValueError(f"No MP3 enclosure found for episode: {title}")

    guid = entry.get("id") or entry.get("link") or mp3_url
    canonical_key = "podcast:" + hashlib.sha256(f"{feed_cfg['podcastTitle']}::{guid}".encode()).hexdigest()[:24]

    prompt = (
        f"You are a professional research assistant for The Innocence Archive.\n"
        f"Listen to the attached podcast audio and use the RSS metadata below to:\n"
        f"1. Produce an accurate verbatim transcript.\n"
        f"2. Extract all structured case data (wrongfully convicted individuals, "
        f"contributing factors, organizations, other involved persons, key quotes, "
        f"executive summary, and any mentioned external links).\n"
        f"Base all extracted facts strictly on the audio and RSS metadata.\n\n"
        f"Podcast Series: {feed_cfg['podcastTitle']}\n"
        f"Default Host: {feed_cfg.get('defaultHost', '')}\n"
        f"RSS Episode Title: {title}\n"
        f"RSS Episode Description:\n{description}\n"
    )

    temp_mp3 = None
    uploaded_file = None
    try:
        print(f"  Downloading MP3: {mp3_url}")
        temp_mp3 = download_temp_mp3(mp3_url)

        print(f"  Uploading to Gemini File API...")
        uploaded_file = client.files.upload(file=str(temp_mp3))
        uploaded_file = wait_for_gemini_file(client, uploaded_file)

        print(f"  Transcribing & extracting with {model_name}...")
        response = client.models.generate_content(
            model=model_name,
            contents=[uploaded_file, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=PodcastExtraction,
            ),
        )
        extracted = PodcastExtraction.model_validate_json(response.text)
    finally:
        if uploaded_file is not None:
            try:
                client.files.delete(name=uploaded_file.name)
            except Exception as cleanup_err:
                print(f"  Warning: failed to delete Gemini file: {cleanup_err}")
        if temp_mp3 is not None and temp_mp3.exists():
            temp_mp3.unlink(missing_ok=True)

    payload = {
        "podcastTitle": feed_cfg["podcastTitle"],
        "publisherOrNetwork": feed_cfg.get("publisherOrNetwork"),
        "episodeTitle": title,
        "episodeNumber": extracted.episodeNumber or entry.get("itunes_episode"),
        "releaseDate": parse_release_date(entry),
        "durationSeconds": parse_duration_seconds(entry),
        "hostOrNarrator": extracted.hostOrNarrator or feed_cfg.get("defaultHost"),
        "focusOrTheme": extracted.focusOrTheme,
        "summaryNotes": extracted.summaryNotes,
        "keyQuotes": extracted.keyQuotes,
        "transcript": extracted.transcript,
        "sourceUrl": entry.get("link") or mp3_url,
        "canonicalKey": canonical_key,
        "importBatchId": f"podcast-{datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
        "individuals": [i.model_dump() for i in extracted.individuals],
        "contributingFactors": extracted.contributingFactors,
        "organizations": [o.model_dump() for o in extracted.organizations],
        "involvedPersons": [p.model_dump() for p in extracted.involvedPersons],
        "externalLinks": [l.model_dump() for l in extracted.externalLinks],
    }

    if dry_run:
        STAGED_DIR.mkdir(parents=True, exist_ok=True)
        out_path = STAGED_DIR / f"{canonical_key.replace(':', '_')}.json"
        out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(f"  [DRY RUN] Saved staged JSON to {out_path}")
        return {"dry_run": True, "file": str(out_path)}

    headers = {"Content-Type": "application/json"}
    if ingest_key:
        headers["X-Ingest-Key"] = ingest_key
    ingest_url = f"{api_base_url.rstrip('/')}/admin/podcast-ingest"
    resp = requests.post(ingest_url, json=payload, headers=headers, timeout=60)
    resp.raise_for_status()
    return resp.json()


def main():
    load_dotenv(BASE_DIR / ".env")
    parser = argparse.ArgumentParser(description="Daily podcast capture & Gemini extraction.")
    parser.add_argument("--limit", type=int, default=3, help="Max new episodes to process per run (default: 3).")
    parser.add_argument("--dry-run", action="store_true", help="Save JSON locally to staged/ instead of posting to API.")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is required in scripts/podcast_pipeline/.env")

    model_name = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
    api_base_url = os.environ.get("API_BASE_URL", "http://localhost:3001/api")
    ingest_key = os.environ.get("PODCAST_INGEST_KEY", "")

    feeds = json.loads(FEEDS_FILE.read_text(encoding="utf-8"))
    state = load_state()
    client = genai.Client(api_key=api_key)

    processed_count = 0
    for feed_cfg in feeds:
        if not feed_cfg.get("active", True):
            continue
        print(f"Checking feed: {feed_cfg['podcastTitle']} ({feed_cfg['rssUrl']})")
        parsed = feedparser.parse(feed_cfg["rssUrl"])

        for entry in parsed.entries:
            if processed_count >= args.limit:
                print(f"Reached --limit {args.limit}. Stopping.")
                return
            guid = entry.get("id") or entry.get("link") or entry.get("title")
            if not guid or guid in state["processed"]:
                continue

            print(f"New episode found: {entry.get('title')}")
            try:
                res = process_episode(
                    client=client,
                    model_name=model_name,
                    feed_cfg=feed_cfg,
                    entry=entry,
                    dry_run=args.dry_run,
                    api_base_url=api_base_url,
                    ingest_key=ingest_key,
                )
                print(f"  Result: {res}")
                if not args.dry_run:
                    state["processed"][guid] = {
                        "podcast": feed_cfg["podcastTitle"],
                        "title": entry.get("title"),
                        "processedAt": datetime.now(timezone.utc).isoformat(),
                    }
                    save_state(state)
                processed_count += 1
            except Exception as err:
                print(f"  Error processing '{entry.get('title')}': {err}")


if __name__ == "__main__":
    main()

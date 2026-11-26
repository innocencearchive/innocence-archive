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
import re
import tempfile
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from enum import Enum
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


class ContributingFactorCode(str, Enum):
    FALSE_CONFESSION = "FALSE_CONFESSION"
    OFFICIAL_MISCONDUCT = "OFFICIAL_MISCONDUCT"
    POLICE_MISCONDUCT = "POLICE_MISCONDUCT"
    PROSECUTORIAL_MISCONDUCT = "PROSECUTORIAL_MISCONDUCT"
    WITHHELD_EXCULPATORY_EVIDENCE = "WITHHELD_EXCULPATORY_EVIDENCE"
    MISTAKEN_EYEWITNESS_IDENTIFICATION = "MISTAKEN_EYEWITNESS_IDENTIFICATION"
    PERJURY_OR_FALSE_ACCUSATION = "PERJURY_OR_FALSE_ACCUSATION"
    FALSE_OR_MISLEADING_FORENSIC_EVIDENCE = "FALSE_OR_MISLEADING_FORENSIC_EVIDENCE"
    INADEQUATE_LEGAL_DEFENSE = "INADEQUATE_LEGAL_DEFENSE"
    JAILHOUSE_INFORMANT = "JAILHOUSE_INFORMANT"
    TUNNEL_VISION_RUSH_TO_JUDGMENT = "TUNNEL_VISION_RUSH_TO_JUDGMENT"
    RACIAL_BIAS = "RACIAL_BIAS"
    PREJUDICIAL_JOINDER_JOINT_TRIAL = "PREJUDICIAL_JOINDER_JOINT_TRIAL"
    MEDIA_SENSATIONALISM = "MEDIA_SENSATIONALISM"
    COERCED_PLEA = "COERCED_PLEA"
    UNRELIABLE_WITNESS = "UNRELIABLE_WITNESS"


class PodcastExtraction(BaseModel):
    episodeNumber: Optional[str] = None
    hostOrNarrator: Optional[str] = None
    focusOrTheme: Optional[str] = None
    summaryNotes: str = Field(
        description="Executive summary of the episode (1 paragraph, max 8 sentences) followed by key case details."
    )
    keyQuotes: Optional[str] = None
    transcript: str = Field(
        description=(
            "Full verbatim transcript of the podcast episode content, omitting any "
            "third-party sponsor advertisements, dynamic ad reads, and cross-promotions for other shows."
        )
    )
    individuals: List[ExtractedIndividual] = Field(default_factory=list)
    contributingFactors: List[ContributingFactorCode] = Field(
        default_factory=list,
        description="Select all applicable standardized ContributingFactorCode enum values from the 16-item list.",
    )
    organizations: List[ExtractedOrganization] = Field(default_factory=list)
    involvedPersons: List[ExtractedInvolvedPerson] = Field(default_factory=list)
    externalLinks: List[ExtractedLink] = Field(default_factory=list)


# --- Helpers ---

INVALID_NAME_TOKENS = {
    "unknown", "n/a", "na", "none", "unnamed", "anonymous",
    "detective", "officer", "judge", "justice", "doctor", "dr", "dr.",
    "mr", "mr.", "mrs", "mrs.", "ms", "ms.", "attorney", "prosecutor",
    "sergeant", "sgt", "sgt.", "lieutenant", "lt", "lt.", "captain", "capt", "capt.",
    "agent", "trooper", "deputy", "sheriff", "commissioner", "warden", "guard",
}


def has_valid_full_name(first_name: Optional[str], last_name: Optional[str]) -> bool:
    f = (first_name or "").strip().lower()
    l = (last_name or "").strip().lower()
    if not f or not l:
        return False
    if f in INVALID_NAME_TOKENS or l in INVALID_NAME_TOKENS:
        return False
    return True


CANONICAL_CONTRIBUTING_FACTORS = [
    "False Confession",
    "Official Misconduct",
    "Police Misconduct",
    "Prosecutorial Misconduct",
    "Withheld Exculpatory Evidence (Brady Violation)",
    "Mistaken Eyewitness Identification",
    "Perjury or False Accusation",
    "False or Misleading Forensic Evidence",
    "Inadequate Legal Defense",
    "Jailhouse Informant",
    "Tunnel Vision / Rush to Judgment",
    "Racial Bias",
    "Prejudicial Joinder / Joint Trial",
    "Media Sensationalism",
    "Coerced Plea",
    "Unreliable Witness",
]


class QuotaExhaustedError(RuntimeError):
    """Raised when Gemini API returns persistent 429 / RESOURCE_EXHAUSTED quota limits."""


def is_rate_limit_error(err: Exception) -> bool:
    msg = str(err).upper()
    return "429" in msg or "RESOURCE_EXHAUSTED" in msg or "QUOTA" in msg


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {"processed": {}}


def save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")


def resolve_episode_url(feed_cfg: dict, feed_link: str, entry, mp3_url: str) -> str:
    """Resolve the most specific episode web URL (preferring direct episode pages over generic show URLs)."""
    entry_link = (entry.get("link") or "").strip()
    generic_feed_link = (feed_link or "").strip().rstrip("/")

    # 1. If RSS entry has a specific episode link (not just the generic show homepage), use it
    if entry_link and entry_link.rstrip("/") != generic_feed_link:
        return entry_link

    # 2. If hosted on Omny Studio, fetch the official episode PublishedUrl from Omny's public clip API
    clip_id = entry.get("omny_clipid")
    rss_url = feed_cfg.get("rssUrl", "")
    omny_match = re.search(r"omnycontent\.com/d/playlist/([0-9a-f-]{36})/", rss_url, re.IGNORECASE)
    if clip_id and omny_match:
        org_id = omny_match.group(1)
        try:
            r = requests.get(f"https://api.omny.fm/orgs/{org_id}/clips/{clip_id}", timeout=10)
            if r.ok:
                pub_url = (r.json().get("PublishedUrl") or "").strip()
                if pub_url:
                    return pub_url
        except Exception:
            pass

    # 3. Try Apple Podcasts public Search API for an exact episode page match
    ep_title = (entry.get("title") or "").strip()
    if ep_title:
        try:
            r = requests.get(
                "https://itunes.apple.com/search",
                params={
                    "media": "podcast",
                    "entity": "podcastEpisode",
                    "term": f"{feed_cfg['podcastTitle']} {ep_title}",
                    "limit": 5,
                },
                timeout=10,
            )
            if r.ok:
                norm_target = re.sub(r"\W+", "", ep_title.lower())
                for item in r.json().get("results", []):
                    track_name = item.get("trackName") or ""
                    if re.sub(r"\W+", "", track_name.lower()) == norm_target and item.get("trackViewUrl"):
                        return item["trackViewUrl"].split("&uo=")[0]
        except Exception:
            pass

    # 4. Fallback to direct episode MP3 URL (or generic link if no MP3)
    return mp3_url or entry_link


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
    resp = requests.get(url, headers={"User-Agent": "InnocenceArchiveBot/1.0"}, stream=True, timeout=120)
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


def compute_canonical_key(podcast_title: str, entry) -> str:
    mp3_url = get_mp3_url(entry) or ""
    guid = entry.get("id") or entry.get("link") or mp3_url or entry.get("title") or ""
    return "podcast:" + hashlib.sha256(f"{podcast_title}::{guid}".encode()).hexdigest()[:24]


def fetch_remote_processed(api_base_url: str, ingest_key: str) -> tuple[set, set]:
    """Fetch canonicalKeys and podcast::title keys already stored in the live database."""
    url = f"{api_base_url.rstrip('/')}/admin/podcast-ingest/processed"
    headers = {}
    if ingest_key:
        headers["X-Ingest-Key"] = ingest_key
    try:
        resp = requests.get(url, headers=headers, timeout=20)
        if resp.ok:
            data = resp.json()
            c_keys = set(data.get("canonicalKeys") or [])
            t_keys = set(data.get("titleKeys") or [])
            print(f"Synced {data.get('total', len(c_keys))} already-processed episode(s) from live database.")
            return c_keys, t_keys
        print(f"Warning: could not fetch remote processed list (HTTP {resp.status_code}); falling back to local state.json.")
    except Exception as err:
        print(f"Warning: remote processed sync failed ({err}); falling back to local state.json.")
    return set(), set()


def process_episode(
    client: genai.Client,
    model_name: str,
    feed_cfg: dict,
    feed_link: str,
    entry,
    dry_run: bool,
    refresh_existing: bool,
    api_base_url: str,
    ingest_key: str,
) -> dict:
    title = entry.get("title", "Untitled Episode").strip()
    description = entry.get("summary") or entry.get("description") or ""
    mp3_url = get_mp3_url(entry)
    if not mp3_url:
        raise ValueError(f"No MP3 enclosure found for episode: {title}")

    canonical_key = compute_canonical_key(feed_cfg["podcastTitle"], entry)

    factors_hint = ", ".join(c.value for c in ContributingFactorCode)
    prompt = (
        f"You are a professional research assistant for The Innocence Archive.\n"
        f"Listen to the attached podcast audio and use the RSS metadata below to:\n"
        f"1. Produce an accurate verbatim transcript of the episode content ONLY "
        f"(omit all third-party sponsor ads, dynamic ad reads, and promos for other podcasts).\n"
        f"2. Extract all structured case data (wrongfully convicted individuals, "
        f"contributing factors, organizations, other involved persons, key quotes, "
        f"executive summary, and any mentioned external links).\n"
        f"3. For individuals and involvedPersons, ONLY include people whose actual first AND last names "
        f"are explicitly stated. Do NOT invent or use placeholders like 'Unknown' or 'N/A', and NEVER put "
        f"titles or ranks (e.g., 'Detective', 'Judge', 'Officer', 'Dr.', 'Attorney') in firstName or lastName. "
        f"Do NOT repeat the wrongfully convicted individual(s) from `individuals` inside `involvedPersons` — "
        f"keep `involvedPersons` strictly for OTHER people (hosts, victims, detectives, prosecutors, defense lawyers, "
        f"judges, witnesses, journalists, investigators, family members). "
        f"Do NOT include podcast production crew or outro credits (producers, audio/sound engineers, editors, "
        f"researchers, or network staff) in involvedPersons.\n"
        f"4. For contributingFactors, select ONLY from these 16 standardized enum codes: "
        f"{factors_hint}.\n"
        f"5. For organizations, use full official organization names (e.g. 'New York City Police Department' "
        f"rather than 'NYPD') and avoid abbreviations or duplicates.\n"
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
        response = None
        for attempt in range(2):
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=[uploaded_file, prompt],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=PodcastExtraction,
                    ),
                )
                break
            except Exception as gen_err:
                if is_rate_limit_error(gen_err):
                    if attempt == 0:
                        print("  Hit Gemini rate limit (429). Waiting 65s before one retry...")
                        time.sleep(65)
                        continue
                    raise QuotaExhaustedError(f"Gemini quota/rate limit reached: {gen_err}") from gen_err
                raise
        extracted = PodcastExtraction.model_validate_json(response.text)
    finally:
        if uploaded_file is not None:
            try:
                client.files.delete(name=uploaded_file.name)
            except Exception as cleanup_err:
                print(f"  Warning: failed to delete Gemini file: {cleanup_err}")
        if temp_mp3 is not None and temp_mp3.exists():
            temp_mp3.unlink(missing_ok=True)

    valid_individuals = [
        i.model_dump() for i in extracted.individuals
        if has_valid_full_name(i.firstName, i.lastName)
    ]
    individual_name_keys = {
        (i["firstName"].strip().lower(), i["lastName"].strip().lower())
        for i in valid_individuals
    }
    valid_involved_persons = [
        p.model_dump() for p in extracted.involvedPersons
        if has_valid_full_name(p.firstName, p.lastName)
        and (p.firstName.strip().lower(), p.lastName.strip().lower()) not in individual_name_keys
    ]

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
        "sourceUrl": resolve_episode_url(feed_cfg, feed_link, entry, mp3_url),
        "canonicalKey": canonical_key,
        "importBatchId": f"podcast-{datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
        "refreshExisting": refresh_existing,
        "individuals": valid_individuals,
        "contributingFactors": list(dict.fromkeys(f.value for f in extracted.contributingFactors)),
        "organizations": [o.model_dump() for o in extracted.organizations],
        "involvedPersons": valid_involved_persons,
        "externalLinks": [l.model_dump() for l in extracted.externalLinks],
    }

    if dry_run:
        STAGED_DIR.mkdir(parents=True, exist_ok=True)
        out_path = STAGED_DIR / f"{canonical_key.replace(':', '_')}.json"
        out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(f"  [DRY RUN] Saved staged JSON to {out_path}")
        preview = dict(payload)
        t = payload.get("transcript") or ""
        preview["transcript"] = f"<{len(t)} chars> {t[:400]}..." if len(t) > 400 else t
        print("\n--- DRY RUN JSON OUTPUT (transcript abbreviated) ---")
        print(json.dumps(preview, indent=2))
        print("--- END DRY RUN JSON OUTPUT ---\n")
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
    parser.add_argument("--limit", type=int, default=5, help="Max new episodes to process per run (default: 5).")
    parser.add_argument("--delay", type=int, default=15, help="Seconds to pause between episodes for Free Tier TPM safety (default: 15).")
    parser.add_argument("--dry-run", action="store_true", help="Save JSON locally to staged/ instead of posting to API.")
    parser.add_argument("--refresh-existing", action="store_true", help="Allow refreshing already-ingested episodes (updates factors & tests dedup without overwriting verified fields).")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is required in scripts/podcast_pipeline/.env")

    model_name = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
    api_base_url = os.environ.get("API_BASE_URL", "http://localhost:3001/api")
    ingest_key = os.environ.get("PODCAST_INGEST_KEY", "")

    feeds = json.loads(FEEDS_FILE.read_text(encoding="utf-8"))
    state = load_state()
    remote_canonical_keys, remote_title_keys = (
        (set(), set()) if args.refresh_existing else fetch_remote_processed(api_base_url, ingest_key)
    )
    client = genai.Client(api_key=api_key)

    processed_count = 0
    for feed_cfg in feeds:
        if not feed_cfg.get("active", True):
            continue
        print(f"Checking feed: {feed_cfg['podcastTitle']} ({feed_cfg['rssUrl']})")
        feed_resp = requests.get(feed_cfg["rssUrl"], headers={"User-Agent": "InnocenceArchiveBot/1.0"}, timeout=30)
        if not feed_resp.ok:
            print(f"  Warning: RSS fetch failed with HTTP {feed_resp.status_code} for {feed_cfg['rssUrl']}")
            continue
        parsed = feedparser.parse(feed_resp.content)
        if not parsed.entries:
            print(f"  Warning: 0 entries parsed from {feed_cfg['rssUrl']}")
            continue

        for entry in parsed.entries:
            if processed_count >= args.limit:
                print(f"Reached --limit {args.limit}. Stopping.")
                return
            guid = entry.get("id") or entry.get("link") or entry.get("title")
            if not guid:
                continue
            ep_title = (entry.get("title") or "").strip()
            canonical_key = compute_canonical_key(feed_cfg["podcastTitle"], entry)
            title_key = f"{feed_cfg['podcastTitle'].strip().lower()}::{ep_title.lower()}"

            if not args.refresh_existing and (
                guid in state["processed"]
                or canonical_key in remote_canonical_keys
                or title_key in remote_title_keys
            ):
                continue

            print(f"Processing episode: {entry.get('title')}")
            try:
                res = process_episode(
                    client=client,
                    model_name=model_name,
                    feed_cfg=feed_cfg,
                    feed_link=parsed.feed.get("link", ""),
                    entry=entry,
                    dry_run=args.dry_run,
                    refresh_existing=args.refresh_existing,
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
                if processed_count < args.limit and args.delay > 0:
                    print(f"  Pausing {args.delay}s before next episode...")
                    time.sleep(args.delay)
            except QuotaExhaustedError as qerr:
                print(f"  Stopping run cleanly due to Gemini quota limit: {qerr}")
                return
            except Exception as err:
                print(f"  Error processing '{entry.get('title')}': {err}")


if __name__ == "__main__":
    main()

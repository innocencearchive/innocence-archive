# The Innocence Archive — Data Rebuild & Curation Workflow Model

> **Purpose:** A permanent reference guide documenting:
> 1. Your **4-Stage On-Site Admin Workflow** for safely adding, validating, auditing, and publishing data via `/admin`.
> 2. Your **Historical Seed Reference (Steps 1–10)** — the exact order, source files, record counts, and lessons learned from the original database build, so you can recreate and verify the archive cleanly on your own terms.
> 3. **Unseeded Research Backlogs** sitting in `docs/` and `scripts/` ready to be brought in over time.

---

## Part 1: The 4-Stage On-Site Admin Workflow (`/admin`)

Every new dataset—whether recreated from historical research or gathered fresh—follows the same 4-stage pipeline using the top navigation bar across all `/admin*` pages:

```
Step 0: Initialize Core Lookups (/admin/import)
   ↓
Stage 1: INGEST   → /admin/import · /admin/film/add · /admin/podcasts
   ↓
Stage 2: VERIFY   → /admin/verify (Unified Validation Queue)
   ↓
Stage 3: AUDIT    → /admin/audit (Data Health & Merge) · /admin/batches (History & Rollback)
   ↓
Stage 4: CONFIGURE → /admin/manage/* (Cross-Link & Citations) · /adminsettings (Homepage)
```

### Step 0: Initialize Core Lookup Tables (Run Once on a Fresh DB)
Open **`/admin/import`** and click **Initialize Core Lookup Tables**. This safely seeds:
* **16 Canonical Contributing Factors** (`ContributingFactorCode` enum — verified, standardized labels).
* **45 Canonical Crime Categories** (the standardized National Registry of Exonerations list, ordered by `severity_order`).
* **6 Core Information Sources** (`National Registry of Exonerations`, `Innocence Project`, `Wikipedia`, `Wrongful Conviction Podcast`, `TMDB`, `Google Books`).

### Stage 1: Ingest (Always Preview Before Writing)
* **CSV / JSON Batches (`/admin/import`):**
  1. Choose Target Entity (`Individuals` or `Organizations`) and upload or paste your CSV/JSON.
  2. Set the **Default Source Name** (provenance), **Ingestion Source Tag** (e.g., `nre_2026`, `wiki_rebuild`), and keep **Target Verification Status** as `UNVERIFIED`.
  3. Click **Preview & Validate (No DB Writes)** to inspect `NEW`, `EXACT_MATCH`, `FUZZY_DUPLICATE`, and `INVALID` rows, plus normalized crime categories and contributing factors.
  4. Review flagged duplicates (`CREATE`, `MERGE`, or `SKIP`) and click **Commit Approved**.
  * *Safety note:* `MERGE` only fills blank fields on existing records and adds new source links—it never overwrites already-verified data.
* **Films & Documentaries (`/admin/film/add`):** Search TMDB, pull poster/credits/streaming providers, review, and save directly to the database.
* **Daily Podcast Pipeline (`/admin/podcasts`):** Automated RSS capture (`scripts/podcast_pipeline/daily_capture.py`) stages new episodes as `UNVERIFIED`; monitor feeds and recent episodes here.

### Stage 2: Verify & Curate (`/admin/verify`)
* Open the **Unified Validation Queue** to review pending records across **Individuals, Media Items, Media Works, Organizations, and Involved Persons** in one screen.
* Check attached primary source links, add optional review notes, and click **Verify**, **In Review**, **Dispute**, or **Full Edit**.

### Stage 3: Audit & Maintain (`/admin/audit` & `/admin/batches`)
* **Data Health (`/admin/audit`):** Periodically check scorecards for:
  * Individuals missing a primary source link, crime category, state, or contributing factors
  * Unlinked media items
  * Potential duplicate individuals (with a safe transactional **Merge** button that preserves all source links and relations)
* **Import Batch History (`/admin/batches`):** Track every committed `importBatchId`, **Bulk Verify** a fully trusted batch, or **Roll Back** (delete) a batch cleanly if a formatting issue slips through.

### Stage 4: Cross-Link, Cite & Publish (`/admin/manage/*` & `/adminsettings`)
* Use **`/admin/manage/individuals`** and **`/admin/manage/mediaitems`** to attach multi-select relations (**Contributing Factors**, **Organizations**, **Groups**, **Featured Individuals**) and manage **Primary Source Links** (`IndividualSourceLink`).
* Manage your citation catalog in **`/admin/manage/informationsources`**.
* Update homepage highlights (featured story, book, podcast, film, organization, factors) in **`/adminsettings`**.

---

## Part 2: Historical Seed Reference (Original Build Order 1–10)

This is the exact sequence and set of source files used in the original database build (archived in `server/prisma/seed_files/`). Keep this as your blueprint when deciding which layers to rebuild, re-verify, or re-source fresh.

| Order | Original Script | Source File(s) | Volume | Entities Populated | Primary Source / Provenance |
| :---: | :--- | :--- | :---: | :--- | :--- |
| **0** | `0seedCore.js` *(new)* | `server/utils/canonicalCatalog.js` | 16 factors, 45 crimes, 6 sources | `ContributingFactor`, `CrimeCategory`, `InformationSource` | Standardized NRE + Archive Catalog |
| **1** | `1seedNRE.js` | `exoneration_list_detailed.csv` | **4,123 rows** | `Individual`, `IndividualSourceLink` | National Registry of Exonerations |
| **2** | `2seedWikipedia.js` | `wrongful_convictions_summarized.csv` | **340 rows** | `Individual` (enriches summaries, dates, sentences, locations), `IndividualSourceLink` | Wikipedia (`List of wrongful convictions in the United States`) |
| **3** | `3groupseed.js` | `longgroup.csv` | **172 rows** | `IndividualGroup`, group memberships | Curated multi-defendant cases (e.g., Central Park Five, West Memphis Three, Tulia, Kern County, Wenatchee) |
| **4** | `4relationshipseed.js` | `connected_convictions_long_format.csv` | **111 rows** | `Individual` ↔ `Individual` (`relatedIndividuals`) | Curated co-defendant / connected conviction links |
| **5** | `5seedPodcasts.js` | `seed_files/podcasts/*.json` | **520 JSONs** | `MediaWork` (`PODCAST_SERIES`), `MediaItem` (`PODCAST_EPISODE`), `Individual`, `InvolvedPerson`, `Organization`, `ContributingFactor` links, `MediaItemSourceLink` | *Wrongful Conviction* podcast transcripts & AI summaries |
| **6** | `6seedBooks.js` | `seed_files/books/*.json` | **61 JSONs** | `MediaWork` (`BOOK`), `MediaItem` (`BOOK_CONTENT`), `Individual`, `InvolvedPerson`, `Organization`, `ContributingFactor` links | Curated book research files (`docs/media/books/research/`) |
| **7** | `7seedFilms.js` | `seed_files/films/*.json` | **82 JSONs** | `MediaWork` (`FILM`/`DOCUMENTARY`/`DOCUSERIES`), `MediaItem`, `Individual`, `InvolvedPerson`, `Organization`, `ContributingFactor` links | Curated film research files (`docs/media/film/research/`) |
| **8** | `8film_enhance.js` | `tmdb_data.csv` | **72 rows** | Enriches `MediaWork` with TMDB IDs (`externalId`), posters (`imagePath`), release years, directors, networks, TMDB summaries | TMDB API |
| **9** | `9news_seed.js` | `innocenceproject_news_processed.csv` | **1,694 rows** | `IndividualSourceLink` (articles + headlines linked to matching Individuals) | Innocence Project News Archive |
| **10** | `10books_enhanced.js` | `bookdata_enhanced.csv` | **60 rows** | Enriches `MediaWork` (`BOOK`) with ISBN-13 (`externalId`), covers, descriptions + creates `BookPurchaseDetails` | Google Books API |

### Important Lessons & Watch-Outs from the Original Seeds
When recreating any of these layers (via `/admin` or updated imports), keep these findings in mind:

1. **Seed #1 (NRE):** Every NRE row represents a formal exoneration — set `status = EXONERATED` and `claimStrength = FORMALLY_EXONERATED`, and ensure all 45 NRE crime categories are initialized first (Step 0) so `crimeCategoryId` maps cleanly. Consider pulling a fresh export from NRE if you want the newest exonerations since the original snapshot.
2. **Seed #2 (Wikipedia):** Wikipedia's `Crime` column contains ~90 messy free-text strings (`"Murder*"`, `"Arson, murder*"`, `"Murder of Jaclyn Dowaliby"`). Always normalize these through the 45 canonical crime categories (automatic in `/admin/import`) rather than creating new `CrimeCategory` rows.
3. **Seeds #5, #6, #7 (Podcasts, Books, Films JSONs):** The original 663 JSONs contain **3,181 distinct free-text contributing factor phrases** (e.g., `"Eyewitness misidentification"`, `"Brady violations"`, `"Ineffective assistance of counsel"`). The database now enforces the **16-item `ContributingFactorCode` enum**, so all legacy phrases must be mapped to the 16 canonical codes (handled by `resolveContributingFactorCodes()` in `server/utils/canonicalCatalog.js`).
4. **Seeds #8 & #10 (TMDB & Google Books Enrichment):**
   * The Prisma field is `sourcingCredit` (lowercase `s`), not `SourcingCredit`.
   * Never match books by hardcoded legacy `id` from `bookdata_enhanced.csv` — always match by `title` or `externalId` (ISBN-13).
   * For new films, prefer **`/admin/film/add`** (live TMDB search + automatic `StreamingProvider` persistence).
5. **Seed #9 (Innocence Project News):** Check `server/prisma/seed_files/unmatched_names_from_log.txt` for names that failed to match during the original run so they can be linked cleanly during verification.

---

## Part 3: Additional Research Backlogs (Not in Seeds 1–10)

These researched materials live in `docs/` and `scripts/` and can be added progressively through `/admin`:

* **Organizations (`docs/organizations/`):**
  * `innocence_projects/` (Innocence Project, California Innocence Project, NY Innocence Project, etc.)
  * `policy_reform/policy_reform_organizations.md`
  * `post_exoneration_support/`
  * `organization_basic_research_form.md`
* **New Podcast Leads (`docs/media/new podcasts.txt`):** *Dead Man Talking*, *Exoneration Nation*, *If Emmett Was Alive Today*, *Murderville* (Season 2).
* **Automated Podcast Feeds (`scripts/podcast_pipeline/feeds.json`):**
  * *Wrongful Conviction* (`active: true`)
  * *Undisclosed* (`active: false` — ready to enable)
  * *In the Dark* (`active: false` — ready to enable)
* **New Film / Video Leads (`docs/media/new_films.txt`):** ~14 TCADP documentaries, short films, NYT Opinion videos, and Bryan Stevenson's TED Talk (add via `/admin/film/add`).
* **Academic & Legal Publications (`docs/media/print/`):** `academic-sources-list.md`, `more-academic-sources.md`, `wrongful-convictions-additional-sources.md`.
* **Expanded Individuals (Non-Formally-Exonerated Cases):** Use `Individual.claimStrength` (`OFFICIAL_RELIEF_NO_EXONERATION`, `STRONG_NEW_EVIDENCE`, `CREDIBLE_CLAIM`) once editorial criteria are finalized.

---

## Part 4: Verification Checklist (Before Marking a Record `VERIFIED`)

Before flipping any record from `UNVERIFIED` / `IN_REVIEW` to `VERIFIED` in `/admin/verify`:

- [ ] **Identity & No Duplicate:** Confirmed name, disambiguation tag (if common name), and no duplicate in `/admin/audit`.
- [ ] **Primary Source Attached:** At least one credible primary citation (`IndividualSourceLink`, `sourceUrl`, or `website`) is linked and opens cleanly.
- [ ] **Controlled Fields Normalized:** `status`, `claimStrength`, `crimeCategoryId`, and `contributingFactors` (from the 16 canonical codes) are accurate.
- [ ] **AI Content Reviewed:** If `aiGenerated` is true (e.g., podcast summaries or scraped bios), facts, dates, and names have been human-checked against the primary source.
- [ ] **Cross-Links Wired:** Key organizations, groups/co-defendants, and media appearances are connected where applicable.

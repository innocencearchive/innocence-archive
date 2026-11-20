# Innocence Archive — Project Roadmap & To-Do List

> **Current Phase:** Core site features and `/admin` foundation are built. The database has been freshly wiped for a clean, well-validated rebuild.
> **Guiding Principle:** Build safe, repeatable validation and ingestion workflows directly into the on-site `/admin` tools so all future data entry, verification, and source tracking happens cleanly on-site rather than ad-hoc in code.

---

## Priority 1: On-Site Admin & Safe Data Workflow Tools
*Build the guardrails and admin workflows first so rebuilding and expanding the database is repeatable and safe.*

- [x] **Import Staging & Validation Queue (`/admin/import`)**: Build an intermediate staging/review workflow between scraped/batch data (NRE, Innocence Project news, CSV/JSON imports, podcast pipeline) and live publishing:
  - [x] Preview incoming records and flag potential duplicates / fuzzy name matches against existing DB entries before inserting.
  - [x] Validate and map controlled fields (e.g., 16-item `ContributingFactorCode` enum, `IndividualStatus`, `claimStrength`, `OrganizationType`, 45 canonical `CrimeCategory` values).
  - [x] Require or attach primary source provenance (`InformationSource` / `IndividualSourceLink`) during review.
  - [x] Approve, edit, or reject staged records cleanly into the live tables via `VerificationStatus` (`UNVERIFIED` → `IN_REVIEW` → `VERIFIED` / `DISPUTED`), plus one-click Core Lookup Table initialization (`ContributingFactor`, `CrimeCategory`, `InformationSource`).
- [x] **Finish On-Site Film Admin Tool (`AdminFilmPage.jsx`)**:
  - [x] Wire real `POST` / `PUT` calls to `/api/admin/mediaworks` (replaced simulated saves).
  - [x] Load existing film data from the DB when opening `/admin/film/edit/:id`.
  - [x] Persist `StreamingProvider` entries alongside `MediaWork`.
- [x] **Source Provenance in Admin CRUD**: Added `Information Sources` management (`/admin/manage/informationsources`) and inline Primary Source Links (view/add/delete `IndividualSourceLink`) inside the Individual edit modal.
- [ ] **Podcast Pipeline Review Workflow**: Confirm staged episodes from `scripts/podcast_pipeline` flow smoothly into the `/admin` unverified queue for review, cross-linking, and approval.

---

## Priority 2: Database Rebuild & Ordered Seeding
*Carefully repopulate the wiped database in a controlled sequence, validating data and source links at each step.*

### Step 0: Pre-Seed Preparation
- [ ] **Audit legacy seed scripts against current Prisma schema**: Update scripts in `server/prisma/seed_files/` for recent migrations (`ContributingFactorCode` 16-item enum, `VerificationStatus`, `claimStrength`, etc.) so all seeded records enter with accurate status (`UNVERIFIED` or `VERIFIED` by source tier) and proper source links.
- [ ] **Seed core reference/lookup tables**: Confirm `ContributingFactor` (16 canonical codes), `CrimeCategory`, and `InformationSource` records are initialized first.

### Ordered Seeding Sequence (`server/prisma/seed_files/`)
*Run and validate each step before moving to the next:*
- [ ] **1. National Registry of Exonerations** — `1seedNRE.js` (`exoneration_list_detailed.csv`)
- [ ] **2. Wikipedia Wrongful Convictions** — `2seedWikipedia.js` (`wrongful_convictions_summarized.csv`)
- [ ] **3. Individual Groups** — `3groupseed.js` (`longgroup.csv`)
- [ ] **4. Connected Convictions / Relationships** — `4relationshipseed.js` (`connected_convictions_long_format.csv`)
- [ ] **5. Podcasts** — `5seedPodcasts.js` (`seed_files/podcasts/`) *(resolve `OrganizationType` mapping TODO)*
- [ ] **6. Books** — `6seedBooks.js` (`seed_files/books/`) *(resolve `OrganizationType` & `crimeCategory` TODOs)*
- [ ] **7. Films & Documentaries** — `7seedFilms.js` (`seed_files/films/`)
- [ ] **8. Film Metadata & Streaming Enhancement** — `8film_enhance.js` (`tmdb_data.csv`)
- [ ] **9. Innocence Project News** — `9news_seed.js` (`innocenceproject_news_processed.csv`) *(review & resolve `unmatched_names_from_log.txt`)*
- [ ] **10. Book Metadata Enhancement** — `10books_enhanced.js` (`bookdata_enhanced.csv`)

### Post-Seed Validation & Missing Core Data
- [ ] **Organizations Data**: Import and verify researched organizations from `docs/organizations/` (not covered by scripts 1–10).
- [ ] **Audit & Cross-Reference**: Spot-check links between Individuals, MediaWorks/MediaItems, Organizations, and ContributingFactors in `/admin`.
- [ ] **Configure Homepage Featured Content**: Set featured individual, media, organization, and factors in `/adminsettings`.

---

## Priority 3: Ongoing Research & Content Expansion (Via `/admin`)
*Once the baseline database is rebuilt and validated, grow the archive using the on-site tools.*

- [ ] **Podcasts**:
  - [ ] Review and verify daily staged episodes from *Wrongful Conviction* in `/admin`.
  - [ ] Activate *Undisclosed* and *In the Dark* in `scripts/podcast_pipeline/feeds.json` when ready.
  - [ ] Evaluate and add leads from `docs/media/new podcasts.txt` (*Dead Man Talking*, *Exoneration Nation*, *If Emmett Was Alive Today*, *Murderville* S2).
- [ ] **Films & Documentaries**:
  - [ ] Review and add leads from `docs/media/new_films.txt` (TCADP list, NYT videos, TED talks) via `/admin/film/add`.
- [ ] **Organizations**:
  - [ ] Review `docs/organizations/` for gaps across innocence projects, legal advocacy, post-exoneration support, policy reform, and university clinics, and add via `/admin`.
- [ ] **Expanded Individuals (Non-Formally-Exonerated Cases)**:
  - [ ] Document clear editorial criteria for `InnocenceClaimStrength` tiers (`OFFICIAL_RELIEF_NO_EXONERATION`, `STRONG_NEW_EVIDENCE`, `CREDIBLE_CLAIM`).
  - [ ] Begin adding and verifying strong-claim cases via `/admin`.
- [ ] **Academic & Legal Publications**:
  - [ ] Define scope and level of detail for academic/legal research (`docs/media/print/`) and add entries via `/admin`.

---

## Priority 4: Finish Remaining App Placeholders & UI Polish
*Close out the remaining stubbed views and placeholder links in the live app.*

- [ ] **Real Recent Updates Feed (`server/routes/updates.js`)**: Replace the 5 hardcoded 2025 mock updates with a live database query (e.g., recently verified/published records or an `Updates` model).
- [ ] **Involved Person Profile (`OtherIndividualProfilePage.jsx`)**: Implement `otherSources` and `relatedPeople` derivation (currently empty placeholder arrays).
- [ ] **Footer Pages (`Footer.jsx`)**: Replace dead `#` links with real content/routes for **About** (drawing from `mission_statement.md`), **Contact**, **Privacy Policy**, and **License (MIT)**.
- [ ] **Component Polish**:
  - [ ] `KeyInfo.jsx` — link each contributing factor badge to its `/factor/:id` page.
  - [ ] `LearnMoreGrid.jsx` — finalize categorization for `ARTICLE` / `OTHER` media item types.
  - [ ] `RelatedWrongfullyConvictedList.jsx` — display relationship type labels.
  - [ ] `BookPurchaseInfo.jsx` — refine Amazon purchase link handling if direct URLs are stored.

---

## Priority 5: Security & Repo Housekeeping
*Quick technical cleanup items.*

- [ ] **Restrict CORS for production (`server/server.js`)**: Replace open `app.use(cors())` with an explicit allowed-origins list from environment variables.
- [ ] **Remove stray root file**: Delete accidental git log dump `dfsdf` at repo root.
- [x] **Fix duplicate route (`newclient/src/App.jsx`)**: Remove the duplicate `<Route path="/login" ... />` entry.
- [ ] **Clean up obsolete code/docs**:
  - [ ] Remove unused `newclient/src/components/MockData.jsx` if no longer referenced.
  - [ ] Clean up outdated `TODO: Add POST/PUT/DELETE` comments in public `server/routes/*.js` files (superseded by `/api/admin`).
  - [ ] Update `README.txt` (or replace with a current `README.md`) to reflect the actual `newclient/`, `server/`, and `scripts/podcast_pipeline/` architecture.

---

## Later / Future Roadmap
*Features to revisit once the database is solid and admin workflows are humming.*

- [ ] **Data Visualizations & Analytics**: Interactive maps, timeline charts, and systemic contributing-factor breakdowns (replacing the early prototypes in `docs/website planning/`).
- [ ] **Enhanced Search & Filtering**: Multi-facet filtering across individuals, media, organizations, states, and contributing factors.
- [ ] **Public / Researcher API**: Documented read-only API endpoints for journalists and researchers.
- [ ] **Community Engagement**:
  - [ ] "Suggest a Correction" / public submission form (`PageNavigationButtons.jsx` placeholder) feeding into the `/admin` staging queue.
  - [ ] Newsletter / update digest system.
  - [ ] Partner organization outreach.

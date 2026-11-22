# Films, Series & Streaming Bundle — Data Hygiene Audit Report

## Summary
- **Total normalized MediaWorks in bundle:** 75 (47 from 82 researched JSONs + 28 TMDB-only titles)
- **Work types:** DOCUMENTARY: 39 · TV_SERIES: 14 · FILM: 6 · DOCUSERIES: 16
- **Total researched MediaItems / Episodes:** 82
- **Broken parenthetical TV series titles auto-fixed:** 21
- **Works with TMDB poster:** 66 / 75
- **Works with US streaming links (Watchmode):** 53 (167 total streaming provider rows)
- **Featured Individuals extracted:** 139 (skipped 3 invalid/placeholder)
- **Other Involved Persons extracted (deduped against exonerees):** 62
- **Works flagged with review warnings:** 24 (7 defaulted to `SKIP` in /admin/import)

## Hard-Blocked / Excluded Bad TMDB Rows
- **MythBusters** (TMDB `#1428`): Unrelated TV show (MythBusters) — excluded from Innocence Archive bundle.
- **The Suspect** (TMDB `#157062`): Wrong TMDB match (2022 UK clinical psychologist thriller) — blocked from attaching to Amar Wala's "The Suspect" documentary.

## Flagged `SKIP` by Default (Verify Before Committing)
- **Accused** (`TV_SERIES`, TMDB `#32940`): Editorial check: "Accused" (2010) is a fictional UK anthology drama rather than a real wrongful-conviction case.
- **Forensic Files** (`TV_SERIES`, TMDB `#11105`): Editorial check: "Forensic Files" is a general true-crime forensics series (not wrongful-conviction focused).
- **Rectify** (`TV_SERIES`, TMDB `#NONE`): Missing TMDB externalId in tmdb_data.csv — verify TMDB ID before committing.
- **Stephen** (`TV_SERIES`, TMDB `#132378`): Editorial check: "Stephen" (2021) is a UK drama about the Stephen Lawrence murder investigation, not a wrongful conviction.
- **The Wrong Man: 17 Years Behind Bars** (`DOCUMENTARY`, TMDB `#1294456`): Incomplete TMDB metadata (blank summary) and possible duplicate of "The Wrong Man? 20 Years Behind Bars" (#1423329).
- **The Wrong Man? 20 Years Behind Bars** (`DOCUMENTARY`, TMDB `#1423329`): Missing TMDB poster and possible duplicate of "The Wrong Man: 17 Years Behind Bars" (#1294456). | No TMDB poster imagePath in CSV.
- **Unlocking the Truth** (`TV_SERIES`, TMDB `#67464`): WRONG TMDB MATCH: TMDB #67464 ("Love, lust, murder, mystery, suspense...") is NOT the MTV/Ryan Ferguson "Unlocking the Truth" docuseries, and has no poster. | No TMDB poster imagePath in CSV.

## Other Review Warnings (Keep or Edit During Verification)
- **20/20** (`TV_SERIES`): Normalized parenthetical series title from legacy JSON ("Wrong Man (20/20)" -> "20/20").
- **3 ½ Minutes, 10 Bullets** (`DOCUMENTARY`): 0 wrongfully convicted individuals linked — verify whether this is a broader criminal-justice title or needs case links added.
- **48 Hours** (`TV_SERIES`): Normalized parenthetical series title from legacy JSON ("Reasonable Doubt (48 Hours)" -> "48 Hours").
- **60 Minutes** (`TV_SERIES`): Skipped placeholder/invalid individual "Unknown Prisoner" from 1.7.shon_hopwood.json.
- **CNN Special Report** (`TV_SERIES`): Normalized parenthetical series title from legacy JSON ("Sole Survivor (CNN Special Report)" -> "CNN Special Report").
- **Crime + Punishment** (`DOCUMENTARY`): 0 wrongfully convicted individuals linked — verify whether this is a broader criminal-justice title or needs case links added.
- **Dateline NBC** (`TV_SERIES`): Normalized parenthetical series title from legacy JSON ("The Carrollton Plot (Dateline NBC)" -> "Dateline NBC"). | Skipped placeholder/invalid individual "Various individuals" from 4.3.the_wrong_man.json.
- **Nightline** (`TV_SERIES`): Normalized parenthetical series title from legacy JSON ("Conviction (Nightline)" -> "Nightline").
- **PBS NewsHour** (`TV_SERIES`): Normalized parenthetical series title from legacy JSON ("Broken Justice (PBS NewsHour Report)" -> "PBS NewsHour"). | Skipped placeholder/invalid individual "Various exonerees" from 8.1.broken_justice.json.
- **Serpico** (`FILM`): Filename says "frank_serpico" (2017 doc, TMDB #454192) but JSON describes the 1973 Sidney Lumet film "Serpico". Did not attach 2017 TMDB data — verify which film you want. | 0 wrongfully convicted individuals linked — verify whether this is a broader criminal-justice title or needs case links added.
- **Strong Island** (`DOCUMENTARY`): 0 wrongfully convicted individuals linked — verify whether this is a broader criminal-justice title or needs case links added.
- **The Art of the Confession** (`DOCUMENTARY`): No TMDB match in tmdb_data.csv — missing poster/TMDB ID (can enrich via /admin/film/add or TMDB lookup).
- **The Seven Five** (`DOCUMENTARY`): 0 wrongfully convicted individuals linked — verify whether this is a broader criminal-justice title or needs case links added.
- **The Suspect** (`DOCUMENTARY`): TMDB #157062 ("The Suspect" 2022 UK thriller) was a WRONG match and blocked. Needs correct TMDB lookup/poster for Amar Wala's documentary on Hassan Diab.
- **The Witness** (`DOCUMENTARY`): 0 wrongfully convicted individuals linked — verify whether this is a broader criminal-justice title or needs case links added.
- **I Am Innocent** (`DOCUSERIES`): No TMDB poster imagePath in CSV.
- **Incendiary: The Willingham Case** (`DOCUMENTARY`): No TMDB poster imagePath in CSV.

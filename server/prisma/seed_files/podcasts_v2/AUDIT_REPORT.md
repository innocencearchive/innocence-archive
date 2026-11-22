# Podcast Series Bundle Audit Report (`podcasts_v2`)

Generated: 2026-11-22T20:21:02.853Z

## Scope
- **Series metadata ONLY (`MediaWork` with `workType: "PODCAST_SERIES"`)** — **0 episodes**, **0 individuals**, **0 organizations** imported from this bundle.
- Existing live DB record **#1 (`Wrongful Conviction`, with Episode #600)** is matched automatically and set to **MERGE** (fills blank artwork, launch year, summary, focus, `externalId`, and Apple Podcasts URL without touching Episode #600).

## Sources Audited & Deduplicated
- `docs/media/podcasts/*_research.md` & `Undisclosed_final.md` (15 files → 14 unique shows; `Undisclosed_final.md` and `Undisclosed_research.md` deduplicated)
- `docs/media/podcasts/podcast_list_template.md` (38 entries; deduplicated #18 into #11 and #20 with `media_sources (1).md` #4)
- `docs/media/new podcasts.txt` (4 entries)
- `docs/media/media_sources (1).md` (5 entries)
- `scripts/podcast_pipeline/feeds.json` (3 entries)
- `server/prisma/seed_files/podcasts/` (520 legacy JSONs scanned — confirmed all belong to *Wrongful Conviction* + its *False Confessions*, *Junk Science*, and *Maggie Freleng* sub-series)

## Summary Metrics
- **Total unique series entries in bundle:** 42
- **Recommended CREATE / MERGE (Core Wrongful-Conviction Series):** 29
- **Recommended SKIP — Broader True-Crime / Legal / Prison Shows:** 6
- **Recommended SKIP — Sub-Series / Duplicate-Feed Entries:** 3
- **Recommended SKIP — Confirmed Hallucinations / Book-as-Podcast Errors:** 4
- **Verified on Apple Podcasts API:** 30/42
- **High-Res Cover Artwork (600x600 `imagePath`):** 32/42
- **Verified Public RSS Feed URLs captured:** 30/42

## 1. Confirmed Hallucinations & Non-Podcasts (Default: `SKIP`)
| Title | Source | Finding |
| --- | --- | --- |
| **Rectify: The Power of Restorative Justice** | docs/media/podcasts/podcast_list_template.md (#38) | NOT A PODCAST (BOOK MISCLASSIFIED — default SKIP): "Rectify: The Power of Restorative Justice After Wrongful Conviction" is a 2018 book by Lara Bazelon, not a podcast series. |
| **The 97%** | docs/media/podcasts/podcast_list_template.md (#35) | LIKELY AI HALLUCINATION (default SKIP): No UK wrongful-conviction podcast called "The 97%" exists; Benjamin Fitton actually hosts "They Walk Among Us". |
| **The Innocents** | docs/media/podcasts/podcast_list_template.md (#36) | UNVERIFIABLE / LIKELY AI HALLUCINATION (default SKIP): No wrongful-conviction podcast titled "The Innocents" was found on Apple Podcasts or web directories. |
| **Lawless** | docs/media/podcasts/podcast_list_template.md (#25) | UNVERIFIED / LIKELY AI CONFUSION (default SKIP): No Australian wrongful-conviction podcast called "Lawless" exists (may have been confused with Missouri's "The Lawless Files" about exoneree Josh Kezer). |

## 2. Sub-Series & Duplicate-Feed Entries (Default: `SKIP`)
| Title | Source | Finding |
| --- | --- | --- |
| **Wrongful Conviction: False Confessions** | docs/media/podcasts/Wrongful Conviction_ False Confessions_research.md; docs/media/podcasts/podcast_list_template.md (#11); docs/media/podcasts/podcast_list_template.md (#18 duplicate: "False Confessions with Laura Nirider & Steve Drizin"); server/prisma/seed_files/podcasts/ (44 legacy episode JSONs) | SUB-SERIES FEED OVERLAP (default SKIP): Distributed inside the main "Wrongful Conviction" RSS feed (Apple ID #1151670380) rather than as a separate Apple Podcasts feed. Switch to CREATE if you want it listed as its own distinct series alongside "Wrongful Conviction". Deduplicated template #18 ("False Confessions with Laura Nirider & Steve Drizin") into this entry. |
| **Wrongful Conviction: Junk Science** | docs/media/podcasts/podcast_list_template.md (#15); server/prisma/seed_files/podcasts/ (24 legacy episode JSONs) | SUB-SERIES FEED OVERLAP (default SKIP): Distributed inside the main "Wrongful Conviction" RSS feed (Apple ID #1151670380) rather than as a separate Apple Podcasts feed. Switch to CREATE if you want it listed as its own distinct series alongside "Wrongful Conviction". |
| **Wrongly Convicted with Maggie Freleng** | docs/media/podcasts/podcast_list_template.md (#34); server/prisma/seed_files/podcasts/ (60 legacy episode JSONs on main feed) | LIKELY DUPLICATE / MISNAMED (default SKIP): No standalone podcast titled "Wrongly Convicted with Maggie Freleng" exists — Maggie Freleng hosted episodes on the main "Wrongful Conviction" feed (#1151670380) and hosted the separate podcast "Unjust & Unsolved" (included above). |

## 3. Broader Scope Shows — Not Primarily Wrongful-Conviction Focused (Default: `SKIP`)
| Title | Host(s) | Apple ID | Note |
| --- | --- | --- | --- |
| **Someone Knows Something** | David Ridgen | 1089216339 | Editorial check (default SKIP): Primarily a cold-case / missing-persons podcast; only Seasons 5–6 involve flawed-conviction angles. Switch to CREATE if you want it included. |
| **Hell and Gone** | Catherine Townsend | 1437808691 | Editorial check (default SKIP): Primarily an unsolved-murder / cold-case series (only Season 2 touches a disputed conviction). Switch to CREATE if desired. |
| **The Docket** | Michael Spratt, Emilie Taman | 873244552 | Editorial check (default SKIP): General Canadian legal/policy commentary podcast rather than a dedicated wrongful-conviction series. Switch to CREATE if desired. |
| **Ear Hustle** | Earlonne Woods, Nigel Poor | 1240841298 | Editorial check (default SKIP): Acclaimed prison-life podcast, but NOT specifically focused on wrongful convictions. Switch to CREATE if you want broader incarceration media included. |
| **Court Junkie** | Jillian Jalali | 1144137857 | Editorial check (default SKIP): General true-crime / courtroom podcast covering mostly guilty verdicts and trials, only occasionally wrongful convictions. Switch to CREATE if desired. |
| **Jensen & Holes: The Murder Squad** | Paul Holes, Billy Jensen | None | Editorial check (default SKIP): Unsolved cold-case / citizen-sleuth show — NOT a wrongful-conviction podcast, and canceled/removed from Apple Podcasts in 2022. |

## 4. Core Wrongful-Conviction Series (Default: `CREATE` / `MERGE`)
| # | Title | Host(s) | Year | Apple ID | Art | Notes / Warnings |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Wrongful Conviction** | Jason Flom | 2016 | 1151670380 | Yes | Already exists in live DB (MediaWork #1 with Episode #600). MERGE will fill blank artwork, launch year, summary, focus, externalId, and Apple URL without touching existing episodes. |
| 2 | **Undisclosed** | Rabia Chaudry, Susan Simpson, Colin Miller | 2015 | 984987791 | Yes | Deduplicated Undisclosed_final.md and Undisclosed_research.md into a single series record. Apple Podcasts currently lists the feed under "Undisclosed: Toward Justice". |
| 3 | **In the Dark** | Madeleine Baran | 2016 | 1148175292 | Yes | Normalized title from "In the Dark (Season 2)" to parent series "In the Dark" (Season 2 covers Curtis Flowers; Season 1 covers Jacob Wetterling; Season 3 covers Haditha). |
| 4 | **Serial** | Sarah Koenig | 2014 | 917918570 | Yes | Normalized title from "Serial (Season 1)" to parent series "Serial" (Season 1 focuses on Adnan Syed's disputed conviction; later seasons cover other criminal justice and journalism topics). |
| 5 | **Bone Valley** | Gilbert King | 2022 | 1643974551 | Yes | Updated summary from 2022 research file: Leo Schofield was granted parole and released from prison on April 30, 2024 (research markdown still stated he remained incarcerated). |
| 6 | **Earwitness** | Beth Shelburne | 2023 | 1707026865 | Yes | Clean |
| 7 | **Broken Justice** | Amna Nawaz, Frank Carlson, Vika Aronson | 2019 | 1485498774 | Yes | Clean |
| 8 | **Truth & Justice with Bob Ruff** | Bob Ruff | 2015 | 990753230 | Yes | Clean |
| 9 | **Proof: A True Crime Podcast** | Susan Simpson, Jacinda Davis | 2022 | 1611647977 | Yes | Clean |
| 10 | **Unjust & Unsolved** | Maggie Freleng | 2020 | 1527777879 | Yes | Apple Podcasts feed (id1527777879) currently lists only 3 remaining tracks from the original 22-episode 2020–2021 run; some older episodes may be archived or behind Patreon. |
| 11 | **For the Innocent** | Michael Semanchik | 2023 | 1665246294 | Yes | Clean |
| 12 | **California Innocence Project Podcast** | California Innocence Project | 2018 | None | No | No active Apple Podcasts listing found (2018 13-episode limited series archived on Podchaser/CIP; no official Apple cover artwork URL). |
| 13 | **The Innocence Podcast** | Kylie Pentelow, Claire McGourlay | 2022 | 1615808386 | Yes | Normalized title from "The Innocence Project Podcast" (filename/list #20) to its true title "The Innocence Podcast" — this is the UK Manchester Innocence Project show (innocence.fm), NOT the U.S. Innocence Project. |
| 14 | **Criminal (In)justice** | David Harris | 2015 | 1094352910 | Yes | Clean |
| 15 | **SIXTH HOUR: The Wrongful Conviction of Brendan Dassey** | Tracy Keogh | 2020 | 1512638999 | Yes | Clean |
| 16 | **Choppin' It Up With Jimmie C. -- Life After Wrongful Conviction** | Jimmie C. Gardner | 2020 | 1521492486 | Yes | Trimmed trailing keywords (", Exonerated, Mass Exoneration") from template #19 to match the official Apple Podcasts series title. |
| 17 | **Actual Innocence** | Brooke Gittings | 2016 | 1102237078 | Yes | Clean |
| 18 | **Righteous Convictions with Jason Flom** | Jason Flom | 2021 | 1557315056 | Yes | Normalized title from "Wrongful Conviction with Jason Flom: Righteous Convictions" to its official standalone Apple Podcasts title "Righteous Convictions with Jason Flom". |
| 19 | **13 Alibis** | Dan Slepian | 2019 | 1463081342 | Yes | Clean |
| 20 | **Wrongly Accused: The Annette Hewins Story** | BBC Radio Wales | 2024 | 1733285319 | Yes | Normalized title from "Wrongly Accused: The Annette Hewins case" to official BBC/Apple title "Wrongly Accused: The Annette Hewins Story". |
| 21 | **Dead Man Talking** | Alex Hannaford | 2018 | 1436700030 | Yes | Clean |
| 22 | **Murderville** | Liliana Segura, Jordan Smith | 2018 | 1443674380 | Yes | Clean |
| 23 | **If Emmett Was Alive Today Podcast** | Daphine Priscilla Brown Jack | 2019 | 1487054857 | Yes | Clean |
| 24 | **Empire on Blood** | Steve Fishman | 2018 | 1734312219 | Yes | Originally released via Panoply in 2018; now distributed on Apple Podcasts under Steve Fishman's umbrella feed "The Burden" (id1734312219, Orbit Media). |
| 25 | **Accused** | Amber Hunt | 2016 | 1145990861 | Yes | Clean |
| 26 | **Aggravating Circumstances** | Laura Szeremi | 2020 | None | No | Verified on Podchaser, but no active Apple Podcasts feed/ID found (no official Apple cover artwork URL available). |
| 27 | **Conviction** | Saki Knafo, Gimlet Media | 2019 | None | No | Gimlet/Spotify Original podcast — not indexed on Apple Podcasts Lookup API (no Apple cover artwork URL). |
| 28 | **Exoneration Nation** | Christopher Scott | 2019 | None | No | Verified via Acast / TCADP, but no active Apple Podcasts listing found (no Apple cover artwork URL). |
| 29 | **The Appeal** | The Appeal | 2018 | 1392667248 | Yes | Editorial note: Covers broader criminal justice policy and reform in addition to wrongful convictions. |

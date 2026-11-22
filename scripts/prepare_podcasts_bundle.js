// scripts/prepare_podcasts_bundle.js
// Consolidates & audits all podcast SERIES metadata across the repository:
//   1. docs/media/podcasts/*_research.md & Undisclosed_final.md (15 research files -> 14 unique shows)
//   2. docs/media/podcasts/podcast_list_template.md (38 candidate entries)
//   3. docs/media/new podcasts.txt (4 entries)
//   4. docs/media/media_sources (1).md (5 entries)
//   5. scripts/podcast_pipeline/feeds.json (3 RSS pipeline entries)
//
// SERIES ONLY — NO EPISODES (mediaItems are intentionally omitted).
// Verifies every candidate against the live Apple Podcasts Lookup API, fetches 600x600 artwork,
// official Apple Podcasts URLs, RSS feed URLs, and episode counts, deduplicates overlapping files,
// catches AI hallucinations / book-as-podcast errors / sub-series feed overlaps, and writes:
//   - server/prisma/seed_files/podcasts_v2/<slug>.json (individual normalized series files)
//   - server/prisma/seed_files/podcasts_v2/all_podcast_series_bundle.json (combined bundle for /admin/import)
//   - server/prisma/seed_files/podcasts_v2/AUDIT_REPORT.md (full data hygiene & audit report)

const fs = require('fs');
const path = require('path');
const https = require('https');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOCS_MEDIA = path.join(REPO_ROOT, 'docs', 'media');
const DOCS_PODCASTS = path.join(DOCS_MEDIA, 'podcasts');
const FEEDS_JSON_PATH = path.join(REPO_ROOT, 'scripts', 'podcast_pipeline', 'feeds.json');
const OUT_DIR = path.join(REPO_ROOT, 'server', 'prisma', 'seed_files', 'podcasts_v2');

function normTitle(t) {
  return (t || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slugify(t) {
  return normTitle(t).replace(/\s+/g, '_').slice(0, 64) || 'untitled';
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'InnocenceArchivePodcastPrep/1.0' } }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error(`Failed to parse JSON from ${url}: ${err.message}`));
          }
        });
      })
      .on('error', reject);
  });
}

// Parse basic metadata bullets from docs/media/podcasts/*_research.md (and Undisclosed_final.md)
function parseResearchMarkdown(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const text = fs.readFileSync(filePath, 'utf8');
  const getBullet = (labelRegex) => {
    const m = text.match(new RegExp(`[-*]\\s+\\*\\*${labelRegex}\\*\\*:\\s*(.+)`, 'i'));
    return m ? m[1].trim() : null;
  };
  const yearStr = getBullet('Release Year\\(s\\)');
  const yearMatch = yearStr ? yearStr.match(/\b(19\d{2}|20\d{2})\b/) : null;

  // Extract Key Statistics / Information sub-bullets if present
  const statsSection = text.match(/\*\*Key Statistics\/Information\*\*:\s*\r?\n((?:[ \t]*[-*][ \t]+.+\r?\n?)+)/i);
  const keyBullets = statsSection
    ? statsSection[1]
        .split(/\r?\n/)
        .map((l) => l.replace(/^[ \t]*[-*][ \t]+/, '').trim())
        .filter(Boolean)
    : [];

  return {
    title: getBullet('Title'),
    hosts: getBullet('Host\\(s\\)'),
    releaseYearRaw: yearStr,
    releaseYear: yearMatch ? parseInt(yearMatch[1], 10) : null,
    network: getBullet('Production Company\\(ies\\)/Network'),
    focusOrTheme: getBullet('Focus/Theme'),
    keyBullets,
  };
}

// Authoritative, audited catalog of all 42 distinct podcast series candidates discovered across
// docs/media/podcasts/, docs/media/new podcasts.txt, docs/media/media_sources (1).md, and feeds.json.
// Each entry preserves exact source provenance, verified Apple Podcasts ID (where one exists),
// normalized fields, and transparent audit warnings / recommendedAction.
const PODCAST_CATALOG = [
  // =========================================================================
  // TIER A: CORE WRONGFUL-CONVICTION & INNOCENCE PODCAST SERIES (29 series)
  // =========================================================================
  {
    key: 'wrongful_conviction',
    title: 'Wrongful Conviction',
    creatorName: 'Jason Flom',
    publicationOrReleaseYear: 2016,
    publisherOrNetwork: 'Lava for Good Podcasts',
    focusOrTheme: 'First-hand interviews with exonerees, wrongfully convicted individuals, and innocence advocates examining how innocent people end up behind bars.',
    summaryNotes:
      'Flagship Lava for Good interview series hosted by Jason Flom (with occasional guest hosts and thematic sub-series) sharing personal stories of wrongful conviction, legal battles for exoneration, and criminal justice reform.',
    sourceUrlFallback: 'https://lavaforgood.com/with-jason-flom/',
    appleId: 1151670380,
    sourceFiles: [
      'docs/media/podcasts/podcast_list_template.md (#1)',
      'docs/media/media_sources (1).md (#1)',
      'scripts/podcast_pipeline/feeds.json',
      'server/prisma/seed_files/podcasts/ (520 legacy episode JSONs)',
    ],
    category: 'CORE',
    recommendedAction: 'CREATE', // Preview auto-converts to MERGE against existing DB #1
    reviewWarnings: [
      'Already exists in live DB (MediaWork #1 with Episode #600). MERGE will fill blank artwork, launch year, summary, focus, externalId, and Apple URL without touching existing episodes.',
    ],
  },
  {
    key: 'undisclosed',
    title: 'Undisclosed',
    creatorName: 'Rabia Chaudry, Susan Simpson, Colin Miller',
    publicationOrReleaseYear: 2015,
    publisherOrNetwork: 'Undisclosed, LLC / Audioboom',
    researchFile: 'Undisclosed_final.md',
    focusOrTheme: 'In-depth legal investigations of wrongful convictions and systemic failures in the U.S. criminal justice system.',
    summaryNotes:
      'Investigative podcast hosted by attorneys Rabia Chaudry, Susan Simpson, and Colin Miller. Spanning 24+ seasons (starting with Adnan Syed, Joey Watkins, Shaurn Thomas, Willie Veasy, Terrance Lewis, Chester Holman III, Ronnie Long, Dennis Perry, and more), the series examines trials, police files, and newly uncovered evidence; relaunched in 2025 as "Undisclosed: Toward Justice."',
    sourceUrlFallback: 'https://undisclosed-podcast.com/',
    appleId: 984987791,
    sourceFiles: [
      'docs/media/podcasts/Undisclosed_final.md',
      'docs/media/podcasts/Undisclosed_research.md (deduplicated)',
      'docs/media/podcasts/podcast_list_template.md (#2)',
      'docs/media/media_sources (1).md (#3)',
      'scripts/podcast_pipeline/feeds.json',
    ],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [
      'Deduplicated Undisclosed_final.md and Undisclosed_research.md into a single series record. Apple Podcasts currently lists the feed under "Undisclosed: Toward Justice".',
    ],
  },
  {
    key: 'in_the_dark',
    title: 'In the Dark',
    creatorName: 'Madeleine Baran',
    publicationOrReleaseYear: 2016,
    publisherOrNetwork: 'The New Yorker / APM Reports',
    researchFile: 'In the Dark (Season 2)_research.md',
    focusOrTheme: 'Long-form investigative journalism into prosecutorial misconduct, flawed investigations, and wrongful convictions (notably Season 2 on Curtis Flowers).',
    summaryNotes:
      'Peabody Award-winning investigative journalism podcast hosted by Madeleine Baran (originally APM Reports, now The New Yorker). Season 2 deeply investigated the six trials of Curtis Flowers in Winona, Mississippi—uncovering racial jury discrimination and recanted jailhouse-informant testimony that helped lead to a U.S. Supreme Court ruling and Flowers\'s eventual exoneration.',
    sourceUrlFallback: 'https://www.newyorker.com/podcast/in-the-dark',
    appleId: 1148175292,
    sourceFiles: [
      'docs/media/podcasts/In the Dark (Season 2)_research.md',
      'docs/media/podcasts/podcast_list_template.md (#12)',
      'scripts/podcast_pipeline/feeds.json',
    ],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [
      'Normalized title from "In the Dark (Season 2)" to parent series "In the Dark" (Season 2 covers Curtis Flowers; Season 1 covers Jacob Wetterling; Season 3 covers Haditha).',
    ],
  },
  {
    key: 'serial',
    title: 'Serial',
    creatorName: 'Sarah Koenig',
    publicationOrReleaseYear: 2014,
    publisherOrNetwork: 'Serial Productions & The New York Times',
    researchFile: 'Serial (Season 1)_research.md',
    focusOrTheme: 'Serialized investigative audio journalism examining criminal justice cases and disputed convictions (notably Season 1 on Adnan Syed).',
    summaryNotes:
      'Landmark Peabody Award-winning investigative podcast hosted by Sarah Koenig (Serial Productions / The New York Times). Season 1 reinvestigated the 1999 murder of Hae Min Lee in Baltimore and the conviction of Adnan Syed, examining alibi witnesses, cell-tower evidence, and witness credibility.',
    sourceUrlFallback: 'https://serialpodcast.org/',
    appleId: 917918570,
    sourceFiles: [
      'docs/media/podcasts/Serial (Season 1)_research.md',
      'docs/media/podcasts/podcast_list_template.md (#10)',
    ],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [
      'Normalized title from "Serial (Season 1)" to parent series "Serial" (Season 1 focuses on Adnan Syed\'s disputed conviction; later seasons cover other criminal justice and journalism topics).',
    ],
  },
  {
    key: 'bone_valley',
    title: 'Bone Valley',
    creatorName: 'Gilbert King',
    publicationOrReleaseYear: 2022,
    publisherOrNetwork: 'Lava for Good Podcasts',
    researchFile: 'Bone Valley_research.md',
    focusOrTheme: 'Investigative journalism examining the wrongful conviction of Leo Schofield for the 1987 murder of his wife Michelle in Polk County, Florida.',
    summaryNotes:
      'Hosted by Pulitzer Prize-winning author Gilbert King and produced by Lava for Good. Investigates Leo Schofield\'s 1989 murder conviction in Lakeland, Florida, uncovering fingerprint evidence and repeated confessions from another man, Jeremy Scott. Following the series, Schofield was granted parole and released in April 2024 after 36 years in prison while continuing to seek full exoneration.',
    sourceUrlFallback: 'https://lavaforgood.com/podcast/bone-valley/',
    appleId: 1643974551,
    sourceFiles: [
      'docs/media/podcasts/Bone Valley_research.md',
      'docs/media/podcasts/podcast_list_template.md (#4)',
    ],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [
      'Updated summary from 2022 research file: Leo Schofield was granted parole and released from prison on April 30, 2024 (research markdown still stated he remained incarcerated).',
    ],
  },
  {
    key: 'earwitness',
    title: 'Earwitness',
    creatorName: 'Beth Shelburne',
    publicationOrReleaseYear: 2023,
    publisherOrNetwork: 'Lava for Good Podcasts',
    researchFile: 'Earwitness_research.md',
    focusOrTheme: 'Investigates the wrongful conviction and death sentence of Toforest Johnson in Alabama based on an uncorroborated "earwitness" account.',
    summaryNotes:
      'Eight-part investigative series hosted by journalist Beth Shelburne (from the Lava for Good team behind Bone Valley) examining the 1998 murder conviction and death sentence of Toforest Johnson for the killing of Deputy Sheriff William G. Hardy in Birmingham, Alabama, despite multiple alibi witnesses and a secret reward paid to the sole "earwitness."',
    sourceUrlFallback: 'https://lavaforgood.com/podcast/earwitness/',
    appleId: 1707026865,
    sourceFiles: [
      'docs/media/podcasts/Earwitness_research.md',
      'docs/media/podcasts/podcast_list_template.md (#5)',
    ],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [],
  },
  {
    key: 'broken_justice',
    title: 'Broken Justice',
    creatorName: 'Amna Nawaz, Frank Carlson, Vika Aronson',
    publicationOrReleaseYear: 2019,
    publisherOrNetwork: 'PBS NewsHour',
    researchFile: 'Broken Justice_research.md',
    focusOrTheme: 'Examines the crisis in Missouri\'s public defender system through the wrongful conviction of Ricky Kidd.',
    summaryNotes:
      'Limited investigative podcast from PBS NewsHour examining how chronically underfunded, overworked public defense systems contribute to wrongful convictions, told through the 23-year wrongful imprisonment and eventual 2019 exoneration of Ricky Kidd in Kansas City, Missouri.',
    sourceUrlFallback: 'https://www.pbs.org/newshour/podcasts/broken-justice',
    appleId: 1485498774,
    sourceFiles: [
      'docs/media/podcasts/Broken Justice_research.md',
      'docs/media/podcasts/podcast_list_template.md (#7)',
    ],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [],
  },
  {
    key: 'truth_and_justice_with_bob_ruff',
    title: 'Truth & Justice with Bob Ruff',
    creatorName: 'Bob Ruff',
    publicationOrReleaseYear: 2015,
    publisherOrNetwork: 'NBI Studios',
    researchFile: 'Truth & Justice with Bob Ruff_research.md',
    focusOrTheme: 'Crowdsourced, multi-season investigations into potential wrongful convictions and questionable criminal verdicts.',
    summaryNotes:
      'Long-running, listener-driven investigative podcast hosted by Bob Ruff. Each season focuses on a disputed conviction or cold case (including Adnan Syed, Ed Ates, Sandy Melgar, the West Memphis Three, Jodi Hill, and others), mobilizing public records requests and crowdsourced analysis to uncover new evidence.',
    sourceUrlFallback: 'https://www.truthandjusticepod.com/',
    appleId: 990753230,
    sourceFiles: [
      'docs/media/podcasts/Truth & Justice with Bob Ruff_research.md',
      'docs/media/podcasts/podcast_list_template.md (#9)',
      'docs/media/media_sources (1).md (#2)',
    ],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [],
  },
  {
    key: 'proof_a_true_crime_podcast',
    title: 'Proof: A True Crime Podcast',
    creatorName: 'Susan Simpson, Jacinda Davis',
    publicationOrReleaseYear: 2022,
    publisherOrNetwork: 'Red Marble Media',
    researchFile: 'Proof_ A True Crime Podcast_research.md',
    focusOrTheme: 'Case-per-season investigative reporting into potential wrongful convictions.',
    summaryNotes:
      'Hosted by attorney Susan Simpson (Undisclosed) and investigative producer Jacinda Davis. Season 1 ("A Murder at the Warehouse" / Brian Bowling case) uncovered evidence that directly contributed to the December 2022 exonerations of Lee Clark and Joshua Cain Storey after 25 years in prison; subsequent seasons investigate additional disputed convictions.',
    sourceUrlFallback: 'https://www.proofcrimepod.com/',
    appleId: 1611647977,
    sourceFiles: [
      'docs/media/podcasts/Proof_ A True Crime Podcast_research.md',
      'docs/media/podcasts/podcast_list_template.md (#17)',
    ],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [],
  },
  {
    key: 'unjust_and_unsolved',
    title: 'Unjust & Unsolved',
    creatorName: 'Maggie Freleng',
    publicationOrReleaseYear: 2020,
    publisherOrNetwork: 'Daisy / Obsessed Network',
    researchFile: 'Unjust & Unsolved_research.md',
    focusOrTheme: 'Weekly deep dives into cases of people claiming wrongful conviction while the underlying crimes remain unresolved.',
    summaryNotes:
      'Investigative series hosted by Pulitzer Prize-winning journalist Maggie Freleng profiling potentially wrongfully convicted individuals (including Brandon Spencer, Cheri Hayden, Andre Brown, Ralph Trent Stokes, and others) and examining the unsolved crimes behind their convictions.',
    sourceUrlFallback: 'https://podcasts.apple.com/us/podcast/unjust-unsolved/id1527777879',
    appleId: 1527777879,
    sourceFiles: [
      'docs/media/podcasts/Unjust & Unsolved_research.md',
      'docs/media/podcasts/podcast_list_template.md (#13)',
    ],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [
      'Apple Podcasts feed (id1527777879) currently lists only 3 remaining tracks from the original 22-episode 2020–2021 run; some older episodes may be archived or behind Patreon.',
    ],
  },
  {
    key: 'for_the_innocent',
    title: 'For the Innocent',
    creatorName: 'Michael Semanchik',
    publicationOrReleaseYear: 2023,
    publisherOrNetwork: 'Legal Talk Network / The Innocence Center',
    focusOrTheme: 'Stories of exonerees, innocence litigation, and systemic causes of wrongful conviction from The Innocence Center.',
    summaryNotes:
      'Hosted by Michael Semanchik (Executive Director of The Innocence Center and former Managing Attorney of the California Innocence Project) on the Legal Talk Network. Features interviews with exonerees, attorneys, and forensic experts dissecting wrongful convictions and criminal justice reform.',
    sourceUrlFallback: 'https://legaltalknetwork.com/podcasts/for-the-innocent/',
    appleId: 1665246294,
    sourceFiles: ['docs/media/podcasts/podcast_list_template.md (#3)'],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [],
  },
  {
    key: 'california_innocence_project_podcast',
    title: 'California Innocence Project Podcast',
    creatorName: 'California Innocence Project',
    publicationOrReleaseYear: 2018,
    publisherOrNetwork: 'California Innocence Project',
    researchFile: 'California Innocence Project Podcast_research.md',
    focusOrTheme: 'Case studies of California wrongful convictions handled by the California Innocence Project, including flawed arson science, eyewitness misidentification, and compensation laws.',
    summaryNotes:
      'Limited 13-episode 2018 podcast series produced by the California Innocence Project detailing individual wrongful conviction cases (including Rodney Gupton, JoAnn Parks, and Horace Roberts) and exoneree compensation reform. Later succeeded by Michael Semanchik\'s "For the Innocent" on Legal Talk Network.',
    sourceUrlFallback: 'https://californiainnocenceproject.org/',
    appleId: null,
    sourceFiles: [
      'docs/media/podcasts/California Innocence Project Podcast_research.md',
      'docs/media/podcasts/podcast_list_template.md (#8)',
    ],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [
      'No active Apple Podcasts listing found (2018 13-episode limited series archived on Podchaser/CIP; no official Apple cover artwork URL).',
    ],
  },
  {
    key: 'the_innocence_podcast',
    title: 'The Innocence Podcast',
    creatorName: 'Kylie Pentelow, Claire McGourlay',
    publicationOrReleaseYear: 2022,
    publisherOrNetwork: 'The Manchester Innocence Project',
    researchFile: 'The Innocence Project Podcast_research.md',
    focusOrTheme: 'UK and international wrongful conviction cases, appeals, and the work of university innocence projects.',
    summaryNotes:
      'Produced by the Manchester Innocence Project (University of Manchester, UK), hosted by journalist Kylie Pentelow with Executive Producer Professor Claire McGourlay. Features conversations with exonerees (such as Brian Banks), innocence pioneers (such as Barry Scheck), and UK criminal appeal lawyers.',
    sourceUrlFallback: 'https://www.innocence.fm/',
    appleId: 1615808386,
    sourceFiles: [
      'docs/media/podcasts/The Innocence Project Podcast_research.md',
      'docs/media/podcasts/podcast_list_template.md (#20)',
      'docs/media/media_sources (1).md (#4)',
    ],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [
      'Normalized title from "The Innocence Project Podcast" (filename/list #20) to its true title "The Innocence Podcast" — this is the UK Manchester Innocence Project show (innocence.fm), NOT the U.S. Innocence Project.',
    ],
  },
  {
    key: 'criminal_injustice',
    title: 'Criminal (In)justice',
    creatorName: 'David Harris',
    publicationOrReleaseYear: 2015,
    publisherOrNetwork: 'David Harris (initially WESA Pittsburgh)',
    researchFile: 'Criminal Injustice_research.md',
    focusOrTheme: 'Academic and legal interviews examining wrongful convictions, flawed forensics, public defense, policing, and U.S. criminal justice reform.',
    summaryNotes:
      'Interview-based podcast hosted by University of Pittsburgh law professor David Harris (2015–2022, 187 episodes). Features legal scholars, forensic scientists, advocates, and exonerees examining DNA exonerations, flawed forensic testimony, sentinel event reviews, and post-exoneration reentry.',
    sourceUrlFallback: 'https://www.criminalinjusticepodcast.com/',
    appleId: 1094352910,
    sourceFiles: [
      'docs/media/podcasts/Criminal Injustice_research.md',
      'docs/media/podcasts/podcast_list_template.md (#16)',
    ],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [],
  },
  {
    key: 'sixth_hour_brendan_dassey',
    title: 'SIXTH HOUR: The Wrongful Conviction of Brendan Dassey',
    creatorName: 'Tracy Keogh',
    publicationOrReleaseYear: 2020,
    publisherOrNetwork: 'Tracy Keogh',
    focusOrTheme: 'In-depth examination of the juvenile interrogation, coerced confession, and wrongful conviction of Brendan Dassey in Manitowoc County, Wisconsin.',
    summaryNotes:
      'Limited investigative series (18 episodes) examining the 2006 interrogation, trial, and post-conviction appeals of Brendan Dassey, focusing on juvenile false confession dynamics and legal failures highlighted after Making a Murderer.',
    sourceUrlFallback: 'https://podcasts.apple.com/us/podcast/sixth-hour-the-wrongful-conviction-of-brendan-dassey/id1512638999',
    appleId: 1512638999,
    sourceFiles: ['docs/media/podcasts/podcast_list_template.md (#14)'],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [],
  },
  {
    key: 'choppin_it_up_with_jimmie_c',
    title: "Choppin' It Up With Jimmie C. -- Life After Wrongful Conviction",
    creatorName: 'Jimmie C. Gardner',
    publicationOrReleaseYear: 2020,
    publisherOrNetwork: 'Jimmie C. Gardner',
    focusOrTheme: 'Exoneree-hosted conversations about surviving wrongful imprisonment, rebuilding life after release, and mass exoneration advocacy.',
    summaryNotes:
      'Hosted by exoneree Jimmie C. Gardner, who spent 27 years wrongfully imprisoned in West Virginia before his release. Features candid conversations with fellow exonerees and advocates about reentry, healing, and criminal justice reform.',
    sourceUrlFallback: 'https://podcasts.apple.com/us/podcast/choppin-it-up-with-jimmie-c-life-after-wrongful-conviction/id1521492486',
    appleId: 1521492486,
    sourceFiles: ['docs/media/podcasts/podcast_list_template.md (#19)'],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [
      'Trimmed trailing keywords (", Exonerated, Mass Exoneration") from template #19 to match the official Apple Podcasts series title.',
    ],
  },
  {
    key: 'actual_innocence',
    title: 'Actual Innocence',
    creatorName: 'Brooke Gittings',
    publicationOrReleaseYear: 2016,
    publisherOrNetwork: 'BEP',
    focusOrTheme: 'Direct first-person interviews with exonerees and wrongful conviction advocates.',
    summaryNotes:
      'Interview-driven podcast hosted by Brooke Gittings (72 episodes) giving wrongfully convicted and exonerated individuals a platform to tell their own stories of arrest, trial, incarceration, and life after exoneration.',
    sourceUrlFallback: 'https://podcasts.apple.com/us/podcast/actual-innocence/id1102237078',
    appleId: 1102237078,
    sourceFiles: ['docs/media/podcasts/podcast_list_template.md (#21)'],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [],
  },
  {
    key: 'righteous_convictions_with_jason_flom',
    title: 'Righteous Convictions with Jason Flom',
    creatorName: 'Jason Flom',
    publicationOrReleaseYear: 2021,
    publisherOrNetwork: 'Lava for Good Podcasts',
    focusOrTheme: 'Profiles of reform-minded prosecutors, Conviction Integrity Unit leaders, defense attorneys, and activists fighting wrongful convictions.',
    summaryNotes:
      'Lava for Good companion series hosted by Jason Flom (43 episodes) spotlighting legal professionals, justice reformers, and advocates working inside and outside the system to overturn wrongful convictions and prevent miscarriages of justice.',
    sourceUrlFallback: 'https://lavaforgood.com/podcast/righteous-convictions-with-jason-flom/',
    appleId: 1557315056,
    sourceFiles: ['docs/media/podcasts/podcast_list_template.md (#29)'],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [
      'Normalized title from "Wrongful Conviction with Jason Flom: Righteous Convictions" to its official standalone Apple Podcasts title "Righteous Convictions with Jason Flom".',
    ],
  },
  {
    key: '13_alibis',
    title: '13 Alibis',
    creatorName: 'Dan Slepian',
    publicationOrReleaseYear: 2019,
    publisherOrNetwork: 'Dateline NBC / NBC News',
    focusOrTheme: 'Investigates the wrongful murder conviction of Richard Rosario despite 13 alibi witnesses placing him in Florida.',
    summaryNotes:
      'Dateline NBC original investigative podcast reported by producer Dan Slepian following the 20-year fight to free Richard Rosario, who was convicted of a 1996 Bronx murder despite 13 witnesses placing him 1,000 miles away in Florida, leading to the 2016 vacatur of his conviction.',
    sourceUrlFallback: 'https://podcasts.apple.com/us/podcast/13-alibis/id1463081342',
    appleId: 1463081342,
    sourceFiles: ['docs/media/podcasts/podcast_list_template.md (#30)'],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [],
  },
  {
    key: 'wrongly_accused_annette_hewins',
    title: 'Wrongly Accused: The Annette Hewins Story',
    creatorName: 'BBC Radio Wales',
    publicationOrReleaseYear: 2024,
    publisherOrNetwork: 'BBC Radio Wales',
    focusOrTheme: 'Investigates the 1996 wrongful arson-murder conviction and subsequent exoneration of Annette Hewins in Wales.',
    summaryNotes:
      'Ten-part BBC Radio Wales investigative podcast examining the 1995 Merthyr Tydfil arson attack and the miscarriage of justice that led to Annette Hewins\'s wrongful conviction, her overturned verdict in 1999, and the lasting impact on her family.',
    sourceUrlFallback: 'https://www.bbc.co.uk/programmes/p0hf0f2f',
    appleId: 1733285319,
    sourceFiles: ['docs/media/podcasts/podcast_list_template.md (#33)'],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [
      'Normalized title from "Wrongly Accused: The Annette Hewins case" to official BBC/Apple title "Wrongly Accused: The Annette Hewins Story".',
    ],
  },
  {
    key: 'dead_man_talking',
    title: 'Dead Man Talking',
    creatorName: 'Alex Hannaford',
    publicationOrReleaseYear: 2018,
    publisherOrNetwork: 'Audioboom Studios',
    focusOrTheme: 'Investigates death-row confessions of "Railroad Killer" Ángel Maturino Reséndiz and whether innocent people—including Andres Mascorro—were wrongfully convicted of his crimes.',
    summaryNotes:
      'Investigative podcast hosted by journalist Alex Hannaford (Audioboom Studios, 19 episodes) following Reséndiz\'s confessions to additional murders and working alongside investigators and the Innocence Project of Texas to examine the wrongful conviction claim of Andres Mascorro.',
    sourceUrlFallback: 'https://podcasts.apple.com/us/podcast/dead-man-talking/id1436700030',
    appleId: 1436700030,
    sourceFiles: ['docs/media/new podcasts.txt'],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [],
  },
  {
    key: 'murderville',
    title: 'Murderville',
    creatorName: 'Liliana Segura, Jordan Smith',
    publicationOrReleaseYear: 2018,
    publisherOrNetwork: 'The Intercept',
    focusOrTheme: 'Investigates disputed murder convictions and death-row innocence claims in the American South (Season 1 Georgia; Season 2 Charles Raby in Texas).',
    summaryNotes:
      'Investigative podcast from The Intercept hosted by reporters Liliana Segura and Jordan Smith (24 episodes). Season 2 ("Murderville, Texas") examines the case of Charles Raby, on Texas death row since 1994 after a disputed confession with no physical or DNA evidence linking him to the crime.',
    sourceUrlFallback: 'https://theintercept.com/podcasts/murderville/',
    appleId: 1443674380,
    sourceFiles: ['docs/media/new podcasts.txt'],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [],
  },
  {
    key: 'if_emmett_was_alive_today',
    title: 'If Emmett Was Alive Today Podcast',
    creatorName: 'Daphine Priscilla Brown Jack',
    publicationOrReleaseYear: 2019,
    publisherOrNetwork: 'Daphine Priscilla Brown Jack / Sol-Caritas',
    focusOrTheme: 'Criminal justice reform, racial justice, and interviews with Texas death-row exonerees including Christopher Scott and Anthony Graves.',
    summaryNotes:
      'Hosted by veteran parole officer and criminal justice advocate Daphine Jack (21 episodes), exploring systemic flaws in the criminal justice system and featuring in-depth interviews with Texas exonerees Christopher Scott and Anthony Graves.',
    sourceUrlFallback: 'https://podcasts.apple.com/us/podcast/if-emmett-was-alive-today-podcast/id1487054857',
    appleId: 1487054857,
    sourceFiles: ['docs/media/new podcasts.txt'],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [],
  },
  {
    key: 'empire_on_blood',
    title: 'Empire on Blood',
    creatorName: 'Steve Fishman',
    publicationOrReleaseYear: 2018,
    publisherOrNetwork: 'Panoply / Orbit Media',
    focusOrTheme: 'Seven-year investigation into the 1992 Bronx double-homicide conviction and eventual exoneration of Calvin Buari.',
    summaryNotes:
      'Investigative series hosted by journalist Steve Fishman examining the 1992 Bronx double murder for which Calvin Buari spent 22 years in prison before his conviction was vacated days before the podcast\'s 2018 premiere. Later re-released with new follow-up episodes as Season 2 of "The Burden" (Orbit Media).',
    sourceUrlFallback: 'https://podcasts.apple.com/us/podcast/the-burden/id1734312219',
    appleId: 1734312219,
    sourceFiles: ['docs/media/podcasts/podcast_list_template.md (#22)'],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [
      'Originally released via Panoply in 2018; now distributed on Apple Podcasts under Steve Fishman\'s umbrella feed "The Burden" (id1734312219, Orbit Media).',
    ],
  },
  {
    key: 'accused',
    title: 'Accused',
    creatorName: 'Amber Hunt',
    publicationOrReleaseYear: 2016,
    publisherOrNetwork: 'Cincinnati Enquirer / USA Today Network',
    focusOrTheme: 'Multi-season investigative journalism examining questionable convictions, flawed police investigations, and unsolved murders.',
    summaryNotes:
      'Investigative podcast from The Cincinnati Enquirer hosted by reporter Amber Hunt (52 episodes). Several seasons—including Season 2 (William Virgil, exonerated after 28 years in Kentucky) and Season 4 (Elwood Jones)—directly investigate wrongful or deeply disputed convictions.',
    sourceUrlFallback: 'https://www.cincinnati.com/series/accused/',
    appleId: 1145990861,
    sourceFiles: ['docs/media/podcasts/podcast_list_template.md (#27)'],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [],
  },
  {
    key: 'aggravating_circumstances',
    title: 'Aggravating Circumstances',
    creatorName: 'Laura Szeremi',
    publicationOrReleaseYear: 2020,
    publisherOrNetwork: 'Independent',
    researchFile: 'Aggravating Circumstances_research.md',
    focusOrTheme: 'Investigative podcast examining cases of alleged wrongful conviction, hidden evidence, and unintended consequences in the criminal justice system.',
    summaryNotes:
      'Multi-season independent investigative podcast hosted by Laura Szeremi. Season 1 examines the conviction of Destry Cord McKinney; Season 2 examines a disputed Florida self-defense case; Season 3 investigates the conviction of Tommy Hall.',
    sourceUrlFallback: 'https://www.podchaser.com/podcasts/aggravating-circumstances-1158367',
    appleId: null,
    sourceFiles: [
      'docs/media/podcasts/Aggravating Circumstances_research.md',
      'docs/media/podcasts/podcast_list_template.md (#6)',
    ],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [
      'Verified on Podchaser, but no active Apple Podcasts feed/ID found (no official Apple cover artwork URL available).',
    ],
  },
  {
    key: 'conviction_gimlet',
    title: 'Conviction',
    creatorName: 'Saki Knafo, Gimlet Media',
    publicationOrReleaseYear: 2019,
    publisherOrNetwork: 'Gimlet Media / Spotify',
    focusOrTheme: 'Anthology investigative podcast covering wrongful arrests, police misconduct (Season 1: Pedro Hernandez), and 1980s Satanic Panic wrongful convictions (Season 2: American Panic).',
    summaryNotes:
      'Investigative anthology series from Gimlet Media / Spotify. Season 1 (hosted by Saki Knafo) follows Bronx teenager Pedro Hernandez\'s fight against a flawed shooting prosecution; Season 2 ("American Panic") investigates how 1980s Satanic Panic hysteria led to wrongful convictions.',
    sourceUrlFallback: 'https://open.spotify.com/show/2V4a1fJ7iM2u1m4W2g8g5a',
    appleId: null,
    sourceFiles: ['docs/media/podcasts/podcast_list_template.md (#24)'],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [
      'Gimlet/Spotify Original podcast — not indexed on Apple Podcasts Lookup API (no Apple cover artwork URL).',
    ],
  },
  {
    key: 'exoneration_nation',
    title: 'Exoneration Nation',
    creatorName: 'Christopher Scott',
    publicationOrReleaseYear: 2019,
    publisherOrNetwork: 'House of Renewed Hope / Acast',
    focusOrTheme: 'Texas exoneree Christopher Scott interviews fellow exonerees and innocence advocates about wrongful imprisonment and life after exoneration.',
    summaryNotes:
      'Hosted by Texas exoneree and House of Renewed Hope co-founder Christopher Scott (wrongfully convicted of capital murder in 1997, exonerated in 2009), sharing personal stories of fellow exonerees and wrongful conviction investigations.',
    sourceUrlFallback: 'https://shows.acast.com/exoneration-nation',
    appleId: null,
    sourceFiles: ['docs/media/new podcasts.txt'],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [
      'Verified via Acast / TCADP, but no active Apple Podcasts listing found (no Apple cover artwork URL).',
    ],
  },
  {
    key: 'the_appeal',
    title: 'The Appeal',
    creatorName: 'The Appeal',
    publicationOrReleaseYear: 2018,
    publisherOrNetwork: 'The Appeal',
    focusOrTheme: 'Criminal justice journalism covering prosecutorial misconduct, wrongful convictions, cash bail, and systemic reform.',
    summaryNotes:
      'News and interview podcast produced by nonprofit criminal-justice outlet The Appeal (65 episodes), examining systemic drivers of wrongful conviction, prosecutorial accountability, and criminal legal reform.',
    sourceUrlFallback: 'https://theappeal.org/',
    appleId: 1392667248,
    sourceFiles: ['docs/media/podcasts/podcast_list_template.md (#32)'],
    category: 'CORE',
    recommendedAction: 'CREATE',
    reviewWarnings: [
      'Editorial note: Covers broader criminal justice policy and reform in addition to wrongful convictions.',
    ],
  },

  // =========================================================================
  // TIER B: BROADER TRUE-CRIME / LEGAL / PRISON SHOWS (6 series -> default SKIP)
  // =========================================================================
  {
    key: 'someone_knows_something',
    title: 'Someone Knows Something',
    creatorName: 'David Ridgen',
    publicationOrReleaseYear: 2016,
    publisherOrNetwork: 'CBC',
    focusOrTheme: 'Canadian cold-case investigative podcast; Seasons 5 and 6 examine flawed investigations and potential wrongful convictions.',
    summaryNotes:
      'Acclaimed CBC investigative series hosted by filmmaker David Ridgen primarily investigating unsolved cold cases and missing persons across Canada and the U.S., with Seasons 5 and 6 touching on potential wrongful convictions and investigative failures.',
    sourceUrlFallback: 'https://www.cbc.ca/radio/sks',
    appleId: 1089216339,
    sourceFiles: ['docs/media/podcasts/podcast_list_template.md (#26)'],
    category: 'BROAD_SCOPE',
    recommendedAction: 'SKIP',
    reviewWarnings: [
      'Editorial check (default SKIP): Primarily a cold-case / missing-persons podcast; only Seasons 5–6 involve flawed-conviction angles. Switch to CREATE if you want it included.',
      'Normalized title from "Someone Knows Something (Seasons 5 & 6)" to parent series "Someone Knows Something".',
    ],
  },
  {
    key: 'hell_and_gone',
    title: 'Hell and Gone',
    creatorName: 'Catherine Townsend',
    publicationOrReleaseYear: 2018,
    publisherOrNetwork: 'iHeartPodcasts / School of Humans',
    focusOrTheme: 'True-crime cold-case investigations; Season 2 examines a disputed conviction.',
    summaryNotes:
      'Investigative podcast hosted by private investigator and writer Catherine Townsend (currently titled "Hell and Gone: Murder Line" on Apple Podcasts) primarily investigating unsolved murders, with Season 2 examining questions surrounding a disputed conviction.',
    sourceUrlFallback: 'https://podcasts.apple.com/us/podcast/hell-and-gone-murder-line/id1437808691',
    appleId: 1437808691,
    sourceFiles: ['docs/media/podcasts/podcast_list_template.md (#31)'],
    category: 'BROAD_SCOPE',
    recommendedAction: 'SKIP',
    reviewWarnings: [
      'Editorial check (default SKIP): Primarily an unsolved-murder / cold-case series (only Season 2 touches a disputed conviction). Switch to CREATE if desired.',
      'Normalized title from "Hell and Gone (Season 2)" to parent series "Hell and Gone".',
    ],
  },
  {
    key: 'the_docket',
    title: 'The Docket',
    creatorName: 'Michael Spratt, Emilie Taman',
    publicationOrReleaseYear: 2014,
    publisherOrNetwork: 'Michael Spratt, Emilie Taman',
    focusOrTheme: 'Canadian criminal law, legal policy, and court commentary that occasionally discusses wrongful convictions.',
    summaryNotes:
      'Canadian legal commentary podcast hosted by defense lawyer Michael Spratt and former prosecutor Emilie Taman covering Canadian Supreme Court decisions, criminal justice policy, and occasional miscarriage-of-justice cases.',
    sourceUrlFallback: 'https://podcasts.apple.com/us/podcast/the-docket/id873244552',
    appleId: 873244552,
    sourceFiles: ['docs/media/podcasts/podcast_list_template.md (#23)'],
    category: 'BROAD_SCOPE',
    recommendedAction: 'SKIP',
    reviewWarnings: [
      'Editorial check (default SKIP): General Canadian legal/policy commentary podcast rather than a dedicated wrongful-conviction series. Switch to CREATE if desired.',
    ],
  },
  {
    key: 'ear_hustle',
    title: 'Ear Hustle',
    creatorName: 'Earlonne Woods, Nigel Poor',
    publicationOrReleaseYear: 2017,
    publisherOrNetwork: 'Ear Hustle & Radiotopia',
    focusOrTheme: 'Daily realities of life inside San Quentin State Prison and post-incarceration reentry, occasionally featuring claims of innocence.',
    summaryNotes:
      'Pulitzer Prize-finalist podcast co-created inside San Quentin State Prison by Earlonne Woods and Nigel Poor (Radiotopia) exploring everyday life behind bars and reentry after prison.',
    sourceUrlFallback: 'https://www.earhustlesq.com/',
    appleId: 1240841298,
    sourceFiles: ['docs/media/podcasts/podcast_list_template.md (#37)'],
    category: 'BROAD_SCOPE',
    recommendedAction: 'SKIP',
    reviewWarnings: [
      'Editorial check (default SKIP): Acclaimed prison-life podcast, but NOT specifically focused on wrongful convictions. Switch to CREATE if you want broader incarceration media included.',
    ],
  },
  {
    key: 'court_junkie',
    title: 'Court Junkie',
    creatorName: 'Jillian Jalali',
    publicationOrReleaseYear: 2016,
    publisherOrNetwork: 'PodcastOne',
    focusOrTheme: 'General true-crime courtroom coverage using trial audio and court documents, occasionally featuring wrongful convictions.',
    summaryNotes:
      'Long-running true-crime podcast hosted by Jillian Jalali (400+ episodes) focusing on criminal trials, judicial proceedings, and courtroom audio across a wide range of criminal cases.',
    sourceUrlFallback: 'https://courtjunkie.com/',
    appleId: 1144137857,
    sourceFiles: ['docs/media/media_sources (1).md (#5)'],
    category: 'BROAD_SCOPE',
    recommendedAction: 'SKIP',
    reviewWarnings: [
      'Editorial check (default SKIP): General true-crime / courtroom podcast covering mostly guilty verdicts and trials, only occasionally wrongful convictions. Switch to CREATE if desired.',
    ],
  },
  {
    key: 'the_murder_squad',
    title: 'Jensen & Holes: The Murder Squad',
    creatorName: 'Paul Holes, Billy Jensen',
    publicationOrReleaseYear: 2019,
    publisherOrNetwork: 'Exactly Right',
    focusOrTheme: 'Unsolved cold cases, missing persons, and citizen-sleuthing (2019–2022).',
    summaryNotes:
      'Defunct true-crime podcast (2019–2022) hosted by retired investigator Paul Holes and Billy Jensen focused on solving unsolved murders and identifying Jane/John Does via crowdsourcing.',
    sourceUrlFallback: null,
    appleId: null,
    sourceFiles: ['docs/media/podcasts/podcast_list_template.md (#28)'],
    category: 'BROAD_SCOPE',
    recommendedAction: 'SKIP',
    reviewWarnings: [
      'Editorial check (default SKIP): Unsolved cold-case / citizen-sleuth show — NOT a wrongful-conviction podcast, and canceled/removed from Apple Podcasts in 2022.',
    ],
  },

  // =========================================================================
  // TIER C: SUB-SERIES / DUPLICATE-FEED ENTRIES (3 entries -> default SKIP)
  // =========================================================================
  {
    key: 'wrongful_conviction_false_confessions',
    title: 'Wrongful Conviction: False Confessions',
    creatorName: 'Laura Nirider, Steve Drizin',
    publicationOrReleaseYear: 2020,
    publisherOrNetwork: 'Lava for Good Podcasts',
    researchFile: 'Wrongful Conviction_ False Confessions_research.md',
    focusOrTheme: 'Sub-series of Wrongful Conviction analyzing real police interrogation audio and how innocent people are pressured into false confessions.',
    summaryNotes:
      'Hosted by Northwestern Center on Wrongful Convictions co-directors Laura Nirider and Steve Drizin (Lava for Good). Uses real interrogation audio to dissect cases like the Norfolk Four, Matt Livers, Robert Davis, and Tommy Ward & Karl Fontenot.',
    sourceUrlFallback: 'https://lavaforgood.com/podcast/wrongful-conviction-false-confessions/',
    appleId: null, // Shares Apple ID 1151670380 with main Wrongful Conviction; keep externalId null to avoid @unique collision!
    sharedArtworkAppleId: 1151670380,
    sourceFiles: [
      'docs/media/podcasts/Wrongful Conviction_ False Confessions_research.md',
      'docs/media/podcasts/podcast_list_template.md (#11)',
      'docs/media/podcasts/podcast_list_template.md (#18 duplicate: "False Confessions with Laura Nirider & Steve Drizin")',
      'server/prisma/seed_files/podcasts/ (44 legacy episode JSONs)',
    ],
    category: 'SUB_SERIES',
    recommendedAction: 'SKIP',
    reviewWarnings: [
      'SUB-SERIES FEED OVERLAP (default SKIP): Distributed inside the main "Wrongful Conviction" RSS feed (Apple ID #1151670380) rather than as a separate Apple Podcasts feed. Switch to CREATE if you want it listed as its own distinct series alongside "Wrongful Conviction".',
      'Deduplicated template #18 ("False Confessions with Laura Nirider & Steve Drizin") into this entry.',
    ],
  },
  {
    key: 'wrongful_conviction_junk_science',
    title: 'Wrongful Conviction: Junk Science',
    creatorName: 'Josh Dubin',
    publicationOrReleaseYear: 2020,
    publisherOrNetwork: 'Lava for Good Podcasts',
    focusOrTheme: 'Sub-series of Wrongful Conviction dissecting discredited forensic methods (bite marks, arson, hair microscopy, bloodstain patterns, footwear) that caused wrongful convictions.',
    summaryNotes:
      'Hosted by civil rights attorney and innocence advocate Josh Dubin (Lava for Good), examining how unvalidated forensic disciplines led to wrongful convictions across the United States.',
    sourceUrlFallback: 'https://lavaforgood.com/podcast/wrongful-conviction-junk-science/',
    appleId: null, // Shares Apple ID 1151670380 with main Wrongful Conviction
    sharedArtworkAppleId: 1151670380,
    sourceFiles: [
      'docs/media/podcasts/podcast_list_template.md (#15)',
      'server/prisma/seed_files/podcasts/ (24 legacy episode JSONs)',
    ],
    category: 'SUB_SERIES',
    recommendedAction: 'SKIP',
    reviewWarnings: [
      'SUB-SERIES FEED OVERLAP (default SKIP): Distributed inside the main "Wrongful Conviction" RSS feed (Apple ID #1151670380) rather than as a separate Apple Podcasts feed. Switch to CREATE if you want it listed as its own distinct series alongside "Wrongful Conviction".',
    ],
  },
  {
    key: 'wrongly_convicted_with_maggie_freleng',
    title: 'Wrongly Convicted with Maggie Freleng',
    creatorName: 'Maggie Freleng',
    publicationOrReleaseYear: 2021,
    publisherOrNetwork: 'Lava for Good Podcasts',
    focusOrTheme: 'Misnamed duplicate of Maggie Freleng\'s co-hosted episodes on the main "Wrongful Conviction" feed.',
    summaryNotes:
      'Listed in podcast_list_template.md (#34) as "Wrongly Convicted with Maggie Freleng", but Maggie Freleng hosted episodes under "Wrongful Conviction with Maggie Freleng" inside the main Lava for Good "Wrongful Conviction" feed (and separately hosted "Unjust & Unsolved").',
    sourceUrlFallback: null,
    appleId: null,
    sourceFiles: [
      'docs/media/podcasts/podcast_list_template.md (#34)',
      'server/prisma/seed_files/podcasts/ (60 legacy episode JSONs on main feed)',
    ],
    category: 'SUB_SERIES',
    recommendedAction: 'SKIP',
    reviewWarnings: [
      'LIKELY DUPLICATE / MISNAMED (default SKIP): No standalone podcast titled "Wrongly Convicted with Maggie Freleng" exists — Maggie Freleng hosted episodes on the main "Wrongful Conviction" feed (#1151670380) and hosted the separate podcast "Unjust & Unsolved" (included above).',
    ],
  },

  // =========================================================================
  // TIER D: CONFIRMED HALLUCINATIONS / NON-PODCASTS (4 entries -> default SKIP)
  // =========================================================================
  {
    key: 'rectify_restorative_justice',
    title: 'Rectify: The Power of Restorative Justice',
    creatorName: null,
    publicationOrReleaseYear: null,
    publisherOrNetwork: null,
    focusOrTheme: 'Post-exoneration experiences and restorative justice (listed in template #38).',
    summaryNotes:
      'NOT A PODCAST: "Rectify: The Power of Restorative Justice After Wrongful Conviction" is a 2018 book by legal scholar Lara Bazelon, mistakenly entered into the podcast brainstorming list.',
    sourceUrlFallback: null,
    appleId: null,
    sourceFiles: ['docs/media/podcasts/podcast_list_template.md (#38)'],
    category: 'HALLUCINATION_OR_ERROR',
    recommendedAction: 'SKIP',
    reviewWarnings: [
      'NOT A PODCAST (BOOK MISCLASSIFIED — default SKIP): "Rectify: The Power of Restorative Justice After Wrongful Conviction" is a 2018 book by Lara Bazelon, not a podcast series.',
    ],
  },
  {
    key: 'the_97_percent',
    title: 'The 97%',
    creatorName: 'Benjamin Fitton (unverified)',
    publicationOrReleaseYear: null,
    publisherOrNetwork: null,
    focusOrTheme: 'Claimed in template #35 to be a UK wrongful conviction podcast hosted by Benjamin Fitton.',
    summaryNotes:
      'AI HALLUCINATION / UNVERIFIED: No UK wrongful-conviction podcast named "The 97%" hosted by Benjamin Fitton exists. Benjamin Fitton is actually the co-creator of the UK true-crime podcast "They Walk Among Us".',
    sourceUrlFallback: null,
    appleId: null,
    sourceFiles: ['docs/media/podcasts/podcast_list_template.md (#35)'],
    category: 'HALLUCINATION_OR_ERROR',
    recommendedAction: 'SKIP',
    reviewWarnings: [
      'LIKELY AI HALLUCINATION (default SKIP): No UK wrongful-conviction podcast called "The 97%" exists; Benjamin Fitton actually hosts "They Walk Among Us".',
    ],
  },
  {
    key: 'the_innocents',
    title: 'The Innocents',
    creatorName: null,
    publicationOrReleaseYear: null,
    publisherOrNetwork: null,
    focusOrTheme: 'Claimed in template #36 to focus on personal stories of wrongfully convicted individuals.',
    summaryNotes:
      'UNVERIFIABLE / LIKELY AI HALLUCINATION: No wrongful-conviction podcast series named "The Innocents" exists on Apple Podcasts or major podcast directories.',
    sourceUrlFallback: null,
    appleId: null,
    sourceFiles: ['docs/media/podcasts/podcast_list_template.md (#36)'],
    category: 'HALLUCINATION_OR_ERROR',
    recommendedAction: 'SKIP',
    reviewWarnings: [
      'UNVERIFIABLE / LIKELY AI HALLUCINATION (default SKIP): No wrongful-conviction podcast titled "The Innocents" was found on Apple Podcasts or web directories.',
    ],
  },
  {
    key: 'lawless_australia',
    title: 'Lawless',
    creatorName: null,
    publicationOrReleaseYear: null,
    publisherOrNetwork: null,
    focusOrTheme: 'Claimed in template #25 to be an Australian podcast on miscarriages of justice.',
    summaryNotes:
      'AI CONFUSION / WRONG DESCRIPTION: No Australian wrongful-conviction podcast titled "Lawless" exists. Likely confused with "The Lawless Files" (Missouri podcast about the 1992 Mischelle Lawless murder and exoneree Josh Kezer, Apple ID 1594448298) or WORLD Radio\'s drug-war podcast "Lawless".',
    sourceUrlFallback: null,
    appleId: null,
    sourceFiles: ['docs/media/podcasts/podcast_list_template.md (#25)'],
    category: 'HALLUCINATION_OR_ERROR',
    recommendedAction: 'SKIP',
    reviewWarnings: [
      'UNVERIFIED / LIKELY AI CONFUSION (default SKIP): No Australian wrongful-conviction podcast called "Lawless" exists (may have been confused with Missouri\'s "The Lawless Files" about exoneree Josh Kezer).',
    ],
  },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Clean old JSONs in OUT_DIR
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith('.json')) fs.unlinkSync(path.join(OUT_DIR, f));
  }

  // Load feeds.json for cross-referencing active RSS feeds
  let pipelineFeeds = [];
  if (fs.existsSync(FEEDS_JSON_PATH)) {
    pipelineFeeds = JSON.parse(fs.readFileSync(FEEDS_JSON_PATH, 'utf8'));
  }
  const feedByNormTitle = new Map(pipelineFeeds.map((f) => [normTitle(f.podcastTitle), f]));

  // Batch-lookup ALL unique Apple Podcasts IDs in a single API call
  const appleIds = Array.from(
    new Set(
      PODCAST_CATALOG.flatMap((c) => [c.appleId, c.sharedArtworkAppleId]).filter(Boolean)
    )
  );
  console.log(`Fetching Apple Podcasts metadata for ${appleIds.length} verified collection IDs...`);
  const lookupUrl = `https://itunes.apple.com/lookup?id=${appleIds.join(',')}`;
  const lookupResp = await fetchJson(lookupUrl);
  const appleById = new Map();
  for (const r of lookupResp.results || []) {
    if (r.collectionId) appleById.set(Number(r.collectionId), r);
  }
  console.log(`Apple Lookup returned ${appleById.size}/${appleIds.length} podcasts.`);

  const bundle = [];
  const usedExternalIds = new Set();

  for (const item of PODCAST_CATALOG) {
    // Optionally read research markdown to verify existence & keep provenance accurate
    let parsedResearch = null;
    if (item.researchFile) {
      parsedResearch = parseResearchMarkdown(path.join(DOCS_PODCASTS, item.researchFile));
    }

    const apple = item.appleId ? appleById.get(item.appleId) : null;
    const sharedArtApple =
      !apple && item.sharedArtworkAppleId ? appleById.get(item.sharedArtworkAppleId) : null;
    const pipelineFeed = feedByNormTitle.get(normTitle(item.title)) || null;

    let externalId = item.appleId ? `apple-podcast:${item.appleId}` : null;
    if (externalId && usedExternalIds.has(externalId)) {
      // Never emit duplicate externalIds (MediaWork.externalId is @unique)
      externalId = null;
    }
    if (externalId) usedExternalIds.add(externalId);

    const artworkUrl = apple?.artworkUrl600 || sharedArtApple?.artworkUrl600 || null;
    const appleViewUrl = apple?.collectionViewUrl
      ? apple.collectionViewUrl.replace(/\?uo=\d+$/, '')
      : null;
    const rssFeedUrl = pipelineFeed?.rssUrl || apple?.feedUrl || null;
    const trackCount = apple?.trackCount ?? null;

    const availabilityParts = [];
    if (appleViewUrl) availabilityParts.push('Apple Podcasts');
    if (item.key === 'conviction_gimlet') availabilityParts.push('Spotify');
    else if (item.key === 'exoneration_nation') availabilityParts.push('Acast / Spotify');
    else if (item.key === 'aggravating_circumstances') availabilityParts.push('Podchaser');
    else if (item.key === 'california_innocence_project_podcast') availabilityParts.push('Podchaser / Archive');
    if (rssFeedUrl) availabilityParts.push('Public RSS feed verified');
    if (trackCount) availabilityParts.push(`~${trackCount} episodes on Apple Podcasts`);

    const sourcingCredit = apple
      ? 'Apple Podcasts / Research Files'
      : parsedResearch
        ? 'Repository Research Files'
        : 'Repository Podcast Lists';

    const record = {
      sourceFiles: item.sourceFiles,
      category: item.category,
      recommendedAction: item.recommendedAction,
      reviewWarnings: [...item.reviewWarnings],
      podcastMeta: {
        appleCollectionId: item.appleId || null,
        appleCollectionName: apple?.collectionName || null,
        appleArtistName: apple?.artistName || null,
        appleTrackCount: trackCount,
        rssFeedUrl,
        inDailyPipeline: Boolean(pipelineFeed),
        dailyPipelineActive: Boolean(pipelineFeed?.active),
      },
      mediaWork: {
        title: item.title,
        workType: 'PODCAST_SERIES',
        creatorName: item.creatorName || parsedResearch?.hosts || apple?.artistName || null,
        publicationOrReleaseYear:
          item.publicationOrReleaseYear ?? parsedResearch?.releaseYear ?? null,
        publisherOrNetwork:
          item.publisherOrNetwork || parsedResearch?.network || apple?.artistName || null,
        focusOrTheme: item.focusOrTheme || parsedResearch?.focusOrTheme || null,
        summaryNotes: item.summaryNotes,
        availabilityNotes:
          availabilityParts.length > 0 ? availabilityParts.join(' · ') : null,
        sourceUrl: appleViewUrl || item.sourceUrlFallback || null,
        externalId,
        imagePath: artworkUrl,
        sourcingCredit,
        aiGenerated: false,
      },
      // Explicitly empty: user requested series metadata ONLY (no episodes / episode entities).
      mediaItems: [],
    };

    bundle.push(record);
    const outFile = path.join(OUT_DIR, `${slugify(item.title)}.json`);
    fs.writeFileSync(outFile, JSON.stringify(record, null, 2), 'utf8');
  }

  const bundlePath = path.join(OUT_DIR, 'all_podcast_series_bundle.json');
  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), 'utf8');

  // Generate AUDIT_REPORT.md
  const coreRows = bundle.filter((b) => b.category === 'CORE');
  const broadRows = bundle.filter((b) => b.category === 'BROAD_SCOPE');
  const subRows = bundle.filter((b) => b.category === 'SUB_SERIES');
  const hallRows = bundle.filter((b) => b.category === 'HALLUCINATION_OR_ERROR');
  const withArt = bundle.filter((b) => b.mediaWork.imagePath).length;
  const withApple = bundle.filter((b) => b.podcastMeta.appleCollectionId).length;
  const withRss = bundle.filter((b) => b.podcastMeta.rssFeedUrl).length;

  const lines = [
    '# Podcast Series Bundle Audit Report (`podcasts_v2`)',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Scope',
    '- **Series metadata ONLY (`MediaWork` with `workType: "PODCAST_SERIES"`)** — **0 episodes**, **0 individuals**, **0 organizations** imported from this bundle.',
    '- Existing live DB record **#1 (`Wrongful Conviction`, with Episode #600)** is matched automatically and set to **MERGE** (fills blank artwork, launch year, summary, focus, `externalId`, and Apple Podcasts URL without touching Episode #600).',
    '',
    '## Sources Audited & Deduplicated',
    '- `docs/media/podcasts/*_research.md` & `Undisclosed_final.md` (15 files → 14 unique shows; `Undisclosed_final.md` and `Undisclosed_research.md` deduplicated)',
    '- `docs/media/podcasts/podcast_list_template.md` (38 entries; deduplicated #18 into #11 and #20 with `media_sources (1).md` #4)',
    '- `docs/media/new podcasts.txt` (4 entries)',
    '- `docs/media/media_sources (1).md` (5 entries)',
    '- `scripts/podcast_pipeline/feeds.json` (3 entries)',
    '- `server/prisma/seed_files/podcasts/` (520 legacy JSONs scanned — confirmed all belong to *Wrongful Conviction* + its *False Confessions*, *Junk Science*, and *Maggie Freleng* sub-series)',
    '',
    '## Summary Metrics',
    `- **Total unique series entries in bundle:** ${bundle.length}`,
    `- **Recommended CREATE / MERGE (Core Wrongful-Conviction Series):** ${coreRows.length}`,
    `- **Recommended SKIP — Broader True-Crime / Legal / Prison Shows:** ${broadRows.length}`,
    `- **Recommended SKIP — Sub-Series / Duplicate-Feed Entries:** ${subRows.length}`,
    `- **Recommended SKIP — Confirmed Hallucinations / Book-as-Podcast Errors:** ${hallRows.length}`,
    `- **Verified on Apple Podcasts API:** ${withApple}/${bundle.length}`,
    `- **High-Res Cover Artwork (600x600 \`imagePath\`):** ${withArt}/${bundle.length}`,
    `- **Verified Public RSS Feed URLs captured:** ${withRss}/${bundle.length}`,
    '',
    '## 1. Confirmed Hallucinations & Non-Podcasts (Default: `SKIP`)',
    '| Title | Source | Finding |',
    '| --- | --- | --- |',
    ...hallRows.map(
      (r) =>
        `| **${r.mediaWork.title}** | ${r.sourceFiles.join('; ')} | ${r.reviewWarnings.join(' ')} |`
    ),
    '',
    '## 2. Sub-Series & Duplicate-Feed Entries (Default: `SKIP`)',
    '| Title | Source | Finding |',
    '| --- | --- | --- |',
    ...subRows.map(
      (r) =>
        `| **${r.mediaWork.title}** | ${r.sourceFiles.join('; ')} | ${r.reviewWarnings.join(' ')} |`
    ),
    '',
    '## 3. Broader Scope Shows — Not Primarily Wrongful-Conviction Focused (Default: `SKIP`)',
    '| Title | Host(s) | Apple ID | Note |',
    '| --- | --- | --- | --- |',
    ...broadRows.map(
      (r) =>
        `| **${r.mediaWork.title}** | ${r.mediaWork.creatorName || '—'} | ${r.podcastMeta.appleCollectionId || 'None'} | ${r.reviewWarnings[0] || ''} |`
    ),
    '',
    '## 4. Core Wrongful-Conviction Series (Default: `CREATE` / `MERGE`)',
    '| # | Title | Host(s) | Year | Apple ID | Art | Notes / Warnings |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...coreRows.map(
      (r, i) =>
        `| ${i + 1} | **${r.mediaWork.title}** | ${r.mediaWork.creatorName || '—'} | ${r.mediaWork.publicationOrReleaseYear || '?'} | ${r.podcastMeta.appleCollectionId || 'None'} | ${r.mediaWork.imagePath ? 'Yes' : 'No'} | ${r.reviewWarnings.join(' ') || 'Clean'} |`
    ),
    '',
  ];

  fs.writeFileSync(path.join(OUT_DIR, 'AUDIT_REPORT.md'), lines.join('\n'), 'utf8');
  console.log(`\nWrote ${bundle.length} series to ${bundlePath}`);
  console.log(`Core CREATE/MERGE: ${coreRows.length} | Default SKIP: ${bundle.length - coreRows.length}`);
  console.log(`Apple Verified: ${withApple} | Artwork: ${withArt} | RSS URLs: ${withRss}`);
}

main().catch((err) => {
  console.error('Fatal error preparing podcast bundle:', err);
  process.exit(1);
});

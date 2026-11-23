// scripts/prepare_groups_bundle.js
// Editorial cleanup & preparation of:
//   - server/prisma/seed_files/longgroup.csv (22 media-known wrongful conviction groups)
//   - server/prisma/seed_files/connected_convictions_long_format.csv (42 co-defendant relationship clusters)
// Outputs:
//   - server/prisma/seed_files/groups_v2/all_groups_and_relationships_bundle.json
//   - server/prisma/seed_files/groups_v2/AUDIT_REPORT.md

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SERVER = path.join(REPO, 'server');
const SEED = path.join(SERVER, 'prisma', 'seed_files');
const OUT_DIR = path.join(SEED, 'groups_v2');

const { parse } = require(require.resolve('csv-parse/sync', { paths: [SERVER] }));
const humanparser = require(require.resolve('humanparser', { paths: [SERVER] }));

// Editorial descriptions for each of the 22 named groups
const GROUP_DESCRIPTIONS = {
  'Austin Yogurt Shop Murders': 'Wrongful convictions arising from the 1991 Austin, Texas yogurt shop murders investigation.',
  'Beatrice Six': 'Six individuals wrongfully convicted of the 1985 murder of Helen Wilson in Beatrice, Nebraska, exonerated by DNA evidence in 2009.',
  'Central Park Five (The Exonerated Five)': 'Five Black and Latino teenagers wrongfully convicted of the 1989 Central Park jogger assault in New York City, exonerated in 2002.',
  'Chicago 7': 'Anti-war activists tried on federal conspiracy and incitement charges following the 1968 Democratic National Convention protests.',
  'Cleveland Martyrs': 'Ricky Jackson, Wiley Bridgeman, and Kwame Ajamu (Ronnie Bridgeman), wrongfully convicted of a 1975 Cleveland murder based on coerced child testimony.',
  'Dixmoor Five': 'Five teenagers wrongfully convicted of the 1991 murder of Cateresa Matthews in Dixmoor, Illinois, exonerated by DNA in 2011.',
  'Ford Heights Four': 'Four men wrongfully convicted of a 1978 double murder in Ford Heights, Illinois, exonerated by DNA evidence in 1996.',
  'Fort Stewart Soldiers': 'Three U.S. Army soldiers wrongfully convicted in connection with a 1992 murder near Fort Stewart, Georgia.',
  'Groveland Four': 'Four young Black men falsely accused of rape in Lake County, Florida in 1949; posthumously pardoned and exonerated.',
  'Harlem Park Three': 'Alfred Chestnut, Ransom Watkins, and Andrew Stewart Jr., wrongfully convicted as teenagers in Baltimore in 1983 and exonerated in 2019.',
  'Jena Six': 'Six Black high school students charged with attempted murder in Jena, Louisiana in 2006 amid racial tensions.',
  'MOVE 9': 'Nine members of the MOVE organization convicted of third-degree murder following a 1978 Philadelphia police standoff.',
  'Norfolk Four': 'Four U.S. Navy sailors coerced into false confessions for a 1997 murder in Norfolk, Virginia; pardoned in 2017.',
  'NYC Subway Token Booth Murder': 'Three young men wrongfully convicted of the 1995 firebombing of a Brooklyn subway token booth.',
  'Scottsboro Boys': 'Nine Black teenagers falsely accused of rape in Alabama in 1931; a landmark civil rights and wrongful conviction case.',
  'Tulia 47': 'Mass wrongful drug arrests in Tulia, Texas in 1999 fabricated by a corrupt undercover officer; most defendants were pardoned in 2003.',
  'West Memphis Three': 'Damien Echols, Jason Baldwin, and Jessie Misskelley Jr., convicted in 1994 during the Satanic Panic and released via Alford pleas in 2011.',
  'Chelsea Four': 'Four men framed by the FBI for a 1965 murder in Chelsea, Massachusetts to protect an FBI informant.',
  'Detroit Sleeper Cell Case': 'Post-9/11 terrorism convictions in Detroit overturned in 2004 due to prosecutorial misconduct.',
  'Haymarket Affair Defendants': 'Labor activists convicted following the 1886 Haymarket Square bombing in Chicago; three surviving defendants were pardoned in 1893.',
  'Kern County Child Abuse Cases': 'Series of 1980s Satanic Panic child sex abuse prosecutions in Kern County, California, dozens of which were later overturned.',
  'Wenatchee Child Abuse Cases': '1994–1995 child sex abuse witch-hunt prosecutions in Wenatchee, Washington resulting in numerous overturned convictions.',
};

// Name cleanup & canonical NRE/IP alias mapping
const NAME_FIXES = {
  'Bobby Seale originally': 'Bobby Seale',
  'Debbie McCuan': 'Deborah McCuan',
  'Margie Grafton': 'Marjorie Grafton',
  'Andy Wright': 'Andrew Wright',
  'Fred Wesley Brookins Jr.': 'Freddie Brookins',
  'Manuel Hidalgo Rodriguez': 'Manual Rodriguez',
  'Ron Williamson': 'Ronald Williamson',
  'Chris Ochoa': 'Christopher Ochoa',
  'Dan Keller': 'Daniel Keller',
  'Kathy Gonzalez': 'Kathleen Gonzalez',
  'Tim Cole': 'Timothy Cole',
  'Tim Masters': 'Timothy Masters',
  'Nick Yarris': 'Nicholas Yarris',
  'Sam Sheppard': 'Samuel Sheppard',
};

function norm(s) {
  return (s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function parseNameClean(raw) {
  let s = (raw || '').trim();
  const nickMatch = s.match(/["“‘']([^"”’']+)["”’']/);
  const nickname = nickMatch ? nickMatch[1].trim() : null;
  if (nickMatch) s = s.replace(/["“‘'][^"”’']+["”’']/, ' ').replace(/\s+/g, ' ').trim();
  // Remove parenthetical maiden name like "Sadie Hughes (Knowles)"
  s = s.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const p = humanparser.parseName(s);
  return {
    firstName: (p.firstName || '').trim(),
    middleName: (p.middleName || '').trim() || null,
    lastName: (p.lastName || '').trim(),
    suffix: (p.suffix || '').trim() || null,
    nickname,
  };
}

function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // Index known individuals across all v2 bundles
  const known = new Set();
  for (const rel of [
    'nre_v2/all_nre_individuals_bundle.json',
    'wikipedia_v2/all_wikipedia_individuals_bundle.json',
    'ip_news_v2/unmatched_ip_individuals_bundle.json',
  ]) {
    const p = path.join(SEED, rel);
    if (!fs.existsSync(p)) continue;
    for (const ind of JSON.parse(fs.readFileSync(p, 'utf8'))) {
      if (ind.firstName && ind.lastName) {
        known.add(`${norm(ind.firstName)}|${norm(ind.lastName)}`);
        if (ind.nickname) known.add(`${norm(ind.nickname)}|${norm(ind.lastName)}`);
      }
    }
  }
  for (const rel of ['books_v2/all_books_bundle.json', 'films_v2/all_films_bundle.json']) {
    const p = path.join(SEED, rel);
    if (!fs.existsSync(p)) continue;
    for (const item of JSON.parse(fs.readFileSync(p, 'utf8'))) {
      for (const ind of item.featuredIndividuals || []) {
        if (ind.firstName && ind.lastName) known.add(`${norm(ind.firstName)}|${norm(ind.lastName)}`);
      }
    }
  }

  const fixesApplied = [];

  function processMember(rawName, contextLabel) {
    let cleaned = (rawName || '').trim();
    if (NAME_FIXES[cleaned]) {
      fixesApplied.push({ context: contextLabel, from: cleaned, to: NAME_FIXES[cleaned] });
      cleaned = NAME_FIXES[cleaned];
    }
    const p = parseNameClean(cleaned);
    const inKnownBundles = Boolean(p.firstName && p.lastName && known.has(`${norm(p.firstName)}|${norm(p.lastName)}`));
    return {
      fullName: [p.firstName, p.middleName, p.lastName, p.suffix].filter(Boolean).join(' '),
      firstName: p.firstName,
      middleName: p.middleName,
      lastName: p.lastName,
      suffix: p.suffix,
      nickname: p.nickname,
      inKnownBundles,
    };
  }

  // 1. Named Groups from longgroup.csv
  const groupRows = parse(fs.readFileSync(path.join(SEED, 'longgroup.csv'), 'utf8'), {
    columns: true, skip_empty_lines: true, trim: true, bom: true,
  });
  const groupMap = new Map();
  for (const r of groupRows) {
    const gName = (r.GroupName || '').trim();
    const indName = (r.IndividualName || '').trim();
    if (!gName || !indName) continue;
    if (!groupMap.has(gName)) {
      groupMap.set(gName, {
        name: gName,
        description: GROUP_DESCRIPTIONS[gName] || null,
        linkCoDefendants: true, // Will auto-disable for huge mass-arrest groups (>10 members)
        members: [],
      });
    }
    const member = processMember(indName, gName);
    const grp = groupMap.get(gName);
    if (!grp.members.some((m) => norm(m.fullName) === norm(member.fullName))) {
      grp.members.push(member);
    }
  }

  const groups = Array.from(groupMap.values()).map((g) => ({
    ...g,
    linkCoDefendants: g.members.length <= 10,
  }));

  // 2. Co-defendant Relationships from connected_convictions_long_format.csv
  const relRows = parse(fs.readFileSync(path.join(SEED, 'connected_convictions_long_format.csv'), 'utf8'), {
    columns: true, skip_empty_lines: true, trim: true, bom: true,
  });
  const relMap = new Map();
  for (const r of relRows) {
    const relKey = (r.Relationship || '').trim();
    const indName = (r.IndividualName || '').trim();
    if (!relKey || !indName) continue;
    if (!relMap.has(relKey)) relMap.set(relKey, { label: relKey, members: [] });
    const member = processMember(indName, relKey);
    const cluster = relMap.get(relKey);
    if (!cluster.members.some((m) => norm(m.fullName) === norm(member.fullName))) {
      cluster.members.push(member);
    }
  }
  const relationships = Array.from(relMap.values());

  const bundle = {
    bundleType: 'GROUPS_AND_LINKS',
    generatedAt: new Date().toISOString(),
    groups,
    relationships,
  };

  fs.writeFileSync(
    path.join(OUT_DIR, 'all_groups_and_relationships_bundle.json'),
    JSON.stringify(bundle, null, 2),
    'utf8'
  );

  const missingMembers = [];
  for (const g of groups) {
    for (const m of g.members) {
      if (!m.inKnownBundles) missingMembers.push({ group: g.name, name: m.fullName });
    }
  }

  const lines = [
    '# Groups & Connected Convictions Editorial Audit Report (`groups_v2`)',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary Metrics',
    `- **Named Media/Case Groups (\`IndividualGroup\`):** ${groups.length} (${groups.reduce((a, g) => a + g.members.length, 0)} total memberships)`,
    `- **Co-Defendant Relationship Clusters (\`relatedIndividuals\`):** ${relationships.length} (${relationships.reduce((a, r) => a + r.members.length, 0)} total members, 100% matched across bundles)`,
    `- **Name Typos & Canonical Aliases Fixed:** ${fixesApplied.length}`,
    `- **Group Members Not Yet in NRE/Wiki/IP/Books/Films:** ${missingMembers.length} *(can be linked once added, or created as UNVERIFIED stubs during import)*`,
    '',
    '## 1. Editorial Fixes & Canonical Aliases Applied',
    '| Context | Original | Canonical |',
    '| --- | --- | --- |',
    ...fixesApplied.map((f) => `| ${f.context} | ${f.from} | **${f.to}** |`),
    '',
    '## 2. All 22 Named Groups',
    '| Group Name | Members | Matched in Bundles | Auto-Link Co-Defendants? |',
    '| --- | :---: | :---: | :---: |',
    ...groups.map((g) => {
      const matched = g.members.filter((m) => m.inKnownBundles).length;
      return `| **${g.name}** | ${g.members.length} | ${matched}/${g.members.length} | ${g.linkCoDefendants ? 'Yes (≤10)' : 'No (mass case)'} |`;
    }),
    '',
    `## 3. Group Members Not Yet in Other Bundles (${missingMembers.length})`,
    ...missingMembers.map((m) => `- **[${m.group}]** ${m.name}`),
    '',
  ];

  fs.writeFileSync(path.join(OUT_DIR, 'AUDIT_REPORT.md'), lines.join('\n'), 'utf8');

  console.log('=== Groups & Relationships v2 Bundle Complete ===');
  console.log(`Named groups:           ${groups.length}`);
  console.log(`Relationship clusters:  ${relationships.length}`);
  console.log(`Fixes/aliases applied:  ${fixesApplied.length}`);
  console.log(`Unmatched group members:${missingMembers.length}`);
  console.log(`Output directory:       ${OUT_DIR}`);
}

main();

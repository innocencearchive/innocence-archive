// server/utils/canonicalCatalog.js
// Single source of truth for standardized lookup tables and fuzzy/alias resolvers
// shared by seed scripts and /api/admin staging/import workflows.

const CONTRIBUTING_FACTOR_CATALOG = [
  {
    code: 'FALSE_CONFESSION',
    name: 'False Confession',
    description: 'An admission of guilt by an innocent person, often resulting from coercive or deceptive interrogation tactics.',
  },
  {
    code: 'OFFICIAL_MISCONDUCT',
    name: 'Official Misconduct',
    description: 'Abuse of authority or improper conduct by government officials involved in investigating or prosecuting a case.',
  },
  {
    code: 'POLICE_MISCONDUCT',
    name: 'Police Misconduct',
    description: 'Improper or unlawful actions by law enforcement officers, such as fabricating evidence, coercing witnesses, or suggestive lineups.',
  },
  {
    code: 'PROSECUTORIAL_MISCONDUCT',
    name: 'Prosecutorial Misconduct',
    description: 'Improper conduct by prosecutors, including presenting false testimony, improper arguments, or violating ethical duties.',
  },
  {
    code: 'WITHHELD_EXCULPATORY_EVIDENCE',
    name: 'Withheld Exculpatory Evidence (Brady Violation)',
    description: 'Failure by prosecution or police to disclose evidence favorable to the defense as required under Brady v. Maryland.',
  },
  {
    code: 'MISTAKEN_EYEWITNESS_IDENTIFICATION',
    name: 'Mistaken Eyewitness Identification',
    description: 'Incorrect identification of an innocent person by a witness, often influenced by flawed lineup or photo array procedures.',
  },
  {
    code: 'PERJURY_OR_FALSE_ACCUSATION',
    name: 'Perjury or False Accusation',
    description: 'Deliberately false testimony or fabricated accusations made by a witness, accuser, or official.',
  },
  {
    code: 'FALSE_OR_MISLEADING_FORENSIC_EVIDENCE',
    name: 'False or Misleading Forensic Evidence',
    description: 'Unvalidated, overstated, or fraudulent forensic science or expert testimony (e.g., flawed bite mark, arson, or hair microscopy analysis).',
  },
  {
    code: 'INADEQUATE_LEGAL_DEFENSE',
    name: 'Inadequate Legal Defense',
    description: 'Ineffective assistance of counsel, underfunded defense representation, or failure to investigate key evidence or alibis.',
  },
  {
    code: 'JAILHOUSE_INFORMANT',
    name: 'Jailhouse Informant',
    description: 'Unreliable or incentivized testimony from an incarcerated informant claiming the defendant confessed in custody.',
  },
  {
    code: 'TUNNEL_VISION_RUSH_TO_JUDGMENT',
    name: 'Tunnel Vision / Rush to Judgment',
    description: 'Cognitive bias causing investigators or prosecutors to focus prematurely on a single suspect while ignoring exculpatory leads.',
  },
  {
    code: 'RACIAL_BIAS',
    name: 'Racial Bias',
    description: 'Explicit or implicit racial prejudice affecting investigation, charging, jury selection, trial, or sentencing.',
  },
  {
    code: 'PREJUDICIAL_JOINDER_JOINT_TRIAL',
    name: 'Prejudicial Joinder / Joint Trial',
    description: 'Trying multiple defendants or unrelated charges together in a manner that unfairly prejudices the jury against an innocent defendant.',
  },
  {
    code: 'MEDIA_SENSATIONALISM',
    name: 'Media Sensationalism',
    description: 'Prejudicial pretrial publicity, moral panic, or sensationalized coverage that biases public opinion or the jury pool.',
  },
  {
    code: 'COERCED_PLEA',
    name: 'Coerced Plea',
    description: 'A guilty or Alford plea entered by an innocent person under pressure, such as threat of the death penalty or a harsher sentence.',
  },
  {
    code: 'UNRELIABLE_WITNESS',
    name: 'Unreliable Witness',
    description: 'Testimony from a witness whose credibility, memory, coaching, or incentives make the account unreliable.',
  },
];

const CONTRIBUTING_FACTOR_LABELS = Object.fromEntries(
  CONTRIBUTING_FACTOR_CATALOG.map((f) => [f.code, f.name])
);

const CONTRIBUTING_FACTOR_NAME_TO_CODE = Object.fromEntries(
  CONTRIBUTING_FACTOR_CATALOG.map((f) => [f.name.toLowerCase(), f.code])
);

// Keyword/pattern rules to map legacy free-text factor strings into canonical ContributingFactorCode values
const FACTOR_ALIAS_PATTERNS = [
  { code: 'WITHHELD_EXCULPATORY_EVIDENCE', pattern: /\b(brady|withheld|withholding|suppressed|suppression|exculpatory|hidden evidence|concealed evidence|non-disclosure|nondisclosure)\b/i },
  { code: 'FALSE_CONFESSION', pattern: /\b(false confession|coerced confession|forced confession|interrogation|confessed)\b/i },
  { code: 'MISTAKEN_EYEWITNESS_IDENTIFICATION', pattern: /\b(eyewitness|misidentification|lineup|photo array|mistaken id|flawed identification|cross-racial identification)\b/i },
  { code: 'JAILHOUSE_INFORMANT', pattern: /\b(jailhouse|informant|snitch|incentivized witness)\b/i },
  { code: 'FALSE_OR_MISLEADING_FORENSIC_EVIDENCE', pattern: /\b(forensic|junk science|bite ?mark|arson|hair microscopy|fingerprint|ballistic|polygraph|serology|shaken baby|flawed science|medical evidence|autopsy|dna lab|crime lab|expert testimony)\b/i },
  { code: 'INADEQUATE_LEGAL_DEFENSE', pattern: /\b(ineffective|inadequate|defense counsel|legal defense|legal representation|public defender|bad lawyer|failure to investigate)\b/i },
  { code: 'PROSECUTORIAL_MISCONDUCT', pattern: /\b(prosecutorial|prosecutor|da misconduct|district attorney)\b/i },
  { code: 'POLICE_MISCONDUCT', pattern: /\b(police misconduct|detective|planted evidence|fabricated evidence|police coercion|police corruption|law enforcement misconduct)\b/i },
  { code: 'OFFICIAL_MISCONDUCT', pattern: /\b(official misconduct|government misconduct|judicial bias|judicial misconduct|corrupt judge|state misconduct)\b/i },
  { code: 'PERJURY_OR_FALSE_ACCUSATION', pattern: /\b(perjury|false accusation|false testimony|fabricated accusation|lied on the stand|lying witness|recanted)\b/i },
  { code: 'TUNNEL_VISION_RUSH_TO_JUDGMENT', pattern: /\b(tunnel vision|rush to judgment|confirmation bias|ignoring.*actual perpetrator|ignoring.*leads)\b/i },
  { code: 'RACIAL_BIAS', pattern: /\b(racial|racism|all-white jury|batson|jim crow|discrimination)\b/i },
  { code: 'PREJUDICIAL_JOINDER_JOINT_TRIAL', pattern: /\b(joinder|joint trial|co-defendant trial|tried together)\b/i },
  { code: 'MEDIA_SENSATIONALISM', pattern: /\b(media|sensational|satanic panic|mass hysteria|public frenzy|pretrial publicity)\b/i },
  { code: 'COERCED_PLEA', pattern: /\b(coerced plea|guilty plea|plea bargain|alford plea|threat.*death penalty)\b/i },
  { code: 'UNRELIABLE_WITNESS', pattern: /\b(unreliable witness|coached witness|child testimony|child interview|hypnotized|contaminated testimony|sole witness)\b/i },
];

/**
 * Resolves a raw string or object into one or more canonical ContributingFactorCode values.
 * Exact code/label matches take precedence; otherwise falls back to alias pattern matching.
 * @param {string|object} raw
 * @returns {string[]} Array of unique canonical ContributingFactorCode enum strings
 */
function resolveContributingFactorCodes(raw) {
  if (!raw) return [];
  const val = (typeof raw === 'string' ? raw : raw?.code || raw?.name || '').trim();
  if (!val) return [];

  const upper = val.toUpperCase();
  if (CONTRIBUTING_FACTOR_LABELS[upper]) return [upper];

  const exactByName = CONTRIBUTING_FACTOR_NAME_TO_CODE[val.toLowerCase()];
  if (exactByName) return [exactByName];

  const matched = new Set();
  for (const { code, pattern } of FACTOR_ALIAS_PATTERNS) {
    if (pattern.test(val)) {
      matched.add(code);
    }
  }
  return Array.from(matched);
}

// 45 Standardized Crime Categories from the National Registry of Exonerations (ordered by severity)
const CANONICAL_CRIME_CATEGORIES = [
  { crime_name: 'Murder', severity_order: 1 },
  { crime_name: 'Accessory to Murder', severity_order: 2 },
  { crime_name: 'Attempted Murder', severity_order: 3 },
  { crime_name: 'Manslaughter', severity_order: 4 },
  { crime_name: 'Sexual Assault', severity_order: 5 },
  { crime_name: 'Child Sex Abuse', severity_order: 6 },
  { crime_name: 'Kidnapping', severity_order: 7 },
  { crime_name: 'Arson', severity_order: 8 },
  { crime_name: 'Robbery', severity_order: 9 },
  { crime_name: 'Assault', severity_order: 10 },
  { crime_name: 'Child Abuse', severity_order: 11 },
  { crime_name: 'Dependent Adult Abuse', severity_order: 12 },
  { crime_name: 'Supporting Terrorism', severity_order: 13 },
  { crime_name: 'Attempt, Violent', severity_order: 14 },
  { crime_name: 'Other Violent Felony', severity_order: 15 },
  { crime_name: 'Other Violent Misdemeanor', severity_order: 16 },
  { crime_name: 'Burglary/Unlawful Entry', severity_order: 17 },
  { crime_name: 'Weapon Possession or Sale', severity_order: 18 },
  { crime_name: 'Drug Possession or Sale', severity_order: 19 },
  { crime_name: 'Sex Offender Registration', severity_order: 20 },
  { crime_name: 'Conspiracy', severity_order: 21 },
  { crime_name: 'Solicitation', severity_order: 22 },
  { crime_name: 'Stalking', severity_order: 23 },
  { crime_name: 'Threats', severity_order: 24 },
  { crime_name: 'Menacing', severity_order: 25 },
  { crime_name: 'Harassment', severity_order: 26 },
  { crime_name: 'Fraud', severity_order: 27 },
  { crime_name: 'Tax Evasion/Fraud', severity_order: 28 },
  { crime_name: 'Bribery', severity_order: 29 },
  { crime_name: 'Forgery', severity_order: 30 },
  { crime_name: 'Theft', severity_order: 31 },
  { crime_name: 'Possession of Stolen Property', severity_order: 32 },
  { crime_name: 'Destruction of Property', severity_order: 33 },
  { crime_name: 'Perjury', severity_order: 34 },
  { crime_name: 'Obstruction of Justice', severity_order: 35 },
  { crime_name: 'Official Misconduct', severity_order: 36 },
  { crime_name: 'Filing a False Report', severity_order: 37 },
  { crime_name: 'Immigration', severity_order: 38 },
  { crime_name: 'Military Justice Offense', severity_order: 39 },
  { crime_name: 'Failure to Pay Child Support', severity_order: 40 },
  { crime_name: 'Traffic Offense', severity_order: 41 },
  { crime_name: 'Attempt, Nonviolent', severity_order: 42 },
  { crime_name: 'Other Nonviolent Felony', severity_order: 43 },
  { crime_name: 'Other Nonviolent Misdemeanor', severity_order: 44 },
  { crime_name: 'Other', severity_order: 45 },
];

const CRIME_CATEGORY_BY_LOWER = Object.fromEntries(
  CANONICAL_CRIME_CATEGORIES.map((c) => [c.crime_name.toLowerCase(), c.crime_name])
);

/**
 * Maps raw/messy crime strings (e.g., from Wikipedia) to the highest-severity canonical CrimeCategory name.
 * @param {string} rawCrime
 * @returns {string|null} Canonical crime_name or null if empty
 */
function resolveCrimeCategoryName(rawCrime) {
  if (!rawCrime || typeof rawCrime !== 'string') return null;
  const cleaned = rawCrime.replace(/\*+/g, '').trim();
  if (!cleaned) return null;

  const exact = CRIME_CATEGORY_BY_LOWER[cleaned.toLowerCase()];
  if (exact) return exact;

  // Fallback priority order (highest severity first) for free-text strings like "Arson, murder*" or "Murder of ..."
  const lower = cleaned.toLowerCase();
  if (/\b(murder|assassination|homicide)\b/.test(lower)) {
    if (/\battempted\b/.test(lower) && !/\bmurder(s)?\b(?!.*attempted)/.test(lower.replace(/attempted\s+murder/g, ''))) {
      return 'Attempted Murder';
    }
    if (/\baccessory\b/.test(lower)) return 'Accessory to Murder';
    return 'Murder';
  }
  if (/\bmanslaughter\b/.test(lower)) return 'Manslaughter';
  if (/\b(child sex|child sexual|child molestation)\b/.test(lower)) return 'Child Sex Abuse';
  if (/\b(rape|sexual assault|criminal sexual conduct|sodomy|sexual abuse)\b/.test(lower)) return 'Sexual Assault';
  if (/\bkidnapping\b/.test(lower)) return 'Kidnapping';
  if (/\barson\b/.test(lower)) return 'Arson';
  if (/\brobbery\b/.test(lower)) return 'Robbery';
  if (/\b(child abuse|assault of a child)\b/.test(lower)) return 'Child Abuse';
  if (/\b(assault|stabbing)\b/.test(lower)) return 'Assault';
  if (/\b(terrorism|bombing|sabotage)\b/.test(lower)) return 'Supporting Terrorism';
  if (/\b(burglary|breaking and entering)\b/.test(lower)) return 'Burglary/Unlawful Entry';
  if (/\b(weapon|firearm|gun)\b/.test(lower)) return 'Weapon Possession or Sale';
  if (/\b(drug|controlled substance)\b/.test(lower)) return 'Drug Possession or Sale';
  if (/\b(fraud|identity theft)\b/.test(lower)) return 'Fraud';
  if (/\btheft\b/.test(lower)) return 'Theft';
  if (/\bperjury\b/.test(lower)) return 'Perjury';
  if (/\bfalse report\b/.test(lower)) return 'Filing a False Report';
  if (/\bconspiracy\b/.test(lower)) return 'Conspiracy';

  return 'Other';
}

// Core InformationSource records for provenance tracking
const CORE_INFORMATION_SOURCES = [
  {
    name: 'National Registry of Exonerations',
    baseUrl: 'https://www.law.umich.edu/special/exoneration',
  },
  {
    name: 'Innocence Project',
    baseUrl: 'https://innocenceproject.org',
  },
  {
    name: 'Wikipedia',
    baseUrl: 'https://en.wikipedia.org/wiki/List_of_wrongful_convictions_in_the_United_States',
  },
  {
    name: 'Wrongful Conviction Podcast',
    baseUrl: 'https://www.lavaforgood.com/wrongful-conviction',
  },
  {
    name: 'TMDB',
    baseUrl: 'https://www.themoviedb.org',
  },
  {
    name: 'Google Books',
    baseUrl: 'https://books.google.com',
  },
];

module.exports = {
  CONTRIBUTING_FACTOR_CATALOG,
  CONTRIBUTING_FACTOR_LABELS,
  CONTRIBUTING_FACTOR_NAME_TO_CODE,
  resolveContributingFactorCodes,
  CANONICAL_CRIME_CATEGORIES,
  resolveCrimeCategoryName,
  CORE_INFORMATION_SOURCES,
};

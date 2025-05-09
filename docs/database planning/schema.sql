-- Database Schema for Wrongfully Convicted Americans
-- Based on analysis of spreadsheet data and coding manual

-- Main table for exonerees
CREATE TABLE exonerees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    last_name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    age_at_crime REAL,
    race TEXT NOT NULL,
    sex TEXT NOT NULL,
    state TEXT NOT NULL,
    county TEXT,
    worst_crime TEXT NOT NULL,
    sentence TEXT NOT NULL,
    convicted_year INTEGER NOT NULL,
    exonerated_year INTEGER NOT NULL,
    posting_date DATE NOT NULL,
    date_of_crime_year INTEGER NOT NULL,
    years_to_exoneration INTEGER GENERATED ALWAYS AS (exonerated_year - convicted_year) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for tags (many-to-many relationship with exonerees)
CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_code TEXT NOT NULL UNIQUE,
    tag_name TEXT NOT NULL,
    tag_description TEXT NOT NULL
);

-- Junction table for exonerees and tags (many-to-many)
CREATE TABLE exoneree_tags (
    exoneree_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (exoneree_id, tag_id),
    FOREIGN KEY (exoneree_id) REFERENCES exonerees(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Table for contributing factors (DNA, F/MFE, FC, ILD, P/FA, MWID, OM)
CREATE TABLE contributing_factors (
    exoneree_id INTEGER NOT NULL,
    dna_evidence BOOLEAN DEFAULT FALSE,
    false_misleading_forensic_evidence BOOLEAN DEFAULT FALSE,
    false_confession BOOLEAN DEFAULT FALSE,
    inadequate_legal_defense BOOLEAN DEFAULT FALSE,
    perjury_false_accusation BOOLEAN DEFAULT FALSE,
    mistaken_witness_id BOOLEAN DEFAULT FALSE,
    official_misconduct BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (exoneree_id),
    FOREIGN KEY (exoneree_id) REFERENCES exonerees(id) ON DELETE CASCADE
);

-- Table for official misconduct tags (many-to-many relationship with exonerees)
CREATE TABLE om_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_code TEXT NOT NULL UNIQUE,
    tag_description TEXT NOT NULL
);

-- Junction table for exonerees and OM tags (many-to-many)
CREATE TABLE exoneree_om_tags (
    exoneree_id INTEGER NOT NULL,
    om_tag_id INTEGER NOT NULL,
    PRIMARY KEY (exoneree_id, om_tag_id),
    FOREIGN KEY (exoneree_id) REFERENCES exonerees(id) ON DELETE CASCADE,
    FOREIGN KEY (om_tag_id) REFERENCES om_tags(id) ON DELETE CASCADE
);

-- Table for crime categories
CREATE TABLE crime_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crime_name TEXT NOT NULL UNIQUE,
    severity_order INTEGER NOT NULL
);

-- Insert tag definitions from coding manual
INSERT INTO tags (tag_code, tag_name, tag_description) VALUES
('A', 'Arson', 'The exoneree was convicted of arson or the exoneration depended at least in part on evidence that the exoneree did not commit arson'),
('CDC', 'Codefendant confession', 'A codefendant of the exoneree, or a person who might have been charged as a codefendant, gave a pre-conviction confession that also implicated the exoneree'),
('CIU', 'Conviction Integrity Unit', 'A Conviction Integrity Unit in the prosecutorial office that prosecuted the exoneree helped secure the exoneration'),
('CSH', 'Child sex abuse hysteria', 'The exoneree was convicted of child sex abuse as part of a wave of child sex abuse prosecutions in the 1980s and 1990s based on aggressive and suggestive interviews of children'),
('CV', 'Child victim', 'At least one victim is under 18'),
('F', 'Female exoneree', 'The exoneree is female'),
('FED', 'Federal court prosecution', 'The trial court was a federal court'),
('H', 'Homicide', 'The exoneree was convicted of either murder or manslaughter'),
('JI', 'Jailhouse Informant', 'A witness who was incarcerated with the exoneree testified or reported that the exoneree confessed to him or her'),
('M', 'Misdemeanor', 'The worst crime for which the exoneree was convicted was a misdemeanor'),
('NC', 'No crime occurred', 'The exoneree was convicted of a crime that did not occur'),
('P', 'Plea', 'Exoneree pled guilty at 1st or 2nd trial'),
('PH', 'Posthumous exoneration', 'The exoneration occurred after the person died'),
('SBS', 'Shaken baby syndrome', 'The exoneree was convicted of injuring or killing an infant by violent shaking, based on a medical diagnosis that is now highly controversial'),
('IO', 'Insufficient evidence', 'The exoneree was convicted with insufficient evidence');

-- Insert crime categories from coding manual
INSERT INTO crime_categories (crime_name, severity_order) VALUES
('Murder', 1),
('Manslaughter', 2),
('Attempted Murder', 3),
('Accessory to Murder', 4),
('Sexual Assault', 5),
('Child Sex Abuse', 6),
('Child Abuse', 7),
('Robbery', 8),
('Assault', 9),
('Arson', 10),
('Kidnapping', 11),
('Terrorism', 12),
('Supporting Terrorism', 13),
('Attempt, Violent', 14),
('Other Violent Felony', 15),
('Burglary/Unlawful Entry', 16),
('Theft', 17),
('Forgery', 18),
('Possession of Stolen Property', 19),
('Destruction of Property', 20),
('Drug Possession or Sale', 21),
('Gun Possession or Sale', 22),
('Other Weapon Possession or Sale', 23),
('Sex Offender Registration', 24),
('Tax Evasion/Fraud', 25),
('Immigration', 26),
('Fraud', 27),
('Bribery', 28),
('Perjury', 29),
('Official Misconduct', 30),
('Traffic Offense', 31),
('Conspiracy', 32),
('Solicitation', 33),
('Obstruction of Justice', 34),
('Failure to Pay Child Support', 35),
('Dependent Adult Abuse', 36),
('Attempt, Nonviolent', 37),
('Other Nonviolent Felony', 38),
('Military Justice Offense', 39),
('Menacing', 40),
('Stalking', 41),
('Harassment', 42),
('Threats', 43),
('Filing a False Report', 44),
('Other', 45);

-- Create indexes for performance
CREATE INDEX idx_exonerees_last_name ON exonerees(last_name);
CREATE INDEX idx_exonerees_race ON exonerees(race);
CREATE INDEX idx_exonerees_state ON exonerees(state);
CREATE INDEX idx_exonerees_worst_crime ON exonerees(worst_crime);
CREATE INDEX idx_exonerees_convicted_year ON exonerees(convicted_year);
CREATE INDEX idx_exonerees_exonerated_year ON exonerees(exonerated_year);
CREATE INDEX idx_exoneree_tags_exoneree_id ON exoneree_tags(exoneree_id);
CREATE INDEX idx_exoneree_tags_tag_id ON exoneree_tags(tag_id);

-- Create views for common queries
CREATE VIEW exoneree_details AS
SELECT 
    e.id, 
    e.last_name, 
    e.first_name, 
    e.age_at_crime, 
    e.race, 
    e.sex, 
    e.state, 
    e.county, 
    e.worst_crime, 
    e.sentence, 
    e.convicted_year, 
    e.exonerated_year, 
    e.years_to_exoneration,
    e.date_of_crime_year,
    cf.dna_evidence, 
    cf.false_misleading_forensic_evidence, 
    cf.false_confession, 
    cf.inadequate_legal_defense, 
    cf.perjury_false_accusation, 
    cf.mistaken_witness_id, 
    cf.official_misconduct
FROM 
    exonerees e
LEFT JOIN 
    contributing_factors cf ON e.id = cf.exoneree_id;

-- View for exonerees with their tags
CREATE VIEW exoneree_with_tags AS
SELECT 
    e.id, 
    e.last_name, 
    e.first_name, 
    e.worst_crime,
    e.state,
    e.convicted_year,
    e.exonerated_year,
    GROUP_CONCAT(t.tag_code, ';') AS tags
FROM 
    exonerees e
LEFT JOIN 
    exoneree_tags et ON e.id = et.exoneree_id
LEFT JOIN 
    tags t ON et.tag_id = t.id
GROUP BY 
    e.id;

-- Schema Update for Wrongfully Convicted Americans Database
-- Adding Media Resources and Organizations tables

-- Table for media types (podcast, book, article, documentary, etc.)
CREATE TABLE media_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);

-- Table for media resources
CREATE TABLE media_resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    media_type_id INTEGER NOT NULL,
    creator TEXT,
    publication_date DATE,
    url TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (media_type_id) REFERENCES media_types(id)
);

-- Junction table for exonerees and media resources (many-to-many)
CREATE TABLE exoneree_media (
    exoneree_id INTEGER NOT NULL,
    media_id INTEGER NOT NULL,
    PRIMARY KEY (exoneree_id, media_id),
    FOREIGN KEY (exoneree_id) REFERENCES exonerees(id) ON DELETE CASCADE,
    FOREIGN KEY (media_id) REFERENCES media_resources(id) ON DELETE CASCADE
);

-- Table for organizations that help wrongfully convicted individuals
CREATE TABLE organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    website TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    focus_area TEXT,
    year_founded INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Junction table for exonerees and organizations (many-to-many)
CREATE TABLE exoneree_organizations (
    exoneree_id INTEGER NOT NULL,
    organization_id INTEGER NOT NULL,
    assistance_type TEXT,
    assistance_year INTEGER,
    PRIMARY KEY (exoneree_id, organization_id),
    FOREIGN KEY (exoneree_id) REFERENCES exonerees(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Insert common media types
INSERT INTO media_types (name, description) VALUES
('Podcast', 'Audio podcast episodes or series'),
('Book', 'Published books including biographies and non-fiction'),
('News Article', 'News articles from newspapers, magazines, or online publications'),
('Documentary', 'Documentary films or series'),
('TV Show', 'Television shows or episodes'),
('Academic Paper', 'Academic or research papers'),
('Blog Post', 'Blog posts or online articles'),
('Interview', 'Interviews in various media'),
('Court Document', 'Public court documents and legal filings'),
('Video', 'Online videos including YouTube');

-- Create indexes for performance
CREATE INDEX idx_media_resources_title ON media_resources(title);
CREATE INDEX idx_media_resources_media_type_id ON media_resources(media_type_id);
CREATE INDEX idx_exoneree_media_exoneree_id ON exoneree_media(exoneree_id);
CREATE INDEX idx_exoneree_media_media_id ON exoneree_media(media_id);
CREATE INDEX idx_organizations_name ON organizations(name);
CREATE INDEX idx_exoneree_organizations_exoneree_id ON exoneree_organizations(exoneree_id);
CREATE INDEX idx_exoneree_organizations_organization_id ON exoneree_organizations(organization_id);

-- Create views for common queries
CREATE VIEW exoneree_with_media AS
SELECT 
    e.id, 
    e.last_name, 
    e.first_name, 
    e.worst_crime,
    e.state,
    e.convicted_year,
    e.exonerated_year,
    m.title AS media_title,
    mt.name AS media_type,
    m.creator,
    m.url
FROM 
    exonerees e
LEFT JOIN 
    exoneree_media em ON e.id = em.exoneree_id
LEFT JOIN 
    media_resources m ON em.media_id = m.id
LEFT JOIN
    media_types mt ON m.media_type_id = mt.id;

-- View for exonerees with their supporting organizations
CREATE VIEW exoneree_with_organizations AS
SELECT 
    e.id, 
    e.last_name, 
    e.first_name, 
    e.worst_crime,
    e.state,
    e.convicted_year,
    e.exonerated_year,
    o.name AS organization_name,
    o.website,
    eo.assistance_type,
    eo.assistance_year
FROM 
    exonerees e
LEFT JOIN 
    exoneree_organizations eo ON e.id = eo.exoneree_id
LEFT JOIN 
    organizations o ON eo.organization_id = o.id;

-- View for media resources with count of associated exonerees
CREATE VIEW media_with_exoneree_count AS
SELECT 
    m.id,
    m.title,
    mt.name AS media_type,
    m.creator,
    m.publication_date,
    m.url,
    COUNT(em.exoneree_id) AS exoneree_count
FROM 
    media_resources m
LEFT JOIN 
    media_types mt ON m.media_type_id = mt.id
LEFT JOIN 
    exoneree_media em ON m.id = em.media_id
GROUP BY 
    m.id;

-- View for organizations with count of exonerees helped
CREATE VIEW organizations_with_exoneree_count AS
SELECT 
    o.id,
    o.name,
    o.website,
    o.focus_area,
    COUNT(eo.exoneree_id) AS exonerees_helped
FROM 
    organizations o
LEFT JOIN 
    exoneree_organizations eo ON o.id = eo.organization_id
GROUP BY 
    o.id;

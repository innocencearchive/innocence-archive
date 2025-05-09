# Database Design for Wrongfully Convicted Americans

## Overview
This document explains the database schema design for the Wrongfully Convicted Americans project. The schema is designed to efficiently store and query information about wrongfully convicted individuals based on the provided spreadsheet data and coding manual.

## Tables Structure

### 1. exonerees
The main table storing core information about each wrongfully convicted individual.

- **id**: Unique identifier for each exoneree
- **last_name, first_name**: Name of the exoneree
- **age_at_crime**: Age of the exoneree when the crime occurred
- **race, sex**: Demographic information
- **state, county**: Location information
- **worst_crime**: The most serious crime for which they were wrongfully convicted
- **sentence**: The sentence they received
- **convicted_year**: Year of conviction
- **exonerated_year**: Year of exoneration
- **posting_date**: When the case was added to the database
- **date_of_crime_year**: Year when the alleged crime occurred
- **years_to_exoneration**: Calculated field showing time between conviction and exoneration

### 2. tags
Stores the various tag codes and their descriptions from the coding manual.

- **id**: Unique identifier for each tag
- **tag_code**: Short code for the tag (e.g., "H", "NC", "IO")
- **tag_name**: Full name of the tag
- **tag_description**: Detailed description of what the tag means

### 3. exoneree_tags
Junction table implementing the many-to-many relationship between exonerees and tags.

- **exoneree_id**: References the exonerees table
- **tag_id**: References the tags table

### 4. contributing_factors
Stores boolean flags for the various contributing factors to wrongful convictions.

- **exoneree_id**: References the exonerees table
- **dna_evidence**: Whether DNA evidence was a substantial factor in exoneration
- **false_misleading_forensic_evidence**: Whether false/misleading forensic evidence contributed
- **false_confession**: Whether a false confession was involved
- **inadequate_legal_defense**: Whether inadequate legal defense was a factor
- **perjury_false_accusation**: Whether perjury or false accusation was involved
- **mistaken_witness_id**: Whether mistaken witness identification was a factor
- **official_misconduct**: Whether official misconduct was involved

### 5. om_tags
Stores the official misconduct tag codes and descriptions.

- **id**: Unique identifier for each OM tag
- **tag_code**: Short code for the OM tag
- **tag_description**: Description of the OM tag

### 6. exoneree_om_tags
Junction table for the many-to-many relationship between exonerees and OM tags.

- **exoneree_id**: References the exonerees table
- **om_tag_id**: References the om_tags table

### 7. crime_categories
Stores the hierarchy of crime categories from the coding manual.

- **id**: Unique identifier for each crime category
- **crime_name**: Name of the crime
- **severity_order**: Numerical order of severity

## Views

### exoneree_details
A view that joins exonerees with their contributing factors for easier querying.

### exoneree_with_tags
A view that aggregates all tags for each exoneree into a single field for easier display and filtering.

## Design Decisions

1. **Normalized Structure**: The database follows normalization principles to reduce redundancy and improve data integrity.

2. **Junction Tables**: Many-to-many relationships are implemented using junction tables.

3. **Calculated Fields**: The years_to_exoneration field is calculated automatically to avoid data inconsistency.

4. **Indexes**: Indexes are created on frequently queried fields to improve performance.

5. **Views**: Views are created for common query patterns to simplify application code.

6. **Boolean Flags**: Contributing factors are stored as boolean flags for efficient filtering.

This design supports the requirements for the Wrongfully Convicted Americans database and website, allowing for efficient storage, retrieval, and analysis of the data.

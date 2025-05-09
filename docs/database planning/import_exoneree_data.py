#!/usr/bin/env python3
"""
Exoneree Data Import Script

This script imports exoneree data from the publicspreadsheet.xlsx file into a SQLite database
using the schema defined in schema.sql. It handles data transformation to match the database
schema and ensures data integrity during the import process.
"""

import os
import sqlite3
import pandas as pd
import logging
import re
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('exoneree_import.log'),
        logging.StreamHandler()
    ]
)

# Constants
DATABASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_FILE = os.path.join(DATABASE_DIR, "innocence_archive.db")
SCHEMA_FILE = os.path.join(DATABASE_DIR, "schema.sql")
EXCEL_FILE = os.path.join(DATABASE_DIR, "planning docs", "publicspreadsheet.xlsx")

def setup_database():
    """Create SQLite database using the schema.sql file"""
    logging.info(f"Setting up database at {DATABASE_FILE}")
    
    # Check if database file already exists
    if os.path.exists(DATABASE_FILE):
        logging.warning(f"Database file {DATABASE_FILE} already exists. Backing up before recreating.")
        backup_file = f"{DATABASE_FILE}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        os.rename(DATABASE_FILE, backup_file)
        logging.info(f"Created backup at {backup_file}")
    
    # Create new database
    conn = sqlite3.connect(DATABASE_FILE)
    
    # Read schema file
    with open(SCHEMA_FILE, 'r') as f:
        schema_sql = f.read()
    
    # Execute schema SQL
    conn.executescript(schema_sql)
    conn.commit()
    
    logging.info("Database setup complete")
    return conn

def read_excel_data():
    """Read exoneree data from Excel spreadsheet"""
    logging.info(f"Reading data from {EXCEL_FILE}")
    df = pd.read_excel(EXCEL_FILE)
    logging.info(f"Read {len(df)} rows from Excel file")
    return df

def transform_data(df):
    """Transform Excel data to match database schema"""
    logging.info("Transforming data to match database schema")
    
    # Create a copy of the dataframe to avoid modifying the original
    transformed_df = df.copy()
    
    # Rename columns to match database schema
    column_mapping = {
        'Last Name': 'last_name',
        'First Name': 'first_name',
        'Age': 'age_at_crime',
        'Race': 'race',
        'Sex': 'sex',
        'State': 'state',
        'County': 'county',
        'Worst Crime Display': 'worst_crime',
        'Sentence': 'sentence',
        'Convicted': 'convicted_year',
        'Exonerated': 'exonerated_year',
        'Date of Crime Year': 'date_of_crime_year'
    }
    
    # Apply column renaming
    transformed_df = transformed_df.rename(columns=column_mapping)
    
    # Extract tags before removing columns not in the schema
    tags_df = extract_tags(transformed_df, df['Tags'])
    
    # Extract OM tags if present
    om_tags_df = None
    if 'OM Tags' in df.columns:
        om_tags_df = extract_om_tags(transformed_df, df['OM Tags'])
    
    # Extract contributing factors
    contributing_factors_df = pd.DataFrame({
        'dna_evidence': df['DNA'].notna(),
        'false_misleading_forensic_evidence': df['F/MFE'].notna(),
        'false_confession': df['FC'].notna(),
        'inadequate_legal_defense': df['ILD'].notna(),
        'perjury_false_accusation': df['P/FA'].notna(),
        'mistaken_witness_id': df['MWID'].notna(),
        'official_misconduct': df['OM'].notna()
    }).astype(int)
    
    # Add index from original dataframe to use as foreign key
    contributing_factors_df['exoneree_id'] = transformed_df.index + 1
    
    # Add posting_date from the Posting Date column or use current date
    if 'Posting Date' in df.columns:
        transformed_df['posting_date'] = df['Posting Date']
    else:
        transformed_df['posting_date'] = datetime.now().strftime('%Y-%m-%d')
    
    # Keep only columns that match the database schema
    # Note: years_to_exoneration is a generated column in the schema, so we don't include it here
    schema_columns = [
        'last_name', 'first_name', 'age_at_crime', 'race', 'sex', 
        'state', 'county', 'worst_crime', 'sentence', 'convicted_year', 
        'exonerated_year', 'date_of_crime_year', 'posting_date'
    ]
    
    # Filter dataframe to include only schema columns
    transformed_df = transformed_df[schema_columns]
    
    # Handle missing values
    for col in transformed_df.columns:
        if transformed_df[col].dtype == 'object':
            transformed_df[col] = transformed_df[col].fillna('')
        else:
            transformed_df[col] = transformed_df[col].fillna(0)
    
    logging.info("Data transformation complete")
    return transformed_df, contributing_factors_df, tags_df, om_tags_df

def extract_tags(df, tags_column):
    """Extract tags from the Tags column and create a mapping to tag IDs"""
    logging.info("Extracting tags from data")
    
    # Create empty list to store tag mappings
    tag_mappings = []
    
    # Process each row
    for idx, tag_value in enumerate(tags_column):
        exoneree_id = idx + 1  # 1-based index for database
        
        # Process Tags column
        if pd.notna(tag_value) and tag_value:
            tags = str(tag_value).split(';#')
            for tag in tags:
                tag = tag.strip()
                if tag:
                    # Remove any leading '#' if present
                    if tag.startswith('#'):
                        tag = tag[1:]
                    tag_mappings.append({
                        'exoneree_id': exoneree_id,
                        'tag_code': tag
                    })
    
    # Convert to DataFrame
    tags_df = pd.DataFrame(tag_mappings)
    logging.info(f"Extracted {len(tags_df)} tag mappings")
    return tags_df

def extract_om_tags(df, om_tags_column):
    """Extract OM tags from the OM Tags column and create a mapping to OM tag IDs"""
    logging.info("Extracting OM tags from data")
    
    # Create empty list to store OM tag mappings
    om_tag_mappings = []
    
    # Process each row
    for idx, om_tag_value in enumerate(om_tags_column):
        exoneree_id = idx + 1  # 1-based index for database
        
        # Process OM Tags column
        if pd.notna(om_tag_value) and om_tag_value:
            om_tags = str(om_tag_value).split(';#')
            for tag in om_tags:
                tag = tag.strip()
                if tag:
                    # Remove any leading '#' if present
                    if tag.startswith('#'):
                        tag = tag[1:]
                    om_tag_mappings.append({
                        'exoneree_id': exoneree_id,
                        'tag_code': tag
                    })
    
    # Convert to DataFrame
    om_tags_df = pd.DataFrame(om_tag_mappings)
    logging.info(f"Extracted {len(om_tags_df)} OM tag mappings")
    return om_tags_df

def import_data(conn, exonerees_df, contributing_factors_df, tags_df, om_tags_df=None):
    """Import transformed data into the database"""
    logging.info("Importing data into database")
    
    # Import exonerees
    exonerees_df.to_sql('exonerees', conn, if_exists='append', index=False)
    logging.info(f"Imported {len(exonerees_df)} exonerees")
    
    # Import contributing factors
    contributing_factors_df.to_sql('contributing_factors', conn, if_exists='append', index=False)
    logging.info(f"Imported {len(contributing_factors_df)} contributing factors records")
    
    # Get tag IDs from database
    cursor = conn.cursor()
    cursor.execute("SELECT id, tag_code FROM tags")
    tag_id_map = {row[1]: row[0] for row in cursor.fetchall()}
    
    # Import tag mappings
    for _, row in tags_df.iterrows():
        tag_code = row['tag_code']
        if tag_code in tag_id_map:
            cursor.execute(
                "INSERT INTO exoneree_tags (exoneree_id, tag_id) VALUES (?, ?)",
                (row['exoneree_id'], tag_id_map[tag_code])
            )
    
    conn.commit()
    logging.info(f"Imported tag mappings for exonerees")
    
    # Import OM tags if present
    if om_tags_df is not None and not om_tags_df.empty:
        import_om_tags(conn, om_tags_df)
    
    logging.info("Data import complete")

def import_om_tags(conn, om_tags_df):
    """Import OM (Official Misconduct) tags if present"""
    logging.info("Importing OM tags")
    
    # Create OM tags table if not exists
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS om_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tag_code TEXT NOT NULL UNIQUE,
        tag_name TEXT NOT NULL,
        tag_description TEXT
    )
    """)
    
    # Create exoneree_om_tags table if not exists
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS exoneree_om_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exoneree_id INTEGER NOT NULL,
        om_tag_id INTEGER NOT NULL,
        FOREIGN KEY (exoneree_id) REFERENCES exonerees(id) ON DELETE CASCADE,
        FOREIGN KEY (om_tag_id) REFERENCES om_tags(id) ON DELETE CASCADE
    )
    """)
    
    # Check the structure of om_tags table
    cursor.execute("PRAGMA table_info(om_tags)")
    columns = [row[1] for row in cursor.fetchall()]
    logging.info(f"OM tags table columns: {columns}")
    
    # Define OM tags
    om_tags = {
        'OF': 'Forensic analyst misconduct',
        'WH': 'Withholding exculpatory evidence',
        'NW': 'Witness-related misconduct',
        'WT': 'Witness tampering'
    }
    
    # Insert OM tags based on available columns
    if 'tag_name' in columns and 'tag_description' in columns:
        # Full structure with name and description
        for code, desc in om_tags.items():
            name = f"Official Misconduct - {code}"
            cursor.execute(
                "INSERT OR IGNORE INTO om_tags (tag_code, tag_name, tag_description) VALUES (?, ?, ?)",
                (code, name, desc)
            )
    else:
        # Simplified structure with just code and description
        for code, desc in om_tags.items():
            cursor.execute(
                "INSERT OR IGNORE INTO om_tags (tag_code, tag_description) VALUES (?, ?)",
                (code, desc)
            )
    
    conn.commit()
    
    # Get OM tag IDs
    cursor.execute("SELECT id, tag_code FROM om_tags")
    om_tag_id_map = {row[1]: row[0] for row in cursor.fetchall()}
    
    # Process each row in the OM tags dataframe
    for _, row in om_tags_df.iterrows():
        tag_code = row['tag_code']
        if tag_code in om_tag_id_map:
            cursor.execute(
                "INSERT INTO exoneree_om_tags (exoneree_id, om_tag_id) VALUES (?, ?)",
                (row['exoneree_id'], om_tag_id_map[tag_code])
            )
    
    conn.commit()
    logging.info(f"Imported {len(om_tags_df)} OM tag mappings")
    logging.info("OM tags import complete")

def verify_import(conn):
    """Verify the imported data"""
    logging.info("Verifying imported data")
    
    cursor = conn.cursor()
    
    # Check exonerees count
    cursor.execute("SELECT COUNT(*) FROM exonerees")
    exonerees_count = cursor.fetchone()[0]
    logging.info(f"Exonerees count: {exonerees_count}")
    
    # Check contributing factors count
    cursor.execute("SELECT COUNT(*) FROM contributing_factors")
    cf_count = cursor.fetchone()[0]
    logging.info(f"Contributing factors count: {cf_count}")
    
    # Check exoneree tags count
    cursor.execute("SELECT COUNT(*) FROM exoneree_tags")
    tags_count = cursor.fetchone()[0]
    logging.info(f"Exoneree tags count: {tags_count}")
    
    # Check if OM tags table exists and count
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='om_tags'")
    if cursor.fetchone():
        cursor.execute("SELECT COUNT(*) FROM exoneree_om_tags")
        om_tags_count = cursor.fetchone()[0]
        logging.info(f"Exoneree OM tags count: {om_tags_count}")
    
    # Sample query to verify data
    cursor.execute("""
    SELECT e.id, e.first_name, e.last_name, e.state, e.worst_crime, e.convicted_year, e.exonerated_year,
           cf.dna_evidence, cf.false_confession, cf.official_misconduct
    FROM exonerees e
    JOIN contributing_factors cf ON e.id = cf.exoneree_id
    LIMIT 5
    """)
    
    sample_data = cursor.fetchall()
    logging.info("Sample data from database:")
    for row in sample_data:
        logging.info(f"  {row}")
    
    logging.info("Data verification complete")
    return exonerees_count, cf_count, tags_count

def main():
    """Main execution function"""
    logging.info("Starting Exoneree Data Import")
    
    try:
        # Setup database
        conn = setup_database()
        
        # Read Excel data
        df = read_excel_data()
        
        # Transform data
        exonerees_df, contributing_factors_df, tags_df, om_tags_df = transform_data(df)
        
        # Import data
        import_data(conn, exonerees_df, contributing_factors_df, tags_df, om_tags_df)
        
        # Verify import
        exonerees_count, cf_count, tags_count = verify_import(conn)
        
        # Close database connection
        conn.close()
        
        logging.info(f"Exoneree Data Import completed successfully")
        logging.info(f"Imported {exonerees_count} exonerees with {cf_count} contributing factors records and {tags_count} tag mappings")
        
        return True
    except Exception as e:
        logging.error(f"Error during import: {str(e)}", exc_info=True)
        return False

if __name__ == "__main__":
    main()

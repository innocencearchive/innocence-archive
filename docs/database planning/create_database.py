#!/usr/bin/env python3
"""
Script to create the SQLite database for Wrongfully Convicted Americans project
and import data from the Excel spreadsheet.
"""

import sqlite3
import pandas as pd
import os
import sys
import re

# Paths
SPREADSHEET_PATH = '/home/ubuntu/upload/publicspreadsheet.xlsx'
SCHEMA_PATH = '/home/ubuntu/database/schema.sql'
DB_PATH = '/home/ubuntu/database/wrongful_convictions.db'

def create_database():
    """Create the database using the schema file"""
    print("Creating database...")
    
    # Check if schema file exists
    if not os.path.exists(SCHEMA_PATH):
        print(f"Error: Schema file not found at {SCHEMA_PATH}")
        sys.exit(1)
    
    # Read schema file
    with open(SCHEMA_PATH, 'r') as f:
        schema_sql = f.read()
    
    # Create database and tables
    try:
        # Remove existing database if it exists
        if os.path.exists(DB_PATH):
            os.remove(DB_PATH)
            print(f"Removed existing database at {DB_PATH}")
        
        # Connect to database
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Execute schema SQL
        cursor.executescript(schema_sql)
        conn.commit()
        
        print(f"Database created successfully at {DB_PATH}")
        return conn
    except sqlite3.Error as e:
        print(f"SQLite error: {e}")
        sys.exit(1)

def load_spreadsheet_data():
    """Load data from the Excel spreadsheet"""
    print("Loading spreadsheet data...")
    
    if not os.path.exists(SPREADSHEET_PATH):
        print(f"Error: Spreadsheet not found at {SPREADSHEET_PATH}")
        sys.exit(1)
    
    try:
        # Load the Excel file
        sheet_name = 'owssvr - 2025-02-07T195539.912'  # From previous analysis
        df = pd.read_excel(SPREADSHEET_PATH, sheet_name=sheet_name)
        print(f"Loaded {len(df)} rows from spreadsheet")
        return df
    except Exception as e:
        print(f"Error loading spreadsheet: {e}")
        sys.exit(1)

def parse_tags(tag_string):
    """Parse the tag string into a list of individual tags"""
    if pd.isna(tag_string) or not isinstance(tag_string, str):
        return []
    
    # Split by ';#' and remove any empty strings
    tags = [tag.strip() for tag in tag_string.split(';#') if tag.strip()]
    return tags

def import_data(conn, df):
    """Import data from the dataframe into the database"""
    print("Importing data into database...")
    cursor = conn.cursor()
    
    # Get existing tags from the database
    cursor.execute("SELECT tag_code FROM tags")
    existing_tags = [row[0] for row in cursor.fetchall()]
    
    # Track tag IDs for linking
    tag_id_map = {}
    for tag in existing_tags:
        cursor.execute("SELECT id FROM tags WHERE tag_code = ?", (tag,))
        tag_id_map[tag] = cursor.fetchone()[0]
    
    # Import exonerees
    print("Importing exonerees...")
    for index, row in df.iterrows():
        try:
            # Insert exoneree
            cursor.execute("""
                INSERT INTO exonerees (
                    last_name, first_name, age_at_crime, race, sex, state, county,
                    worst_crime, sentence, convicted_year, exonerated_year,
                    posting_date, date_of_crime_year
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                row['Last Name'],
                row['First Name'],
                row['Age'] if not pd.isna(row['Age']) else None,
                row['Race'],
                row['Sex'],
                row['State'],
                row['County'] if not pd.isna(row['County']) else None,
                row['Worst Crime Display'],
                row['Sentence'],
                row['Convicted'],
                row['Exonerated'],
                row['Posting Date'],
                row['Date of Crime Year']
            ))
            
            # Get the ID of the inserted exoneree
            exoneree_id = cursor.lastrowid
            
            # Insert contributing factors
            cursor.execute("""
                INSERT INTO contributing_factors (
                    exoneree_id, dna_evidence, false_misleading_forensic_evidence,
                    false_confession, inadequate_legal_defense,
                    perjury_false_accusation, mistaken_witness_id, official_misconduct
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                exoneree_id,
                not pd.isna(row['DNA']),
                not pd.isna(row['F/MFE']),
                not pd.isna(row['FC']),
                not pd.isna(row['ILD']),
                not pd.isna(row['P/FA']),
                not pd.isna(row['MWID']),
                not pd.isna(row['OM'])
            ))
            
            # Process tags
            tags = parse_tags(row['Tags'])
            for tag in tags:
                if tag in tag_id_map:
                    # Insert into junction table
                    cursor.execute("""
                        INSERT INTO exoneree_tags (exoneree_id, tag_id)
                        VALUES (?, ?)
                    """, (exoneree_id, tag_id_map[tag]))
            
            # Process OM tags
            om_tags = parse_tags(row['OM Tags']) if not pd.isna(row['OM Tags']) else []
            for om_tag in om_tags:
                # Check if OM tag exists, if not create it
                cursor.execute("SELECT id FROM om_tags WHERE tag_code = ?", (om_tag,))
                result = cursor.fetchone()
                
                if result:
                    om_tag_id = result[0]
                else:
                    cursor.execute("""
                        INSERT INTO om_tags (tag_code, tag_description)
                        VALUES (?, ?)
                    """, (om_tag, f"Official misconduct tag: {om_tag}"))
                    om_tag_id = cursor.lastrowid
                
                # Insert into junction table
                cursor.execute("""
                    INSERT INTO exoneree_om_tags (exoneree_id, om_tag_id)
                    VALUES (?, ?)
                """, (exoneree_id, om_tag_id))
            
            # Commit every 100 records to avoid large transactions
            if index % 100 == 0:
                conn.commit()
                print(f"Imported {index+1} records...")
        
        except Exception as e:
            print(f"Error importing row {index} ({row['First Name']} {row['Last Name']}): {e}")
    
    # Final commit
    conn.commit()
    print(f"Successfully imported {len(df)} exoneree records")

def validate_database(conn):
    """Validate the database by running some basic queries"""
    print("\nValidating database...")
    cursor = conn.cursor()
    
    # Check exonerees count
    cursor.execute("SELECT COUNT(*) FROM exonerees")
    exoneree_count = cursor.fetchone()[0]
    print(f"Total exonerees: {exoneree_count}")
    
    # Check tags count
    cursor.execute("SELECT COUNT(*) FROM tags")
    tag_count = cursor.fetchone()[0]
    print(f"Total tags: {tag_count}")
    
    # Check exoneree_tags count
    cursor.execute("SELECT COUNT(*) FROM exoneree_tags")
    exoneree_tag_count = cursor.fetchone()[0]
    print(f"Total exoneree-tag relationships: {exoneree_tag_count}")
    
    # Check contributing factors
    cursor.execute("SELECT COUNT(*) FROM contributing_factors")
    cf_count = cursor.fetchone()[0]
    print(f"Total contributing factor records: {cf_count}")
    
    # Check some specific queries
    cursor.execute("SELECT COUNT(*) FROM exonerees WHERE race = 'Black'")
    black_count = cursor.fetchone()[0]
    print(f"Black exonerees: {black_count}")
    
    cursor.execute("SELECT COUNT(*) FROM contributing_factors WHERE dna_evidence = 1")
    dna_count = cursor.fetchone()[0]
    print(f"Cases with DNA evidence: {dna_count}")
    
    # Check view
    cursor.execute("SELECT COUNT(*) FROM exoneree_details")
    view_count = cursor.fetchone()[0]
    print(f"Records in exoneree_details view: {view_count}")
    
    print("Database validation complete")

def main():
    """Main function to create database and import data"""
    print("Starting database creation and data import...")
    
    # Create database
    conn = create_database()
    
    # Load spreadsheet data
    df = load_spreadsheet_data()
    
    # Import data
    import_data(conn, df)
    
    # Validate database
    validate_database(conn)
    
    # Close connection
    conn.close()
    
    print("\nDatabase implementation complete!")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Script to update the SQLite database schema for Wrongfully Convicted Americans project
to add media resources and organizations tables.
"""

import sqlite3
import os
import sys

# Paths
SCHEMA_UPDATE_PATH = '/home/ubuntu/database/schema_update.sql'
DB_PATH = '/home/ubuntu/database/wrongful_convictions.db'

def update_database_schema():
    """Update the database schema using the schema_update.sql file"""
    print("Updating database schema...")
    
    # Check if schema update file exists
    if not os.path.exists(SCHEMA_UPDATE_PATH):
        print(f"Error: Schema update file not found at {SCHEMA_UPDATE_PATH}")
        sys.exit(1)
    
    # Check if database exists
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        sys.exit(1)
    
    # Read schema update file
    with open(SCHEMA_UPDATE_PATH, 'r') as f:
        schema_update_sql = f.read()
    
    # Connect to database and update schema
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Execute schema update SQL
        cursor.executescript(schema_update_sql)
        conn.commit()
        
        print(f"Database schema updated successfully")
        return conn
    except sqlite3.Error as e:
        print(f"SQLite error: {e}")
        sys.exit(1)

def validate_schema_update(conn):
    """Validate the schema update by checking if the new tables exist"""
    print("\nValidating schema update...")
    cursor = conn.cursor()
    
    # Check if tables exist
    tables_to_check = [
        'media_types', 
        'media_resources', 
        'exoneree_media', 
        'organizations', 
        'exoneree_organizations'
    ]
    
    for table in tables_to_check:
        cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
        if cursor.fetchone():
            print(f"Table '{table}' exists")
        else:
            print(f"Error: Table '{table}' does not exist")
    
    # Check if media types were inserted
    cursor.execute("SELECT COUNT(*) FROM media_types")
    media_type_count = cursor.fetchone()[0]
    print(f"Media types count: {media_type_count}")
    
    # Check if views exist
    views_to_check = [
        'exoneree_with_media',
        'exoneree_with_organizations',
        'media_with_exoneree_count',
        'organizations_with_exoneree_count'
    ]
    
    for view in views_to_check:
        cursor.execute(f"SELECT name FROM sqlite_master WHERE type='view' AND name='{view}'")
        if cursor.fetchone():
            print(f"View '{view}' exists")
        else:
            print(f"Error: View '{view}' does not exist")
    
    print("Schema update validation complete")

def main():
    """Main function to update database schema"""
    print("Starting database schema update...")
    
    # Update database schema
    conn = update_database_schema()
    
    # Validate schema update
    validate_schema_update(conn)
    
    # Close connection
    conn.close()
    
    print("\nDatabase schema update complete!")

if __name__ == "__main__":
    main()

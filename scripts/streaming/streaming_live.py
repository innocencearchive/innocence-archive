import os
import psycopg2
import psycopg2.extras # For dictionary cursors
import requests
import time
from datetime import datetime
from dotenv import load_dotenv
import json

# Load environment variables from .env file for local development
# On Render, these will be set in the environment configuration
load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')
WATCHMODE_API_KEY = os.getenv('WATCHMODE_API_KEY')
WATCHMODE_BASE_URL = "https://api.watchmode.com/v1/"

# --- Script Configuration ---
REQUEST_DELAY_SECONDS = 1.2  # Delay between WatchMode API calls
PRIMARY_SOURCE_TYPES = {'free', 'sub'}  # e.g., Netflix, Hulu
SECONDARY_SOURCE_TYPES = {'rent', 'buy'} # Used if no primary types are found
ALLOWED_REGIONS = {'US'} # Filter for US region sources

# --- Database Functions ---

def get_db_connection():
    """Establishes a connection to the PostgreSQL database."""
    if not DATABASE_URL:
        print("CRITICAL ERROR: DATABASE_URL environment variable not set.")
        return None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        print("Successfully connected to the database.")
        return conn
    except psycopg2.Error as e:
        print(f"Error connecting to PostgreSQL database: {e}")
        return None

def fetch_media_works_for_update_from_db(conn):
    """
    Fetches MediaWork records (FILM or DOCUMENTARY) that have an externalId.
    Returns a list of dictionaries, each with 'id' (mediaWorkId), 
    'externalId' (TMDB ID), 'title', and 'workType'.
    """
    media_works_to_update = []
    if not conn:
        return media_works_to_update
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute("""
                SELECT id, "externalId", title, "workType"
                FROM media_works 
                WHERE "externalId" IS NOT NULL 
                AND ("workType" = 'FILM' OR "workType" = 'DOCUMENTARY');
            """)
            results = cur.fetchall()
            for row in results:
                media_works_to_update.append(dict(row))
        print(f"Found {len(media_works_to_update)} media works in DB to check for streaming updates.")
    except psycopg2.Error as e:
        print(f"Error fetching media works from DB: {e}")
    return media_works_to_update

def map_watchmode_source_type_to_db_enum(source_type_str):
    """Maps WatchMode's source type string to your Prisma Enum for streamingType."""
    if not source_type_str:
        return 'UNKNOWN'
    mapping = {
        'sub': 'SUBSCRIPTION',
        'free': 'FREE',
        'rent': 'RENT',
        'buy': 'BUY',
        # Add other mappings if WatchMode uses different terms like 'addon', 'purchase', etc.
    }
    return mapping.get(source_type_str.lower(), 'UNKNOWN')

def update_streaming_providers_in_db(conn, media_work_id, processed_sources):
    """
    Deletes old streaming providers and inserts new ones for a given media_work_id.
    processed_sources should be a list of dictionaries, each formatted for DB insertion.
    """
    if not conn:
        return
    try:
        with conn.cursor() as cur:
            cur.execute("""
                DELETE FROM streaming_providers 
                WHERE "mediaWorkId" = %s;
            """, (media_work_id,))
            print(f"DB: Deleted old streaming providers for mediaWorkId: {media_work_id}")

            if not processed_sources:
                print(f"DB: No new streaming options to insert for mediaWorkId: {media_work_id}")
                conn.commit() # Commit the delete even if no new inserts
                return

            insert_query = """
                INSERT INTO streaming_providers (
                    "providerName", "watchmodeProviderId", "streamingType", url, 
                    "priceCurrency", "priceAmount", "presentationQuality", 
                    "lastChecked", "mediaWorkId", "createdAt", "updatedAt"
                ) VALUES (
                    %(providerName)s, %(watchmodeProviderId)s, %(streamingType)s, %(url)s,
                    %(priceCurrency)s, %(priceAmount)s, %(presentationQuality)s,
                    %(lastChecked)s, %(mediaWorkId)s, NOW(), NOW()
                );
            """
            
            # Data for insertion should already be prepared by the calling function
            psycopg2.extras.execute_batch(cur, insert_query, processed_sources)
            print(f"DB: Inserted {len(processed_sources)} new streaming providers for mediaWorkId: {media_work_id}")
        conn.commit()
    except psycopg2.Error as e:
        print(f"DB ERROR: Error updating streaming providers for mediaWorkId {media_work_id}: {e}")
        conn.rollback()
    except Exception as ex:
        print(f"DB UNEXPECTED ERROR: During update for mediaWorkId {media_work_id}: {ex}")
        conn.rollback()

# --- WatchMode API Functions ---

def get_watchmode_details_and_sources(tmdb_id, media_work_type_from_db, api_key):
    """
    Fetches the Watchmode title details (internal ID, name) and its streaming sources.
    media_work_type_from_db should be 'FILM' or 'DOCUMENTARY'.
    Returns a tuple: (watchmode_title_info, list_of_source_details_dicts)
    """
    if not api_key:
        print("WatchMode API ERROR: API Key is missing.")
        return None, []

    search_url = f"{WATCHMODE_BASE_URL}search/"
    search_field_val = ""
    search_types_val = "" # WatchMode types: 'movie', 'tv_series', 'tv_episode', etc.

    # Map your DB workType to WatchMode's 'types' parameter
    if media_work_type_from_db == 'FILM' or media_work_type_from_db == 'DOCUMENTARY':
        search_field_val = "tmdb_movie_id"
        search_types_val = "movie" # WatchMode generally treats standalone docs as movies
    # Add elif for 'DOCUSERIES' -> 'tv_series' if you expand this script
    else:
        print(f"WatchMode API WARNING: Unknown media type '{media_work_type_from_db}' for TMDB ID {tmdb_id}. Skipping WatchMode search.")
        return None, []

    search_params = {
        "apiKey": api_key,
        "search_field": search_field_val,
        "search_value": str(tmdb_id),
        "types": search_types_val
    }

    watchmode_title_info = None
    sources_api_data = []

    try:
        print(f"WatchMode API: Searching for TMDB ID: {tmdb_id} (Type: {search_types_val})")
        response = requests.get(search_url, params=search_params)
        response.raise_for_status()  # Will raise HTTPError for bad responses (4XX, 5XX)
        
        search_results = response.json()
        # WatchMode search results can be in 'title_results' or 'results'
        results_list = search_results.get("title_results", []) or search_results.get("results", [])


        if results_list:
            first_result = results_list[0]
            watchmode_internal_id = first_result.get("id")
            watchmode_title_name = first_result.get("name") # For logging/verification
            
            if watchmode_internal_id:
                watchmode_title_info = {"id": watchmode_internal_id, "name": watchmode_title_name}
                print(f"WatchMode API: Found '{watchmode_title_name}' (WM ID: {watchmode_internal_id}) for TMDB ID {tmdb_id}.")
                
                sources_url = f"{WATCHMODE_BASE_URL}title/{watchmode_internal_id}/sources/"
                sources_params = {"apiKey": api_key}
                if ALLOWED_REGIONS and 'US' in ALLOWED_REGIONS: # Ensure US is in your set
                    sources_params["regions"] = "US" 
                
                sources_response = requests.get(sources_url, params=sources_params)
                sources_response.raise_for_status()
                sources_api_data = sources_response.json()
                print(f"WatchMode API: Retrieved {len(sources_api_data)} sources for WM ID {watchmode_internal_id}.")
            else:
                print(f"WatchMode API WARNING: Could not extract Watchmode internal ID for TMDB ID: {tmdb_id}")
        else:
            print(f"WatchMode API INFO: No search results in Watchmode for TMDB ID: {tmdb_id}")

    except requests.exceptions.HTTPError as http_err:
        print(f"WatchMode API HTTP error for TMDB ID {tmdb_id}: {http_err} - Response: {http_err.response.text[:200] if http_err.response else 'N/A'}")
    except requests.exceptions.RequestException as req_err:
        print(f"WatchMode API Request error for TMDB ID {tmdb_id}: {req_err}")
    except json.JSONDecodeError as json_err:
        # Log problematic text carefully, might be large
        problematic_text = "N/A"
        if 'response' in locals() and response: problematic_text = response.text
        elif 'sources_response' in locals() and sources_response: problematic_text = sources_response.text
        print(f"WatchMode API JSON decoding error for TMDB ID {tmdb_id}: {json_err}. Text: {problematic_text[:200]}...")
    except Exception as e:
        print(f"WatchMode API Unexpected error for TMDB ID {tmdb_id}: {e}")
    
    return watchmode_title_info, sources_api_data


def process_and_filter_sources(api_sources, media_work_id_for_db, watchmode_title_id=None):
    """
    Filters raw API sources and prepares them for database insertion.
    Returns a list of dictionaries, each formatted for the streaming_providers table.
    """
    primary_matches = []
    secondary_matches = []

    for source in api_sources:
        source_type = source.get('type') # e.g., 'sub', 'rent', 'buy', 'free'
        source_region = source.get('region')

        # Filter by region
        if ALLOWED_REGIONS and source_region not in ALLOWED_REGIONS:
            continue
        
        price_val = source.get('price')
        price_amount = None
        price_currency = None # WatchMode API usually implies USD for US region, but good to be explicit if available
        
        if price_val is not None:
            try:
                price_amount = float(price_val)
                price_currency = 'USD' # Defaulting to USD
            except ValueError:
                print(f"  Data WARNING: Could not parse price '{price_val}' for source '{source.get('name')}'")

        db_row = {
            "providerName": source.get('name'),
            "watchmodeProviderId": source.get('source_id'), # This is WatchMode's ID for the streaming service (e.g., Netflix is 203)
            "streamingType": map_watchmode_source_type_to_db_enum(source_type),
            "url": source.get('web_url'),
            "priceCurrency": price_currency,
            "priceAmount": price_amount,
            "presentationQuality": source.get('format'), # e.g., 'HD', 'SD', '4K'
            "lastChecked": datetime.utcnow(),
            "mediaWorkId": media_work_id_for_db # Link to your media_works table
        }

        if source_type in PRIMARY_SOURCE_TYPES:
            primary_matches.append(db_row)
        elif source_type in SECONDARY_SOURCE_TYPES:
            secondary_matches.append(db_row)

    if primary_matches:
        print(f"  + Found {len(primary_matches)} primary sources.")
        return primary_matches
    elif secondary_matches:
        print(f"  + No primary, found {len(secondary_matches)} secondary sources.")
        return secondary_matches
    else:
        print(f"  - No sources matched primary/secondary filters.")
        return []

# --- Main Execution ---

def main():
    print(f"--- Starting Streaming Availability Update Script: {datetime.now()} ---")
    if not WATCHMODE_API_KEY:
        print("CRITICAL ERROR: Watchmode API key (WATCHMODE_API_KEY) not configured. Exiting.")
        return

    db_conn = get_db_connection()
    if not db_conn:
        print("Failed to connect to database. Exiting.")
        return

    media_works_from_db = fetch_media_works_for_update_from_db(db_conn)

    if not media_works_from_db:
        print("No media works found in the database that require updating. Exiting.")
        db_conn.close()
        return

    total_updated_count = 0
    for work in media_works_from_db:
        media_work_id_db = work.get('id')
        tmdb_id_for_api = work.get('externalId')
        title_for_logging = work.get('title', 'N/A')
        db_work_type = work.get('workType') # e.g., 'FILM', 'DOCUMENTARY'

        print(f"\nProcessing DB MediaWork ID: {media_work_id_db}, Title: '{title_for_logging}', TMDB ID: {tmdb_id_for_api}")

        if not tmdb_id_for_api or not db_work_type:
            print(f"  Skipping MediaWork ID {media_work_id_db} due to missing TMDB ID or WorkType.")
            continue

        # Fetch data from WatchMode API
        # The `get_watchmode_details_and_sources` function expects the media type string like "FILM" or "DOCUMENTARY"
        watchmode_title_details, raw_api_sources = get_watchmode_details_and_sources(
            tmdb_id_for_api, 
            db_work_type, 
            WATCHMODE_API_KEY
        )

        if watchmode_title_details and raw_api_sources:
            # Process and filter these sources
            db_ready_sources = process_and_filter_sources(
                raw_api_sources, 
                media_work_id_db,
                watchmode_title_details.get("id") # Pass WatchMode's internal title ID for logging if needed
            )
            
            # Update the database
            update_streaming_providers_in_db(db_conn, media_work_id_db, db_ready_sources)
            if db_ready_sources:
                total_updated_count += 1
        elif watchmode_title_details and not raw_api_sources:
             print(f"  INFO: Title '{watchmode_title_details.get('name')}' found in WatchMode, but no streaming sources listed by API. Clearing existing.")
             update_streaming_providers_in_db(db_conn, media_work_id_db, []) # Clear existing if none found
        else:
            print(f"  - Failed to retrieve sufficient data from WatchMode for TMDB ID {tmdb_id_for_api}. No DB update.")

        print(f"--- Delaying for {REQUEST_DELAY_SECONDS} seconds ---")
        time.sleep(REQUEST_DELAY_SECONDS)
    
    print(f"\n--- Script Finished: {datetime.now()} ---")
    print(f"Total media works for which streaming providers were potentially updated in DB: {total_updated_count} out of {len(media_works_from_db)} processed.")

    if db_conn:
        db_conn.close()
        print("Database connection closed.")

if __name__ == "__main__":
    main()

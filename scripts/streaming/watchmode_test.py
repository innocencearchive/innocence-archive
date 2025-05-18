import csv
import requests
import os
from dotenv import load_dotenv
import time
import json

# Load environment variables from .env file
load_dotenv()

# Get Watchmode API key from environment variables
WATCHMODE_API_KEY = os.getenv("WATCHMODE_API_KEY")

# Watchmode API base URL
WATCHMODE_BASE_URL = "https://api.watchmode.com/v1/"

# --- Configuration ---
INPUT_CSV_FILE_PATH = 'tmdb_data.csv'
OUTPUT_CSV_FILE_PATH = 'streaming_availability_us_conditional_purchase.csv'

TMDB_ID_COLUMN_NAME = 'externalId'
MEDIA_TYPE_COLUMN_NAME = 'Type'
REQUEST_DELAY = 1.2

# --- Filtering Configuration ---
PRIMARY_SOURCE_TYPES = {'free', 'sub'}
SECONDARY_SOURCE_TYPES = {'rent', 'buy'} # Used if no primary types are found
ALLOWED_REGIONS = {'US'}

def get_watchmode_title_and_sources(tmdb_id_from_csv, media_type_from_csv, api_key):
    """
    Fetches the Watchmode title details and its streaming sources.
    """
    if not api_key:
        print("ERROR: API Key is missing.")
        return None, None

    search_url = f"{WATCHMODE_BASE_URL}search/"
    search_field_val = ""
    search_types_val = ""

    if media_type_from_csv.lower() == "movie":
        search_field_val = "tmdb_movie_id"
        search_types_val = "movie"
    elif media_type_from_csv.lower() == "tv show":
        search_field_val = "tmdb_tv_id"
        search_types_val = "tv"
    else:
        print(f"WARNING: Unknown media type '{media_type_from_csv}' for TMDB ID {tmdb_id_from_csv}. Skipping.")
        return None, None

    search_params = {
        "apiKey": api_key,
        "search_field": search_field_val,
        "search_value": str(tmdb_id_from_csv),
        "types": search_types_val
    }

    watchmode_title_info = None
    sources_data = None

    try:
        response = requests.get(search_url, params=search_params)
        if response.status_code != 200:
            print(f"ERROR: Search API Status {response.status_code} for TMDB ID {tmdb_id_from_csv}. Response: {response.text}")
            response.raise_for_status()
        
        search_results = response.json()
        results_list = search_results.get("title_results") or search_results.get("results")

        if results_list:
            first_result = results_list[0]
            watchmode_internal_id = first_result.get("id")
            watchmode_title_name = first_result.get("name")
            
            if watchmode_internal_id and watchmode_title_name:
                watchmode_title_info = {"id": watchmode_internal_id, "name": watchmode_title_name}
                sources_url = f"{WATCHMODE_BASE_URL}title/{watchmode_internal_id}/sources/"
                sources_params = {"apiKey": api_key}
                if ALLOWED_REGIONS and 'US' in ALLOWED_REGIONS:
                    sources_params["regions"] = "US"
                
                sources_response = requests.get(sources_url, params=sources_params)
                if sources_response.status_code != 200:
                    print(f"ERROR: Sources API Status {sources_response.status_code} for WM ID {watchmode_internal_id}. Response: {sources_response.text}")
                    sources_response.raise_for_status()
                sources_data = sources_response.json()
            else:
                print(f"WARNING: Could not extract Watchmode ID or Name for TMDB ID: {tmdb_id_from_csv}")
        else:
            print(f"INFO: No search results in Watchmode for TMDB ID: {tmdb_id_from_csv}")

    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error for TMDB ID {tmdb_id_from_csv}: {http_err}")
    except requests.exceptions.RequestException as req_err:
        print(f"Request error for TMDB ID {tmdb_id_from_csv}: {req_err}")
    except json.JSONDecodeError as json_err:
        problematic_text = response.text if 'response' in locals() else (sources_response.text if 'sources_response' in locals() else "N/A")
        print(f"JSON decoding error for TMDB ID {tmdb_id_from_csv}: {json_err}. Text: {problematic_text[:200]}...")
    except Exception as e:
        print(f"Unexpected error for TMDB ID {tmdb_id_from_csv}: {e}")
    
    return watchmode_title_info, sources_data

def main():
    if not WATCHMODE_API_KEY:
        print("CRITICAL ERROR: Watchmode API key not configured.")
        return

    print(f"Starting script. Input: {INPUT_CSV_FILE_PATH}, Output: {OUTPUT_CSV_FILE_PATH}")
    print(f"Primary source types: {PRIMARY_SOURCE_TYPES}, Secondary: {SECONDARY_SOURCE_TYPES} (if no primary found)")
    if ALLOWED_REGIONS: print(f"Filtering for regions: {ALLOWED_REGIONS}")
    print("-" * 30)

    output_data_rows = []
    csv_headers = [
        "tmdb_id", "watchmode_title", "watchmode_id", 
        "source_name", "source_type", "region", "web_url", "price" # Added price
    ]

    try:
        with open(INPUT_CSV_FILE_PATH, mode='r', encoding='utf-8-sig') as infile:
            reader = csv.DictReader(infile)
            if not all(col in reader.fieldnames for col in [TMDB_ID_COLUMN_NAME, MEDIA_TYPE_COLUMN_NAME]):
                print(f"ERROR: Input CSV missing required columns. Need: '{TMDB_ID_COLUMN_NAME}', '{MEDIA_TYPE_COLUMN_NAME}'. Found: {reader.fieldnames}")
                return

            for row_number, row in enumerate(reader):
                tmdb_id_str = (row.get(TMDB_ID_COLUMN_NAME) or "").strip()
                media_type_from_csv = (row.get(MEDIA_TYPE_COLUMN_NAME) or "").strip()

                if not tmdb_id_str or not media_type_from_csv:
                    continue
                try:
                    current_tmdb_id = int(float(tmdb_id_str))
                except ValueError:
                    print(f"WARNING: Invalid TMDB ID '{tmdb_id_str}' in input row {row_number + 2}. Skipping.")
                    continue

                print(f"\nProcessing TMDB ID: {current_tmdb_id} (Type: {media_type_from_csv})")
                watchmode_title, sources = get_watchmode_title_and_sources(current_tmdb_id, media_type_from_csv, WATCHMODE_API_KEY)

                if watchmode_title and sources:
                    primary_matches = []
                    secondary_matches = []

                    for source in sources:
                        source_type = source.get('type')
                        source_region = source.get('region')
                        region_match = (not ALLOWED_REGIONS) or (source_region in ALLOWED_REGIONS)

                        if not region_match:
                            continue

                        row_to_add = {
                            "tmdb_id": current_tmdb_id,
                            "watchmode_title": watchmode_title.get("name"),
                            "watchmode_id": watchmode_title.get("id"),
                            "source_name": source.get('name'),
                            "source_type": source_type,
                            "region": source_region,
                            "web_url": source.get('web_url'),
                            "price": source.get('price') # Get price, will be null if not applicable
                        }
                        if source_type in PRIMARY_SOURCE_TYPES:
                            primary_matches.append(row_to_add)
                        elif source_type in SECONDARY_SOURCE_TYPES:
                            secondary_matches.append(row_to_add)
                    
                    if primary_matches:
                        output_data_rows.extend(primary_matches)
                        for match in primary_matches:
                             print(f"  + Added Primary: {match['source_name']} ({match['source_type']})")
                    elif secondary_matches:
                        output_data_rows.extend(secondary_matches)
                        for match in secondary_matches:
                             print(f"  + Added Secondary: {match['source_name']} ({match['source_type']}, Price: {match['price']})")
                    else:
                        print(f"  - No sources matched filters for '{watchmode_title.get('name')}' (TMDB ID: {current_tmdb_id}).")
                elif watchmode_title and not sources:
                    print(f"  INFO: Title '{watchmode_title.get('name')}' found, but no streaming sources listed by API.")
                else:
                    print(f"  - Failed to retrieve data for TMDB ID {current_tmdb_id} from Watchmode.")
                time.sleep(REQUEST_DELAY)
            
            if output_data_rows:
                print(f"\nWriting {len(output_data_rows)} rows to {OUTPUT_CSV_FILE_PATH}...")
                with open(OUTPUT_CSV_FILE_PATH, mode='w', newline='', encoding='utf-8') as outfile:
                    writer = csv.DictWriter(outfile, fieldnames=csv_headers)
                    writer.writeheader()
                    writer.writerows(output_data_rows)
                print("Successfully wrote data to CSV.")
            else:
                print("\nNo data matched filters to write to CSV.")

    except FileNotFoundError:
        print(f"ERROR: Input file {INPUT_CSV_FILE_PATH} not found.")
    except Exception as e:
        print(f"Unexpected error in main: {e}")

if __name__ == "__main__":
    main()

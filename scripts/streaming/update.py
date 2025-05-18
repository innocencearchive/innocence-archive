#this script doesn't retrieve all the needed data from TMDB but it
#was able to fix an ID problem and correctly link the poster image.

import requests
import os
import json
import csv
import time
from dotenv import load_dotenv
from urllib.parse import quote # For URL encoding search queries

# Load environment variables from .env file
load_dotenv()
TMDB_API_KEY = os.getenv("TMDB_API_KEY")

# TMDB API Base URLs
API_BASE_URL = "https://api.themoviedb.org/3"
IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"  # Standard image size

# --- Helper Functions ---

def search_tmdb_for_id(title, item_type="movie", year=None):
    """
    Searches TMDB for a movie or TV show by title, type, and optionally year.
    Returns the TMDB ID of the first result if found, otherwise None.
    """
    if not TMDB_API_KEY:
        print("Error: TMDB_API_KEY not found.")
        return None

    if not title or title.strip().lower() == 'n/a': # Added check for invalid title before searching
        print(f"  Invalid title for search: '{title}'. Skipping TMDB search.")
        return None

    search_endpoint = ""
    year_param = ""
    if item_type.lower() == "movie":
        search_endpoint = "/search/movie"
        if year: year_param = f"&year={year}"
    elif item_type.lower() == "tv show" or item_type.lower() == "tv":
        search_endpoint = "/search/tv"
        if year: year_param = f"&first_air_date_year={year}"
    else:
        print(f"  Unsupported item type for search: '{item_type}' for title '{title}'. Skipping search.")
        return None

    search_url = f"{API_BASE_URL}{search_endpoint}?api_key={TMDB_API_KEY}&query={quote(title)}{year_param}"
    print(f"  Searching URL: {search_url.replace(TMDB_API_KEY, 'YOUR_API_KEY')}") # Avoid logging key

    try:
        response = requests.get(search_url)
        response.raise_for_status() 
        results = response.json().get("results", [])
        if results:
            found_item = results[0] # Still taking the first result, but year should improve its accuracy
            found_id = found_item.get("id")
            found_title_from_tmdb = found_item.get("title") or found_item.get("name")
            print(f"  Search successful for '{title}' ({item_type}{', Year: '+year if year else ''}). Top Result: '{found_title_from_tmdb}' (ID: {found_id}).")
            return found_id 
        else:
            print(f"  No search results for '{title}' ({item_type}{', Year: '+year if year else ''}).")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error searching for '{title}' ({item_type}): {e}")
        return None
    except json.JSONDecodeError:
        print(f"Error decoding JSON for search of '{title}' ({item_type}). Response: {response.text}")
        return None

def get_movie_details_for_poster(movie_id):
    if not TMDB_API_KEY: return None
    details_url = f"{API_BASE_URL}/movie/{movie_id}?api_key={TMDB_API_KEY}"
    try:
        response = requests.get(details_url)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error fetching movie details for ID {movie_id}: {e}")
        return None

def get_tv_details_for_poster(tv_id):
    if not TMDB_API_KEY: return None
    details_url = f"{API_BASE_URL}/tv/{tv_id}?api_key={TMDB_API_KEY}"
    try:
        response = requests.get(details_url)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error fetching TV details for ID {tv_id}: {e}")
        return None

def construct_image_url(poster_path_suffix):
    if poster_path_suffix and isinstance(poster_path_suffix, str) and poster_path_suffix.startswith('/'):
        return f"{IMAGE_BASE_URL}{poster_path_suffix}"
    return ""

# --- Main Script ---
def main(input_csv_path, output_csv_path):
    if not TMDB_API_KEY:
        print("Critical Error: TMDB_API_KEY is not configured. Exiting.")
        return

    print(f"Starting TMDB ID and image path update. Input CSV: '{input_csv_path}', Output CSV: '{output_csv_path}'")

    updated_rows_data = []
    csv_fieldnames = [] 

    try:
        with open(input_csv_path, 'r', newline='', encoding='utf-8') as infile:
            reader = csv.DictReader(infile)
            if not reader.fieldnames:
                print(f"Error: Could not read fieldnames from '{input_csv_path}'.")
                return
            
            # Normalize fieldnames from the reader to handle potential casing/spacing issues
            normalized_fieldnames = {name.lower().strip(): name for name in reader.fieldnames}
            csv_fieldnames = reader.fieldnames # Keep original fieldnames for writing output
            
            # Determine the actual key for 'Title' using normalized names
            # Prioritize 'title' as per user feedback
            title_column_key = normalized_fieldnames.get('title') 
            if not title_column_key:
                # Fallback to 'original title' if 'title' is not found
                title_column_key = normalized_fieldnames.get('original title')
                if title_column_key:
                     print("Warning: Using 'Original Title' column as 'Title' column was not found.")
                else:
                    print("FATAL: Could not identify a 'Title' or 'Original Title' column in the CSV. Please check column headers. Exiting.")
                    return


            if "TMDB ID" not in csv_fieldnames: csv_fieldnames.append("TMDB ID")
            if "Image Path" not in csv_fieldnames: csv_fieldnames.append("Image Path")

            all_rows = list(reader)
            total_rows_count = len(all_rows)
            print(f"Found {total_rows_count} rows to process.")

            for i, row_data in enumerate(all_rows):
                # Use the determined title_column_key to get the title
                original_title = row_data.get(title_column_key, 'N/A').strip() # Use the dynamically found key
                
                print(f"\nProcessing row {i+1}/{total_rows_count}: '{original_title}'")
                
                if not original_title or original_title.lower() == 'n/a':
                    print(f"  WARNING: Title for row {i+1} is '{original_title}'. This may lead to poor search results or errors. Please check your input CSV, column: '{title_column_key}'.")

                if "TMDB ID" not in row_data: row_data["TMDB ID"] = ""
                if "Image Path" not in row_data: row_data["Image Path"] = ""

                tmdb_id_str = row_data.get("TMDB ID", "").strip()
                item_type_str = row_data.get("Type", "").strip()
                release_year_str = row_data.get("Release Year", "").strip()
                
                current_tmdb_id = None
                if tmdb_id_str:
                    try:
                        current_tmdb_id = int(tmdb_id_str)
                        print(f"  Using pre-existing TMDB ID: {current_tmdb_id}")
                    except ValueError:
                        print(f"  Warning: Existing TMDB ID '{tmdb_id_str}' is not valid. Will attempt to re-fetch.")
                        tmdb_id_str = "" # Force re-fetch

                if not tmdb_id_str and original_title and item_type_str and original_title.lower() != 'n/a': # Added check for N/A title before search
                    year_to_search = release_year_str if release_year_str and release_year_str.lower() != "xxx" and release_year_str.isdigit() and len(release_year_str) == 4 else None
                    print(f"  TMDB ID is missing for '{original_title}'. Searching TMDB (Type: {item_type_str}, Year: {year_to_search if year_to_search else 'Any'})...")
                    
                    fetched_id = search_tmdb_for_id(original_title, item_type_str, year_to_search)
                    if fetched_id:
                        current_tmdb_id = fetched_id
                        row_data["TMDB ID"] = str(fetched_id) 
                        print(f"  Found and updated TMDB ID to: {fetched_id}")
                    else:
                        print(f"  Could not find TMDB ID for '{original_title}'. Skipping image fetch for this item.")
                        updated_rows_data.append(row_data)
                        time.sleep(0.25) 
                        continue 
                elif not original_title or not item_type_str or original_title.lower() == 'n/a':
                    print(f"  Skipping TMDB ID search: Original Title ('{original_title}') or Type ('{item_type_str}') is missing or invalid.")
                
                new_image_url = ""
                if current_tmdb_id and item_type_str:
                    print(f"  Fetching poster for TMDB ID: {current_tmdb_id}, Type: {item_type_str}")
                    details_json = None
                    if item_type_str == "Movie":
                        details_json = get_movie_details_for_poster(current_tmdb_id)
                    elif item_type_str == "TV Show" or item_type_str.lower() == "tv":
                        details_json = get_tv_details_for_poster(current_tmdb_id)
                    else:
                        print(f"  Skipping image update: Unknown item type '{item_type_str}'.")
                    
                    if details_json:
                        poster_path_suffix = details_json.get('poster_path')
                        new_image_url = construct_image_url(poster_path_suffix)
                        if new_image_url:
                            print(f"  Successfully fetched and constructed image path: '{new_image_url}'")
                        else:
                            print(f"  No poster_path found in TMDB details for ID {current_tmdb_id}.")
                    else:
                        print(f"  Could not fetch details for TMDB ID {current_tmdb_id} to get poster.")
                else:
                     if not current_tmdb_id: 
                        print(f"  Skipping image fetch: No valid TMDB ID available.")
                
                row_data["Image Path"] = new_image_url 
                updated_rows_data.append(row_data)
                time.sleep(0.25) 
            
    except FileNotFoundError:
        print(f"Error: Input CSV file '{input_csv_path}' not found.")
        return
    except Exception as e_outer:
        print(f"An unexpected error occurred: {e_outer}")
        if not updated_rows_data and 'all_rows' in locals():
             updated_rows_data = all_rows
        elif 'all_rows' in locals() and len(updated_rows_data) < len(all_rows):
             start_index_for_unprocessed = len(updated_rows_data)
             for i in range(start_index_for_unprocessed, len(all_rows)):
                  updated_rows_data.append(all_rows[i])

    if updated_rows_data and csv_fieldnames:
        try:
            with open(output_csv_path, 'w', newline='', encoding='utf-8') as outfile:
                # Use the original fieldnames for writing to maintain CSV structure
                writer = csv.DictWriter(outfile, fieldnames=csv_fieldnames)
                writer.writeheader()
                writer.writerows(updated_rows_data)
            print(f"\nSuccessfully processed and wrote {len(updated_rows_data)} rows to '{output_csv_path}'")
        except IOError:
            print(f"Error: Could not write to output CSV file '{output_csv_path}'.")
        except Exception as e_write:
            print(f"An error occurred during writing the output CSV: {e_write}")
    elif not csv_fieldnames and 'input_csv_path' in locals() and os.path.exists(input_csv_path):
         print(f"No fieldnames determined from input CSV '{input_csv_path}'. Output not written.")
    else:
        print("No rows were processed or available to write to output.")

if __name__ == "__main__":
    INPUT_CSV_FILE_PATH = "tmdb_data.csv"  # Your CSV with TMDB IDs to be checked/filled
    OUTPUT_CSV_FILE_PATH = "tmdb_data_ID.csv" # New output file name

    if not os.path.exists(INPUT_CSV_FILE_PATH):
        print(f"Input file '{INPUT_CSV_FILE_PATH}' not found. Please ensure it's in the same directory or provide the full path.")
    else:
        main(INPUT_CSV_FILE_PATH, OUTPUT_CSV_FILE_PATH)

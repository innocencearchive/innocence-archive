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
IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500" # Example image size

# --- Helper Functions ---

def search_tmdb(title, item_type="movie"):
    """
    Searches TMDB for a movie or TV show.
    item_type can be 'movie' or 'tv'.
    Returns the first result if found, otherwise None.
    """
    if not TMDB_API_KEY:
        print("Error: TMDB_API_KEY not found. Please set it in your .env file.")
        return None

    search_url = f"{API_BASE_URL}/search/{item_type}?api_key={TMDB_API_KEY}&query={quote(title)}"
    try:
        response = requests.get(search_url)
        response.raise_for_status() # Raise an exception for HTTP errors
        results = response.json().get("results", [])
        if results:
            return results[0] # Return the top result
        return None
    except requests.exceptions.RequestException as e:
        print(f"Error searching for '{title}' ({item_type}): {e}")
        return None
    except json.JSONDecodeError:
        print(f"Error decoding JSON for '{title}' ({item_type}). Response: {response.text}")
        return None

def get_movie_details(movie_id):
    """Fetches detailed information for a specific movie ID."""
    if not TMDB_API_KEY:
        return None
    
    details_url = f"{API_BASE_URL}/movie/{movie_id}?api_key={TMDB_API_KEY}&append_to_response=credits"
    try:
        response = requests.get(details_url)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching movie details for ID {movie_id}: {e}")
        return None
    except json.JSONDecodeError:
        print(f"Error decoding JSON for movie ID {movie_id}. Response: {response.text}")
        return None

def get_tv_details(tv_id):
    """Fetches detailed information for a specific TV show ID."""
    if not TMDB_API_KEY:
        return None

    # Using aggregate_credits for TV shows to get creators more reliably
    details_url = f"{API_BASE_URL}/tv/{tv_id}?api_key={TMDB_API_KEY}&append_to_response=aggregate_credits"
    try:
        response = requests.get(details_url)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching TV details for ID {tv_id}: {e}")
        return None
    except json.JSONDecodeError:
        print(f"Error decoding JSON for TV ID {tv_id}. Response: {response.text}")
        return None

def extract_movie_data(details):
    """Extracts desired fields from movie details JSON."""
    if not details:
        return {}

    # Extract directors
    directors = []
    if details.get("credits") and details["credits"].get("crew"):
        for crew_member in details["credits"]["crew"]:
            if crew_member.get("job") == "Director":
                directors.append(crew_member.get("name", ""))
    
    # Extract production companies
    production_companies = [comp.get("name", "") for comp in details.get("production_companies", []) if comp.get("name")]

    return {
        "tmdb_id": details.get("id"),
        "found_title": details.get("title"),
        "type": "Movie",
        "release_year": details.get("release_date", "")[:4] if details.get("release_date") else None,
        "creator_name": ", ".join(filter(None, directors)), # Join non-empty director names
        "publisher_or_network": ", ".join(filter(None, production_companies)),
        "summary_notes": details.get("overview"),
        "image_path": f"{IMAGE_BASE_URL}{details.get('poster_path')}" if details.get('poster_path') else None,
    }

def extract_tv_data(details):
    """Extracts desired fields from TV details JSON."""
    if not details:
        return {}

    # Extract creators
    creators = [creator.get("name", "") for creator in details.get("created_by", []) if creator.get("name")]
    if not creators and details.get("aggregate_credits") and details["aggregate_credits"].get("crew"):
        # Fallback to directors from aggregate_credits if 'created_by' is empty
        for crew_member in details["aggregate_credits"]["crew"]:
            if crew_member.get("job") == "Director" or "Creator" in crew_member.get("jobs", []): # Check 'jobs' as well
                # Ensure unique addition
                if crew_member.get("name") not in creators:
                     creators.append(crew_member.get("name", ""))


    # Extract networks
    networks = [network.get("name", "") for network in details.get("networks", []) if network.get("name")]
    
    return {
        "tmdb_id": details.get("id"),
        "found_title": details.get("name"),
        "type": "TV Show",
        "release_year": details.get("first_air_date", "")[:4] if details.get("first_air_date") else None,
        "creator_name": ", ".join(filter(None, creators)),
        "publisher_or_network": ", ".join(filter(None, networks)),
        "summary_notes": details.get("overview"),
        "image_path": f"{IMAGE_BASE_URL}{details.get('poster_path')}" if details.get('poster_path') else None,
    }

# --- Main Script ---
def main(input_file_path, output_file_path):
    """
    Main function to process titles from input file and write TMDB data to output CSV file.
    """
    if not TMDB_API_KEY:
        print("Critical Error: TMDB_API_KEY is not configured. Exiting.")
        return

    print(f"Starting TMDB data fetching. Input: '{input_file_path}', Output: '{output_file_path}'")

    # Prepare the list of titles to search
    # The user can convert the Markdown table from media_work_tmdb_list into a simple text file
    # with one title per line.
    try:
        with open(input_file_path, 'r', encoding='utf-8') as f:
            titles_to_search = [line.strip() for line in f if line.strip()]
    except FileNotFoundError:
        print(f"Error: Input file '{input_file_path}' not found.")
        return
    
    if not titles_to_search:
        print("No titles found in the input file.")
        return

    all_media_data = []
    processed_count = 0

    for original_title in titles_to_search:
        print(f"\nProcessing: '{original_title}'")
        media_data = {"original_title": original_title} # Start with original title for reference

        # Try searching as a TV show first (many series in the list)
        tv_search_result = search_tmdb(original_title, item_type="tv")
        if tv_search_result and tv_search_result.get("id"):
            print(f"  Found TV match: '{tv_search_result.get('name')}' (ID: {tv_search_result.get('id')})")
            tv_details = get_tv_details(tv_search_result["id"])
            if tv_details:
                media_data.update(extract_tv_data(tv_details))
            else:
                print(f"  Could not fetch TV details for '{original_title}'.")
        else:
            # If not found as TV, or if TV search failed, try as movie
            print(f"  No definitive TV match found for '{original_title}'. Trying as movie...")
            movie_search_result = search_tmdb(original_title, item_type="movie")
            if movie_search_result and movie_search_result.get("id"):
                print(f"  Found Movie match: '{movie_search_result.get('title')}' (ID: {movie_search_result.get('id')})")
                movie_details = get_movie_details(movie_search_result["id"])
                if movie_details:
                    media_data.update(extract_movie_data(movie_details))
                else:
                    print(f"  Could not fetch movie details for '{original_title}'.")
            else:
                print(f"  No movie match found for '{original_title}'.")
                media_data.update({ # Add placeholders for not found items
                    "tmdb_id": None, "found_title": "NOT FOUND", "type": None,
                    "release_year": None, "creator_name": None, 
                    "publisher_or_network": None, "summary_notes": None, "image_path": None
                })
        
        all_media_data.append(media_data)
        processed_count += 1
        print(f"  Processed {processed_count}/{len(titles_to_search)}: '{original_title}'")
        
        # Respect TMDB API rate limits - a small delay
        time.sleep(0.3) # Adjust as needed, TMDB allows about 40 requests per 10 seconds. 0.3s = ~3 req/sec

    # Write to CSV
    if all_media_data:
        fieldnames = [
            "original_title", "found_title", "tmdb_id", "type", 
            "release_year", "creator_name", "publisher_or_network", 
            "summary_notes", "image_path"
        ]
        try:
            with open(output_file_path, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()
                for data_row in all_media_data:
                    # Ensure all keys are present in each row, even if None
                    for field in fieldnames:
                        if field not in data_row:
                            data_row[field] = None 
                    writer.writerow(data_row)
            print(f"\nSuccessfully wrote data for {len(all_media_data)} titles to '{output_file_path}'")
        except IOError:
            print(f"Error: Could not write to output file '{output_file_path}'.")
    else:
        print("No data was processed or fetched.")

if __name__ == "__main__":
    # --- Configuration ---
    # 1. Prepare your input file:
    #    Create a text file (e.g., "titles_to_search.txt") and list each movie/series title on a new line.
    #    You can copy the titles from the Markdown table in the 'media_work_tmdb_list' artifact.
    # 2. Create a .env file in the same directory as this script with your TMDB_API_KEY:
    #    TMDB_API_KEY=your_key_here
    # 3. Set the paths below:
    
    INPUT_FILE = "titles.txt"  # Path to your text file with titles
    OUTPUT_CSV_FILE = "tmdb_media_data.csv" # Path for the output CSV file

    if not os.path.exists(INPUT_FILE):
        print(f"Input file '{INPUT_FILE}' not found. Please create it with one title per line.")
        # Create a dummy input file if it doesn't exist, for demonstration
        with open(INPUT_FILE, 'w', encoding='utf-8') as f_dummy:
            f_dummy.write("The Shawshank Redemption\n")
            f_dummy.write("Breaking Bad\n")
            f_dummy.write("A Non Existent Film Title XYZ\n")
        print(f"A dummy input file '{INPUT_FILE}' has been created for you. Please edit it with your actual titles.")
    else:
        main(INPUT_FILE, OUTPUT_CSV_FILE)


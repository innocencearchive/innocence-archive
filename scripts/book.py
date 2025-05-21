import csv
import requests
import os
import time
from dotenv import load_dotenv
import re # For modifying URL parameters

# Load environment variables from .env file
load_dotenv()
API_KEY = os.getenv("GOOGLE_BOOK_API")

# --- Configuration ---
INPUT_CSV_FILE = 'bookdata.csv'
OUTPUT_CSV_FILE = 'bookdata_enhanced.csv'
# Delay between API calls in seconds to avoid rate limiting
API_CALL_DELAY = 1
# Target height for trying to resize thumbnails using &h= parameter
TARGET_HEIGHT = '600' # User's preferred height

# Fields to extract from Google Books API and their corresponding CSV column names
API_FIELD_MAPPING = {
    'isbn_13': 'isbn_13_api',
    'isbn_10': 'isbn_10_api',
    'subtitle': 'subtitle_api',
    'authors': 'authors_api', # Will be a comma-separated string
    'publisher': 'publisher_api',
    'publishedDate': 'publishedDate_api',
    'description': 'description_api', # Potentially longer summary
    'pageCount': 'pageCount_api',
    'categories': 'categories_api', # Will be a comma-separated string
    'averageRating': 'averageRating_api',
    'ratingsCount': 'ratingsCount_api',
    'thumbnailLink': 'thumbnailLink_api', # Original thumbnail for reference
    'heightModifiedLink': 'heightModifiedImageLink_api', # Primary image link with height modification
    'previewLink': 'googleBooksPreviewLink_api',
    'webReaderLink': 'googleBooksWebReaderLink_api',
    'buyLink': 'googleBooksBuyLink_api', # From saleInfo (Google Play)
    'listPriceAmount': 'listPriceAmount_api',
    'listPriceCurrency': 'listPriceCurrency_api',
    'retailPriceAmount': 'retailPriceAmount_api',
    'retailPriceCurrency': 'retailPriceCurrency_api',
    'isEbook': 'isEbookGoogle_api',
    'saleability': 'saleabilityGoogle_api',
    'viewability': 'viewabilityGoogle_api',
    'language': 'language_api'
}

def get_thumbnail_url_with_height(thumbnail_url, target_height='600'):
    """
    Tries to append a height parameter to a Google Books thumbnail URL.
    Example: &h=600
    """
    if not thumbnail_url:
        return None
    
    # Remove existing w or h parameters to avoid conflicts, if any
    url_no_wh = re.sub(r'&[wh]=\d+', '', thumbnail_url)
    # Also remove existing zoom parameter as it might interfere or be redundant
    url_no_zoom_wh = re.sub(r'&zoom=\d+', '', url_no_wh)


    if '?' in url_no_zoom_wh:
        return f"{url_no_zoom_wh}&h={target_height}"
    else:
        # This case is unlikely for typical Google Books image URLs if they have an ID
        return f"{url_no_zoom_wh}?h={target_height}"


def search_google_books(title, api_key):
    """
    Searches the Google Books API for a given title and extracts relevant information.
    """
    if not api_key:
        print("Error: GOOGLE_BOOK_API key not found. Please set it in your .env file.")
        return None

    search_query = f'intitle:{title}'
    # Using projection=full just in case it helps with thumbnail availability, though less critical now
    url = f"https://www.googleapis.com/books/v1/volumes?q={search_query}&key={api_key}&maxResults=1&projection=full"

    extracted_data = {}
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        if data.get("totalItems", 0) > 0 and "items" in data:
            book_item = data["items"][0]
            volume_info = book_item.get("volumeInfo", {})
            sale_info = book_item.get("saleInfo", {})
            access_info = book_item.get("accessInfo", {})

            # --- Basic Info ---
            industry_identifiers = volume_info.get("industryIdentifiers", [])
            for identifier in industry_identifiers:
                if identifier.get("type") == "ISBN_13":
                    extracted_data[API_FIELD_MAPPING['isbn_13']] = identifier.get("identifier")
                elif identifier.get("type") == "ISBN_10":
                    extracted_data[API_FIELD_MAPPING['isbn_10']] = identifier.get("identifier")

            extracted_data[API_FIELD_MAPPING['subtitle']] = volume_info.get("subtitle")
            authors_list = volume_info.get("authors", [])
            extracted_data[API_FIELD_MAPPING['authors']] = ", ".join(authors_list) if authors_list else None
            extracted_data[API_FIELD_MAPPING['publisher']] = volume_info.get("publisher")
            extracted_data[API_FIELD_MAPPING['publishedDate']] = volume_info.get("publishedDate")
            extracted_data[API_FIELD_MAPPING['description']] = volume_info.get("description")
            extracted_data[API_FIELD_MAPPING['pageCount']] = volume_info.get("pageCount")
            categories_list = volume_info.get("categories", [])
            extracted_data[API_FIELD_MAPPING['categories']] = ", ".join(categories_list) if categories_list else None
            extracted_data[API_FIELD_MAPPING['averageRating']] = volume_info.get("averageRating")
            extracted_data[API_FIELD_MAPPING['ratingsCount']] = volume_info.get("ratingsCount")
            extracted_data[API_FIELD_MAPPING['language']] = volume_info.get("language")

            # --- Simplified Image Link Logic ---
            image_links = volume_info.get("imageLinks", {})
            original_thumbnail = image_links.get("thumbnail") # Get the basic thumbnail
            
            extracted_data[API_FIELD_MAPPING['thumbnailLink']] = original_thumbnail
            
            if original_thumbnail:
                extracted_data[API_FIELD_MAPPING['heightModifiedLink']] = get_thumbnail_url_with_height(
                    original_thumbnail,
                    TARGET_HEIGHT
                )
            else:
                extracted_data[API_FIELD_MAPPING['heightModifiedLink']] = None

            # --- Links & Sale/Access Info ---
            extracted_data[API_FIELD_MAPPING['previewLink']] = volume_info.get("previewLink")
            extracted_data[API_FIELD_MAPPING['buyLink']] = sale_info.get("buyLink")
            list_price = sale_info.get("listPrice", {})
            extracted_data[API_FIELD_MAPPING['listPriceAmount']] = list_price.get("amount")
            extracted_data[API_FIELD_MAPPING['listPriceCurrency']] = list_price.get("currencyCode")
            retail_price = sale_info.get("retailPrice", {})
            extracted_data[API_FIELD_MAPPING['retailPriceAmount']] = retail_price.get("amount")
            extracted_data[API_FIELD_MAPPING['retailPriceCurrency']] = retail_price.get("currencyCode")
            extracted_data[API_FIELD_MAPPING['isEbook']] = sale_info.get("isEbook")
            extracted_data[API_FIELD_MAPPING['saleability']] = sale_info.get("saleability")
            extracted_data[API_FIELD_MAPPING['webReaderLink']] = access_info.get("webReaderLink")
            extracted_data[API_FIELD_MAPPING['viewability']] = access_info.get("viewability")
            
            return extracted_data
        else:
            print(f"No items found for title: {title}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"Error fetching data for '{title}': {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred while processing '{title}': {e}")
        return None

def main():
    if not API_KEY:
        print("API Key for Google Books is not configured. Exiting.")
        return

    try:
        with open(INPUT_CSV_FILE, mode='r', encoding='utf-8-sig') as infile, \
             open(OUTPUT_CSV_FILE, mode='w', encoding='utf-8', newline='') as outfile:

            reader = csv.DictReader(infile)
            
            original_fieldnames = reader.fieldnames if reader.fieldnames else []
            # Define the fieldnames for the output CSV based on the simplified API_FIELD_MAPPING
            current_api_fieldnames = list(API_FIELD_MAPPING.values())
            
            output_fieldnames = original_fieldnames[:] 
            for fn in current_api_fieldnames: # Use current_api_fieldnames
                if fn not in output_fieldnames:
                    output_fieldnames.append(fn)

            writer = csv.DictWriter(outfile, fieldnames=output_fieldnames)
            writer.writeheader()

            print(f"Starting to process {INPUT_CSV_FILE}...")
            for i, row in enumerate(reader):
                title = row.get('title')
                if not title:
                    print(f"Skipping row {i+1} due to missing title.")
                    for col_name in output_fieldnames: # Ensure all columns are present
                        if col_name not in row:
                            row[col_name] = None
                    writer.writerow(row)
                    continue

                print(f"Processing book: '{title}'...")
                output_row = row.copy()
                api_data = search_google_books(title, API_KEY)

                if api_data:
                    print(f"Found data for '{title}'.")
                    # Populate based on the current API_FIELD_MAPPING
                    for api_mapped_key, csv_col_name in API_FIELD_MAPPING.items():
                        output_row[csv_col_name] = api_data.get(csv_col_name) 
                else:
                    print(f"No API data found or error for '{title}'.")
                    # Ensure all new API columns (from current_api_fieldnames) exist if no API data
                    for csv_col_name in current_api_fieldnames:
                        if csv_col_name not in output_row: 
                            output_row[csv_col_name] = None 
                
                writer.writerow(output_row)

                if (i + 1) % 10 == 0:
                    print(f"Processed {i+1} books...")
                time.sleep(API_CALL_DELAY)
            
            print(f"Processing complete. Enriched data saved to {OUTPUT_CSV_FILE}")

    except FileNotFoundError:
        print(f"Error: The file {INPUT_CSV_FILE} was not found.")
    except Exception as e:
        print(f"An unexpected error occurred during the main process: {e}")

if __name__ == "__main__":
    main()

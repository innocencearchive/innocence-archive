import requests
from bs4 import BeautifulSoup
import pandas as pd
from urllib.parse import urljoin
import time # To add delays between requests
import sys

# --- Configuration ---
# Base URL for pagination (we'll add the page number parameter)
# Using the URL from the user's doctxt.txt which seems to be exonerationregistry.org
base_page_url = 'https://exonerationregistry.org/cases'
# Base URL for constructing absolute links from relative ones found in the table
base_site_url = 'https://exonerationregistry.org' # Updated base site URL
output_csv_file = 'exoneration_list_detailed.csv' # New filename for detailed data

# Headers to mimic a browser visit
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
}

# --- End Configuration ---

# --- Main Script Logic ---
all_records = []
# Drupal pagination starts at page 0
page_number = 0
max_retries = 3 # Number of retries for failed requests
max_pages_to_scrape = 50 # Safety limit to prevent infinite loops if stop condition fails

print("Starting scrape...")

while page_number < max_pages_to_scrape: # Added safety limit
    # Construct URL with Drupal's pagination parameter (?page=N)
    # Also include the default filters seen in doctxt.txt to ensure we get the right view
    # f[0]=n_pre_1989:0 (Since-1989) and f[1]=n_pre_1989:1 (Pre-1989) means show ALL
    params = {
        'f[0]': 'n_pre_1989:0',
        'f[1]': 'n_pre_1989:1',
        'page': page_number
    }
    current_url = base_page_url # requests handles adding params
    print(f"Attempting to fetch page: {page_number} (URL: {base_page_url} with params: {params})")

    retries = 0
    response = None
    success = False

    # --- Fetch Page Content with Retries ---
    while retries < max_retries and not success:
        try:
            # Pass params to requests.get
            response = requests.get(current_url, headers=headers, params=params, timeout=60)
            response.raise_for_status() # Check for HTTP errors (4xx or 5xx)
            print(f" -> Successfully fetched page {page_number}")
            success = True
        except requests.exceptions.RequestException as e:
            retries += 1
            print(f" -> Error fetching page {page_number}: {e}. Attempt {retries}/{max_retries}")
            if retries < max_retries:
                time.sleep(5) # Wait before retrying
            else:
                print(f" -> Max retries reached for page {page_number}. Skipping page.")
                break # Break retry loop

    if not success or response is None:
        page_number += 1 # Try the next page
        continue # Go to the next iteration of the main while loop

    # --- Parse HTML ---
    try:
        print(f" -> Parsing HTML for page {page_number}...")
        soup = BeautifulSoup(response.text, 'lxml')

        # *** Find the correct table using classes identified in doctxt.txt ***
        # This combination seems specific enough based on the provided HTML
        data_table = soup.find('table', class_='views-view-table')

        if not data_table:
            # Check if it's potentially the last page with no table but maybe pagination still exists
            # A more robust check might look for the specific "no results" message if the site has one
            print(f" -> No data table found on page {page_number}. Assuming end of data.")
            break # Stop if no table is found

        # Find all table rows within the tbody
        table_body = data_table.find('tbody')
        rows = table_body.find_all('tr') if table_body else [] # Find rows only within tbody

        if not rows:
            # If the table exists but tbody is empty, we've likely reached the end
            print(f" -> No data rows found in table body on page {page_number}. Assuming end of data.")
            break # Stop if table body is empty

        print(f" -> Found {len(rows)} rows on page {page_number}. Processing...")
        rows_processed_on_page = 0
        # --- Extract Data from Rows ---
        for row in rows:
            cells = row.find_all('td')

            # Expecting at least 6 columns based on requirements
            # Indices: Name(0), State(1), County(2 - skip), Convicted(3), Exonerated(4), Crime(5)
            if len(cells) >= 6:
                try:
                    # Column 1 (index 0): Name and Link
                    name_cell = cells[0]
                    link_tag = name_cell.find('a')
                    # Get name from link text if possible, otherwise cell text
                    name = link_tag.get_text(strip=True) if link_tag else name_cell.get_text(strip=True)
                    # Get link href if exists
                    relative_url = link_tag['href'] if link_tag and link_tag.has_attr('href') else None
                    absolute_url = urljoin(base_site_url, relative_url) if relative_url else None

                    # Column 2 (index 1): State
                    # Use .find('span') if text is wrapped, otherwise direct text
                    state_cell = cells[1]
                    state_span = state_cell.find('span')
                    state = state_span.get_text(strip=True) if state_span else state_cell.get_text(strip=True)

                    # Column 4 (index 3): Convicted Year
                    convicted_cell = cells[3]
                    convicted_span = convicted_cell.find('span')
                    convicted_year = convicted_span.get_text(strip=True) if convicted_span else convicted_cell.get_text(strip=True)

                    # Column 5 (index 4): Exonerated Year
                    exonerated_cell = cells[4]
                    exonerated_span = exonerated_cell.find('span')
                    exonerated_year = exonerated_span.get_text(strip=True) if exonerated_span else exonerated_cell.get_text(strip=True)

                    # Column 6 (index 5): Crime
                    crime_cell = cells[5]
                    crime_span = crime_cell.find('span')
                    crime = crime_span.get_text(strip=True) if crime_span else crime_cell.get_text(strip=True)

                    # Append data as a dictionary
                    all_records.append({
                        'Name': name,
                        'Link': absolute_url,
                        'State': state,
                        'ConvictedYear': convicted_year,
                        'ExoneratedYear': exonerated_year,
                        'Crime': crime
                    })
                    rows_processed_on_page += 1
                except IndexError:
                    print(f" -> Warning: Row on page {page_number} has fewer cells than expected. Skipping row.")
                except Exception as cell_e:
                    print(f" -> Warning: Error processing a cell on page {page_number}: {cell_e}. Skipping row.")

        if rows_processed_on_page == 0 and len(rows) > 0:
             print(f" -> Warning: Found rows on page {page_number}, but couldn't extract data. Check selectors/structure.")
             # break # Optional: Stop if processing fails on a page with rows

        # --- Check for Pagination ---
        # Look for the 'Next' page link to determine if we should continue
        # Find the pager element
        pager = soup.find('nav', class_='pager')
        if pager:
            # Find the 'Next' link specifically (often has class 'pager__item--next')
            next_link = pager.find('li', class_='pager__item--next')
            if not next_link or 'disabled' in next_link.get('class', []):
                # If 'Next' link is missing or disabled, we are on the last page
                print(f" -> No 'Next' page link found or it's disabled on page {page_number}. Assuming end of data.")
                break # Exit the main while loop
        else:
            # If no pager is found at all, assume it's a single-page result or the end
            print(f" -> No pagination element found on page {page_number}. Assuming end of data.")
            break # Exit the main while loop

    except Exception as parse_e:
        print(f" -> An unexpected error occurred during parsing page {page_number}: {parse_e}")
        # break # Optional: Stop on parsing error

    # --- Prepare for Next Page ---
    page_number += 1
    # Be polite to the server - add a delay
    print(" -> Waiting 2 seconds before next page...")
    time.sleep(2)

# --- Save Data ---
print("-" * 20)
print(f"Scraping finished. Total records extracted: {len(all_records)}")

if all_records:
    # Convert list of dictionaries to DataFrame
    print("Converting data to DataFrame...")
    df = pd.DataFrame(all_records)

    # Reorder columns if desired
    df = df[['Name', 'Link', 'State', 'ConvictedYear', 'ExoneratedYear', 'Crime']]

    # Save the DataFrame to a CSV file
    try:
        df.to_csv(output_csv_file, index=False, encoding='utf-8')
        print(f"Successfully saved data to {output_csv_file}")
    except Exception as e:
        print(f"Error saving data to CSV: {e}")
else:
    print("No records were extracted. Check the script logic, selectors, or page structure.")

print("Script completed.")

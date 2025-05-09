import pandas as pd
import re
import io
import os # For environment variables
import time # For potential rate limiting

# Attempt to import necessary libraries for API and web fetching
try:
    from dotenv import load_dotenv
    import google.generativeai as genai
    import requests
    from bs4 import BeautifulSoup
    print("✅ Required libraries (dotenv, google-generativeai, requests, beautifulsoup4) are available.")
except ImportError as e:
    print(f"🔴 Missing one or more required libraries: {e}")
    print("👉 Please install them by running: pip install pandas google-generativeai python-dotenv requests beautifulsoup4")
    exit()

# --- Configuration ---
# Customizable Filenames and Column Names
INPUT_CSV_FILENAME = "download.csv"  # Your input file, e.g., the one with ~150 "FIX" entries
OUTPUT_CSV_FILENAME = "names_llm_corrected.csv" # Output for this targeted run

# Column names from your CSV
# IMPORTANT: Adjust these to match your actual column names in the CSV
NAME_COLUMN_NAME = 'name'                # Column with the original (potentially problematic) name
HEADLINE_COLUMN_NAME = 'headline'        # Column with the article headline
LINK_COLUMN_NAME = 'link'                # Column with the URL
STATUS_COLUMN_NAME = 'review_status'     # Column where you've marked entries with "FIX"
STATUS_VALUE_FOR_PROCESSING = "FIX"      # The value in STATUS_COLUMN_NAME that triggers API processing

# Load API Key from .env file
load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    print("🔴 GEMINI_API_KEY not found in environment variables. Please set it up in your .env file.")
    print("   Example .env content: GEMINI_API_KEY=your_actual_api_key_here")
    GEMINI_API_ENABLED = False
else:
    try:
        genai.configure(api_key=API_KEY)
        print("✅ Gemini API Key configured.")
        GEMINI_API_ENABLED = True
    except Exception as e:
        print(f"🔴 Error configuring Gemini API: {e}")
        GEMINI_API_ENABLED = False

# API and Web Fetching Settings
REQUEST_TIMEOUT_SECONDS = 20 # Timeout for fetching web pages (increased slightly)
MAX_ARTICLE_TEXT_LENGTH = 25000 # Max characters of article text to send to API
API_CALL_DELAY_SECONDS = 1.5 # Delay between API calls to respect rate limits

# --- Helper Functions ---
# The is_name_generic function is kept for potential future use but not used for filtering in this script version.
def is_name_generic(name_value):
    """Checks if a single name value matches any of the generic patterns."""
    # (Implementation from previous version - not actively used for filtering in this script)
    GENERIC_NAME_PATTERNS = [
        r"^\s*an?\s+\w+\s+man\b", r"^\s*an?\s+\w+\s+woman\b", r"^\s*an?\s+\w+\s+teen\b",
        r"^\s*an?\s+\w+\s+child\b", r"^\s*an?\s+\w+\s+resident\b", r"^\s*an?\s+\w+\s+individual\b",
        r"^\s*an?\s+\w+\s+defendant\b", r"^\s*an?\s+\w+\s+client\b", r"^\s*an?\s+\w+\s+person\b",
        r"^\s*this\s+man\b", r"^\s*this\s+woman\b", r"^\s*that\s+man\b", r"^\s*that\s+woman\b",
        r"^\s*the\s+man\b", r"^\s*the\s+woman\b", r"^\s*unknown\b", r"^\s*unidentified\s+man\b",
        r"^\s*unidentified\s+woman\b", r"^\s*mr\.\s*\w+$", r"^\s*ms\.\s*\w+$", r"^\s*mrs\.\s*\w+$",
        r"^\s*(man|woman|teenager|youth|victim|defendant|accused|inmate|prisoner|exoneree|mother|father)\b(?:\s+from\s+\w+)?$",
        r"^\s*[A-Za-z]+\s+Doe\b",
        r"^\s*(\w+(?:\s+\w+)*)\s+(man|woman|teen|child|resident|individual|defendant|client|person|exoneree|mother|father)\b",
        r"^\s*([\w\s.-]+?)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\b"
    ]
    MAX_WORDS_FOR_SIMPLE_GENERIC = 3
    if not name_value or pd.isna(name_value) or str(name_value).lower() == 'nan': return False
    name_value_str = str(name_value).strip()
    if not name_value_str: return False
    for pattern_regex in GENERIC_NAME_PATTERNS:
        if re.match(pattern_regex, name_value_str, re.IGNORECASE):
            if pattern_regex in [r"^\s*the\s+man\b", r"^\s*the\s+woman\b"] and len(name_value_str.split()) > MAX_WORDS_FOR_SIMPLE_GENERIC: continue
            return True
    if len(name_value_str.split()) == 1:
        single_word_generics = ["man", "woman", "teen", "child", "unknown", "victim", "defendant", "client", "inmate", "prisoner", "exoneree", "mother", "father"]
        if name_value_str.lower() in single_word_generics: return True
    return False

def get_name_from_article_via_api(article_url, original_name, headline):
    """
    Fetches article content from the URL and uses the Gemini API to extract the name
    based on the new, more detailed prompt.
    """
    if not GEMINI_API_ENABLED:
        print("  [API SKIPPED] Gemini API is not enabled (check API key configuration).")
        return "API NOT CONFIGURED"

    print(f"  [API CALL] Attempting to process URL: {article_url}")
    print(f"             Original Name (Col A): '{original_name}', Headline (Col B): '{headline}'")
    
    article_text = ""
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        response = requests.get(article_url, timeout=REQUEST_TIMEOUT_SECONDS, headers=headers)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        main_content_tags = ['article', 'main', '.main-content', '#main-content', '.story-content', '.post-content', '.entry-content'] # Added .entry-content
        content_found = False
        for tag_selector in main_content_tags:
            content_element = soup.select_one(tag_selector)
            if content_element:
                article_text = content_element.get_text(separator=' ', strip=True)
                content_found = True
                break
        if not content_found and soup.body:
            article_text = soup.body.get_text(separator=' ', strip=True)
        
        if not article_text or len(article_text) < 100:
            print(f"    [API WARN] Fetched very little or no text from {article_url}. Length: {len(article_text)}")
        print(f"    [API INFO] Fetched ~{len(article_text)} characters from URL.")

    except requests.exceptions.Timeout:
        print(f"    [API ERROR] Timeout fetching URL {article_url}")
        return "URL FETCH TIMEOUT"
    except requests.exceptions.RequestException as e:
        print(f"    [API ERROR] Error fetching URL {article_url}: {e}")
        return "URL FETCH ERROR"
    except Exception as e:
        print(f"    [API ERROR] Error processing HTML for {article_url}: {e}")
        return "HTML PARSE ERROR"

    # New, more detailed prompt
    prompt = (
        f"The following information is about a news story related to a potential wrongful conviction. "
        f"The name initially extracted from the dataset (Col A: '{original_name}') and the headline (Col B: '{headline}') "
        f"did not yield the correct or complete name of the wrongfully convicted individual.\n\n"
        f"Common issues encountered include:\n"
        f"- A generic name was used (e.g., 'Texas prisoner', 'a man').\n"
        f"- Only a last name appeared, but a full name is needed.\n"
        f"- Multiple people were listed, but only one (or a specific subset) was actually the wrongfully convicted subject of the Innocence Project case.\n"
        f"- Other unusual or one-off situations prevented accurate name extraction.\n\n"
        f"Your task is to carefully analyze the provided news story content from the linked article. "
        f"Identify the full name(s) of the individual(s) who was/were wrongfully convicted and are the primary subject of this specific Innocence Project story. "
        f"If multiple individuals form a known group (e.g., 'Central Park Five'), list their full names if available; otherwise, provide the group name.\n"
        f"If, after careful analysis, you cannot confidently determine the name of the wrongfully convicted individual(s) from the text, respond with 'NOT FOUND'.\n\n"
        f"Article content (first {MAX_ARTICLE_TEXT_LENGTH} characters):\n"
        f"--------------------------------------------------\n"
        f"{article_text[:MAX_ARTICLE_TEXT_LENGTH]}\n"
        f"--------------------------------------------------\n"
        f"Based on the article, the wrongfully convicted individual(s) is/are (provide full name(s) or 'NOT FOUND'):"
    )

    try:
        time.sleep(API_CALL_DELAY_SECONDS)
        model = genai.GenerativeModel('gemini-1.5-flash-latest') # Or 'gemini-1.5-flash-latest' if 1.0-pro issues persist
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(temperature=0.1)
        )
        extracted_name = response.text.strip()

        if not extracted_name: return "NOT FOUND (API - Empty Response)"
        if "NOT FOUND" in extracted_name.upper() and len(extracted_name) < 20: return "NOT FOUND (API)"
        print(f"    [API SUCCESS] Extracted: '{extracted_name}'")
        return extracted_name
    except Exception as e:
        print(f"    [API ERROR] Gemini API call failed: {e}")
        if "API key not valid" in str(e): return "API AUTH ERROR"
        if "rate limit" in str(e).lower(): return "API RATE LIMIT EXCEEDED"
        if "is not found for API version" in str(e) or "is not supported for generateContent" in str(e):
            print("    [API INFO] Consider trying a different model like 'gemini-1.5-flash-latest' if 'gemini-1.0-pro' also fails.")
            return "API MODEL NOT FOUND/SUPPORTED"
        return "API CALL ERROR"

# --- Main Processing Function ---
def process_csv_for_fix_entries(input_csv_path, output_csv_path):
    """
    Reads CSV, processes rows marked "FIX" in STATUS_COLUMN_NAME using the API, and writes a new CSV.
    """
    try:
        if not os.path.exists(input_csv_path):
            print(f"🔴 Error: Input CSV file not found at '{input_csv_path}'")
            return
        print(f"Attempting to read CSV from file path: {input_csv_path}")
        df = pd.read_csv(input_csv_path)
        print(f"Successfully read CSV. Rows: {len(df)}, Columns: {df.columns.tolist()}")

        # Validate required columns exist
        required_cols = [NAME_COLUMN_NAME, HEADLINE_COLUMN_NAME, LINK_COLUMN_NAME, STATUS_COLUMN_NAME]
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            print(f"🔴 Critical Error: The following required columns are missing from the CSV: {', '.join(missing_cols)}")
            print(f"   Please ensure your CSV has columns named: '{NAME_COLUMN_NAME}', '{HEADLINE_COLUMN_NAME}', '{LINK_COLUMN_NAME}', and '{STATUS_COLUMN_NAME}'.")
            print(f"   You can configure these names at the top of the script.")
            return

        # Initialize the output column if it doesn't exist
        output_col_name = 'llm_corrected_name' # New column for this script's output
        if output_col_name not in df.columns:
            df[output_col_name] = pd.NA

        print("\nProcessing rows marked for LLM review...")
        processed_count = 0
        fix_marked_count = 0

        # Use enumerate to get a 0-based integer counter 'i'
        # 'original_df_index' will be the actual index from the DataFrame (could be string)
        for i, (original_df_index, row) in enumerate(df.iterrows()):
            current_row_number_for_display = i + 2 # For user-friendly row numbering (1-based + header)
            
            # Check if the status column exists and has a value
            if STATUS_COLUMN_NAME in row and pd.notna(row[STATUS_COLUMN_NAME]):
                status_val_from_row_raw = row[STATUS_COLUMN_NAME]
                # Strip whitespace first, then specifically strip any trailing commas
                status_val_from_row_stripped = str(status_val_from_row_raw).strip().rstrip(',')
                status_val_from_row_upper = status_val_from_row_stripped.upper()
                
                # Debugging print for every row that has a status value
                print(f"    DEBUG: Row {current_row_number_for_display}: Checking status. Column '{STATUS_COLUMN_NAME}' raw: '{status_val_from_row_raw}', Stripped&CommaRemoved: '{status_val_from_row_stripped}', Uppercased: '{status_val_from_row_upper}', Target: '{STATUS_VALUE_FOR_PROCESSING.upper()}'")

                if status_val_from_row_upper == STATUS_VALUE_FOR_PROCESSING.upper():
                    fix_marked_count += 1
                    original_name = str(row[NAME_COLUMN_NAME]) if pd.notna(row[NAME_COLUMN_NAME]) else ""
                    headline = str(row[HEADLINE_COLUMN_NAME]) if pd.notna(row[HEADLINE_COLUMN_NAME]) else ""
                    article_url = str(row[LINK_COLUMN_NAME]) if pd.notna(row[LINK_COLUMN_NAME]) else ""

                    print(f"Row {current_row_number_for_display} (Excel row): Status '{STATUS_VALUE_FOR_PROCESSING}'. Original Name: '{original_name}' -> Sending to API.")
                    
                    if article_url and article_url.startswith('http'):
                        extracted_name_status = get_name_from_article_via_api(article_url, original_name, headline)
                        df.loc[original_df_index, output_col_name] = extracted_name_status
                        processed_count +=1
                    else:
                        print(f"  Skipping API call for row {current_row_number_for_display}: URL is missing or invalid ('{article_url}')")
                        df.loc[original_df_index, output_col_name] = "URL MISSING/INVALID"
                # else: # Optional: print if a status value was found but didn't match "FIX"
                #    if status_val_from_row_stripped: # Only print if not empty after stripping
                #        print(f"    DEBUG: Row {current_row_number_for_display}: Status found ('{status_val_from_row_stripped}') but does not match '{STATUS_VALUE_FOR_PROCESSING}'. Skipping API call.")

            elif STATUS_COLUMN_NAME in row and pd.isna(row[STATUS_COLUMN_NAME]):
                 print(f"    DEBUG: Row {current_row_number_for_display}: Status column '{STATUS_COLUMN_NAME}' is NaN/empty. Skipping API call.")


            if (i + 1) % 10 == 0: # Progress update
                print(f"  Scanned {i + 1}/{len(df)} rows...")
        
        print(f"\nFound {fix_marked_count} rows effectively marked with '{STATUS_VALUE_FOR_PROCESSING}'.")
        print(f"Attempted to process {processed_count} of these rows with the API.")
        
        df.to_csv(output_csv_path, index=False, encoding='utf-8')
        print(f"\n✅ Processing complete. Output saved to: {output_csv_path}")

    except pd.errors.EmptyDataError:
        print(f"🔴 Error: The CSV input '{input_csv_path}' was empty or could not be parsed.")
    except Exception as e:
        print(f"🔴 An unexpected error occurred during main processing: {e}")
        import traceback
        traceback.print_exc()

# --- Script Execution ---
if __name__ == "__main__":
    if not GEMINI_API_ENABLED and not API_KEY:
        print("\n🟡 WARNING: Gemini API key not found or not configured.")
        print("   The script will run, but API calls to extract names will be skipped.")
    elif not GEMINI_API_ENABLED and API_KEY:
         print("\n🔴 ERROR: Gemini API key was found, but configuration failed. Check error messages above.")
         print("   The script will run, but API calls to extract names will be skipped.")

    print(f"Starting targeted processing for file: {INPUT_CSV_FILENAME}")
    print(f"Will look for status '{STATUS_VALUE_FOR_PROCESSING}' in column '{STATUS_COLUMN_NAME}'.")
    process_csv_for_fix_entries(INPUT_CSV_FILENAME, OUTPUT_CSV_FILENAME)

    print("\n--- Script Finished ---")
    if not GEMINI_API_ENABLED:
        print("Reminder: API calls were skipped or may have failed due to configuration issues.")
    print(f"Output should be in: {OUTPUT_CSV_FILENAME}")


import requests
import pandas as pd
import google.generativeai as genai
import os
import re
import time
from dotenv import load_dotenv
import io
from bs4 import BeautifulSoup # <--- Import BeautifulSoup

# --- Configuration ---
load_dotenv()
url = 'https://en.wikipedia.org/wiki/List_of_wrongful_convictions_in_the_United_States'
output_csv_file = 'wrongful_convictions_summarized.csv'
API_KEY = os.getenv('GOOGLE_API_KEY')
GEMINI_MODEL_NAME = 'gemini-1.5-flash-latest'
SENTENCE_THRESHOLD = 8

# Define the EXACT order of columns we expect in the PRIMARY data rows on Wikipedia
# INSPECT a few tables visually on the live page to confirm this order.
# This mapping assumes the summary is NOT in the primary row.
EXPECTED_COLUMNS = [
    'Name of Wrongfully Convicted Individual', # Index 0
    'Date',                                   # Index 1
    'Location',                               # Index 2
    'Crime',                                  # Index 3
    'Sentence',                               # Index 4
    'Time Served',                            # Index 5
    'Status of Exoneration'                   # Index 6
]
SUMMARY_COLUMN_NAME = 'Summary' # The column we'll add for the summary text

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}
# --- End Configuration ---

# --- Helper Functions ---
# ... (keep count_sentences, summarize_text_with_gemini) ...
def count_sentences(text):
    """Counts sentences in a given text using simple regex."""
    if not isinstance(text, str) or not text.strip():
        return 0
    sentences = re.split(r'[.?!](?:\s+|$)', text)
    sentences = [s for s in sentences if s.strip()]
    return len(sentences)

def summarize_text_with_gemini(text_to_summarize, api_key):
    """Uses the Gemini API to summarize the provided text."""
    if not api_key:
        print("Error: API Key not provided to summarizer function.")
        return "Error: API Key not configured"
    if not isinstance(text_to_summarize, str) or len(text_to_summarize) < 50:
        return text_to_summarize
    print(f"    Summarizing text starting with: '{text_to_summarize[:50]}...'")
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(GEMINI_MODEL_NAME)
        prompt = f"Summarize the following text about a legal case concisely, ideally in 2-4 sentences:\n\n{text_to_summarize}"
        safety_settings = [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]
        response = model.generate_content(prompt, safety_settings=safety_settings)
        if response.parts:
             summary = response.text
             print("    Summary generated successfully.")
             return summary.strip()
        elif response.prompt_feedback.block_reason:
             print(f"    Warning: Summarization blocked due to: {response.prompt_feedback.block_reason}")
             return f"Summarization blocked ({response.prompt_feedback.block_reason})"
        else:
             print("    Warning: Summarization returned no content.")
             return "Summarization failed (No content)"
    except Exception as e:
        print(f"    Error during Gemini API call: {e}")
        return f"Error during summarization: {e}"

# --- Main Processing Class ---
# ... (keep WikiSummarizer class the same) ...
class WikiSummarizer:
    def __init__(self, api_key):
        self.summaries_processed = 0
        self.api_key = api_key
        if not self.api_key:
             print("Warning: WikiSummarizer initialized without an API key.")

    def process_summary(self, summary_text):
        """Checks sentence count and calls Gemini if needed."""
        sentence_count = count_sentences(summary_text)
        if sentence_count > SENTENCE_THRESHOLD:
            if not self.api_key:
                 print("    Skipping summary: API key not available.")
                 return summary_text # Return original if no key
            self.summaries_processed += 1
            # time.sleep(0.5) # Optional delay
            return summarize_text_with_gemini(summary_text, self.api_key)
        else:
            return summary_text

# --- Main Script Logic ---
print("Starting script...")

if not API_KEY:
    print("Warning: GOOGLE_API_KEY environment variable is not set. Summarization will be skipped.")

summarizer = WikiSummarizer(API_KEY)
all_records = [] # List to hold dictionaries of extracted records

print(f"Attempting to fetch URL: {url}")
try:
    response = requests.get(url, headers=headers, timeout=30)
    response.raise_for_status()
    print("Successfully fetched URL.")

    print("Parsing HTML with BeautifulSoup...")
    soup = BeautifulSoup(response.text, 'lxml')

    # Find all tables with the specific class for conviction data
    # Using 'wikitable sortable' is more specific and likely excludes nav boxes
    tables = soup.find_all('table', class_='wikitable') # Stick with wikitable if sortable causes issues

    print(f"Found {len(tables)} tables with class 'wikitable'. Processing...")

    if not tables:
        print("No tables with class 'wikitable' found using BeautifulSoup.")
    else:
        for table_index, table in enumerate(tables):
            print(f"  Processing Table {table_index + 1}...")
            tbody = table.find('tbody')
            if not tbody:
                print(f"    Skipping table {table_index + 1}: No tbody found.")
                continue

            rows = tbody.find_all('tr')
            last_primary_record = None # Keep track of the last main record added

            for row_index, row in enumerate(rows):
                cells = row.find_all(['th', 'td'])
                cell_texts = [cell.get_text(strip=True) for cell in cells]

                # Skip empty rows or potential header rows within tbody if necessary
                if not cell_texts or row.find('th'): # Simple check for header rows
                     if row_index > 0: # Don't print for the actual header
                          # print(f"    Skipping header-like row {row_index + 1}: {cell_texts}")
                          pass
                     continue

                # --- Logic to Identify Row Type ---
                # Assume primary row has roughly the number of expected columns
                # Assume summary row has fewer (often 1) cell, maybe with colspan
                is_primary_row = len(cell_texts) >= len(EXPECTED_COLUMNS) -1 # Allow for slight variation
                is_summary_row = len(cell_texts) < len(EXPECTED_COLUMNS) -1 and len(cell_texts) > 0

                # Check if the first cell has a significant colspan (often indicates summary)
                if len(cells) == 1 and cells[0].get('colspan'):
                     is_primary_row = False
                     is_summary_row = True

                # Refine identification if needed based on inspecting more rows

                if is_primary_row:
                    record = {}
                    for i, col_name in enumerate(EXPECTED_COLUMNS):
                        try:
                            record[col_name] = cell_texts[i]
                        except IndexError:
                            record[col_name] = '' # Handle rows with fewer cells than expected
                    record[SUMMARY_COLUMN_NAME] = '' # Initialize summary field
                    all_records.append(record)
                    last_primary_record = record # Remember this record
                    # print(f"      Added primary record: {record['Name of Wrongfully Convicted Individual']}")

                elif is_summary_row and last_primary_record:
                    # Assume the summary text is the concatenation of all cells in this row
                    summary_text = " ".join(cell_texts)
                    # Append to existing summary if multi-line, or replace if empty
                    if last_primary_record[SUMMARY_COLUMN_NAME]:
                         last_primary_record[SUMMARY_COLUMN_NAME] += " " + summary_text
                    else:
                         last_primary_record[SUMMARY_COLUMN_NAME] = summary_text
                    # print(f"      Added summary to '{last_primary_record['Name of Wrongfully Convicted Individual']}': '{summary_text[:50]}...'")

                # else:
                    # Optional: Handle unexpected row structures
                    # print(f"    Skipping row {row_index + 1} (unexpected structure): {cell_texts}")


        print(f"Finished parsing tables. Extracted {len(all_records)} primary records.")

        if not all_records:
             print("No primary records were extracted. Check table structure and parsing logic.")
        else:
             # Convert list of dictionaries to DataFrame
             print("Converting extracted data to DataFrame...")
             combined_df = pd.DataFrame(all_records)

             # --- Now proceed with the rest of the script using combined_df ---
             print("Columns created by BeautifulSoup parsing:", combined_df.columns.tolist())

             # No renaming needed if EXPECTED_COLUMNS were used correctly

             if SUMMARY_COLUMN_NAME not in combined_df.columns:
                 print(f"Critical Error: The designated summary column '{SUMMARY_COLUMN_NAME}' was not created during parsing.")
                 exit()

             print("Cleaning data (removing references)...")
             # Slightly updated cleaning loop for clarity
             for col in combined_df.columns:
                  # Ensure column is treated as string, handle potential errors
                  try:
                       if combined_df[col].dtype == 'object':
                            combined_df[col] = combined_df[col].astype(str).str.replace(r'\[.*?\]', '', regex=True).str.strip()
                  except Exception as clean_ex:
                       print(f"    Warning: Could not clean column '{col}': {clean_ex}")


             print(f"Processing summaries in column '{SUMMARY_COLUMN_NAME}'...")
             combined_df[SUMMARY_COLUMN_NAME] = combined_df[SUMMARY_COLUMN_NAME].fillna('').apply(summarizer.process_summary)
             print(f"Finished processing summaries. {summarizer.summaries_processed} summaries were sent to the API.")

             # Reorder columns to desired final order + Summary
             final_columns_ordered = EXPECTED_COLUMNS + [SUMMARY_COLUMN_NAME]
             # Ensure all desired columns exist before selecting/reordering
             for col in final_columns_ordered:
                  if col not in combined_df.columns:
                       print(f"Warning: Expected final column '{col}' not found in DataFrame. Adding empty.")
                       combined_df[col] = ''

             final_df = combined_df[final_columns_ordered]
             print(f"Final columns selected for output: {final_columns_ordered}")

             final_df.to_csv(output_csv_file, index=False, encoding='utf-8')
             print(f"Successfully parsed data, processed summaries, and saved to {output_csv_file}")

# ... (keep except blocks the same) ...
except requests.exceptions.RequestException as e:
    print(f"Error fetching URL: {e}")
except ImportError as e:
    print(f"Error: Required library not found. {e}")
    print("Please install libraries using: pip install requests pandas beautifulsoup4 lxml google-generativeai python-dotenv")
except ValueError as e:
    # Keep this for potential errors later, though less likely from BS parsing
    print(f"ValueError during processing: {e}")
except Exception as e:
    print(f"An unexpected error occurred: {e}")
    import traceback
    traceback.print_exc()
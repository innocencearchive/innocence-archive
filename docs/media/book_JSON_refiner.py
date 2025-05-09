# --- How to Use This Script ---
# Refines JSON files (created by book_md_to_json_v5.py) using Google Generative AI
# to fill in missing information or parse unhandled sections from the original Markdown.
#
# Usage (from the command line/terminal):
# python JSON_refiner.py <json_input_dir> <md_input_dir> <output_dir> --api_key YOUR_API_KEY
#   or set GOOGLE_API_KEY environment variable
## python JSON_refiner.py C:\GitHub\innocencearchive\docs\media\books\JSON C:\GitHub\innocencearchive\docs\media\books\research C:\GitHub\innocencearchive\docs\media\books\enhanced --AIzaSyDF1m8Q1E_cNIzFUpI475sTYPibgiDiYC0
# Arguments:
#   <json_input_dir>: Directory containing the JSON files from the previous script.
#   <md_input_dir>:   Directory containing the original Markdown (.md) files.
#   <output_dir>:     Directory where the refined JSON files will be saved.
#   --api_key (optional): Your Google API Key. If not provided, reads from GOOGLE_API_KEY env var.
#
# Example:
# python refine_book_json_with_llm.py "C:\path\to\book_json" "C:\path\to\book_markdown" "C:\path\to\book_enhanced_json" --api_key "YOUR_API_KEY_HERE"
# -----------------------------

import os
import re
import json
import argparse
import time
import copy
import google.generativeai as genai
from pathlib import Path

# --- Configuration ---
# Model to use (update if needed)
LLM_MODEL_NAME = "gemini-1.5-flash-latest"
# Delay between API calls (in seconds) to avoid rate limits
API_CALL_DELAY = 2

# --- Golden Example Structure (for LLM Prompt) ---
# Represents the ideal output format we want the LLM to generate/match.
GOLDEN_JSON_EXAMPLE = {
    "source_file_name": "example_book.md",
    "media_work": {
        "work_type": "BOOK",
        "title": "Example Title: Subtitle",
        "creator_name": "Author One, Author Two",
        "publication_or_release_year": 2023,
        "publisher_or_network": "Example Publisher Inc.",
        "format": "Hardcover, eBook",
        "focus_or_theme": "Main focus or theme of the book.",
        "key_statistics": "Relevant statistics mentioned.",
        "recognition_notes": "Awards or notable recognition."
    },
    "media_item": {
        "item_media_type": "BOOK_CONTENT",
        "item_title": "Book Content: Example Title", # Convention: "Book Content: " + media_work.title
        "summary_notes": "A concise summary of the book's content extracted from the text.",
        "focus_or_theme": "Main focus or theme of the book (can be same as media_work).",
        "case_details_raw": "Detailed descriptions or narratives about specific cases discussed.",
        "key_quotes_raw": [
            "An important quote from the book.",
            "Another significant quote."
        ],
        "systemic_issues_raw": [
            "Systemic issue 1 identified.",
            "Systemic issue 2 identified."
        ],
        "policy_recommendations_raw": [
            "Policy recommendation 1.",
            "Policy recommendation 2."
        ],
        "additional_resources_raw": [
            "Link or reference 1.",
            "Mentioned documentary or website."
        ],
        "research_notes_other": {
            "some_unmapped_key": "Value for an unmapped key found in research notes.",
        }
    },
    "featured_individuals": [
        {
            "full_name": "Firstname Lastname",
            "first_name": "Firstname",
            "middle_name": None,
            "last_name": "Lastname",
            "case_location": "City, State",
            "conviction_year": 1995,
            "exoneration_or_release_year": 2010,
            "crime_convicted_of": "Specific crime description.",
            "sentence": "Sentence received.",
            "time_served": "Approximate time served.",
            "contributing_factors_raw": [
                "Factor 1 (e.g., Eyewitness Misidentification)",
                "Factor 2 (e.g., False Confession)"
            ],
            "status_raw": "Exonerated",
            "organizations_involved_raw": [
                "Innocence Project",
                "Specific Law Firm"
            ],
            "cross_reference": "Mentioned in Book X, Podcast Y.",
            "individual_notes": "Any additional specific notes about this individual's case."
        }
        # ... more individuals if present
    ],
    "involved_persons": [
        {
            "full_name": "Author One",
            "role": "AUTHOR",
            "first_name": "Author",
            "middle_name": None,
            "last_name": "One"
        },
        {
            "full_name": "Author Two",
            "role": "AUTHOR",
            "first_name": "Author",
            "middle_name": None,
            "last_name": "Two"
        }
        # ... potentially other involved persons if identified
    ],
    "research_strategy_notes_raw": "Raw text from the research strategy section.",
    "research_notes_raw": "Raw text from a general research notes section if not parsed into key-value pairs.",
    # "unhandled_section_...": "This key should NOT be present in the final output."
}

# --- Helper Functions ---

def load_json(filepath):
    """Loads JSON data from a file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON from {filepath}: {e}")
        return None
    except Exception as e:
        print(f"Error reading file {filepath}: {e}")
        return None

def save_json(data, filepath):
    """Saves data to a JSON file."""
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error writing JSON file {filepath}: {e}")
        return False

def check_if_refinement_needed(json_data):
    """Checks if the loaded JSON data likely needs LLM refinement."""
    if not json_data:
        return False # Cannot refine if loading failed

    # Check for missing essential MediaWork info
    if not json_data.get('media_work', {}).get('title') or \
       json_data.get('media_work', {}).get('title') == 'Unknown Title' or \
       not json_data.get('media_work', {}).get('creator_name'):
        print("  Reason: Missing title or creator.")
        return True

    # Check for empty featured individuals list
    if not json_data.get('featured_individuals'):
        print("  Reason: Featured individuals list is empty.")
        return True

    # Check for unhandled sections
    for key in json_data.keys():
        if key.startswith("unhandled_section_"):
            print(f"  Reason: Found unhandled section key: {key}")
            return True

    # Add more checks if needed (e.g., missing summary, specific required fields)

    return False # Looks okay based on current checks

def build_prompt(markdown_content, current_json_data, golden_example_str):
    """Builds the prompt for the LLM."""

    prompt = f"""Analyze the following Markdown text which is research notes about a book discussing wrongful convictions.
Your goal is to extract information and structure it into a complete JSON object that accurately reflects the book's content, matching the provided GOLDEN_JSON_EXAMPLE structure.

GOLDEN_JSON_EXAMPLE structure:
```json
{golden_example_str}
```

**Instructions:**
1.  Identify the main book title, author(s), publication year, publisher, etc., and populate the `media_work` object. Set `work_type` to "BOOK".
2.  Identify the featured wrongfully convicted individuals. For each individual, create an object in the `featured_individuals` list. Extract details like `full_name`, `case_location`, `conviction_year`, `exoneration_or_release_year`, `crime_convicted_of`, `sentence`, `time_served`, `contributing_factors_raw` (as a list of strings), `status_raw`, `organizations_involved_raw` (as a list of strings), and any `individual_notes`. Use the `parse_name` logic shown in the example to populate `first_name`, `middle_name`, `last_name`.
3.  Populate the `involved_persons` list. Always include the author(s) with `role: "AUTHOR"`.
4.  Populate the `media_item` object. Set `item_media_type` to "BOOK_CONTENT". Generate `item_title` as "Book Content: [Actual Book Title]". Extract `summary_notes`, `focus_or_theme`, `case_details_raw`, and parse lists for `key_quotes_raw`, `systemic_issues_raw`, `policy_recommendations_raw`, `additional_resources_raw`.
5.  Extract content from any "Research Notes" or "Book Research Notes" sections into `research_notes_raw` or specific `media_item` fields if applicable.
6.  Extract content from "Research Strategy Notes" into `research_strategy_notes_raw`.
7.  **Crucially:** Try to incorporate information from any unhandled sections (keys starting with `unhandled_section_`) found in the `CURRENT_JSON_DATA` provided below. These unhandled sections contain important data missed by the initial parser.
8.  Ensure the final output is a **single, valid JSON object** adhering to the golden example structure. Do not include explanatory text before or after the JSON object. Do not include keys like `unhandled_section_*` in your final output.

**Current JSON Data (may be incomplete or have unhandled sections):**
```json
{json.dumps(current_json_data, indent=2)}
```

**Markdown Content:**
```markdown
{markdown_content}
```

**Refined JSON Output:**
"""
    return prompt

def call_llm(model, prompt):
    """Calls the Google Generative AI API and attempts to parse JSON response."""
    print("  Calling LLM API...")
    try:
        # Configure for JSON output if possible (check model documentation)
        # For Gemini, you might need to explicitly ask for JSON in the prompt
        # and potentially use specific generation config if available.
        # Simple approach for now:
        response = model.generate_content(prompt)

        # Attempt to extract JSON block if markdown backticks are present
        cleaned_response = response.text
        match = re.search(r'```json\s*([\s\S]*?)\s*```', cleaned_response, re.IGNORECASE)
        if match:
            json_str = match.group(1).strip()
            print("  LLM response contained JSON block.")
        else:
            # Assume the whole response is JSON, or needs cleaning
            json_str = cleaned_response.strip()
            print("  Assuming entire LLM response is JSON.")

        # Parse the JSON string
        llm_data = json.loads(json_str)
        print("  Successfully parsed LLM response as JSON.")
        return llm_data

    except json.JSONDecodeError as e:
        print(f"  Error: LLM response was not valid JSON: {e}")
        print(f"  LLM Raw Response Text:\n---\n{response.text}\n---")
        return None
    except Exception as e:
        print(f"  Error calling LLM API: {e}")
        # Consider checking specific error types from the API library
        # if hasattr(e, 'response'): print(f"  API Response Error: {e.response}")
        return None

def merge_results(original_data, llm_data):
    """Merges LLM results into the original data structure."""
    if not llm_data or not isinstance(llm_data, dict):
        print("  Merge skipped: LLM data is invalid or empty.")
        return original_data # Return original if LLM data is bad

    print("  Merging LLM data with original...")
    merged_data = copy.deepcopy(original_data) # Start with original

    # Overwrite top-level fields if present in LLM data (except source_file_name)
    for key, value in llm_data.items():
        if key != "source_file_name" and key not in ["media_work", "media_item", "featured_individuals", "involved_persons"] and not key.startswith("unhandled_section"):
             if value is not None: # Only overwrite if LLM provided a value
                merged_data[key] = value

    # Merge media_work dictionary
    if isinstance(llm_data.get('media_work'), dict):
        if 'media_work' not in merged_data: merged_data['media_work'] = {}
        for key, value in llm_data['media_work'].items():
            if value is not None: # Only overwrite if LLM provided a value
                merged_data['media_work'][key] = value

    # Merge media_item dictionary
    if isinstance(llm_data.get('media_item'), dict):
        if 'media_item' not in merged_data: merged_data['media_item'] = {}
        for key, value in llm_data['media_item'].items():
             if value is not None: # Only overwrite if LLM provided a value
                 merged_data['media_item'][key] = value

    # Replace lists if LLM provided them and they are not empty
    if isinstance(llm_data.get('featured_individuals'), list) and llm_data['featured_individuals']:
        merged_data['featured_individuals'] = llm_data['featured_individuals']
    elif not merged_data.get('featured_individuals'): # Ensure key exists even if empty
         merged_data['featured_individuals'] = []


    if isinstance(llm_data.get('involved_persons'), list) and llm_data['involved_persons']:
        merged_data['involved_persons'] = llm_data['involved_persons']
    elif not merged_data.get('involved_persons'): # Ensure key exists
         merged_data['involved_persons'] = []


    # Remove unhandled sections from the final merged data
    keys_to_remove = [key for key in merged_data if key.startswith("unhandled_section_")]
    for key in keys_to_remove:
        del merged_data[key]
        print(f"  Removed unhandled section key: {key}")

    return merged_data


# --- Main Execution ---
def main():
    parser = argparse.ArgumentParser(description="Refine book JSON data using Google Generative AI.")
    parser.add_argument("json_input_dir", help="Directory containing the input JSON files.")
    parser.add_argument("md_input_dir", help="Directory containing the original Markdown (.md) files.")
    parser.add_argument("output_dir", help="Directory where the refined JSON files will be saved.")
    parser.add_argument("--api_key", help="Google API Key (reads from GOOGLE_API_KEY env var if not provided)", default=None)
    parser.add_argument("--force_refine", action='store_true', help="Force LLM refinement even if checks pass.")


    args = parser.parse_args()

    # --- Setup ---
    json_input_path = Path(args.json_input_dir)
    md_input_path = Path(args.md_input_dir)
    output_path = Path(args.output_dir)

    if not json_input_path.is_dir():
        print(f"Error: Input JSON directory '{args.json_input_dir}' not found.")
        return
    if not md_input_path.is_dir():
        print(f"Error: Input Markdown directory '{args.md_input_dir}' not found.")
        return

    output_path.mkdir(parents=True, exist_ok=True)
    print(f"Output directory: {output_path}")

    # --- Configure API Key ---
    api_key = args.api_key or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("Error: Google API Key not provided. Set GOOGLE_API_KEY environment variable or use --api_key argument.")
        return
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(LLM_MODEL_NAME)
    print(f"Using LLM Model: {LLM_MODEL_NAME}")

    # --- Process Files ---
    total_files = 0
    refined_files = 0
    copied_files = 0
    error_files = 0

    golden_example_str = json.dumps(GOLDEN_JSON_EXAMPLE, indent=2) # For prompt

    for json_filepath in json_input_path.glob("*.json"):
        total_files += 1
        print(f"\nProcessing: {json_filepath.name}")

        # Find corresponding Markdown file
        md_filename = json_filepath.stem + ".md"
        md_filepath = md_input_path / md_filename
        if not md_filepath.is_file():
            print(f"  Error: Corresponding Markdown file '{md_filename}' not found in {md_input_path}. Skipping.")
            error_files += 1
            continue

        # Load original JSON
        original_json_data = load_json(json_filepath)
        if not original_json_data:
            print(f"  Error: Failed to load original JSON. Skipping.")
            error_files += 1
            continue

        output_filepath = output_path / json_filepath.name

        # Check if refinement is needed
        needs_refinement = args.force_refine or check_if_refinement_needed(original_json_data)

        if needs_refinement:
            print("  Refinement needed. Preparing LLM call.")
            refined_files += 1
            try:
                # Read Markdown content
                markdown_content = md_filepath.read_text(encoding='utf-8')

                # Build prompt
                prompt = build_prompt(markdown_content, original_json_data, golden_example_str)

                # Call LLM
                llm_result_data = call_llm(model, prompt)

                # Merge results
                final_data = merge_results(original_json_data, llm_result_data)

                # Save refined JSON
                if not save_json(final_data, output_filepath):
                    error_files += 1 # Error saving

                # Add delay between API calls
                print(f"  Waiting {API_CALL_DELAY} seconds before next API call...")
                time.sleep(API_CALL_DELAY)

            except Exception as e:
                print(f"  Error during refinement process for {json_filepath.name}: {e}")
                error_files += 1
                # Optionally copy the original file on error?
                # shutil.copy2(json_filepath, output_filepath)

        else:
            print("  No refinement needed. Copying original JSON.")
            copied_files += 1
            try:
                import shutil
                shutil.copy2(json_filepath, output_filepath)
            except Exception as e:
                print(f"  Error copying file {json_filepath.name}: {e}")
                error_files += 1


    print("\n--- Refinement Summary ---")
    print(f"Total JSON files processed: {total_files}")
    print(f"Files refined using LLM: {refined_files}")
    print(f"Files copied without refinement: {copied_files}")
    print(f"Files with errors: {error_files}")
    print("--------------------------")


if __name__ == "__main__":
    main()

# --- How to Use This Script ---
# Refines JSON files (created by film_md_to_json.py) using Google Generative AI
# to fill in missing information, correct parsing errors (like lists and names),
# and align the structure closer to the target schema based on the original Markdown.
# Loads the target 'Golden JSON' structure from an external file.
#
# Prerequisites:
# 1. Install necessary libraries:
#    pip install google-generativeai python-dotenv
# 2. Create a file named '.env' in the same directory as this script.
# 3. Add your Google API Key to the '.env' file like this:
#    GOOGLE_API_KEY=YOUR_API_KEY_HERE
# 4. Have your 'Golden JSON' example file ready (e.g., film_golden_example.json).
#
# Usage (from the command line/terminal):
# python film_JSON_refiner.py <json_input_dir> <md_input_dir> <output_dir> --golden_json_path <path_to_golden.json> [--force_refine]
#
# Arguments:
#   <json_input_dir>:     Directory containing the JSON files from film_md_to_json.py.
#   <md_input_dir>:       Directory containing the original Markdown (.md) files.
#   <output_dir>:         Directory where the refined JSON files will be saved.
#   --golden_json_path:   Path to the file containing the golden JSON example structure.
#   --force_refine (optional): Force LLM refinement even if initial checks pass.
#
# Example (Windows):
# python film_JSON_refiner.py "C:\path\to\film_json_initial" "C:\path\to\film_markdown" "C:\path\to\film_json_refined" --golden_json_path "C:\path\to\golden_film.json"
# -----------------------------

import os
import re
import json
import argparse
import time
import copy
import google.generativeai as genai
from pathlib import Path
from dotenv import load_dotenv # For loading API key from .env file

# --- Configuration ---
# Load environment variables from .env file
load_dotenv()

# Model to use (update if needed)
LLM_MODEL_NAME = "gemini-2.0-flash"
# Delay between API calls (in seconds) to avoid rate limits
API_CALL_DELAY = 2

# --- Golden Example Structure ---
# REMOVED - This will be loaded from the file specified by --golden_json_path
# GOLDEN_JSON_EXAMPLE = { ... }

# --- Helper Functions ---

def load_json(filepath):
    """Loads JSON data from a file."""
    try:
        # Ensure filepath is a Path object for consistency
        filepath = Path(filepath)
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"  Error decoding JSON from {filepath.name}: {e}")
        return None
    except FileNotFoundError:
        print(f"  Error: File not found - {filepath}")
        return None
    except Exception as e:
        print(f"  Error reading file {filepath.name}: {e}")
        return None

def save_json(data, filepath):
    """Saves data to a JSON file."""
    try:
        filepath.parent.mkdir(parents=True, exist_ok=True) # Ensure output dir exists
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"  Error writing JSON file {filepath.name}: {e}")
        return False

def check_if_refinement_needed(json_data, filename):
    """
    Checks if the loaded JSON data likely needs LLM refinement based on
    common errors found in the initial parsing phase.
    """
    if not json_data:
        print(f"  Skipping refinement check for {filename}: Failed to load JSON.")
        return False # Cannot refine if loading failed

    reasons = []

    # Check for missing essential MediaWork/MediaItem info
    if not json_data.get('media_work', {}).get('title'):
        reasons.append("Missing media_work.title")
    if not json_data.get('media_item', {}).get('item_title'):
        reasons.append("Missing media_item.item_title")

    # Check for unknown types
    if json_data.get('media_work', {}).get('work_type') == 'UNKNOWN':
        reasons.append("media_work.work_type is UNKNOWN")
    if json_data.get('media_item', {}).get('item_media_type') == 'UNKNOWN':
        reasons.append("media_item.item_media_type is UNKNOWN")

    # Check for empty featured individuals list (if expected)
    if not json_data.get('featured_individuals'):
        reasons.append("featured_individuals list is empty")

    # Check for list parsing errors (single long string instead of list items)
    list_keys_to_check = ['key_quotes_raw', 'systemic_issues_raw', 'policy_recommendations_raw', 'contributing_factors_raw', 'organizations_involved_raw']
    media_item = json_data.get('media_item', {})
    list_error_found = False
    for key in list_keys_to_check:
        if key in media_item and isinstance(media_item[key], list) and len(media_item[key]) == 1 and isinstance(media_item[key][0], str) and len(media_item[key][0]) > 100:
            reasons.append(f"Potential list parsing error in media_item.{key}")
            list_error_found = True
            break
    if not list_error_found:
        individuals = json_data.get('featured_individuals', [])
        for i, individual in enumerate(individuals):
            if isinstance(individual, dict):
                 for key in ['contributing_factors_raw', 'organizations_involved_raw']:
                     if key in individual and isinstance(individual[key], list) and len(individual[key]) == 1 and isinstance(individual[key][0], str) and len(individual[key][0]) > 100:
                         reasons.append(f"Potential list parsing error in featured_individuals[{i}].{key}")
                         list_error_found = True
                         break
            if list_error_found: break

    # Check for individual name parsing errors
    name_pattern = re.compile(r'\[cite:|^\d+\.\d+$|^and |Film follows six inmates:')
    name_error_found = False
    individuals = json_data.get('featured_individuals', [])
    for i, individual in enumerate(individuals):
         if isinstance(individual, dict):
             full_name = individual.get('full_name', '')
             if not full_name or name_pattern.search(full_name):
                  reasons.append(f"Potential name parsing error for featured_individuals[{i}] (name: '{full_name}')")
                  name_error_found = True; break
             if individual.get('first_name') and individual.get('first_name').replace('.','').replace(']','').isdigit() and not individual.get('last_name'):
                  reasons.append(f"Potential numeric/citation name error for featured_individuals[{i}]")
                  name_error_found = True; break
    # Removed redundant break

    # Check for stray/incorrect keys
    stray_key_pattern = re.compile(r'^\*\*also_mentioned|note_on_wrongful_conviction_focus|^unhandled_section_')
    stray_key_found = False
    for key in json_data.keys():
        if stray_key_pattern.match(key):
            reasons.append(f"Found stray/unhandled key: {key}"); stray_key_found = True; break
    if not stray_key_found:
        individuals = json_data.get('featured_individuals', [])
        for i, individual in enumerate(individuals):
             if isinstance(individual, dict):
                 for key in individual.keys():
                     if stray_key_pattern.match(key):
                         reasons.append(f"Found stray/unhandled key in featured_individuals[{i}]: {key}"); stray_key_found = True; break
             if stray_key_found: break

    # Check for link parsing errors (empty external_links_raw)
    if 'media_item' in json_data and isinstance(json_data['media_item'], dict) and json_data['media_item'].get('external_links_raw') == []:
        reasons.append("Potential link parsing error (external_links_raw is empty)")

    if reasons:
        unique_reasons = sorted(list(set(reasons)))
        print(f"  Refinement needed for {filename}. Reasons: {'; '.join(unique_reasons)}")
        return True
    else:
        return False

def build_prompt(markdown_content, current_json_data_str, golden_example_str):
    """Builds the prompt for the LLM, including the golden example structure."""

    # Construct the prompt using string concatenation or multiple f-strings
    # to avoid issues with braces in the JSON examples.
    part1 = "Analyze the following Markdown text which contains research notes about a film, documentary, or TV series episode discussing wrongful convictions.\n"
    part2 = "Your goal is to extract information and structure it into a complete JSON object that accurately reflects the content, **strictly adhering** to the provided GOLDEN_JSON_EXAMPLE structure and fixing common parsing errors.\n\n"
    part3 = "GOLDEN_JSON_EXAMPLE structure (Target Output Format):\n```json\n"
    part4 = golden_example_str # This is the loaded golden example string
    part5 = "\n```\n\n"
    part6 = "**Current JSON Data (from initial script - MAY CONTAIN ERRORS):**\n```json\n"
    part7 = current_json_data_str # This is the current file's data as a string
    part8 = "\n```\n\n"
    part9 = "**Markdown Content:**\n```markdown\n"
    part10 = markdown_content
    part11 = "\n```\n\n"
    part12 = """**Instructions:**

1.  **Identify Core Metadata:** Extract the main work title (`media_work.title`), director(s) (`involved_persons` with role DIRECTOR), release year (`media_work.publication_or_release_year`), and production company/network (`media_work.publisher_or_network`). Determine the correct `media_work.work_type` (FILM, DOCUMENTARY, DOCUSERIES, TV_SERIES, UNKNOWN) based on the format or context.
2.  **Handle Episodes:** If it's an episode of a series, extract the episode title (`media_item.item_title`) and episode number (`media_item.item_number`, e.g., "S01 E05") if available. Ensure the `media_item.item_media_type` is set correctly (e.g., TV_EPISODE). If it's a standalone film/documentary, `media_item.item_title` should usually match `media_work.title`, and `item_media_type` should be FILM_CONTENT or DOCUMENTARY_CONTENT.
3.  **Parse Individuals Accurately:**
    * Identify **all** featured wrongfully convicted individuals listed in the Markdown.
    * **Crucially fix name parsing errors:** Remove any "[cite:...]" tags or stray numbers/punctuation from `full_name`, `first_name`, `middle_name`, `last_name`. Ensure names like "Eric Glisson" are parsed correctly, not "Eric Glisson [cite:". Discard entries that are clearly just citation numbers (e.g., "12.1").
    * **Handle Grouped Individuals:** If individuals are listed as a group (e.g., "San Antonio Four: Name1, Name2..."), create a separate, complete entry in the `featured_individuals` list for **each** named individual, applying the shared details found below the group name to each person. Do **not** duplicate details from one person onto others incorrectly.
    * Extract details for each individual: `conviction_year`, `exoneration_or_release_year` (as integer or null), `time_served`, `sentence`, `crime_convicted_of_raw`, `case_location_city`, `case_location_state`, `status_raw`.
    * **Synthesize `narrative_summary`:** Provide a brief (1-3 sentence) summary for each individual based on their details in the Markdown.
    * **Map `status`:** If possible, map the `status_raw` text to one of the enum values (EXONERATED, RELEASED_ALFORD_PLEA, RELEASED_CLEMENCY, RELEASED_TIME_SERVED, CONVICTION_OVERTURNED, EXECUTED, CONVICTED, OTHER, UNKNOWN). Default to UNKNOWN or OTHER if unsure. Set to null if no conviction occurred (e.g., charges dismissed).
4.  **Correct List Parsing:**
    * **Critically Important:** Ensure fields like `key_quotes_raw`, `systemic_issues_raw`, `policy_recommendations_raw`, `contributing_factors_raw`, and `organizations_involved_raw` are **LISTS OF STRINGS**. If the Current JSON shows a list with only one long string, **split that string into individual items** based on the Markdown list structure (e.g., bullet points, numbered lists, distinct sentences/phrases).
5.  **Extract Links:** Parse Markdown links (`[Text](URL)` or standalone URLs) in the "Additional Resources" section and format them as a list of objects `[{ "url": "...", "description": "..." }]` in `media_item.external_links_raw`. Ensure the 'url' field is populated correctly.
6.  **Synthesize Summaries:** Populate `media_work.summaryNotes` (overall work summary, often from "Key Statistics/Information") and `media_item.summary_notes` (specific episode/film summary, synthesized from research notes).
7.  **Clean Fields:** Remove extra quotes or parenthetical notes from titles unless part of the actual title. Convert placeholders like "N/A" or "Information Unavailable" to `null` where appropriate (especially for numeric/date fields like years). Ensure years are integers or null.
8.  **Remove Stray Keys:** Ensure the final JSON does **not** contain keys like `unhandled_section_*`, `**also_mentioned`, `note_on_wrongful_conviction_focus`, `episode_title_raw`, `format_raw`, or `director_name`. Incorporate data from `unhandled_section_*` into appropriate fields if possible.
9.  **Final Output:** Produce a **single, valid JSON object** matching the GOLDEN_JSON_EXAMPLE structure. Do not include explanations before or after the JSON block. Ensure all strings are properly escaped.

**Refined JSON Output:**
"""

    # Combine the parts
    prompt = part1 + part2 + part3 + part4 + part5 + part6 + part7 + part8 + part9 + part10 + part11 + part12
    return prompt


def call_llm(model, prompt):
    """Calls the Google Generative AI API and attempts to parse JSON response."""
    print("  Calling LLM API...")
    llm_result_data = None
    try:
        safety_settings = [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]
        response = model.generate_content(prompt, safety_settings=safety_settings)

        cleaned_response_text = response.text
        match = re.search(r'```json\s*([\s\S]*?)\s*```', cleaned_response_text, re.IGNORECASE)
        if match:
            json_str = match.group(1).strip()
            print("  LLM response contained JSON block.")
        else:
            json_str = cleaned_response_text.strip()
            start_brace = json_str.find('{')
            end_brace = json_str.rfind('}')
            if start_brace != -1 and end_brace != -1 and end_brace > start_brace:
                json_str = json_str[start_brace:end_brace+1]
            else:
                 raise json.JSONDecodeError("Could not find valid JSON structure in response", json_str, 0)
            print("  Assuming entire LLM response is JSON (or needs cleaning).")

        llm_result_data = json.loads(json_str)
        print("  Successfully parsed LLM response as JSON.")

    except json.JSONDecodeError as e:
        print(f"  Error: LLM response was not valid JSON: {e}")
        print(f"  LLM Raw Response Text (first 500 chars):\n---\n{cleaned_response_text[:500]}\n---")
        llm_result_data = None
    except ValueError as e:
         print(f"  Warning: LLM response generation may have been blocked or incomplete. {e}")
         try: partial_text = response.text; print(f"  LLM Partial Response Text (first 500 chars):\n---\n{partial_text[:500]}\n---")
         except Exception: print("  Could not retrieve partial text from response.")
         llm_result_data = None
    except Exception as e:
        print(f"  Error calling LLM API or processing response: {e}")
        llm_result_data = None

    return llm_result_data


def merge_results(original_data, llm_data):
    """
    Merges LLM results into the original data structure.
    Prioritizes LLM data for fields known to have parsing issues (lists, individuals),
    while carefully merging other fields. Removes known bad keys.
    """
    if not llm_data or not isinstance(llm_data, dict):
        print("  Merge skipped: LLM data is invalid or empty.")
        # Return original data but clean it first
        cleaned_original = copy.deepcopy(original_data)
        keys_to_remove_patterns = re.compile(r'^\*\*also_mentioned|note_on_wrongful_conviction_focus|^unhandled_section_|episode_title_raw|format_raw|director_name')
        # Clean top level
        final_keys = list(cleaned_original.keys())
        for key in final_keys:
            if keys_to_remove_patterns.match(key):
                del cleaned_original[key]
        # Clean individuals
        if 'featured_individuals' in cleaned_original and isinstance(cleaned_original['featured_individuals'], list):
            valid_individuals = []
            name_pattern = re.compile(r'\[cite:|^\d+\.\d+$|^and |Film follows six inmates:')
            for individual in cleaned_original['featured_individuals']:
                 if isinstance(individual, dict):
                     ind_keys = list(individual.keys())
                     valid = True
                     for key in ind_keys:
                         if keys_to_remove_patterns.match(key):
                             del individual[key]
                     full_name = individual.get('full_name', '')
                     if not full_name or name_pattern.search(full_name): valid = False
                     elif individual.get('first_name') and individual.get('first_name').replace('.','').replace(']','').isdigit() and not individual.get('last_name'): valid = False
                     if valid: valid_individuals.append(individual)
            cleaned_original['featured_individuals'] = valid_individuals
        return cleaned_original # Return cleaned original if LLM failed

    print("  Merging LLM data with original...")
    merged_data = copy.deepcopy(llm_data)

    # --- Key Fields to Prioritize from LLM ---
    list_keys_to_check_merge = ['key_quotes_raw', 'systemic_issues_raw', 'policy_recommendations_raw', 'external_links_raw']
    if 'media_item' in merged_data and isinstance(merged_data['media_item'], dict):
        for key in list_keys_to_check_merge:
             if key in merged_data['media_item'] and isinstance(merged_data['media_item'][key], list): pass
             elif key not in merged_data['media_item'] and key in original_data.get('media_item', {}):
                  original_list = original_data['media_item'][key]
                  is_bad_original_list = isinstance(original_list, list) and len(original_list) == 1 and isinstance(original_list[0], str) and len(original_list[0]) > 100
                  if not is_bad_original_list: merged_data['media_item'][key] = original_list
                  else: merged_data['media_item'][key] = []

    if 'featured_individuals' not in merged_data and 'featured_individuals' in original_data:
         merged_data['featured_individuals'] = original_data['featured_individuals']
    if 'involved_persons' not in merged_data and 'involved_persons' in original_data:
         merged_data['involved_persons'] = original_data['involved_persons']

    # --- Carefully Merge Dictionaries (media_work, media_item) ---
    for section_key in ['media_work', 'media_item']:
        original_section = original_data.get(section_key, {})
        if section_key not in merged_data: merged_data[section_key] = {}
        llm_section = merged_data.get(section_key, {})
        if not isinstance(original_section, dict): continue

        for key, value in original_section.items():
             is_problematic_list_key = section_key == 'media_item' and key in list_keys_to_check_merge
             if key not in llm_section and not is_problematic_list_key:
                 merged_data[section_key][key] = value
             elif key in ['work_type', 'item_media_type'] and llm_section.get(key) == 'UNKNOWN' and value != 'UNKNOWN' and value is not None:
                  merged_data[section_key][key] = value
             elif key in ['summaryNotes', 'summary_notes'] and not llm_section.get(key) and value:
                  merged_data[section_key][key] = value

    # --- Merge Top-Level Fields ---
    for key, value in original_data.items():
         if key not in merged_data and key not in ['media_work', 'media_item', 'featured_individuals', 'involved_persons']:
             keys_to_remove_patterns_check = re.compile(r'^\*\*also_mentioned|note_on_wrongful_conviction_focus|^unhandled_section_|episode_title_raw|format_raw|director_name')
             if not keys_to_remove_patterns_check.match(key):
                 merged_data[key] = value

    # --- Final Cleanup ---
    if 'featured_individuals' not in merged_data: merged_data['featured_individuals'] = []
    if 'involved_persons' not in merged_data: merged_data['involved_persons'] = []
    if 'media_item' in merged_data and isinstance(merged_data['media_item'], dict):
        if 'external_links_raw' not in merged_data['media_item']: merged_data['media_item']['external_links_raw'] = []
        if 'research_notes_other' not in merged_data['media_item']: merged_data['media_item']['research_notes_other'] = {}
    elif 'media_item' not in merged_data:
         merged_data['media_item'] = {'external_links_raw': [], 'research_notes_other': {}}

    keys_to_remove_patterns = re.compile(r'^\*\*also_mentioned|note_on_wrongful_conviction_focus|^unhandled_section_|episode_title_raw|format_raw|director_name')
    final_keys = list(merged_data.keys())
    for key in final_keys:
        if keys_to_remove_patterns.match(key):
            del merged_data[key]; print(f"  Removed stray/temp key: {key}")

    if 'featured_individuals' in merged_data and isinstance(merged_data['featured_individuals'], list):
        valid_individuals = []
        name_pattern = re.compile(r'\[cite:|^\d+\.\d+$|^and |Film follows six inmates:')
        for individual in merged_data['featured_individuals']:
             if isinstance(individual, dict):
                 ind_keys = list(individual.keys())
                 valid = True
                 for key in ind_keys:
                     if keys_to_remove_patterns.match(key):
                         del individual[key]; print(f"  Removed stray/temp key from individual: {key}")
                 full_name = individual.get('full_name', '')
                 if not full_name or name_pattern.search(full_name):
                     print(f"  Skipping individual due to invalid name after cleanup: '{full_name}'"); valid = False
                 elif individual.get('first_name') and individual.get('first_name').replace('.','').replace(']','').isdigit() and not individual.get('last_name'):
                      print(f"  Skipping individual due to numeric/citation name error after cleanup: '{full_name}'"); valid = False
                 if valid: valid_individuals.append(individual)
        merged_data['featured_individuals'] = valid_individuals

    if isinstance(merged_data.get('media_item'), dict) and 'research_notes_other' in merged_data['media_item'] and not merged_data['media_item']['research_notes_other']:
         del merged_data['media_item']['research_notes_other']

    merged_data['source_file_name'] = original_data.get('source_file_name', 'unknown_source_file.md')

    return merged_data


# --- Main Execution ---
def main():
    parser = argparse.ArgumentParser(description="Refine film/documentary JSON data using Google Generative AI.")
    parser.add_argument("json_input_dir", help="Directory containing the input JSON files (from film_md_to_json.py).")
    parser.add_argument("md_input_dir", help="Directory containing the original Markdown (.md) files.")
    parser.add_argument("output_dir", help="Directory where the refined JSON files will be saved.")
    # Make golden_json_path a required argument
    parser.add_argument("--golden_json_path", required=True, help="Path to the file containing the golden JSON example structure.")
    parser.add_argument("--force_refine", action='store_true', help="Force LLM refinement even if checks pass.")

    args = parser.parse_args()

    # --- Setup ---
    json_input_path = Path(args.json_input_dir)
    md_input_path = Path(args.md_input_dir)
    output_path = Path(args.output_dir)
    golden_json_path = Path(args.golden_json_path) # Get path from args

    if not json_input_path.is_dir():
        print(f"Error: Input JSON directory '{args.json_input_dir}' not found.")
        return
    if not md_input_path.is_dir():
        print(f"Error: Input Markdown directory '{args.md_input_dir}' not found.")
        return
    if not golden_json_path.is_file():
        print(f"Error: Golden JSON file '{args.golden_json_path}' not found.")
        return

    output_path.mkdir(parents=True, exist_ok=True)
    print(f"Output directory: {output_path}")

    # --- Load Golden JSON Example ---
    print(f"Loading Golden JSON example from: {golden_json_path}")
    golden_json_example_dict = load_json(golden_json_path)
    if not golden_json_example_dict:
        print("Exiting due to error loading Golden JSON.")
        return
    try:
        # Convert the loaded dictionary back to a formatted string for the prompt
        golden_example_str = json.dumps(golden_json_example_dict, indent=2)
    except Exception as e:
        print(f"Error converting loaded Golden JSON to string: {e}")
        return

    # --- Configure API Key ---
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("Error: GOOGLE_API_KEY not found in environment variables.")
        print("Please ensure you have a .env file in the script's directory with GOOGLE_API_KEY=YOUR_KEY")
        return
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(LLM_MODEL_NAME)
        print(f"Using LLM Model: {LLM_MODEL_NAME}")
    except Exception as e:
        print(f"Error configuring Google Generative AI: {e}")
        return


    # --- Process Files ---
    total_files = 0
    refined_files = 0
    copied_files = 0
    error_files = 0

    json_files = list(json_input_path.glob("*.json"))
    print(f"Found {len(json_files)} JSON files to process.")

    for json_filepath in json_files:
        total_files += 1
        print(f"\nProcessing: {json_filepath.name} ({total_files}/{len(json_files)})")

        md_filename = json_filepath.stem + ".md"
        md_filepath = md_input_path / md_filename
        if not md_filepath.is_file():
            print(f"  Error: Corresponding Markdown file '{md_filename}' not found in {md_input_path}. Skipping.")
            error_files += 1; continue

        original_json_data = load_json(json_filepath)
        if not original_json_data:
            print(f"  Error: Failed to load original JSON from {json_filepath.name}. Skipping.")
            error_files += 1; continue

        output_filepath = output_path / json_filepath.name
        needs_refinement = args.force_refine or check_if_refinement_needed(original_json_data, json_filepath.name)

        if needs_refinement:
            print("  Refinement identified as needed. Preparing LLM call.")
            refined_files += 1
            try:
                markdown_content = md_filepath.read_text(encoding='utf-8')
                current_json_str = json.dumps(original_json_data, indent=2)
                # Pass the loaded golden_example_str to build_prompt
                prompt = build_prompt(markdown_content, current_json_str, golden_example_str)

                llm_result_data = call_llm(model, prompt)
                final_data = merge_results(original_json_data, llm_result_data)

                if save_json(final_data, output_filepath):
                     print(f"  Successfully saved refined JSON: {output_filepath.name}")
                else:
                    error_files += 1

                print(f"  Waiting {API_CALL_DELAY} seconds before next API call...")
                time.sleep(API_CALL_DELAY)

            except Exception as e:
                print(f"  Error during refinement process for {json_filepath.name}: {e}")
                error_files += 1
        else:
            print("  No refinement needed based on checks. Copying original JSON.")
            copied_files += 1
            try:
                import shutil
                shutil.copy2(json_filepath, output_filepath)
                print(f"  Successfully copied original JSON: {output_filepath.name}")
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

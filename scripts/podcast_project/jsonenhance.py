import os
import json
import argparse
import time # Import the time module
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
from dotenv import load_dotenv
from tqdm import tqdm # For progress bar

# --- Configuration ---

# Load API Key from .env file
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

if not GOOGLE_API_KEY:
    print("Error: GOOGLE_API_KEY not found in environment variables or .env file.")
    exit() # Exit if no API key

# Configure the Gemini API client
genai.configure(api_key=GOOGLE_API_KEY)

# Choose the Gemini model
MODEL_NAME = "gemini-2.0-flash-lite" 

# Safety settings
SAFETY_SETTINGS = {
    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
}

# Generation configuration - asking for JSON output
GENERATION_CONFIG = {
    "response_mime_type": "application/json",
}

# --- Helper Function for API Call ---

def call_gemini_api(prompt_text, retries=3, delay=5):
    """Calls the Gemini API with retries and delay."""
    # Note: This function's internal delay is for retries on *failure*,
    # the main rate limit delay is added in the main loop.
    print("\n - Sending request to Gemini API...") # Indented for clarity within loop
    try:
        model = genai.GenerativeModel(
            MODEL_NAME,
            safety_settings=SAFETY_SETTINGS,
            generation_config=GENERATION_CONFIG
            )
        response = model.generate_content(prompt_text)
        print(" - Received response from API.")
        if response.parts:
             return response.text 
        else:
            print("   Warning: API response did not contain expected content parts.")
            if response.prompt_feedback.block_reason:
                 print(f"   API Call Blocked: {response.prompt_feedback.block_reason}")
                 print(f"   Block Reason Message: {response.prompt_feedback.block_reason_message}")
            return None

    except Exception as e:
        print(f"   Error calling Gemini API: {e}")
        if retries > 0:
            print(f"   Retrying in {delay} seconds... ({retries} retries left)")
            time.sleep(delay) # Pause before retrying
            return call_gemini_api(prompt_text, retries - 1, delay * 2) 
        else:
            print("   Max retries reached. Skipping API call for this item.")
            return None

# --- Prompt Generation ---

def create_llm_prompt(json_data):
    """Creates the prompt for the Gemini API based on the JSON data."""
    context_parts = []
    item_title = json_data.get('mediaItem', {}).get('itemTitle', '')
    summary = json_data.get('mediaItem', {}).get('summaryNotes', '')
    key_quotes = json_data.get('keyQuotesRaw', []) 
    systemic_issues = json_data.get('systemicIssuesRaw', []) 
    
    if item_title: context_parts.append(f"Episode Title: {item_title}")
    if summary: context_parts.append(f"\nExecutive Summary:\n{summary}")
    if key_quotes: context_parts.append("\nKey Quotes:\n" + "\n".join(f"- {q}" for q in key_quotes))
    if systemic_issues: context_parts.append("\nSystemic Issues Mentioned:\n" + "\n".join(f"- {s}" for s in systemic_issues))
         
    explicit_wc_person = json_data.get('featuredIndividual', {}).get('fullName', '')
    explicit_lawyers = json_data.get('featuredIndividual', {}).get('innocenceLawyersRaw', [])
    explicit_orgs = json_data.get('featuredIndividual', {}).get('organizationsInvolvedRaw', [])
    explicit_factors = json_data.get('featuredIndividual', {}).get('contributingFactorsRaw', [])
    explicit_hosts = json_data.get('mediaItem', {}).get('hosts', '')

    context_parts.append("\n--- Known Entities (Avoid listing these unless context adds new info) ---")
    if explicit_wc_person: context_parts.append(f"Featured WC Person: {explicit_wc_person}")
    if explicit_lawyers: context_parts.append(f"Known Lawyers: {', '.join(explicit_lawyers)}")
    if explicit_orgs: context_parts.append(f"Known Orgs: {', '.join(explicit_orgs)}")
    if explicit_factors: context_parts.append(f"Known Factors: {', '.join(explicit_factors)}")
    if explicit_hosts: context_parts.append(f"Host(s): {explicit_hosts}")
    context_parts.append("--------------------------------------------------------------------")
    
    context_text = "\n".join(context_parts)

    json_structure_definition = """
    {
      "llm_extracted_persons": [
        { 
          "name": "Full name of the person mentioned", 
          "role_guess": "Suggested role (e.g., Witness, Police Officer, Victim, Family Member, Actual Perpetrator, Judge, Prosecutor, Activist, Other)", 
          "is_likely_wc_suggestion": true | false | "uncertain" // Is this person presented as another wrongfully convicted individual or exoneree?
        }
      ],
      "llm_extracted_orgs": ["List of organization names mentioned, excluding known orgs if possible"],
      "llm_extracted_factors": ["List of contributing factor names mentioned, excluding known factors if possible"],
      "llm_media_relationships": {
        "part_number": null | number, // If the title/summary indicates 'Part X'
        "is_update_of": null | string, // Describe what it updates (e.g., 'previous episode', 'case of [Name]', 'specific event')
        "related_themes": ["List of specific themes strongly emphasized in this episode"],
        "mentions_other_media": [ 
          { "title": "Title of mentioned media", "type_guess": "podcast | book | film | tv_series | article | website | other" } 
        ]
      }
    }
    """

    prompt = f"""
    Analyze the following text content from a podcast episode summary about wrongful convictions. 
    Identify implicitly mentioned entities and relationships based *only* on the provided text. 
    Avoid hallucinating information not present. 
    Exclude entities explicitly listed in the 'Known Entities' section unless the context provides significant new information about them.

    **Context:**
    {context_text}

    **Task:**
    Extract the following information and provide the output ONLY in the valid JSON format specified below. Do not include any explanatory text before or after the JSON object.

    **Desired JSON Output Structure:**
    ```json
    {json_structure_definition}
    ```
    """
    return prompt

# --- Main Processing Function ---

def process_json_file(filepath, output_dir):
    """Reads a JSON file, calls LLM, adds results, writes enhanced JSON."""
    # Reduced print statement frequency inside this function
    # print(f"\nProcessing JSON file: {os.path.basename(filepath)}") 
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading or parsing JSON file {os.path.basename(filepath)}: {e}")
        return False 

    prompt = create_llm_prompt(data)
    if not prompt:
        print(f"Could not generate prompt for {os.path.basename(filepath)}. Skipping.")
        return False

    llm_response_text = call_gemini_api(prompt) # API call happens here

    if llm_response_text:
        try:
            llm_data = json.loads(llm_response_text)
            data['llm_analysis'] = llm_data 
            # print("Successfully parsed LLM response and added to data.") # Less verbose

        except json.JSONDecodeError as e:
            print(f"{_get_color_code('red')}Error parsing JSON response from LLM for {os.path.basename(filepath)}: {e}{_get_color_code('reset')}")
            print("--- LLM Response Text ---")
            print(llm_response_text) 
            print("-------------------------")
            data['llm_analysis_raw_error'] = llm_response_text
            # Decide if parsing failure is fatal for this file
            # return False 

        except Exception as e:
             print(f"Error processing LLM response for {os.path.basename(filepath)}: {e}")
             data['llm_analysis_processing_error'] = str(e)
             # return False

    else:
        print(f"No valid response received from LLM for {os.path.basename(filepath)}. Skipping enrichment.")
        data['llm_analysis'] = None 
        # Decide if this counts as an error or just a skip
        # return False 

    # Write the enhanced JSON file
    output_filename = os.path.basename(filepath)
    output_filepath = os.path.join(output_dir, output_filename)
    
    try:
        with open(output_filepath, 'w', encoding='utf-8') as f_out:
            json.dump(data, f_out, indent=4, ensure_ascii=False)
        # print(f"Successfully wrote enhanced JSON: {output_filename}") # Less verbose
        return True 
    except Exception as e:
        print(f"Error writing enhanced JSON file {output_filename}: {e}")
        return False 


# Helper for colored output (optional)
def _get_color_code(color_name):
    if color_name == "red": return "\x1b[31m"
    if color_name == "yellow": return "\x1b[33m"
    if color_name == "reset": return "\x1b[0m"
    return ""

# --- Main Execution Block ---

def main(input_dir, output_dir, delay_seconds=4): # Add delay_seconds parameter
    """Main function to process all JSON files in input directory."""
    if not os.path.isdir(input_dir):
        print(f"Error: Input directory '{input_dir}' not found.")
        return
        
    if not os.path.exists(output_dir):
        print(f"Creating output directory: {output_dir}")
        os.makedirs(output_dir)
        
    print(f"Starting Phase 2 LLM Enrichment...")
    print(f"Input JSON directory: '{input_dir}'")
    print(f"Output Enhanced JSON directory: '{output_dir}'")
    print(f"Delay between API calls: {delay_seconds} seconds") # Inform user about the delay
    
    json_files = [f for f in os.listdir(input_dir) if f.lower().endswith(".json")]
    
    if not json_files:
         print("No JSON files found in the input directory.")
         return
         
    success_count = 0
    error_count = 0
    
    print(f"Found {len(json_files)} JSON files to process.")
    # Use tqdm for a progress bar
    for filename in tqdm(json_files, desc="Processing JSON files"):
        filepath = os.path.join(input_dir, filename)
        
        # Process the file (which includes the API call)
        if process_json_file(filepath, output_dir):
            success_count += 1
        else:
            error_count += 1
            
        # *** ADDED DELAY HERE ***
        # Pause after processing each file to respect rate limits
        # This happens regardless of whether the API call succeeded or failed for the file
        if delay_seconds > 0:
             # print(f"Pausing for {delay_seconds} seconds...") # Optional: uncomment for verbose pausing
             time.sleep(delay_seconds) 
            
    print("\n--- Phase 2 Summary ---")
    print(f"Total JSON files processed: {len(json_files)}")
    print(f"Successfully enriched and saved: {success_count}")
    print(f"Files with errors or skipped enrichment: {error_count}")
    print("-----------------------")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enrich podcast JSON summaries using Gemini API.")
    parser.add_argument("input_dir", help="Directory containing the input JSON files (from Phase 1).")
    parser.add_argument("output_dir", help="Directory where the output enhanced JSON files will be saved.")
    # Add optional argument for delay
    parser.add_argument("--delay", type=int, default=4, help="Delay in seconds between processing each file (default: 4)") 
    
    args = parser.parse_args()
    
    # Pass the delay value to main
    main(args.input_dir, args.output_dir, args.delay)

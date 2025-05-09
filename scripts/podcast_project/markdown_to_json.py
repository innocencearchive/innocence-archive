# --- How to Use This Script ---
# This script converts Markdown (.md or .txt) files containing podcast summaries
# into structured JSON files.
#
# Usage (from the command line/terminal):
# python markdown_to_json.py <input_directory> <output_directory>
#
# Arguments:
#   <input_directory>:  The full path to the folder containing your Markdown summary files.
#   <output_directory>: The full path to the folder where the generated JSON files should be saved.
#
# Example for your specific setup (run from the script's directory):
# cd C:\GitHub\innocencearchive\scripts\podcast_project
# python markdown_to_json.py C:\GitHub\innocencearchive\scripts\podcast_project\summary C:\GitHub\innocencearchive\scripts\podcast_project\JSON
# -----------------------------

import os
import re
import json
import argparse
from collections import defaultdict

# --- Configuration ---
# Define keys we expect to find under specific headings
# We use these to know how to structure the JSON
BASIC_INFO_KEYS = [
    "Title", "Episode # & Title (if applicable)", "Host(s)",
    "Release Year(s)", "Production Company(ies)/Network",
    "Series Type", "Format", "Focus/Theme", "Key Statistics/Information",
    "Executive Summary"
]

INDIVIDUAL_INFO_KEYS = [
    "Name", "Case Location", "Conviction Year", "Exoneration Year",
    "Crime Convicted Of", "Sentence", "Time Served", "Contributing Factors",
    "Legal Status", "Organizations Involved", "Innocence Lawyer Details",
    "Cross-Reference", "Narrative of Original Crime", "Key Evidence at Trial (Prosecution)",
    "Trial Defender Notes", "Key Evidence for Exoneration/Change in Legal Status",
    "Actual Perpetrator Details"
]

NOTES_KEYS = [
    "Key Quotes/Moments", "Systemic Issues Identified",
    "Policy Recommendations/Calls to Action", "Personal Narrative/Impact",
    "Additional Resources"
]

# Mapping from Markdown Key to JSON Key (Optional, for cleaner JSON)
# If not mapped, the original key (lowercased, spaces replaced by _) is used
KEY_MAPPING = {
    "Title": "mediaWorkTitle", # Special case for parent work
    "Episode # & Title (if applicable)": "episodeIdAndTitle", # Needs further parsing
    "Host(s)": "hosts",
    "Release Year(s)": "releaseYear",
    "Production Company(ies)/Network": "network",
    "Series Type": "seriesType",
    "Format": "format",
    "Focus/Theme": "focusTheme_Work", # Distinguish from potential episode theme
    "Key Statistics/Information": "keyStats",
    "Executive Summary": "summaryNotes", # Maps to MediaItem.summaryNotes
    "Name": "fullName",
    "Case Location": "caseLocation",
    "Conviction Year": "convictionYear",
    "Exoneration Year": "exonerationYear",
    "Crime Convicted Of": "crimeConvictedOf",
    "Sentence": "sentence",
    "Time Served": "timeServed",
    "Contributing Factors": "contributingFactorsRaw", # Keep raw list text
    "Legal Status": "status",
    "Organizations Involved": "organizationsInvolvedRaw", # Keep raw list text
    "Innocence Lawyer Details": "innocenceLawyersRaw", # Keep raw list text
    "Cross-Reference": "crossReference",
    "Narrative of Original Crime": "narrativeOriginalCrime",
    "Key Evidence at Trial (Prosecution)": "keyEvidenceProsecutionRaw",
    "Trial Defender Notes": "trialDefenderNotes",
    "Key Evidence for Exoneration/Change in Legal Status": "keyEvidenceExonerationRaw",
    "Actual Perpetrator Details": "actualPerpetratorDetails",
    "Key Quotes/Moments": "keyQuotesRaw", # Keep raw list text
    "Systemic Issues Identified": "systemicIssuesRaw",
    "Policy Recommendations/Calls to Action": "policyRecommendationsRaw",
    "Personal Narrative/Impact": "personalNarrativeRaw",
    "Additional Resources": "additionalResourcesRaw"
}

def parse_markdown_list(text_block):
    """Parses a block of text containing markdown list items."""
    items = []
    # Regex to find list items, capturing the text after '- ' or '* '
    # Handles potential indentation and multi-line list items
    # This regex assumes list items start at the beginning of a line optionally preceded by spaces
    pattern = re.compile(r"^\s*[-*+]\s+(.*)", re.MULTILINE)
    matches = pattern.findall(text_block)

    # Simple approach: Treat each found line as a separate item.
    # A more sophisticated approach might try to rejoin multi-line items.
    items = [match.strip() for match in matches]

    # If no list items found, return the whole block as a single item list (e.g., for summary)
    if not items and text_block.strip():
         return [text_block.strip()]

    return items

def parse_key_value_list(text_block):
    """Parses a block of text containing '- **Key**: Value' items."""
    data = {}
    # Regex to find lines like "- **Key**: Value"
    # It captures the Key (group 1) and the Value (group 2)
    # Allows for spaces around the colon
    pattern = re.compile(r"^\s*-\s*\*\*(.*?)\*\*\s*:\s*(.*)", re.MULTILINE)
    current_key = None
    current_value = []

    lines = text_block.strip().split('\n')

    for line in lines:
        match = pattern.match(line)
        if match:
            # If we were accumulating value for a previous key, save it
            if current_key and current_value:
                 json_key = KEY_MAPPING.get(current_key, current_key.lower().replace(' ', '_').replace('/', '_'))
                 data[json_key] = "\n".join(current_value).strip()

            # Start new key-value
            current_key = match.group(1).strip()
            current_value = [match.group(2).strip()]
        elif current_key:
            # This line is a continuation of the previous key's value
            current_value.append(line.strip())

    # Save the last key-value pair
    if current_key and current_value:
        json_key = KEY_MAPPING.get(current_key, current_key.lower().replace(' ', '_').replace('/', '_'))
        data[json_key] = "\n".join(current_value).strip()

    # --- Special Handling for list-like values ---
    # Identify keys that contain lists and parse their values further
    list_keys_raw = [
        "contributingFactorsRaw", "organizationsInvolvedRaw",
        "innocenceLawyersRaw", "keyEvidenceProsecutionRaw",
        "keyEvidenceExonerationRaw", "keyQuotesRaw",
        "systemicIssuesRaw", "policyRecommendationsRaw",
        "personalNarrativeRaw", "additionalResourcesRaw"
    ]
    for key in list_keys_raw:
        if key in data:
            data[key] = parse_markdown_list(data[key])

    return data


def parse_episode_id_title(raw_string):
    """Extracts episode number and title from combined string."""
    match = re.match(r"(\d+)\s+(.*)", raw_string)
    if match:
        return match.group(1), match.group(2).strip()
    return None, raw_string # Return None for number if no match

def process_markdown_file(filepath):
    """Reads and parses a single Markdown file."""
    print(f"Processing file: {filepath}")
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading file {filepath}: {e}")
        return None

    # Use regex to find all H3 headings and the content below them
    sections = re.split(r'\n###\s*(.*?)\s*\n', content)

    # The first element is content before the first H3, often just whitespace or H1/H2
    # Subsequent elements are [heading, content, heading, content, ...]

    parsed_data = {"sourceFileName": os.path.basename(filepath)}

    # Process pairs of heading and content
    # Start from index 1, step by 2
    for i in range(1, len(sections), 2):
        heading = sections[i].strip()
        text_block = sections[i+1].strip()

        # Decide how to parse based on heading
        if "Basic Podcast Information" in heading:
             # These sections use - **Key**: Value format
             basic_info = parse_key_value_list(text_block)
             # Separate MediaWork title
             if 'mediaWorkTitle' in basic_info:
                 parsed_data['mediaWorkTitle'] = basic_info.pop('mediaWorkTitle')
             # Parse episode ID and Title
             if 'episodeIdAndTitle' in basic_info:
                 ep_num, ep_title = parse_episode_id_title(basic_info.pop('episodeIdAndTitle'))
                 basic_info['itemNumber'] = ep_num
                 basic_info['itemTitle'] = ep_title
             # Add remaining basic info under 'mediaItem'
             if 'mediaItem' not in parsed_data: parsed_data['mediaItem'] = {}
             parsed_data['mediaItem'].update(basic_info)
             # Hardcode media type
             parsed_data['mediaItem']['itemMediaType'] = "PODCAST_EPISODE"

        elif "Wrongfully Convicted Individuals Featured" in heading:
            individual_info = parse_key_value_list(text_block)
            parsed_data['featuredIndividual'] = individual_info

        elif "Podcast Research Notes" in heading:
            notes_info = parse_key_value_list(text_block)
            # Merge these directly or under a 'notes' key? Merging for flatter structure.
            parsed_data.update(notes_info)
        else:
            # Skip the initial comments block when checking for unknown sections
            if not heading.startswith("--- How to Use This Script ---"):
                 print(f"Warning: Unknown section heading '{heading}' in file {filepath}")


    return parsed_data


def main(input_dir, output_dir):
    """Main function to process all files in input directory."""
    if not os.path.isdir(input_dir):
        print(f"Error: Input directory '{input_dir}' not found.")
        return

    if not os.path.exists(output_dir):
        print(f"Creating output directory: {output_dir}")
        os.makedirs(output_dir)

    print(f"Starting processing from '{input_dir}' to '{output_dir}'...")

    file_count = 0
    success_count = 0
    error_count = 0

    for filename in os.listdir(input_dir):
        if filename.lower().endswith(".txt") or filename.lower().endswith(".md"):
            file_count += 1
            filepath = os.path.join(input_dir, filename)
            parsed_content = process_markdown_file(filepath)

            if parsed_content:
                # Create output filename
                base_name = os.path.splitext(filename)[0]
                output_filename = f"{base_name}.json"
                output_filepath = os.path.join(output_dir, output_filename)

                try:
                    with open(output_filepath, 'w', encoding='utf-8') as f_out:
                        json.dump(parsed_content, f_out, indent=4, ensure_ascii=False)
                    print(f"Successfully created JSON: {output_filename}")
                    success_count += 1
                except Exception as e:
                    print(f"Error writing JSON file {output_filename}: {e}")
                    error_count += 1
            else:
                error_count += 1

    print("\n--- Processing Summary ---")
    print(f"Total files found: {file_count}")
    print(f"Successfully converted to JSON: {success_count}")
    print(f"Files with errors: {error_count}")
    print("--------------------------")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Parse Markdown podcast summaries into JSON.")
    parser.add_argument("input_dir", help="Directory containing the input Markdown (.txt or .md) files.")
    parser.add_argument("output_dir", help="Directory where the output JSON files will be saved.")

    args = parser.parse_args()

    main(args.input_dir, args.output_dir)
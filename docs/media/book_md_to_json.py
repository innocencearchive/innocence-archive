# --- How to Use This Script ---
# Converts Markdown (.md) files containing book research summaries into structured JSON.
# Adaptively handles variations in heading levels (tries H2 structure first, falls back to H3).
# Handles multiple authors.
#
# Usage (from the command line/terminal):
# python book_md_to_json_v5.py <input_directory> <output_directory>
#
# Arguments:
#   <input_directory>:  The full path to the folder containing your book Markdown files.
#   <output_directory>: The full path to the folder where the generated JSON files should be saved.
#
# Example:
# python book_md_to_json_v5.py "C:\path\to\book_markdown" "C:\path\to\book_json"
# -----------------------------

import os
import re
import json
import argparse
import copy # Used for deep copies if needed

# --- Configuration ---

# Mapping from Markdown Key to JSON Key (Specific to Books)
# Using snake_case for consistency with potential database seeding later
KEY_MAPPING = {
    # MediaWork Fields (from Basic Book Information)
    "Title": "title",
    "Author(s)": "creator_name", # Map Author to creatorName
    "Author": "creator_name", # Handle singular case
    "Publication Year": "publication_or_release_year",
    "Publisher": "publisher_or_network",
    "Format": "format", # Keep format for now, may not map directly to schema enum easily
    "Focus/Theme": "focus_or_theme", # Will be used for both Work and Item initially
    "Key Statistics": "key_statistics", # Store this somewhere, maybe availabilityNotes?
    "Recognition": "recognition_notes", # Capture awards etc.

    # Individual Fields (from Wrongfully Convicted Individuals Featured)
    "Name": "full_name",
    "Case Location": "case_location",
    "Conviction Year": "conviction_year",
    "Exoneration Year": "exoneration_or_release_year",
    "Crime Convicted Of": "crime_convicted_of",
    "Sentence": "sentence",
    "Time Served": "time_served",
    "Contributing Factors": "contributing_factors_raw", # Keep raw list text
    "Legal Status": "status_raw", # Keep raw, needs mapping to enum later
    "Organizations Involved": "organizations_involved_raw", # Keep raw list text
    "Cross-Reference": "cross_reference",
    "Additional Notes": "individual_notes", # Capture extra notes per individual

    # MediaItem Fields (from Book Research Notes / Summary / Systemic Issues etc.)
    "Book Summary": "summary_notes", # From dedicated section
    "Case Details": "case_details_raw", # Added for sections like this
    "Key Quotes": "key_quotes_raw", # Keep raw list text
    "Systemic Issues Identified": "systemic_issues_raw", # Keep raw list text
    "Policy Recommendations": "policy_recommendations_raw", # Keep raw list text
    "Additional Resources": "additional_resources_raw", # Keep raw list text

    # Author Info (Extracted separately)
    # "Author": "author_name", # Used internally for InvolvedPerson (handled by creator_name now)

    # Research Strategy Notes (Separate section)
    "Research Strategy Notes": "research_strategy_notes_raw",
    "Research Notes": "research_notes_raw", # Capture general research notes section
    "Book Research Notes": "research_notes_raw" # Capture variation
}

def parse_name(full_name_str):
    """Basic name parser (first/last/middle)."""
    if not isinstance(full_name_str, str):
        return {"first_name": None, "middle_name": None, "last_name": None}
    # Remove potential prefixes like "1. ", "a) " etc.
    full_name_str = re.sub(r'^\s*\d+\.\s*|^[a-zA-Z]\)\s*', '', full_name_str).strip()
    parts = full_name_str.strip().split()
    first_name = parts[0] if parts else None
    last_name = parts[-1] if len(parts) > 1 else None
    # Simple middle name capture - everything between first and last
    middle_name = " ".join(parts[1:-1]) if len(parts) > 2 else None
    # Handle single names by assigning to first_name
    if len(parts) == 1:
        last_name = None # Or assign to last_name as well? Depends on convention.

    return {
        "first_name": first_name,
        "middle_name": middle_name if middle_name else None,
        "last_name": last_name
    }

def parse_markdown_list(text_block):
    """Parses a block of text containing markdown list items."""
    if not isinstance(text_block, str):
        return []
    items = []
    # Regex to find list items, capturing the text after '- ' or '* ' or digits like '1. '
    # Handles optional indentation
    pattern = re.compile(r"^\s*(?:[-*+]|\d+\.)\s+(.*)", re.MULTILINE)
    matches = pattern.findall(text_block)
    items = [match.strip() for match in matches if match.strip()]

    # If no list items found but text exists, return the whole block as a single item list
    # unless it looks like key-value pairs (basic check)
    if not items and text_block.strip() and not re.search(r"^\s*(?:-\s*)?\*\*(.*?)\*\*\s*:", text_block, re.MULTILINE):
         # print(f"DEBUG: parse_markdown_list returning single item for: {text_block[:50]}...")
         return [text_block.strip()]
    elif not items and text_block.strip(): # It might be key-value, return empty list
        # print(f"DEBUG: parse_markdown_list returning empty list for potential key-value: {text_block[:50]}...")
        return []
    # print(f"DEBUG: parse_markdown_list returning items: {items}")
    return items

def parse_key_value_section(text_block):
    """
    Parses a block of text containing '- **Key**: Value' items,
    handling multi-line values and mapping keys.
    Returns a dictionary.
    """
    if not isinstance(text_block, str):
        return {}
    data = {}
    # Regex to find lines like "- **Key**: Value" or just "**Key**: Value"
    # Makes the leading "- " optional. Handles potential spaces around colon.
    # Allows for keys without bolding if they are followed by ':'
    pattern = re.compile(r"^\s*(?:-\s*)?(?:\*\*(.*?)\*\*|([^:\n]+))\s*:\s*(.*)", re.MULTILINE)
    lines = text_block.strip().split('\n')

    current_key_raw = None
    current_value_lines = []

    def save_current_kv():
        nonlocal current_key_raw, current_value_lines, data
        if current_key_raw and current_value_lines:
            # Clean the key before mapping
            clean_key = current_key_raw.strip()
            # Map the key using KEY_MAPPING, fallback to snake_case
            mapped_key = KEY_MAPPING.get(clean_key,
                                         clean_key.lower().replace(' ', '_').replace('/', '_').replace('(', '').replace(')', ''))
            value_str = "\n".join(current_value_lines).strip()

            # Check if this key *should* be a list based on mapping convention (_raw suffix)
            if mapped_key.endswith("_raw"):
                list_data = parse_markdown_list(value_str)
                # If parsing list returns empty but there was text, store raw text instead
                if not list_data and value_str:
                     # print(f"DEBUG: Storing raw string for _raw key '{mapped_key}' as list parsing failed.")
                     data[mapped_key] = value_str # Fallback for lists that aren't lists
                else:
                     data[mapped_key] = list_data

            else:
                # Attempt to parse numeric fields like years
                if mapped_key in ["publication_or_release_year", "conviction_year", "exoneration_or_release_year"]:
                     # Try to find any 4-digit number, handling ranges or multiple years
                     year_match = re.findall(r'\b(\d{4})\b', value_str)
                     if year_match:
                         # Take the first year found if multiple exist (e.g., in exoneration range)
                         data[mapped_key] = int(year_match[0])
                     else:
                         data[mapped_key] = value_str # Keep original if no 4-digit year found
                else:
                     data[mapped_key] = value_str
            # Reset for next key
            current_key_raw = None
            current_value_lines = []

    for line in lines:
        match = pattern.match(line)
        if match:
            # Found a new key-value line, save the previous one
            save_current_kv()
            # Start the new one
            # Group 1 is **Key**, Group 2 is Key (no bold), Group 3 is Value
            current_key_raw = match.group(1).strip() if match.group(1) else match.group(2).strip()
            # Ensure key is not empty
            if not current_key_raw:
                continue
            current_value_lines = [match.group(3).strip()]
        elif current_key_raw:
            # This is a continuation line for the current key
            # Append if it's not blank
            if line.strip():
                 current_value_lines.append(line.strip())
            # We might need more sophisticated logic for indentation checks if needed
        else:
             # Line before the first key or unrelated line
             pass

    # Save the last key-value pair captured
    save_current_kv()

    return data

# --- Helper function to process a block based on heading ---
def process_section_content(heading, content, parsed_data):
    """Processes content based on a heading title."""
    # print(f"DEBUG: Processing section '{heading}'")
    if "Basic Book Information" in heading:
        basic_info_parsed = parse_key_value_section(content)
        parsed_data['media_work'].update(basic_info_parsed)
        # Return author and theme for later use
        return basic_info_parsed.get('creator_name'), basic_info_parsed.get('focus_or_theme')

    elif "Wrongfully Convicted Individuals Featured" in heading:
        # Split this section_content by H3 or H4 '###' / '####'
        # Prioritize H4 if present, otherwise use H3
        individual_blocks_h4 = re.split(r'(?=\n####\s)', content)
        individual_blocks_h3 = re.split(r'(?=\n###\s)', content)

        # Choose H4 splitting if it resulted in more than one block, otherwise use H3
        use_h4 = len(individual_blocks_h4) > 1
        individual_blocks = individual_blocks_h4 if use_h4 else individual_blocks_h3
        heading_level_pattern = r'####\s*(.*?)\s*\n' if use_h4 else r'###\s*(.*?)\s*\n'
        # print(f"DEBUG: Parsing individuals using {'H4' if use_h4 else 'H3'} structure. Found {len(individual_blocks)} potential blocks.")

        for i, block in enumerate(individual_blocks):
            block = block.strip()
            if not block: continue

            heading_match = re.match(heading_level_pattern, block)
            individual_name_from_heading = None
            individual_content = block

            if heading_match:
                individual_name_from_heading = heading_match.group(1).strip()
                individual_content = block[heading_match.end():].strip()
            elif i == 0 and len(individual_blocks) > 1:
                 continue # Skip content before first heading if multiple blocks exist
            elif i == 0 and len(individual_blocks) == 1 and not heading_match:
                 pass # Process the single block as is
            elif not heading_match:
                 continue # Skip blocks without the expected heading level

            individual_data = parse_key_value_section(individual_content)

            if 'full_name' not in individual_data and individual_name_from_heading:
                cleaned_name = re.sub(r'^\d+\.\s*', '', individual_name_from_heading).strip()
                individual_data['full_name'] = cleaned_name

            if individual_data.get('full_name'):
                individual_data.update(parse_name(individual_data['full_name']))
                parsed_data['featured_individuals'].append(individual_data)
            elif heading_match:
                 print(f"Warning: Could not extract name/data for potential individual block starting with heading: {individual_name_from_heading}")
        return None, None # Return None as this doesn't set author/theme

    elif "Book Summary" in heading:
        parsed_data['media_item']['summary_notes'] = content
    elif "Systemic Issues Identified" in heading:
         mapped_key = KEY_MAPPING.get("Systemic Issues Identified")
         parsed_data['media_item'][mapped_key] = parse_markdown_list(content)
    elif "Policy Recommendations" in heading:
         mapped_key = KEY_MAPPING.get("Policy Recommendations")
         parsed_data['media_item'][mapped_key] = parse_markdown_list(content)
    elif "Key Quotes" in heading:
         mapped_key = KEY_MAPPING.get("Key Quotes")
         parsed_data['media_item'][mapped_key] = parse_markdown_list(content)
    elif "Additional Resources" in heading:
         mapped_key = KEY_MAPPING.get("Additional Resources")
         parsed_data['media_item'][mapped_key] = parse_markdown_list(content)
    elif "Case Details" in heading:
        parsed_data['media_item']['case_details_raw'] = content
    elif "Research Notes" in heading or "Book Research Notes" in heading:
         notes_kv = parse_key_value_section(content)
         if notes_kv:
              for key, value in notes_kv.items():
                   mapped_note_key = KEY_MAPPING.get(key, key)
                   if mapped_note_key in KEY_MAPPING.values():
                        if mapped_note_key.endswith("_raw"):
                             parsed_data['media_item'][mapped_note_key] = parse_markdown_list(value) if isinstance(value, str) else value
                        else:
                             parsed_data['media_item'][mapped_note_key] = value
                   else:
                        if 'research_notes_other' not in parsed_data['media_item']:
                             parsed_data['media_item']['research_notes_other'] = {}
                        parsed_data['media_item']['research_notes_other'][mapped_note_key] = value
         else:
              parsed_data['research_notes_raw'] = content
    elif "Research Strategy Notes" in heading:
        parsed_data['research_strategy_notes_raw'] = content
    elif "About the Author" in heading or "Integration Plan" in heading:
        pass # Ignore these sections
    else:
        # Store content under unhandled sections for review
        unhandled_key = f"unhandled_section_{heading.lower().replace(' ', '_')}"
        parsed_data[unhandled_key] = content
        print(f"Warning: Storing content under unhandled section title: '{heading}' as key '{unhandled_key}'")

    return None, None # Default return if not basic info

def process_markdown_file(filepath):
    """Reads and parses a single book Markdown file using adaptive H2/H3 structure."""
    print(f"Processing file: {filepath}")
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading file {filepath}: {e}")
        return None

    # Initialize data structure
    parsed_data = {
        "source_file_name": os.path.basename(filepath),
        "media_work": { "work_type": "BOOK" },
        "media_item": { "item_media_type": "BOOK_CONTENT" },
        "featured_individuals": [],
        "involved_persons": [], # For author, others if needed
        "research_strategy_notes_raw": None,
        "research_notes_raw": None
    }

    author_name_raw = None
    focus_theme = None
    processed_sections = set() # Keep track of headings processed

    # --- Strategy 1: Try H2 Structure First ---
    h2_sections = re.split(r'(?=\n##\s)', content)
    # print(f"DEBUG: Found {len(h2_sections)} potential H2 sections.")

    # Process content before first H2 (might contain H1 title)
    if h2_sections and not h2_sections[0].strip().startswith('##'):
        h1_match = re.match(r'#\s+(.*)', h2_sections[0].strip())
        if h1_match:
            # print(f"DEBUG: H1 Title Found: {h1_match.group(1).strip()}")
            pass # Title preferably comes from Basic Info

    for section in h2_sections:
        section = section.strip()
        if not section: continue

        h2_match = re.match(r'##\s+(.*?)\s*\n', section)
        if h2_match:
            current_h2_title = h2_match.group(1).strip()
            section_content = section[h2_match.end():].strip()
            # print(f"DEBUG: Processing H2 Section: '{current_h2_title}'")
            auth, theme = process_section_content(current_h2_title, section_content, parsed_data)
            processed_sections.add(current_h2_title) # Mark as processed
            if auth: author_name_raw = auth
            if theme: focus_theme = theme
        # else: print("DEBUG: Skipping content block without H2 heading in H2 loop.")


    # --- Strategy 2: If core data missing, try H3 on full content ---
    # Heuristic: Check if title AND individuals are missing after H2 pass
    core_data_found_h2 = bool(parsed_data['media_work'].get('title') or parsed_data['featured_individuals'])

    if not core_data_found_h2:
        print("Info: Core data not found via H2 structure, attempting H3 structure on full content.")
        h3_sections = re.split(r'(?=\n###\s)', content) # Split *entire* content by H3
        # print(f"DEBUG: Found {len(h3_sections)} potential H3 sections.")

        # Process content before first H3 (might contain H1/H2 title)
        if h3_sections and not h3_sections[0].strip().startswith('###'):
            # Check for H1/H2 title again if not found
            if not parsed_data['media_work'].get('title'):
                 h1_match = re.match(r'#\s+(.*)', h3_sections[0].strip())
                 h2_match = re.match(r'##\s+(.*)', h3_sections[0].strip())
                 if h1_match: parsed_data['media_work']['title'] = h1_match.group(1).strip()
                 elif h2_match: parsed_data['media_work']['title'] = h2_match.group(1).strip()
            # print("DEBUG: Processed content before first H3.")


        for section in h3_sections:
            section = section.strip()
            if not section: continue

            h3_match = re.match(r'###\s+(.*?)\s*\n', section)
            if h3_match:
                current_h3_title = h3_match.group(1).strip()
                section_content = section[h3_match.end():].strip()

                # Skip if this section title was already successfully processed under an H2
                if current_h3_title in processed_sections:
                    # print(f"DEBUG: Skipping H3 section '{current_h3_title}' as it was processed under H2.")
                    continue

                # print(f"DEBUG: Processing H3 Section: '{current_h3_title}'")
                auth, theme = process_section_content(current_h3_title, section_content, parsed_data)
                # We might get author/theme again, overwrite if needed
                if auth: author_name_raw = auth
                if theme: focus_theme = theme
            # else: print("DEBUG: Skipping content block without H3 heading in H3 loop.")


    # --- Post-Processing ---

    # Process Author(s) after potentially finding them
    if author_name_raw:
        authors = re.split(r'\s*,\s*|\s+and\s+', author_name_raw) # Split by comma or 'and'
        for auth in authors:
            auth = auth.strip()
            if auth:
                author_person = {
                    "full_name": auth,
                    "role": "AUTHOR",
                    **parse_name(auth)
                }
                # Avoid adding duplicate authors
                if not any(p.get('full_name') == auth and p.get('role') == 'AUTHOR' for p in parsed_data['involved_persons']):
                     parsed_data['involved_persons'].append(author_person)

    # Ensure mediaItem title is set if not found via Basic Info
    if 'item_title' not in parsed_data['media_item']:
         book_title_final = parsed_data['media_work'].get('title', 'Unknown Title')
         parsed_data['media_item']['item_title'] = f"Book Content: {book_title_final}"

    # Update media item theme if found
    if focus_theme and 'focus_or_theme' not in parsed_data['media_item']:
         parsed_data['media_item']['focus_or_theme'] = focus_theme


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
        # Process only .md files
        if filename.lower().endswith(".md"):
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
                        # Use indent=2 for readability, remove ensure_ascii
                        json.dump(parsed_content, f_out, indent=2, ensure_ascii=False)
                    print(f"Successfully created JSON: {output_filename}")
                    success_count += 1
                except Exception as e:
                    print(f"Error writing JSON file {output_filename}: {e}")
                    error_count += 1
            else:
                print(f"Failed to parse file: {filename}")
                error_count += 1
        elif filename.lower().endswith(".txt"):
             print(f"Skipping .txt file: {filename}. Please convert to .md if needed.")
        # Add other file types to skip if necessary

    print("\n--- Processing Summary ---")
    print(f"Total potential files found: {len(os.listdir(input_dir))}")
    print(f"Markdown files processed: {file_count}")
    print(f"Successfully converted to JSON: {success_count}")
    print(f"Files with errors/Failed parses: {error_count}")
    print("--------------------------")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Parse book research Markdown files into structured JSON.")
    parser.add_argument("input_dir", help="Directory containing the input Markdown (.md) files.")
    parser.add_argument("output_dir", help="Directory where the output JSON files will be saved.")

    args = parser.parse_args()

    main(args.input_dir, args.output_dir)

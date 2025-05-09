# --- How to Use This Script ---
# Converts Markdown (.md) files containing film/documentary research summaries into structured JSON.
# Adaptively handles variations in heading levels (tries H2 structure first, falls back to H3).
# Handles grouped individuals (e.g., "San Antonio Four").
# Extracts episode information where applicable.
# Cleans common placeholders and citations.
#
# Usage (from the command line/terminal):
# python film_md_to_json.py <input_directory> <output_directory>
#
# Arguments:
#   <input_directory>:  The full path to the folder containing your film/doc Markdown files.
#   <output_directory>: The full path to the folder where the generated JSON files should be saved.
#
# Example (Windows):
# python film_md_to_json.py "C:\path\to\film_markdown" "C:\path\to\film_json"
# -----------------------------

import os
import re
import json
import argparse
import copy # Used for deep copies if needed
from pathlib import Path # Use pathlib for easier path handling

# --- Configuration ---

# Mapping from Markdown Key to JSON Key (Specific to Films/Docs)
# Using snake_case for consistency with the Prisma schema
KEY_MAPPING = {
    # MediaWork Fields (from Basic Film/Documentary Information)
    "Title": "title", # Often the Series Title if an episode
    "Episode # & Title (if applicable)": "episode_title_raw", # Store raw, process later
    "Director(s)": "director_name", # Map Director to this temporary key
    "Release Year": "publication_or_release_year",
    "Production Company(ies)": "publisher_or_network", # Using schema field name
    "Format": "format_raw", # Store raw format info
    "Focus/Theme": "focus_or_theme", # Used for both Work and Item initially
    "Key Statistics/Information": "summaryNotes", # Use this for work summary

    # Individual Fields (from Wrongfully Convicted Individuals Featured)
    "Name": "full_name",
    "Case Location": "case_location", # Will be split into city/state later if possible
    "Conviction Year": "conviction_year",
    "Exoneration Year": "exoneration_or_release_year",
    "Crime Convicted Of": "crime_convicted_of_raw", # Store raw crime description
    "Sentence": "sentence",
    "Time Served": "time_served",
    "Contributing Factors": "contributing_factors_raw", # Keep raw list text
    "Legal Status": "status_raw", # Keep raw, needs mapping to enum later
    "Organizations Involved": "organizations_involved_raw", # Keep raw list text
    "Cross-Reference": "cross_reference", # Keep if present
    "Additional Notes": "individual_notes", # Capture extra notes per individual

    # MediaItem Fields (from Film/Documentary Research Notes / Summary / Systemic Issues etc.)
    "Film Summary": "summary_notes", # From dedicated section if present
    "Key Quotes/Moments": "key_quotes_raw", # Keep raw list text
    "Systemic Issues Identified": "systemic_issues_raw", # Keep raw list text
    "Policy Recommendations/Calls to Action": "policy_recommendations_raw", # Keep raw list text
    "Additional Resources": "external_links_raw", # Keep raw list text/links

    # Other potential sections found in samples
    "Notes from `film_list.txt`": "research_notes_other", # Store under other notes
    "Research Findings": "research_notes_other", # Store under other notes
    "Research Strategy Notes": "research_strategy_notes_raw",
    "Film/Documentary Research Notes": "research_notes_raw", # Capture general notes if not subsectioned
}

# Values to treat as null/None during cleaning
NULL_VALUES = ["N/A", "Information Unavailable", ""]

# --- Helper Functions ---

def clean_value(value_str):
    """Removes citations [cite: ...], trims whitespace, and converts known null values."""
    if not isinstance(value_str, str):
        return value_str
    # Remove citations like [cite: ...]
    cleaned = re.sub(r'\s*\[cite:.*?\]', '', value_str).strip()
    # Convert known null values to None
    if cleaned in NULL_VALUES:
        return None
    return cleaned

def parse_name(full_name_str):
    """
    Basic name parser (first/last/middle).
    Cleans the input string first using clean_value().
    """
    cleaned_name = clean_value(full_name_str)
    if not cleaned_name:
        return {"first_name": None, "middle_name": None, "last_name": None}

    # Remove potential list prefixes like "1. ", "a) " etc. after cleaning
    cleaned_name = re.sub(r'^\s*\d+\.\s*|^[a-zA-Z]\)\s*', '', cleaned_name).strip()
    parts = cleaned_name.strip().split()
    first_name = parts[0] if parts else None
    last_name = parts[-1] if len(parts) > 1 else None
    middle_name = " ".join(parts[1:-1]) if len(parts) > 2 else None
    # Handle single names (assign to first_name, last_name becomes None)
    if len(parts) == 1:
        last_name = None

    return {
        "first_name": first_name,
        "middle_name": middle_name if middle_name else None, # Ensure None if empty string
        "last_name": last_name
    }

def parse_markdown_list(text_block):
    """
    Parses a block of text containing markdown list items.
    Handles standard lists (- item), numbered lists (1. item), and Markdown links ([Text](URL)).
    Cleans each item using clean_value().
    Returns a list of strings or dictionaries (for links).
    """
    if not isinstance(text_block, str):
        return []
    items = []
    # Regex for standard list items (-, *, +) or numbered list items (1.)
    list_pattern = re.compile(r"^\s*(?:[-*+]|\d+\.)\s+(.*)", re.MULTILINE)
    # Regex for Markdown links: [Text](URL) or standalone https URLs
    link_pattern = re.compile(r'\[([^\]]+)\]\(([^)]+)\)|(https?://[^\s)]+)') # Avoid capturing final ')' in URL

    potential_list_items = list_pattern.findall(text_block)

    if potential_list_items:
        # Process lines identified as list items
        for item_text in potential_list_items:
            item_text = item_text.strip()
            # Check for links within the item text
            link_match = link_pattern.search(item_text)
            if link_match:
                # Case 1: [Text](URL) format
                if link_match.group(1) and link_match.group(2):
                     link_desc = clean_value(link_match.group(1))
                     link_url = clean_value(link_match.group(2))
                     if link_url: # Only add if URL is valid after cleaning
                         items.append({
                             "description": link_desc if link_desc else link_url, # Use URL as desc if text is missing/null
                             "url": link_url
                         })
                # Case 2: Standalone URL format
                elif link_match.group(3):
                     url_only = clean_value(link_match.group(3))
                     if url_only: # Only add if URL is valid after cleaning
                         items.append({"url": url_only, "description": url_only}) # Use URL as description
                # Fallback: If link parsing is weird, store the cleaned text
                else:
                    cleaned_item = clean_value(item_text)
                    if cleaned_item: items.append(cleaned_item)
            else:
                # No link found, just add the cleaned text
                cleaned_item = clean_value(item_text)
                if cleaned_item: items.append(cleaned_item)
    else:
        # If no list markers (-) found, check the entire block for links or treat as single item
        cleaned_block = clean_value(text_block)
        if cleaned_block:
            # Avoid treating key-value pairs as a single list item
            kv_pattern = re.compile(r"^\s*(?:-\s*)?(?:\*\*(.*?)\*\*|([^:\n]+))\s*:\s*(.*)", re.MULTILINE)
            if kv_pattern.search(cleaned_block):
                return [] # It looks like key-value data, return empty list

            # Try finding links directly within the cleaned block
            direct_links = link_pattern.findall(cleaned_block)
            if direct_links:
                 for desc, url1, url2 in direct_links:
                     if desc and url1:
                         link_desc = clean_value(desc)
                         link_url = clean_value(url1)
                         if link_url: items.append({"description": link_desc if link_desc else link_url, "url": link_url})
                     elif url2:
                         url_only = clean_value(url2)
                         if url_only: items.append({"url": url_only, "description": url_only})
                 if items: return items # Return list of found links

            # Fallback: If no list markers and no links found, return the whole block as a single-item list
            # Only if it's not just whitespace.
            if cleaned_block and not cleaned_block.isspace():
                return [cleaned_block]

    return items


def parse_key_value_section(text_block):
    """
    Parses a block of text containing key-value pairs (e.g., '- **Key**: Value').
    Handles multi-line values, cleans values using clean_value(), and maps keys using KEY_MAPPING.
    Attempts to parse numeric years and split case locations.
    Returns a dictionary.
    """
    if not isinstance(text_block, str):
        return {}
    data = {}
    # Regex to find lines like "- **Key**: Value" or "**Key**: Value" or "Key: Value"
    # Allows optional leading dash, optional bolding around key.
    pattern = re.compile(r"^\s*(?:-\s*)?(?:\*\*(.*?)\*\*|([^:\n]+?))\s*:\s*(.*)", re.MULTILINE)
    lines = text_block.strip().split('\n')

    current_key_raw = None
    current_value_lines = []

    def save_current_kv():
        """Helper to process and save the currently accumulated key-value pair."""
        nonlocal current_key_raw, current_value_lines, data
        if current_key_raw and current_value_lines:
            clean_key = current_key_raw.strip()
            # Map the key using KEY_MAPPING, fallback to snake_case if not found
            mapped_key = KEY_MAPPING.get(clean_key,
                                         clean_key.lower().replace(' ', '_').replace('/', '_').replace('(', '').replace(')', '').replace('#','').replace('&','and'))

            value_str = "\n".join(current_value_lines).strip()
            # Clean the final accumulated value string *after* joining lines
            cleaned_val = clean_value(value_str)

            # Check if this key *should* be treated as a list based on mapping convention
            # (ends with "_raw" but isn't one of the specific single-value raw fields)
            is_list_key = mapped_key.endswith("_raw") and mapped_key not in [
                "episode_title_raw", "format_raw", "crime_convicted_of_raw",
                "status_raw", "research_strategy_notes_raw", "research_notes_raw"
            ]

            if is_list_key:
                 if cleaned_val: # Only parse list if there's non-null content
                    # Pass the original (uncleaned) value string to list parser
                    # to preserve link markdown etc.
                    list_data = parse_markdown_list(value_str)
                    data[mapped_key] = list_data if list_data else [] # Store empty list if parsing fails
                 else:
                     data[mapped_key] = [] # Store empty list if value was null
            else:
                # Handle specific single-value fields
                # Attempt to parse numeric fields like years
                if mapped_key in ["publication_or_release_year", "conviction_year", "exoneration_or_release_year"]:
                     if cleaned_val:
                         # Try to find any 4-digit number
                         year_match = re.findall(r'\b(\d{4})\b', cleaned_val)
                         if year_match:
                             data[mapped_key] = int(year_match[0]) # Take the first year found
                         else:
                             data[mapped_key] = cleaned_val # Keep original cleaned string if no 4-digit year found
                     else:
                         data[mapped_key] = None # Set to None if cleaned value was None
                # Handle case location splitting (simple comma split)
                elif mapped_key == "case_location" and cleaned_val:
                    parts = cleaned_val.split(',', 1) # Split only on the first comma
                    data["case_location_city"] = parts[0].strip() if parts else cleaned_val
                    data["case_location_state"] = parts[1].strip() if len(parts) > 1 else None
                    # Do not store the original 'case_location' key
                # Store other cleaned single values
                else:
                    data[mapped_key] = cleaned_val # Assign the cleaned value (could be None)
            # Reset for next key-value pair
            current_key_raw = None
            current_value_lines = []

    # Iterate through lines of the text block
    for line in lines:
        match = pattern.match(line)
        if match:
            # Found a new key-value line, save the previous one (if any)
            save_current_kv()
            # Start the new one
            # Group 1 is **Key**, Group 2 is Key (no bold), Group 3 is Value
            current_key_raw = match.group(1).strip() if match.group(1) else match.group(2).strip()
            # Ensure key is not empty
            if not current_key_raw:
                continue
            current_value_lines = [match.group(3).strip()] # Start value with the first line
        elif current_key_raw:
            # This is a continuation line for the current key
            # Append if it's not blank (preserve multi-line values)
            if line.strip():
                 current_value_lines.append(line.strip())
            # Could add indentation checks here if needed for more complex structures
        else:
             # Line before the first key or an unrelated line, ignore for key-value parsing
             pass

    # Save the last key-value pair captured after the loop finishes
    save_current_kv()

    return data

def process_section_content(heading, content, parsed_data):
    """
    Processes content based on a main section heading (e.g., ## Basic Information).
    Delegates parsing to helper functions based on the heading.
    Returns extracted director name and theme for potential later use.
    """
    extracted_director = None
    extracted_theme = None
    heading = heading.strip() # Ensure heading is clean

    # --- Section: Basic Film/Documentary Information ---
    if "Basic Film/Documentary Information" in heading:
        basic_info_parsed = parse_key_value_section(content)

        # Handle potential episode title stored in 'episode_title_raw'
        episode_title = basic_info_parsed.get("episode_title_raw")
        if episode_title:
            parsed_data['media_item']['item_title'] = episode_title # Store cleaned title
            # Attempt to extract item number (e.g., "2.1. Title", "S2 E5: Title")
            num_match = re.match(r'(\d+\.\d+)', episode_title) # Match "2.1." style
            se_match = re.match(r'S(\d+)\s*E(\d+)', episode_title, re.IGNORECASE) # Match "S01 E05" style
            if num_match:
                parsed_data['media_item']['item_number'] = num_match.group(1)
            elif se_match:
                parsed_data['media_item']['item_number'] = f"S{se_match.group(1)} E{se_match.group(2)}"
            # Remove the raw key now that it's processed
            basic_info_parsed.pop("episode_title_raw", None)

        # Determine work type based on 'format_raw' if available
        format_raw = basic_info_parsed.get("format_raw")
        if format_raw:
            format_lower = format_raw.lower()
            if "series episode" in format_lower or "tv_episode" in format_lower or "tv episode" in format_lower:
                 parsed_data['media_work']['work_type'] = 'TV_SERIES' # Assume TV Series for episodes
                 parsed_data['media_item']['item_media_type'] = 'TV_EPISODE'
            elif "docuseries" in format_lower:
                 parsed_data['media_work']['work_type'] = 'DOCUSERIES'
                 parsed_data['media_item']['item_media_type'] = 'TV_EPISODE' # Docuseries items are TV_EPISODE
            elif "documentary" in format_lower:
                 parsed_data['media_work']['work_type'] = 'DOCUMENTARY'
                 parsed_data['media_item']['item_media_type'] = 'DOCUMENTARY_CONTENT'
            elif "film" in format_lower:
                 parsed_data['media_work']['work_type'] = 'FILM'
                 parsed_data['media_item']['item_media_type'] = 'FILM_CONTENT'
            # Clean up raw format key
            basic_info_parsed.pop("format_raw", None)

        # Store director name temporarily for later processing into involved_persons
        if basic_info_parsed.get("director_name"):
             extracted_director = basic_info_parsed["director_name"]
             # Keep the key in basic_info_parsed for now, update media_work directly

        # Update media work with the rest of the parsed info (overwrites existing keys)
        parsed_data['media_work'].update(basic_info_parsed)
        # Extract theme for potential use in media_item
        extracted_theme = basic_info_parsed.get('focus_or_theme')

    # --- Section: Wrongfully Convicted Individuals Featured ---
    elif "Wrongfully Convicted Individuals Featured" in heading:
        # Strategy:
        # 1. Check for a group name pattern first (e.g., "**San Antonio Four**: Name1, Name2...")
        # 2. If no group name, try splitting by H3/H4 headings.
        # 3. If no H3/H4, try splitting by the "- **Name**:" pattern.
        # 4. Process each resulting block as an individual's key-value data.

        group_name_from_heading = None
        individual_names = []
        individual_content_block = content # Default to full content for parsing details
        processed_group_header = False

        # 1. Check for Group Pattern (e.g., "- **Group Name**: Person 1, Person 2")
        first_line = content.split('\n')[0].strip()
        group_match = re.match(r'^\s*(?:-\s*)?\*\*(.*?)\*\*:\s*(.*)', first_line)
        if group_match and len(group_match.group(2).split(',')) > 1 : # If key looks like a group name and value has multiple names
            group_name_from_heading = clean_value(group_match.group(1))
            names_str = group_match.group(2)
            # Split names by comma or 'and', clean each name
            individual_names = [name for name in [clean_value(n) for n in re.split(r'\s*,\s*|\s+and\s+', names_str)] if name]
            # The rest of the content block contains the shared details
            individual_content_block = "\n".join(content.split('\n')[1:]).strip()
            processed_group_header = True
            # print(f"DEBUG: Found grouped individuals: {group_name_from_heading} - {individual_names}")

        if individual_names:
            # Parse the shared details block once
            shared_data = parse_key_value_section(individual_content_block)
            if not shared_data and individual_content_block:
                 print(f"  Warning: Could not parse shared details for group: {group_name_from_heading}")
            # Create an entry for each individual, merging names and shared data
            for name in individual_names:
                 individual_data = copy.deepcopy(shared_data) # Start with shared data
                 individual_data['full_name'] = name # Overwrite/add full name
                 individual_data.update(parse_name(name)) # Add parsed name parts
                 parsed_data['featured_individuals'].append(individual_data)
                 # Optionally store group name if needed: individual_data['group_name'] = group_name_from_heading
        else:
            # No group detected, parse individuals separately
            # 2. Try splitting by H3/H4 headings
            sub_heading_pattern = r'\n(?:###|####)\s'
            blocks = re.split(f'(?={sub_heading_pattern})', content)

            # 3. If no H3/H4, try splitting by "- **Name**:" pattern
            if len(blocks) <= 1:
                 name_pattern = r'\n\s*-\s*\*\*(?:Name)\*\*:'
                 blocks = re.split(f'(?={name_pattern})', content)

            # print(f"DEBUG: Parsing individuals individually. Found {len(blocks)} potential blocks.")
            for i, block in enumerate(blocks):
                 block = block.strip()
                 if not block: continue

                 # Ignore content before the first marker if multiple blocks exist
                 # Heuristic: Check if block starts with list marker/heading or just text
                 is_header_or_list = re.match(r'^\s*(?:###|####|-)', block)
                 if i == 0 and len(blocks) > 1 and not is_header_or_list:
                      # print(f"DEBUG: Skipping potential preamble: {block[:50]}...")
                      continue # Skip preamble before first real entry

                 # Check if block starts with H3/H4 name heading
                 h_match = re.match(r'^(?:###|####)\s*(.*?)\s*\n', block)
                 name_from_heading = None
                 content_after_heading = block

                 if h_match:
                      name_from_heading = clean_value(h_match.group(1))
                      content_after_heading = block[h_match.end():].strip()

                 # Parse the block (or content after heading) as key-value
                 individual_data = parse_key_value_section(content_after_heading)

                 # Use heading name if "**Name**:" key wasn't found in the block
                 if name_from_heading and not individual_data.get('full_name'):
                      individual_data['full_name'] = name_from_heading

                 # Add parsed name parts if full_name exists
                 if individual_data.get('full_name'):
                      individual_data.update(parse_name(individual_data['full_name'])) # Add name parts
                      parsed_data['featured_individuals'].append(individual_data)
                 elif block.strip() and block.strip() != '-': # Avoid adding empty blocks or stray markers
                      # Check if it looks like just an unparsed name (no key-value structure)
                      if not individual_data and len(block.split()) < 5: # Arbitrary short length check
                          potential_name = clean_value(block)
                          if potential_name:
                              print(f"  Warning: Found potential unparsed name '{potential_name}'. Adding basic entry.")
                              ind_entry = {"full_name": potential_name}
                              ind_entry.update(parse_name(potential_name))
                              parsed_data['featured_individuals'].append(ind_entry)
                          else:
                              print(f"  Warning: Could not extract name/data for potential individual block:\n---\n{block[:100]}...\n---")
                      elif individual_data: # Parsed some data but missing name
                           print(f"  Warning: Parsed individual data but missing full_name for block:\n---\n{block[:100]}...\n---")
                           # Optionally add with placeholder name? parsed_data['featured_individuals'].append(individual_data)


    # --- Section: Film/Documentary Research Notes (or similar) ---
    elif "Research Notes" in heading: # Catches variations like "Film/Documentary Research Notes"
         # Strategy:
         # 1. Look for known sub-headings (Key Quotes, Systemic Issues, etc.) within the content.
         # 2. Parse the content under each sub-heading using the appropriate method (list, text).
         # 3. Store any remaining content (not under a known sub-heading) in 'research_notes_raw'.

         remaining_content = content # Start with the full content of the section
         processed_keys = set()

         # Iterate through KEY_MAPPING to find potential sub-sections within this block
         for md_key, json_key in KEY_MAPPING.items():
             # Skip keys that wouldn't typically be sub-sections here
             if json_key not in ['key_quotes_raw', 'systemic_issues_raw', 'policy_recommendations_raw', 'external_links_raw', 'summary_notes', 'research_notes_other']:
                 continue

             # Pattern to find the start of a sub-section (e.g., "- **Key Quotes/Moments**: ...")
             # Allows for optional '-', requires bolded key, handles multiline content until next potential marker or end of string
             # Using non-greedy match .*?
             sub_pattern = re.compile(rf"^\s*(?:-\s*)?\*\*{re.escape(md_key)}\*\*:\s*([\s\S]*?)(?=(\n\s*(?:-\s*)?\*\*|$))", re.MULTILINE)
             match = sub_pattern.search(remaining_content)

             if match:
                 sub_content = match.group(1).strip()
                 # print(f"DEBUG: Found sub-section '{md_key}' mapped to '{json_key}'")

                 # Process based on the expected type (list, links, text)
                 if json_key in ['key_quotes_raw', 'systemic_issues_raw', 'policy_recommendations_raw']:
                     list_data = parse_markdown_list(sub_content)
                     parsed_data['media_item'][json_key] = list_data if list_data else []
                 elif json_key == 'external_links_raw':
                     link_list_raw = parse_markdown_list(sub_content)
                     link_list_formatted = []
                     for item in link_list_raw:
                          if isinstance(item, dict) and 'url' in item and item['url']: # Ensure dict and has URL
                              link_list_formatted.append(item)
                          elif isinstance(item, str) and item.startswith('http'): # Handle URL string
                               link_list_formatted.append({'url': item, 'description': item})
                          elif isinstance(item, str): # Handle plain text description if URL failed
                               link_list_formatted.append({'url': None, 'description': item})
                     parsed_data['media_item'][json_key] = link_list_formatted
                 elif json_key == 'summary_notes': # e.g., if "Film Summary" is a sub-section
                     cleaned_sub_content = clean_value(sub_content)
                     parsed_data['media_item'][json_key] = cleaned_sub_content
                 elif json_key == "research_notes_other":
                     # Store miscellaneous findings under their original MD key for context
                     cleaned_sub_content = clean_value(sub_content)
                     if cleaned_sub_content:
                         if 'research_notes_other' not in parsed_data['media_item']:
                             parsed_data['media_item']['research_notes_other'] = {}
                         # Use original MD key, cleaned for JSON key format
                         other_key = md_key.lower().replace(' ', '_').replace('`', '').replace('/', '_')
                         parsed_data['media_item']['research_notes_other'][other_key] = cleaned_sub_content

                 # Remove the processed part from remaining_content to avoid double parsing
                 # Be careful with replacing, ensure unique match or use indices
                 start, end = match.span()
                 # A simple way is to replace the found block with empty string, but might fail if block appears multiple times
                 # A safer way is to rebuild remaining_content, but complex. Let's try replace for now.
                 remaining_content = remaining_content.replace(match.group(0), '', 1)
                 processed_keys.add(md_key) # Mark this key as handled

         # Store any final remaining content in research_notes_raw
         final_remaining = remaining_content.strip()
         cleaned_remaining = clean_value(final_remaining)
         if cleaned_remaining:
             # Check if it looks like key-value pairs we missed
             remaining_kv = parse_key_value_section(final_remaining)
             if remaining_kv and len(remaining_kv) > 0:
                 print(f"  Warning: Found potential key-value pairs in remaining research notes for section '{heading}'. Storing under 'research_notes_other'.")
                 if 'research_notes_other' not in parsed_data['media_item']:
                     parsed_data['media_item']['research_notes_other'] = {}
                 # Merge remaining KVs into existing 'other' notes, prefixing to avoid clashes
                 for k, v in remaining_kv.items():
                     parsed_data['media_item']['research_notes_other'][f"unparsed_{k}"] = v
             elif cleaned_remaining and not cleaned_remaining.isspace():
                 # Only store if it's not just whitespace or list markers
                 if parsed_data.get('research_notes_raw'):
                     parsed_data['research_notes_raw'] += "\n" + cleaned_remaining
                 else:
                     parsed_data['research_notes_raw'] = cleaned_remaining

    # --- Handle other top-level sections directly mapped in KEY_MAPPING ---
    elif heading in KEY_MAPPING:
        json_key = KEY_MAPPING[heading]
        cleaned_content = clean_value(content)
        # Check if it should be a list based on the mapping convention
        is_list_key = json_key.endswith("_raw") and json_key not in [
             "episode_title_raw", "format_raw", "crime_convicted_of_raw",
             "status_raw", "research_strategy_notes_raw", "research_notes_raw"
        ]
        if is_list_key:
            parsed_data[json_key] = parse_markdown_list(content) if cleaned_content else []
        else:
            parsed_data[json_key] = cleaned_content

    # --- Section: Unhandled ---
    else:
        # Store content under unhandled sections for review/refinement
        unhandled_key = f"unhandled_section_{heading.lower().replace(' ', '_').replace('/', '_')}"
        cleaned_content = clean_value(content)
        if cleaned_content:
             parsed_data[unhandled_key] = cleaned_content
             print(f"  Warning: Storing content under unhandled section title: '{heading}' as key '{unhandled_key}'")

    return extracted_director, extracted_theme # Return director/theme found in this section

# --- Main Processing Function ---

def process_markdown_file(filepath):
    """
    Reads and parses a single film/doc Markdown file.
    Uses an adaptive strategy: tries parsing based on H2 sections first,
    then falls back to parsing based on H3 sections if key data seems missing.
    """
    print(f"Processing file: {filepath.name}")
    try:
        content = filepath.read_text(encoding='utf-8')
    except Exception as e:
        print(f"  Error reading file {filepath.name}: {e}")
        return None

    # Initialize data structure based on golden example structure
    parsed_data = {
        "source_file_name": filepath.name,
        "media_work": {
            "work_type": "UNKNOWN", # Default, try to determine from Format
            "title": None,
            # "creator_name": None, # Director added to involved_persons
            "publication_or_release_year": None,
            "publisher_or_network": None,
            "focus_or_theme": None,
            "summaryNotes": None, # From Key Stats/Info
            "availabilityNotes": None,
            "sourceUrl": None
        },
        "media_item": {
            "item_media_type": "UNKNOWN", # Default
            "item_title": None, # Episode or Film title
            "item_number": None, # Episode number if found
            "release_date": None, # Schema field, usually not in MD
            "hostOrNarrator": None, # Schema field, usually not in MD
            "focus_or_theme": None,
            "summary_notes": None, # Specific summary section
            "key_quotes_raw": [],
            "systemic_issues_raw": [],
            "policy_recommendations_raw": [],
            "external_links_raw": [], # List of {"url": "...", "description": "..."}
            "sourceUrl": None, # Specific URL for the item/episode
            "research_notes_other": {} # For misc key-value pairs under notes
        },
        "featured_individuals": [],
        "involved_persons": [], # For Director, others mentioned
        "research_strategy_notes_raw": None,
        "research_notes_raw": None # For general text under Research Notes heading
    }

    director_name_raw = None # Store director name found during processing
    focus_theme = None # Store theme found during processing
    processed_headings = set() # Track headings processed in H2 pass to avoid duplication

    # --- Strategy 1: Try H2 Structure First ---
    # Split content by lines starting with '## ' (keeping the delimiter)
    h2_sections = re.split(r'(?=\n##\s)', content)
    # print(f"DEBUG: Found {len(h2_sections)} potential H2 sections.")

    # Process content before the first H2 (might contain H1 title)
    if h2_sections and not h2_sections[0].strip().startswith('##'):
         first_block = h2_sections[0].strip()
         h1_match = re.match(r'#\s+(.*)', first_block)
         if h1_match and not parsed_data['media_work'].get('title'):
              # Tentatively set work title from H1 if not found later in Basic Info
              h1_title = clean_value(h1_match.group(1).strip())
              if h1_title:
                  parsed_data['media_work']['title'] = h1_title
                  # print(f"DEBUG: Tentative H1 Title: {h1_title}")

    # Process each H2 section
    for section in h2_sections:
        section = section.strip()
        if not section: continue

        h2_match = re.match(r'##\s+(.*?)\s*\n', section) # Match '## Heading'
        if h2_match:
            current_h2_title = h2_match.group(1).strip()
            section_content = section[h2_match.end():].strip()
            # print(f"DEBUG: Processing H2 Section: '{current_h2_title}'")
            # Process the content of this section
            director, theme = process_section_content(current_h2_title, section_content, parsed_data)
            processed_headings.add(current_h2_title) # Mark heading as processed
            # Store director/theme if found in this section
            if director: director_name_raw = director
            if theme: focus_theme = theme
        elif section.strip(): # Content block without H2 heading (e.g., after H1 before first H2)
             # Could potentially parse this as 'unhandled' or based on keywords if needed
             # print(f"DEBUG: Skipping content block without H2 heading in H2 loop: {section[:50]}...")
             pass


    # --- Strategy 2: If core data seems missing, try H3 structure on full content ---
    # Heuristic: Check if work title AND (individuals OR item summary) are missing after H2 pass
    core_data_found_h2 = bool(parsed_data['media_work'].get('title') and (parsed_data.get('featured_individuals') or parsed_data['media_item'].get('summary_notes')))

    if not core_data_found_h2:
        print(f"  Info: Core data potentially missing after H2 pass, attempting H3 structure on full content.")
        # Split *entire* original content by lines starting with '### '
        h3_sections = re.split(r'(?=\n###\s)', content)
        # print(f"DEBUG: Found {len(h3_sections)} potential H3 sections.")

        # Process content before first H3 (might contain H1/H2 title if not found yet)
        if h3_sections and not h3_sections[0].strip().startswith('###'):
            first_block_h3 = h3_sections[0].strip()
            if not parsed_data['media_work'].get('title'): # Only if title still missing
                 h1_match = re.match(r'#\s+(.*)', first_block_h3)
                 h2_match = re.match(r'##\s+(.*)', first_block_h3)
                 title_from_h = None
                 if h1_match: title_from_h = clean_value(h1_match.group(1).strip())
                 elif h2_match: title_from_h = clean_value(h2_match.group(1).strip())
                 if title_from_h: parsed_data['media_work']['title'] = title_from_h


        # Process each H3 section
        for section in h3_sections:
            section = section.strip()
            if not section: continue

            h3_match = re.match(r'###\s+(.*?)\s*\n', section) # Match '### Heading'
            if h3_match:
                current_h3_title = h3_match.group(1).strip()

                # Skip if this section title was already successfully processed under an H2
                if current_h3_title in processed_headings:
                    # print(f"DEBUG: Skipping H3 section '{current_h3_title}' as it was processed under H2.")
                    continue

                section_content = section[h3_match.end():].strip()
                # print(f"DEBUG: Processing H3 Section: '{current_h3_title}'")
                # Process the content of this section
                director, theme = process_section_content(current_h3_title, section_content, parsed_data)
                # Overwrite director/theme if found again in H3 pass
                if director: director_name_raw = director
                if theme: focus_theme = theme
            elif section.strip(): # Content block without H3 heading
                 # print(f"DEBUG: Skipping content block without H3 heading in H3 loop: {section[:50]}...")
                 pass


    # --- Post-Processing and Cleanup ---

    # Process Director(s) into involved_persons list
    if director_name_raw:
         # Handle multiple directors separated by comma or 'and'
         directors = re.split(r'\s*,\s*|\s+and\s+', director_name_raw)
         for d_name in directors:
             cleaned_d_name = clean_value(d_name) # Clean the name
             if cleaned_d_name:
                person = {
                    "full_name": cleaned_d_name,
                    "role": "DIRECTOR", # Assign role from enum
                    **parse_name(cleaned_d_name) # Get name parts
                }
                # Avoid adding duplicate directors
                if not any(p.get('full_name') == cleaned_d_name and p.get('role') == 'DIRECTOR' for p in parsed_data['involved_persons']):
                     parsed_data['involved_persons'].append(person)
         # Remove temporary director key from media_work if it exists (it shouldn't if update() was used)
         parsed_data['media_work'].pop('director_name', None)


    # Finalize MediaWork and MediaItem titles based on what was found
    work_title = parsed_data['media_work'].get('title')
    item_title = parsed_data['media_item'].get('item_title')

    if work_title and not item_title:
         # Case: Standalone film/doc - Use work_title for item_title
         parsed_data['media_item']['item_title'] = work_title
         # Set default types if still unknown
         if parsed_data['media_work']['work_type'] == 'UNKNOWN':
             parsed_data['media_work']['work_type'] = 'FILM' # Default assumption for standalone
         if parsed_data['media_item']['item_media_type'] == 'UNKNOWN':
             # Match item type to work type for standalone content
             if parsed_data['media_work']['work_type'] == 'FILM':
                 parsed_data['media_item']['item_media_type'] = 'FILM_CONTENT'
             elif parsed_data['media_work']['work_type'] == 'DOCUMENTARY':
                 parsed_data['media_item']['item_media_type'] = 'DOCUMENTARY_CONTENT'
             else: # Fallback if work type is still unknown or other
                 parsed_data['media_item']['item_media_type'] = 'OTHER'

    elif not work_title and item_title:
         # Case: Episode title found, but series title missing (less common)
         # Let LLM refiner attempt to find the series title.
         # Set work_type to UNKNOWN if still unknown.
         if parsed_data['media_work']['work_type'] == 'UNKNOWN':
             parsed_data['media_work']['work_type'] = 'UNKNOWN' # Or maybe TV_SERIES as a guess?
         # Ensure item type is set if known episode title exists
         if parsed_data['media_item']['item_media_type'] == 'UNKNOWN':
              parsed_data['media_item']['item_media_type'] = 'TV_EPISODE' # Best guess

    elif work_title and item_title and work_title == item_title:
        # Case: Work and Item titles are the same (likely standalone film/doc processed correctly)
        # Ensure types are consistent if unknown
        if parsed_data['media_work']['work_type'] == 'UNKNOWN':
             parsed_data['media_work']['work_type'] = 'FILM'
        if parsed_data['media_item']['item_media_type'] == 'UNKNOWN':
             if parsed_data['media_work']['work_type'] == 'FILM':
                 parsed_data['media_item']['item_media_type'] = 'FILM_CONTENT'
             elif parsed_data['media_work']['work_type'] == 'DOCUMENTARY':
                 parsed_data['media_item']['item_media_type'] = 'DOCUMENTARY_CONTENT'
             else:
                 parsed_data['media_item']['item_media_type'] = 'OTHER'


    # Ensure focus/theme is consistent across work and item if only found once
    if focus_theme:
         if not parsed_data['media_work'].get('focus_or_theme'):
             parsed_data['media_work']['focus_or_theme'] = focus_theme
         if not parsed_data['media_item'].get('focus_or_theme'):
             parsed_data['media_item']['focus_or_theme'] = focus_theme


    # Clean up empty 'research_notes_other' dictionary if nothing was added
    if not parsed_data['media_item'].get('research_notes_other'):
         parsed_data['media_item'].pop('research_notes_other', None)

    # Clean up null values at the top level? (Optional, depends on preference for final JSON)
    # parsed_data = {k: v for k, v in parsed_data.items() if v is not None or (isinstance(v, (dict, list)) and v)}


    return parsed_data


def main(input_dir, output_dir):
    """Main function to find .md files, process them, and save as .json."""
    input_path = Path(input_dir)
    output_path = Path(output_dir)

    if not input_path.is_dir():
        print(f"Error: Input directory '{input_dir}' not found.")
        return

    if not output_path.exists():
        print(f"Creating output directory: {output_path}")
        output_path.mkdir(parents=True, exist_ok=True)

    print(f"Starting processing from '{input_path}' to '{output_path}'...")

    file_count = 0
    success_count = 0
    error_count = 0

    # Iterate through all .md files in the input directory
    for filepath in input_path.glob("*.md"):
        file_count += 1
        parsed_content = process_markdown_file(filepath) # Process the file

        if parsed_content:
            # Create output filename (e.g., input.md -> input.json)
            output_filename = f"{filepath.stem}.json"
            output_filepath = output_path / output_filename

            try:
                # Write the parsed data to the JSON file
                with open(output_filepath, 'w', encoding='utf-8') as f_out:
                    json.dump(parsed_content, f_out, indent=2, ensure_ascii=False)
                print(f"  Successfully created JSON: {output_filename}")
                success_count += 1
            except Exception as e:
                print(f"  Error writing JSON file {output_filename}: {e}")
                error_count += 1
        else:
            # Parsing function returned None (likely due to read error)
            print(f"  Failed to parse file: {filepath.name}")
            error_count += 1

    print("\n--- Processing Summary ---")
    print(f"Total potential files found: {len(list(input_path.glob('*')))}") # Count all files initially
    print(f"Markdown files processed: {file_count}")
    print(f"Successfully converted to JSON: {success_count}")
    print(f"Files with errors/Failed parses: {error_count}")
    print("--------------------------")

# --- Script Entry Point ---
if __name__ == "__main__":
    # Set up argument parser for command-line execution
    parser = argparse.ArgumentParser(description="Parse film/documentary research Markdown files into structured JSON.")
    parser.add_argument("input_dir", help="Directory containing the input Markdown (.md) files.")
    parser.add_argument("output_dir", help="Directory where the output JSON files will be saved.")

    # Parse arguments provided by the user
    args = parser.parse_args()

    # Run the main processing function
    main(args.input_dir, args.output_dir)

import csv
import json

def find_unmatched_names(log_file_path):
    """
    Parses the seed log CSV to find names for which no individual was found in the database.

    Args:
        log_file_path (str): The path to the seed log CSV file.

    Returns:
        list: A list of names (strings) that were not matched.
              Returns an empty list if the file cannot be read or no unmatched names are found.
    """
    unmatched_names = []
    processed_identifiers = set() # To avoid listing duplicates if the same name/link combo appears multiple times in the log

    try:
        with open(log_file_path, mode='r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            if not reader.fieldnames or 'action' not in reader.fieldnames or 'details' not in reader.fieldnames:
                print("Error: Log CSV is missing expected columns ('action', 'details').")
                return []

            for row in reader:
                action = row.get('action')
                level = row.get('level')
                details_str = row.get('details')

                if level == 'WARN' and action == 'FIND_INDIVIDUAL_NONE' and details_str:
                    try:
                        details_json = json.loads(details_str)
                        
                        # Extract the original CSV name if available, or construct from parsedName
                        name_to_report = None
                        record_identifier = details_json.get('recordIdentifier', '') # Get the unique identifier for the log entry

                        if 'csvFullName' in details_json: # Check if csvFullName is directly in details
                            name_to_report = details_json['csvFullName']
                        elif 'parsedName' in details_json and isinstance(details_json['parsedName'], dict):
                            # Fallback to constructing from parsedName if csvFullName isn't top-level in details
                            pn = details_json['parsedName']
                            parts = [pn.get('firstName'), pn.get('middleName'), pn.get('lastName'), pn.get('suffix')]
                            name_to_report = " ".join(filter(None, parts))
                        elif 'csvFullName' in details_json.get('parsedName', {}): # Check if csvFullName is nested under parsedName
                             name_to_report = details_json['parsedName']['csvFullName']


                        if name_to_report and record_identifier not in processed_identifiers:
                            unmatched_names.append(name_to_report)
                            processed_identifiers.add(record_identifier)
                        elif not name_to_report:
                            print(f"Warning: Could not extract a reportable name from details: {details_str}")

                    except json.JSONDecodeError:
                        print(f"Warning: Could not parse JSON details for an unmatched entry: {details_str}")
                    except Exception as e:
                        print(f"Warning: Error processing details for an unmatched entry: {details_str} - {e}")
    except FileNotFoundError:
        print(f"Error: Log file not found at {log_file_path}")
        return []
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return []
        
    return list(set(unmatched_names)) # Return unique names

if __name__ == "__main__":
    log_file = 'innocence_project_news_seed_log.csv'  # Make sure this path is correct
    
    print(f"Parsing log file: {log_file} for unmatched names...")
    
    names_not_found = find_unmatched_names(log_file)
    
    if names_not_found:
        print("\n--- Names Not Found in Database ---")
        for i, name in enumerate(names_not_found):
            print(f"{i+1}. {name}")
        print(f"\nTotal unique names not found: {len(names_not_found)}")
    else:
        print("\nNo unmatched names found with action 'FIND_INDIVIDUAL_NONE' or an error occurred.")

    # If you want to output this list to another file:
    output_file = 'unmatched_names_from_log.txt'
    with open(output_file, 'w', encoding='utf-8') as f:
        for name in names_not_found:
            f.write(name + '\n')
    print(f"\nList of unmatched names also saved to: {output_file}")

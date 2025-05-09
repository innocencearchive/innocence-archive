import pandas as pd
import re
import io
import os

# --- Configuration ---
# Make sure the input CSV file is in the same directory as the script,
# or provide the full path.
INPUT_CSV_FILE = 'wrongful_convictions_summarized.csv'
OUTPUT_CSV_FILE = 'connected_convictions.csv'
NAME_COLUMN = 'Name of Wrongfully Convicted Individual(s)' # Adjust if column name differs

# --- Function to extract names ---
def extract_names(name_string):
    """
    Extracts individual names from a string containing multiple names,
    separated by commas, 'and', or potentially just spaces for simple pairs.
    Handles variations like 'Name1 and Name2', 'Name1, Name2, and Name3'.
    """
    if pd.isna(name_string):
        return []

    # Normalize string: replace ' and ' with commas for easier splitting
    name_string = name_string.replace(' and ', ', ')
    # Remove extra whitespace around commas
    name_string = re.sub(r'\s*,\s*', ',', name_string)
    # Split by comma
    names = [name.strip() for name in name_string.split(',') if name.strip()]

    # Basic check: if only one "name" results but contains spaces,
    # assume it might be two names without 'and' or comma (e.g., "Dominic Daley James Halligan")
    # This is a heuristic and might misinterpret single multi-word names.
    # We only apply this if the initial split yields exactly one result and it contains spaces.
    # A more robust solution would require better name parsing or known group identification.
    # For now, we rely primarily on commas and 'and'.
    # Let's refine: only split single results if they seem like multiple distinct names.
    # A simple check could be multiple capital letters indicating start of names.
    # However, sticking to comma/and splitting is safer to avoid errors.
    # If a row has "Dominic Daley James Halligan", the current logic will treat it as one name.
    # The user might need to manually clean the input CSV's name column for such cases
    # or add specific logic for known pairs/groups not using standard separators.

    # Filter out potential empty strings again after stripping
    names = [name for name in names if name]

    return names

# --- Main Script ---
try:
    # Check if input file exists
    if not os.path.exists(INPUT_CSV_FILE):
        print(f"Error: Input file '{INPUT_CSV_FILE}' not found.")
        print("Please make sure the CSV file is in the same directory as the script.")
    else:
        # Read the input CSV
        df = pd.read_csv(INPUT_CSV_FILE)

        # Check if the name column exists
        if NAME_COLUMN not in df.columns:
            print(f"Error: Column '{NAME_COLUMN}' not found in the CSV file.")
            print(f"Available columns are: {list(df.columns)}")
        else:
            connected_cases = []

            # Iterate through each row of the DataFrame
            for index, row in df.iterrows():
                name_field = row[NAME_COLUMN]
                extracted_names = extract_names(name_field)
                num_names = len(extracted_names)

                # Check if 2 or more names were extracted
                if num_names >= 2:
                    # Determine relationship based on number of names
                    relationship = 'Pair' if num_names == 2 else 'Group'

                    # Create a dictionary for the output row
                    output_row = {'Relationship': relationship}
                    # Add names as separate columns (e.g., Name 1, Name 2, ...)
                    for i, name in enumerate(extracted_names):
                        output_row[f'Name {i+1}'] = name
                    connected_cases.append(output_row)

            # Create a new DataFrame from the collected data
            if connected_cases:
                output_df = pd.DataFrame(connected_cases)

                # Fill NaN values that might appear if groups have varying numbers of members
                output_df = output_df.fillna('')

                # Save the output DataFrame to a new CSV file
                output_df.to_csv(OUTPUT_CSV_FILE, index=False, encoding='utf-8')
                print(f"Successfully processed the file.")
                print(f"Output saved to '{OUTPUT_CSV_FILE}'")
            else:
                print("No rows with 2 or more connected individuals found.")

except pd.errors.EmptyDataError:
    print(f"Error: The file '{INPUT_CSV_FILE}' is empty.")
except Exception as e:
    print(f"An unexpected error occurred: {e}")


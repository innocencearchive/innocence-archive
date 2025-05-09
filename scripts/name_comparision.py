# Import the pandas library
import pandas as pd
import numpy as np # For handling potential missing values (NaN)

# --- Configuration ---
# <<< UPDATE HERE: Replace with the actual paths to your CSV files if needed >>>
long_format_file = 'connected_convictions_long_format.csv'
detailed_list_file = 'exoneration_list_detailed.csv'

# <<< UPDATE HERE: Replace with your desired output file path >>>
output_file_path = 'potential_name_matches_formatted_report_v2.csv'

# <<< UPDATE HERE: Replace with the actual column name containing names in BOTH files >>>
name_column_long = 'Name' # Name column in longgroup.csv
name_column_detailed = 'Name' # Name column in exoneration_list_detailed.csv

# <<< UPDATE HERE: Replace with the actual column name for disambiguation info in the detailed file >>>
disambiguation_column = 'Disambiguation' # Disambiguation column in exoneration_list_detailed.csv
# --- End Configuration ---

# --- Helper Function for Name Formatting ---
def format_first_last_to_last_first(name):
    """
    Attempts to convert 'First Middle Last' or 'First Last' to 'Last, First Middle'.
    Assumes the last word is the last name. Handles empty/NaN inputs.
    Returns None if formatting fails or name is too short.
    """
    if pd.isna(name) or not isinstance(name, str) or name.strip() == '':
        return None
    parts = name.strip().split()
    if len(parts) < 2:
        return None
    elif len(parts) == 2:
        return f"{parts[1]}, {parts[0]}"
    else:
        last_name = parts[-1]
        first_middle_parts = parts[:-1]
        return f"{last_name}, {' '.join(first_middle_parts)}"

# --- Load Data ---
print(f"Loading long format list: {long_format_file}")
try:
    df_long = pd.read_csv(long_format_file)
except FileNotFoundError:
    print(f"Error: File not found at {long_format_file}")
    exit()
except Exception as e:
    print(f"Error loading long format CSV: {e}")
    exit()

print(f"Loading detailed list: {detailed_list_file}")
try:
    df_detailed = pd.read_csv(detailed_list_file)
except FileNotFoundError:
    print(f"Error: File not found at {detailed_list_file}")
    exit()
except Exception as e:
    print(f"Error loading detailed CSV: {e}")
    exit()

# --- Data Validation ---
if name_column_long not in df_long.columns:
    print(f"Error: Column '{name_column_long}' not found in {long_format_file}")
    exit()
if name_column_detailed not in df_detailed.columns:
    print(f"Error: Column '{name_column_detailed}' not found in {detailed_list_file}")
    exit()
# <<< ADDED VALIDATION for disambiguation column >>>
if disambiguation_column not in df_detailed.columns:
    print(f"Error: Column '{disambiguation_column}' not found in {detailed_list_file}")
    exit()


print("Columns found. Standardizing formats...")

# --- Standardize Names ---
# 1. Process df_long ('First Last' -> 'Last, First')
df_long['Standardized_Name'] = df_long[name_column_long].fillna('').apply(format_first_last_to_last_first)
print(f"Formatted names in {long_format_file}. Sample:\n{df_long[[name_column_long, 'Standardized_Name']].head()}")

# 2. Process df_detailed ('"Last, First"' -> 'Last, First')
df_detailed[name_column_detailed] = df_detailed[name_column_detailed].astype(str).fillna('')
df_detailed['Standardized_Name'] = df_detailed[name_column_detailed].str.strip('"').str.strip()
print(f"\nFormatted names in {detailed_list_file}. Sample:\n{df_detailed[[name_column_detailed, 'Standardized_Name']].head()}")

# 3. Drop rows where standardization failed
df_long_clean = df_long.dropna(subset=['Standardized_Name'])
df_long_clean = df_long_clean[df_long_clean['Standardized_Name'] != '']

df_detailed_clean = df_detailed.dropna(subset=['Standardized_Name'])
df_detailed_clean = df_detailed_clean[df_detailed_clean['Standardized_Name'] != '']

if df_long_clean.empty or df_detailed_clean.empty:
     print("\nError: After cleaning/standardizing names, one or both lists have no valid names to compare.")
     exit()

print(f"\nProceeding with comparison: {len(df_long_clean)} names from long list vs {len(df_detailed_clean)} names from detailed list.")

# --- Comparison using Merge on Standardized Names ---
potential_matches = pd.merge(
    df_long_clean,
    df_detailed_clean,
    on='Standardized_Name', # Merge on the NEW standardized column
    how='inner',
    suffixes=('_long', '_detailed') # Suffixes are important!
)

# --- Output ---
if potential_matches.empty:
    print("\nNo potential matches found based on the standardized names.")
else:
    print(f"\nFound {len(potential_matches)} potential matches based on standardized name format.")

    # --- MODIFIED Column Selection ---
    # Define the core columns we definitely want at the beginning
    # Note: If 'Disambiguation' column name also existed in df_long, the one from
    # df_detailed would be automatically renamed to 'Disambiguation_detailed' by the merge.
    # Assuming it's unique to df_detailed, it keeps its original name.
    # If you suspect a clash, check potential_matches.columns to confirm the exact name.
    output_columns = ['Standardized_Name', f'{name_column_long}_long', f'{name_column_detailed}_detailed', disambiguation_column]

    # Add other columns you want to see, checking they exist after merge
    other_cols_long = [col for col in df_long.columns if col != name_column_long and col != 'Standardized_Name']
    other_cols_detailed = [col for col in df_detailed.columns if col != name_column_detailed and col != 'Standardized_Name' and col != disambiguation_column] # Exclude already added cols

    # Construct the final list, ensuring no duplicates and handling suffixes
    final_columns = output_columns + [f'{col}_long' for col in other_cols_long if f'{col}_long' in potential_matches.columns] \
                                  + [f'{col}_detailed' for col in other_cols_detailed if f'{col}_detailed' in potential_matches.columns]

    # Ensure all selected columns actually exist in the merged dataframe before selecting
    final_columns = [col for col in final_columns if col in potential_matches.columns]
    # Remove potential duplicates if any arose (though unlikely with suffixes)
    final_columns = list(dict.fromkeys(final_columns))
    # --- End MODIFIED Column Selection ---


    print("\nFirst 5 potential matches found:")
    print(potential_matches[final_columns].head().to_string()) # Display selected columns

    try:
        # Save the selected & reordered columns
        potential_matches[final_columns].to_csv(output_file_path, index=False)
        print(f"\nFull report of potential matches saved to: {output_file_path}")
    except Exception as e:
        print(f"\nError saving results to CSV: {e}")

print("Script finished.")
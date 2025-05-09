# Import the pandas library
import pandas as pd
import numpy as np # numpy is often used with pandas, especially for handling missing values

# --- Configuration ---
# <<< UPDATE HERE: Replace with the actual paths to your CSV files >>>
detailed_file_path = 'exoneration_list_detailed.csv'
summarized_file_path = 'wrongful_convictions_summarized.csv'
output_file_path = 'potential_matches.csv'

# <<< UPDATE HERE: Replace with the actual column names in your CSVs >>>
name_column = 'Name' # The column containing the individual's name in BOTH files
disambiguation_column = 'Disambiguation' # The column containing disambiguation info in the detailed file
# --- End Configuration ---

print(f"Loading detailed list: {detailed_file_path}")
try:
    df_detailed = pd.read_csv(detailed_file_path)
except FileNotFoundError:
    print(f"Error: File not found at {detailed_file_path}")
    exit()
except Exception as e:
    print(f"Error loading detailed CSV: {e}")
    exit()


print(f"Loading summarized list: {summarized_file_path}")
try:
    df_summarized = pd.read_csv(summarized_file_path)
except FileNotFoundError:
    print(f"Error: File not found at {summarized_file_path}")
    exit()
except Exception as e:
    print(f"Error loading summarized CSV: {e}")
    exit()

# --- Data Validation ---
# Check if the specified columns exist
if name_column not in df_detailed.columns:
    print(f"Error: Column '{name_column}' not found in {detailed_file_path}")
    exit()
if disambiguation_column not in df_detailed.columns:
    print(f"Error: Column '{disambiguation_column}' not found in {detailed_file_path}")
    exit()
if name_column not in df_summarized.columns:
    print(f"Error: Column '{name_column}' not found in {summarized_file_path}")
    exit()

print("Columns found. Processing data...")

# --- Filtering and Matching ---
# Convert disambiguation column to string to handle various empty/null types consistently
df_detailed[disambiguation_column] = df_detailed[disambiguation_column].astype(str)

# Filter the detailed list for rows WHERE the disambiguation column is NOT empty or 'nan' (common pandas null representation)
# We check for non-empty strings after stripping whitespace, and also exclude pandas' typical NaN representations.
df_detailed_filtered = df_detailed[
    df_detailed[disambiguation_column].notna() & \
    (df_detailed[disambiguation_column].str.strip() != '') & \
    (df_detailed[disambiguation_column].str.lower() != 'nan') & \
    (df_detailed[disambiguation_column].str.lower() != '<na>') # Handle pandas StringDtype NA
].copy() # Use .copy() to avoid SettingWithCopyWarning

if df_detailed_filtered.empty:
    print("No rows found in the detailed list with data in the disambiguation column.")
    exit()

print(f"Found {len(df_detailed_filtered)} rows with disambiguation info in the detailed list.")

# Merge the filtered detailed list with the summarized list based on the name column
# 'inner' merge keeps only rows where the name exists in BOTH dataframes.
# Suffixes are added to distinguish columns with the same name (other than the merge key) from different original files.
potential_matches = pd.merge(
    df_detailed_filtered,
    df_summarized,
    on=name_column,
    how='inner',
    suffixes=('_detailed', '_summarized')
)

# --- Output ---
if potential_matches.empty:
    print("No potential matches found based on the criteria (matching name AND disambiguation info present).")
else:
    print(f"Found {len(potential_matches)} potential matches.")
    try:
        potential_matches.to_csv(output_file_path, index=False)
        print(f"Potential matches saved to: {output_file_path}")
    except Exception as e:
        print(f"Error saving results to CSV: {e}")

print("Script finished.")
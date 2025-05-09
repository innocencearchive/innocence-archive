# Import the pandas library
import pandas as pd
import re # Import regular expressions for more robust replacement

# --- Configuration ---
# <<< UPDATE HERE: Replace with the actual path to your input CSV file >>>
input_file_path = 'wrongful_convictions_summarized.csv'

# <<< UPDATE HERE: Replace with your desired output file path >>>
output_file_path = 'wrongful_convictions_summarized_long.csv'

# <<< UPDATE HERE: Replace with the actual column name containing names >>>
name_column = 'Name'
# --- End Configuration ---

print(f"Loading summarized list: {input_file_path}")
try:
    df = pd.read_csv(input_file_path)
except FileNotFoundError:
    print(f"Error: File not found at {input_file_path}")
    exit()
except Exception as e:
    print(f"Error loading CSV: {e}")
    exit()

# --- Data Validation ---
if name_column not in df.columns:
    print(f"Error: Column '{name_column}' not found in {input_file_path}")
    exit()

print("Name column found. Processing data for long format...")

# --- Transformation ---
# Ensure the name column is string type
df[name_column] = df[name_column].astype(str)

# 1. Standardize separators: Replace ' and ' (with spaces) with a comma.
#    Using regex=True ensures we replace the whole word "and" surrounded by spaces.
#    We add commas around the replacement to handle cases like "A, B and C" -> "A, B , C"
df[name_column] = df[name_column].str.replace(r'\s+and\s+', ', ', regex=True)

# 2. Split the names: Split the 'Name' column by comma into lists of names.
#    Handles multiple commas and strips whitespace around commas during split.
df[name_column] = df[name_column].str.split(r'\s*,\s*') # Uses regex split for flexibility

# 3. Explode the DataFrame: Create new rows for each name in the lists.
#    This duplicates the other column data for each new row.
df_long = df.explode(name_column)

# 4. Clean up: Remove leading/trailing whitespace from the individual names.
df_long[name_column] = df_long[name_column].str.strip()

# 5. Optional: Remove any empty rows that might result if there were trailing commas, etc.
df_long = df_long[df_long[name_column] != '']

# Reset the index of the resulting DataFrame for cleanliness
df_long = df_long.reset_index(drop=True)

# --- Output ---
print(f"Transformation complete. Original rows: {len(df)}, New rows: {len(df_long)}")
try:
    df_long.to_csv(output_file_path, index=False)
    print(f"Transformed data saved to: {output_file_path}")
except Exception as e:
    print(f"Error saving results to CSV: {e}")

print("Script finished.")
import pandas as pd
import os # Import os for path joining

# --- Configuration ---
# Define the path to your input CSV file
# IMPORTANT: Replace with the actual path to your 'connected_convictions.csv' file
# Assuming it's in the same directory as the previous file, adjust if needed.
# Example: If groupnames.csv was at C:\project_data\groupnames.csv,
# this might be C:\project_data\connected_convictions.csv
input_csv_path = r'connected_convictions.csv' # Use raw string (r'') for Windows paths

# Define the path for the output CSV file (long format)
output_csv_path = r'connected_convictions_long_format.csv' # Use raw string

# Define the name of the column containing the relationship identifiers
# **** THIS IS THE MAIN CHANGE ****
relationship_identifier_column = 'Relationship' # Changed from 'GroupName'

# Define the desired name for the identifier column in the output long format
output_identifier_column_name = 'Relationship' # Can be the same or different

# Define the desired name for the value column in the output long format
output_value_column_name = 'IndividualName'

# --- Script Logic ---
try:
    # 1. Read the wide-format CSV file into a pandas DataFrame
    print(f"Reading CSV file from: {input_csv_path}")
    df_wide = pd.read_csv(input_csv_path, delimiter=',')
    print("CSV file read successfully.")
    print("\nOriginal DataFrame (first 5 rows):")
    print(df_wide.head())

    # 2. Identify member columns (all columns except the relationship identifier column)
    member_columns = [col for col in df_wide.columns if col != relationship_identifier_column]
    print(f"\nIdentified Relationship Identifier Column: '{relationship_identifier_column}'")
    print(f"Identified Member Columns: {member_columns}")

    # 3. Use pandas.melt() to transform from wide to long format
    print("\nMelting DataFrame from wide to long format...")
    df_long = pd.melt(
        df_wide,
        id_vars=[relationship_identifier_column], # Use the relationship column here
        value_vars=member_columns,
        var_name='MemberColumnSource', # Temporary column
        value_name=output_value_column_name # Use the desired output value name
    )
    print("Melting complete.")

    # Rename the identifier column to the desired output name AFTER melting
    df_long.rename(columns={relationship_identifier_column: output_identifier_column_name}, inplace=True)
    print(f"Renamed identifier column to '{output_identifier_column_name}'.")

    print("\nMelted DataFrame (first 5 rows before cleaning):")
    print(df_long.head())


    # 4. Clean up the long-format DataFrame
    print("\nCleaning the long DataFrame (removing empty rows)...")
    df_long.dropna(subset=[output_value_column_name], inplace=True)
    df_long = df_long[df_long[output_value_column_name].astype(str).str.strip() != '']

    print("Dropping the temporary 'MemberColumnSource' column...")
    df_long.drop(columns=['MemberColumnSource'], inplace=True)

    df_long.reset_index(drop=True, inplace=True)

    # 5. Display the final long-format DataFrame
    print("\nFinal Long-Format DataFrame (first 10 rows):")
    print(df_long.head(10))
    print(f"\nTotal relationship-individual connections found: {len(df_long)}")

    # 6. Save the long-format DataFrame to a new CSV file
    print(f"\nSaving long-format data to: {output_csv_path}")
    df_long.to_csv(output_csv_path, index=False, encoding='utf-8')
    print("Long-format CSV file saved successfully.")

except FileNotFoundError:
    print(f"\nError: Input CSV file not found at '{input_csv_path}'. Please check the path.")
except KeyError:
    # This error message now refers to the relationship identifier column
    print(f"\nError: The specified relationship identifier column '{relationship_identifier_column}' was not found in the CSV.")
    if 'df_wide' in locals(): # Check if df_wide was successfully created before accessing columns
      print(f"Available columns are: {df_wide.columns.tolist()}")
    else:
      print("Could not read columns from the CSV.")
except Exception as e:
    print(f"\nAn unexpected error occurred: {e}")


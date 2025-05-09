import pandas as pd
import os
import asyncio # Required for running async Prisma client in a script
from prisma import Prisma, register # Import Prisma client
from nameparser import HumanName # Import the name parsing library

# --- Configuration ---

# !!! --- SET DRY_RUN TO True FOR SIMULATION, False FOR ACTUAL SEEDING --- !!!
DRY_RUN = True 
# !!! ----------------------------------------------------------------- !!!

# Define the path to your LONG-format CSV file (output from previous script)
# IMPORTANT: Replace with the actual path to your 'longgroup.csv' file
input_csv_path = r'C:\GitHub\innocencearchive\scripts\groupslonggroup.csv' # Use raw string (r'') for Windows paths

# Define the column names expected in your long-format CSV
group_column_csv = 'GroupName' # Adjust if your column name is different
individual_column_csv = 'IndividualName' # Adjust if your column name is different

# --- Helper Function for Name Parsing (Using nameparser) ---
def parse_name_robust(full_name):
    """
    Parses a full name string into first and last name using the nameparser library.
    Combines first and middle names into the 'firstName' field.
    Handles potential errors during parsing.
    Returns (firstName, lastName) tuple or (None, None) if input is invalid or parsing fails.
    """
    if not full_name or not isinstance(full_name, str):
        # print(f"Warning: Invalid input to parse_name_robust: {full_name}") # Less verbose
        return None, None
    
    try:
        name = HumanName(full_name.strip())
        first_name = f"{name.first} {name.middle}".strip()
        last_name = name.last
        if not first_name or not last_name:
             # print(f"Warning: Could not reliably parse '{full_name}' into first/last. Parsed: First='{first_name}', Last='{last_name}'") # Less verbose
             return None, None 
        return first_name, last_name
    except Exception as e:
        print(f"Error parsing name '{full_name}': {e}")
        return None, None

# --- Main Seeding Logic ---
async def main():
    """
    Main asynchronous function to run the seeding process with dry run capability.
    """
    if DRY_RUN:
        print("--- RUNNING IN DRY RUN MODE --- (No changes will be made to the database)")
    else:
        print("--- RUNNING IN LIVE MODE --- (Changes WILL be made to the database)")
        
    print("Starting seeding script...")
    prisma = Prisma()
    
    # Counters for summary
    processed_count = 0
    connection_count = 0
    error_count = 0
    skipped_parsing_count = 0
    groups_found = 0
    groups_would_create = 0
    individuals_found = 0
    individuals_would_create = 0
    connections_would_make = 0

    try:
        print("Connecting to database (for read operations)...")
        await prisma.connect()
        print("Database connected.")

        # 1. Read the long-format CSV file
        print(f"Reading CSV file from: {input_csv_path}")
        try:
            df_long = pd.read_csv(input_csv_path, delimiter=',', dtype=str) 
            df_long.fillna('', inplace=True) 
            print(f"Successfully read {len(df_long)} rows from CSV.")
        except FileNotFoundError:
            print(f"Error: Input CSV file not found at '{input_csv_path}'. Please check the path.")
            return 
        except Exception as e:
            print(f"Error reading CSV file: {e}")
            return 

        if group_column_csv not in df_long.columns or individual_column_csv not in df_long.columns:
             print(f"Error: CSV must contain columns named '{group_column_csv}' and '{individual_column_csv}'.")
             print(f"Found columns: {df_long.columns.tolist()}")
             return

        # 2. Iterate through each row of the DataFrame
        print("Processing rows...")
        for index, row in df_long.iterrows():
            group_name = str(row[group_column_csv]).strip()
            individual_full_name = str(row[individual_column_csv]).strip()

            if not group_name or not individual_full_name:
                # print(f"Skipping row {index + 1}: Missing GroupName or IndividualName.") # Less verbose
                error_count += 1
                continue

            try:
                # 3. Parse Individual Name
                first_name, last_name = parse_name_robust(individual_full_name)
                if not first_name or not last_name:
                    # print(f"Skipping row {index + 1}: Failed to parse name '{individual_full_name}'.") # Less verbose
                    skipped_parsing_count += 1
                    continue 

                # --- Group Handling ---
                # Check if group exists (Read operation)
                existing_group = await prisma.individualgroup.find_unique(where={'name': group_name})
                group_id = None # Initialize group_id

                if existing_group:
                    groups_found += 1
                    group_id = existing_group.id
                    # print(f"DRY RUN: Found group '{group_name}' (ID: {group_id})") # Optional verbose logging
                else:
                    groups_would_create += 1
                    if not DRY_RUN:
                        # Actual create operation
                        created_group = await prisma.individualgroup.create(data={'name': group_name})
                        group_id = created_group.id
                        print(f"LIVE RUN: Created group '{group_name}' (ID: {group_id})")
                    else:
                        # Simulate ID for dry run connection step (won't be real)
                        group_id = f"simulated_group_id_for_{group_name}" 
                        print(f"DRY RUN: Would create group '{group_name}'")


                # --- Individual Handling ---
                # Check if individual exists (Read operation)
                existing_individual = await prisma.individual.find_first(
                    where={'firstName': first_name, 'lastName': last_name}
                )
                individual_id = None # Initialize individual_id

                if existing_individual:
                    individuals_found += 1
                    individual_id = existing_individual.id
                    # print(f"DRY RUN: Found individual '{first_name} {last_name}' (ID: {individual_id})") # Optional verbose logging
                else:
                    individuals_would_create += 1
                    if not DRY_RUN:
                        # Actual create operation
                        created_individual = await prisma.individual.create(
                            data={'firstName': first_name, 'lastName': last_name}
                        )
                        individual_id = created_individual.id
                        print(f"LIVE RUN: Created individual '{first_name} {last_name}' (ID: {individual_id})")
                    else:
                         # Simulate ID for dry run connection step (won't be real)
                        individual_id = f"simulated_individual_id_for_{first_name}_{last_name}"
                        print(f"DRY RUN: Would create individual '{first_name} {last_name}'")

                # --- Connection Handling ---
                connections_would_make += 1 # Increment regardless of dry run for summary
                if not DRY_RUN:
                     # Actual connect operation
                     await prisma.individual.update(
                         where={'id': individual_id},
                         data={'groups': {'connect': {'id': group_id}}}
                     )
                     # print(f"LIVE RUN: Connected individual ID {individual_id} to group ID {group_id}.") # Optional verbose logging
                     connection_count += 1 # Count actual connections made
                else:
                     print(f"DRY RUN: Would connect individual '{first_name} {last_name}' (ID: {individual_id}) to group '{group_name}' (ID: {group_id})")

                processed_count += 1

            except Exception as e:
                print(f"Error processing row {index + 1} (Group: '{group_name}', Individual: '{individual_full_name}'): {e}")
                error_count += 1

            # Optional: Print progress periodically
            # if (index + 1) % 50 == 0:
            #      print(f"Processed {index + 1}/{len(df_long)} rows...")


        print("\n--- Seeding Summary ---")
        print(f"Mode: {'DRY RUN' if DRY_RUN else 'LIVE RUN'}")
        print(f"Total rows in CSV: {len(df_long)}")
        print(f"Rows processed for potential action: {processed_count}")
        print("-" * 20)
        print(f"Groups found existing: {groups_found}")
        print(f"Groups {'would be' if DRY_RUN else 'were'} created: {groups_would_create if DRY_RUN else (groups_would_create)}") # Adjust wording
        print(f"Individuals found existing: {individuals_found}")
        print(f"Individuals {'would be' if DRY_RUN else 'were'} created: {individuals_would_create if DRY_RUN else (individuals_would_create)}") # Adjust wording
        print(f"Connections {'would be' if DRY_RUN else 'were'} made/attempted: {connections_would_make if DRY_RUN else connection_count}") # Adjust wording
        print("-" * 20)
        print(f"Rows skipped due to missing data: {error_count}")
        print(f"Rows skipped due to name parsing issues: {skipped_parsing_count}")
        print("-----------------------")

    except Exception as e:
        print(f"\nAn unexpected error occurred during the seeding process: {e}")
    finally:
        if prisma.is_connected():
            print("Disconnecting from database...")
            await prisma.disconnect()
            print("Database disconnected.")
        print("Seeding script finished.")

# --- Run the main async function ---
if __name__ == '__main__':
    register(prisma) 
    asyncio.run(main())

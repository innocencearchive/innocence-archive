import csv
import re

def preprocess_csv_split_names(input_file_path, output_file_path):
    """
    Reads a CSV file, splits rows with multiple names in the 'name' column
    into separate rows, and writes to a new CSV file.

    Args:
        input_file_path (str): Path to the input CSV file.
        output_file_path (str): Path to save the processed CSV file.
    """
    processed_rows = []
    fieldnames = [] # To store the header

    try:
        with open(input_file_path, mode='r', encoding='utf-8') as infile:
            reader = csv.DictReader(infile)
            if not reader.fieldnames:
                print(f"Error: Could not read fieldnames from {input_file_path}. Is the file empty or not a valid CSV?")
                return

            fieldnames = reader.fieldnames
            if 'name' not in fieldnames or 'headline' not in fieldnames or 'link' not in fieldnames:
                print(f"Error: Input CSV {input_file_path} is missing one of the required columns: 'name', 'headline', 'link'.")
                print(f"Found columns: {fieldnames}")
                return

            for row_number, row in enumerate(reader, 1):
                original_name_field = row.get('name', '')
                headline = row.get('headline', '')
                link = row.get('link', '')

                if not original_name_field:
                    print(f"Warning: Row {row_number} has an empty 'name' field. Skipping.")
                    # Optionally, you could write it as is or handle differently
                    # processed_rows.append({'name': '', 'headline': headline, 'link': link})
                    continue

                # Split by comma or semicolon, and handle potential extra spaces
                # Using re.split to handle multiple delimiters and strip whitespace
                individual_names = [name.strip() for name in re.split(r'[,;]', original_name_field) if name.strip()]

                if not individual_names: # Handles cases where name field might be just delimiters
                    print(f"Warning: Row {row_number} with name '{original_name_field}' resulted in no valid individual names after splitting. Original row kept if only one 'name' was effectively present before split attempt, or skipped if truly empty post-split.")
                    if len(original_name_field.strip()) > 0 and not re.search(r'[,;]', original_name_field): # if it was a single name to begin with
                         processed_rows.append({'name': original_name_field.strip(), 'headline': headline, 'link': link})
                    continue


                if len(individual_names) > 0:
                    for name_part in individual_names:
                        new_row = {
                            'name': name_part,
                            'headline': headline,
                            'link': link
                        }
                        # Ensure all original fieldnames are present if there are more than the 3 core ones
                        for field in fieldnames:
                            if field not in new_row:
                                new_row[field] = row.get(field, '') # Copy other original columns if they exist
                        processed_rows.append(new_row)
                else: # Should be caught by the 'if not individual_names' above, but as a fallback
                    print(f"Warning: Row {row_number} with name '{original_name_field}' did not yield any names. Keeping original or skipping if empty.")
                    # If original_name_field was not empty and not just delimiters, add it as is
                    if original_name_field.strip():
                         processed_rows.append({'name': original_name_field.strip(), 'headline': headline, 'link': link})


        if not processed_rows:
            print("No data processed. Output file will not be created.")
            return

        # Write the processed data to the output CSV
        with open(output_file_path, mode='w', encoding='utf-8', newline='') as outfile:
            # Ensure fieldnames for writer match what we're actually outputting
            # If new_row might not contain all original fieldnames, adjust this.
            # For this script, we are focusing on 'name', 'headline', 'link'.
            # If other columns from the original CSV should be preserved, ensure they are added to new_row.
            # The current logic tries to preserve other columns.
            writer_fieldnames = fieldnames
            if not all(f in processed_rows[0] for f in fieldnames) and processed_rows:
                # Fallback to keys from the first processed row if original fieldnames don't align perfectly
                # (e.g. if original had more columns not explicitly handled for new split rows)
                # However, the current logic in the loop aims to preserve all original fields.
                writer_fieldnames = list(processed_rows[0].keys())


            writer = csv.DictWriter(outfile, fieldnames=writer_fieldnames)
            writer.writeheader()
            writer.writerows(processed_rows)

        print(f"\nSuccessfully processed {input_file_path}.")
        print(f"Output saved to {output_file_path}.")
        print(f"Original rows: approx {row_number if 'row_number' in locals() else 'N/A'}. Processed rows written: {len(processed_rows)}")

    except FileNotFoundError:
        print(f"Error: Input file not found at {input_file_path}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    input_csv = 'innocenceproject_news.csv' # Your original CSV
    output_csv = 'innocenceproject_news_processed.csv' # Name for the new CSV

    print(f"Starting preprocessing of '{input_csv}'...")
    preprocess_csv_split_names(input_csv, output_csv)
    print("Preprocessing script finished.")

import os
import re
import logging

logging.basicConfig(filename='update_episodes.log', level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')

def update_markdown_files(folder_path):
    year_ranges = {
        2016: (1, 10),
        2017: (11, 46),
        2018: (47, 80),
        2019: (81, 108),
        2020: (109, 178),
        2021: (179, 238),
        2022: (239, 320),
        2023: (321, 415),
        2024: (416, 505),
        2025: (506, 521)
    }

    for filename in os.listdir(folder_path):
        if filename.endswith(".md") or filename.endswith(".txt"):
            filepath = os.path.join(folder_path, filename)

            try:
                with open(filepath, 'r', encoding='utf-8') as file:
                    lines = file.readlines()
            except UnicodeDecodeError:
                logging.error(f"UnicodeDecodeError with file: {filename}")
                continue

            try:
                match = re.search(r"(\d+)", filename)
                if match:
                    episode_number = int(match.group(1))
                else:
                    logging.warning(f"Could not extract episode number from '{filename}'")
                    continue

                episode_year = None
                for year, (start, end) in year_ranges.items():
                    if start <= episode_number <= end:
                        episode_year = year
                        break

                if episode_year:
                    title_updated = False
                    year_updated = False
                    for i, line in enumerate(lines):
                        #  More flexible matching for the title line
                        if re.search(r"-?\s*\**Episode # & Title \(if applicable\)\**", line, re.IGNORECASE):
                            new_title = f"-   **Episode # & Title (if applicable)**: {filename[:-4].replace('_', ' ')}\n"
                            lines[i] = new_title.replace(" summary", "")
                            title_updated = True
                        #  More flexible matching for the year line
                        elif re.search(r"-?\s*\**Release Year\(s\)\**", line, re.IGNORECASE):
                            lines[i] = f"-   **Release Year(s)**: {episode_year}\n"
                            year_updated = True
                        if title_updated and year_updated:
                            break

                    with open(filepath, 'w', encoding='utf-8') as file:
                        file.writelines(lines)

                    logging.info(f"Updated: {filename}")
                else:
                    logging.warning(f"Could not determine year for: {filename}")

            except Exception as e:
                logging.error(f"An error occurred with file: {filename} - {e}")

# How to use:
folder_path = r"C:\GitHub\innocencearchive\scripts\podcast_project\summary"
update_markdown_files(folder_path)
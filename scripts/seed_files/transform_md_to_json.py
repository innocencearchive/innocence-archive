import google.generativeai as genai
import os
import argparse
import sys
import json # Needed for JSON handling
from pathlib import Path
from dotenv import load_dotenv

# --- Function to List Models (Keep for diagnostics) ---
def list_available_models():
    """Lists models available for the 'generateContent' method."""
    print("Attempting to list available models...")
    try:
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            print("Error: GOOGLE_API_KEY not found in environment variables.", file=sys.stderr)
            return False # Indicate failure
        genai.configure(api_key=api_key)

        print("\nAvailable models for generateContent:")
        count = 0
        for m in genai.list_models():
            # Check if the model supports the 'generateContent' method
            if 'generateContent' in m.supported_generation_methods:
                print(f"- {m.name}")
                count += 1
        if count == 0:
            print("  (No models found supporting generateContent with this setup)")
        print("-" * 20)
        return True # Indicate success

    except Exception as e:
        print(f"\nError listing models: {e}", file=sys.stderr)
        print("Please check API key, network connection, and library setup.", file=sys.stderr)
        print("-" * 20)
        return False # Indicate failure


# --- JSON Transformation Function ---
def transform_markdown_to_json(markdown_text: str, schema_text: str, base_prompt_template: str, model_name: str = 'gemini-2.0-flash-thinking-exp-01-21') -> dict | str:
    """
    Transforms the given markdown text into schema-compliant JSON using the Gemini API.

    Args:
        markdown_text: The full text of the markdown file to transform.
        schema_text: The full text of the Prisma schema definition.
        base_prompt_template: The base instruction text containing placeholders
                              {{PRISMA_SCHEMA}} and {{MARKDOWN_CONTENT}}.
        model_name: The specific model name to use.

    Returns:
        A dictionary representing the parsed JSON object, or an error message starting with "Error:"
    """
    try:
        # API key should be configured by list_available_models or main block
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
             # This check might be redundant if list_models worked, but good practice
            return "Error: GOOGLE_API_KEY not found in environment variables (check .env file)."
        # Ensure configured (idempotent)
        genai.configure(api_key=api_key)

        # --- Model Initialization ---
        print(f"Using model: {model_name}") # Log which model is being used
        # Configure model for JSON output if using Gemini 1.5 Pro or later
        generation_config = None
        if "1.5" in model_name:
             generation_config = genai.types.GenerationConfig(response_mime_type="application/json")
             print("Configured model for JSON output mode.")

        model = genai.GenerativeModel(model_name)

        # --- Prompt Engineering ---
        # Replace placeholders in the base prompt template
        prompt = base_prompt_template.replace("{{PRISMA_SCHEMA}}", schema_text)
        prompt = prompt.replace("{{MARKDOWN_CONTENT}}", markdown_text)

        # --- API Call ---
        response = model.generate_content(prompt, generation_config=generation_config)

        # --- Response Handling ---
        if not response.parts:
             if response.prompt_feedback.block_reason:
                 return f"Error: Generation blocked due to {response.prompt_feedback.block_reason.name}"
             else:
                 # Handle potential finish reason issues if content is empty
                 try:
                     # Accessing finish_reason might raise an error if the structure is unexpected
                     finish_reason = response.candidates[0].finish_reason if response.candidates else 'UNKNOWN'
                     return f"Error: Received an empty response from the API. Finish Reason: {finish_reason}"
                 except Exception as finish_e:
                     return f"Error: Received an empty response from the API and could not determine finish reason. Details: {finish_e}"


        raw_json_text = response.text

        # --- JSON Parsing ---
        try:
            # The response should ideally be *only* the JSON object
            # Clean potential markdown fences if JSON mode wasn't strictly enforced/successful
            raw_json_text = raw_json_text.strip().removeprefix("```json").removesuffix("```").strip()
            parsed_json = json.loads(raw_json_text)
            return parsed_json # Return the parsed dictionary
        except json.JSONDecodeError as json_e:
            print(f"Raw response text was:\n---\n{raw_json_text}\n---", file=sys.stderr)
            return f"Error: Failed to parse API response as JSON. Details: {json_e}"

    except Exception as e:
        # Check if the error message contains the specific 404 we saw
        if '404' in str(e) and model_name in str(e):
             return f"Error: Model '{model_name}' not found or not accessible with your API key/setup. Check the list_models output. Details: {e}"
        else:
            return f"Error: An exception occurred during transformation: {e}"

# --- Main Execution ---
if __name__ == "__main__":
    # --- Load Environment Variables ---
    load_dotenv() # Load .env file for API key

    # --- List Available Models (Diagnostic Step) ---
    if not list_available_models():
        print("\nExiting due to error listing models.")
        sys.exit(1) # Exit if listing failed

    # --- Argument Parsing ---
    parser = argparse.ArgumentParser(description="Transform markdown research files (.txt or .md) into schema-compliant JSON using the Gemini API.")
    parser.add_argument("--input_folder", required=True, help="Path to the folder containing markdown research files.")
    parser.add_argument("--output_folder", required=True, help="Path to the folder where generated JSON files will be saved.")
    parser.add_argument("--prompt_file", required=True, help="Path to a text file containing the base AI prompt template.")
    parser.add_argument("--schema_file", required=True, help="Path to the Prisma schema file (schema.prisma).")
    # Add argument to specify model, default to gemini-1.5-flash-latest as it supports JSON mode
    parser.add_argument("--model", default='gemini-2.0-flash-thinking-exp-01-21', help="Name of the Gemini model to use (e.g., gemini-1.5-flash-latest, gemini-1.5-pro-latest).")
    parser.add_argument("--input_ext", default="txt", help="Extension of input markdown files (e.g., 'txt', 'md'). Default: 'txt'")


    args = parser.parse_args()

    # --- Path Handling ---
    input_folder = Path(args.input_folder)
    output_folder = Path(args.output_folder)
    prompt_file_path = Path(args.prompt_file)
    schema_file_path = Path(args.schema_file)
    input_extension = args.input_ext.strip('.') # Remove leading dot if present

    if not input_folder.is_dir():
        print(f"Error: Input folder not found or is not a directory: {input_folder}", file=sys.stderr)
        sys.exit(1)

    try:
        output_folder.mkdir(parents=True, exist_ok=True)
        print(f"Output folder: {output_folder}")
    except Exception as e:
        print(f"Error: Could not create output folder {output_folder}: {e}", file=sys.stderr)
        sys.exit(1)

    # --- Load Base Prompt ---
    base_prompt_template_text = ""
    if not prompt_file_path.is_file():
         print(f"Error: Prompt file not found at {prompt_file_path}.", file=sys.stderr)
         sys.exit(1)
    else:
        try:
            with open(prompt_file_path, 'r', encoding='utf-8') as f:
                base_prompt_template_text = f.read() # Read the whole template
            print(f"Using prompt template from: {prompt_file_path}")
            # Check for placeholders
            if "{{PRISMA_SCHEMA}}" not in base_prompt_template_text or "{{MARKDOWN_CONTENT}}" not in base_prompt_template_text:
                 print("Warning: Prompt template might be missing required placeholders {{PRISMA_SCHEMA}} or {{MARKDOWN_CONTENT}}.", file=sys.stderr)
        except Exception as e:
            print(f"Error: Failed reading prompt file {prompt_file_path}: {e}", file=sys.stderr)
            sys.exit(1)

    # --- Load Schema ---
    schema_content = ""
    if not schema_file_path.is_file():
        print(f"Error: Schema file not found at {schema_file_path}.", file=sys.stderr)
        sys.exit(1)
    else:
        try:
            with open(schema_file_path, 'r', encoding='utf-8') as f:
                schema_content = f.read()
            print(f"Using schema definition from: {schema_file_path}")
        except Exception as e:
            print(f"Error: Failed reading schema file {schema_file_path}: {e}", file=sys.stderr)
            sys.exit(1)


    # --- File Processing Loop ---
    print(f"\nStarting JSON transformation process for *.{input_extension} files in: {input_folder}")
    processed_count = 0
    error_count = 0

    for md_file_path in input_folder.glob(f'*.{input_extension}'):
        print(f"\nProcessing file: {md_file_path.name}...")

        try:
            with open(md_file_path, 'r', encoding='utf-8') as f:
                markdown_content = f.read()
            if not markdown_content.strip():
                 print(f"Skipping empty file: {md_file_path.name}")
                 continue
        except Exception as e:
            print(f"Error reading file {md_file_path.name}: {e}", file=sys.stderr)
            error_count += 1
            continue

        # --- Transformation Call ---
        # Pass the markdown, schema, base_prompt template, and model name
        json_result = transform_markdown_to_json(
            markdown_text=markdown_content,
            schema_text=schema_content,
            base_prompt_template=base_prompt_template_text,
            model_name=args.model
        )

        # --- Output Handling ---
        if isinstance(json_result, str) and json_result.startswith("Error:"):
            print(f"Failed to transform {md_file_path.name}: {json_result}", file=sys.stderr)
            error_count += 1
        elif isinstance(json_result, dict):
            # Add source filename to JSON object before saving
            json_result['sourceFileName'] = md_file_path.name

            output_filename = md_file_path.stem + '.json' # Save as .json
            output_file_path = output_folder / output_filename
            try:
                with open(output_file_path, 'w', encoding='utf-8') as f:
                    json.dump(json_result, f, indent=2) # Save formatted JSON
                print(f"Successfully saved JSON to: {output_file_path}")
                processed_count += 1
            except Exception as e:
                print(f"Error writing JSON file {output_file_path}: {e}", file=sys.stderr)
                error_count += 1
        else:
             print(f"Failed to transform {md_file_path.name}: Received unexpected result type ({type(json_result)}).", file=sys.stderr)
             error_count += 1


    print(f"\n--- Process Complete ---")
    print(f"Successfully processed and saved JSON for {processed_count} files.")
    if error_count > 0:
        print(f"Encountered errors with {error_count} files.")
    print(f"------------------------")
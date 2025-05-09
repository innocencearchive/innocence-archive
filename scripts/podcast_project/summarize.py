import google.generativeai as genai
import os
import argparse
import sys
from pathlib import Path
from dotenv import load_dotenv

# --- Function to List Models ---
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


# --- Summarization Function ---
def summarize_transcript(transcript_text: str, base_prompt_text: str, model_name: str = 'gemini-2.0-pro-exp') -> str: # Default to 1.0-pro
    """
    Summarizes the given transcript text using the Gemini API and a base prompt.

    Args:
        transcript_text: The full text of the transcript to summarize.
        base_prompt_text: The base instruction text for the prompt.
        model_name: The specific model name to use.

    Returns:
        The generated summary text, or an error message starting with "Error:"
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
        model = genai.GenerativeModel(model_name) # Use the specified model name

        # --- Prompt Engineering ---
        prompt = f"{base_prompt_text}\n\nTranscript:\n{transcript_text}\n\nSummary:"

        # --- API Call ---
        response = model.generate_content(prompt)

        # --- Response Handling ---
        if not response.parts:
             if response.prompt_feedback.block_reason:
                 return f"Error: Summarization blocked due to {response.prompt_feedback.block_reason.name}"
             else:
                 return "Error: Received an empty response from the API."

        summary = response.text
        return summary

    except Exception as e:
        # Check if the error message contains the specific 404 we saw
        if '404' in str(e) and model_name in str(e):
             return f"Error: Model '{model_name}' not found or not accessible with your API key/setup. Check the list_models output. Details: {e}"
        else:
            return f"Error: An exception occurred during summarization: {e}"

# --- Main Execution ---
if __name__ == "__main__":
    # --- Load Environment Variables ---
    load_dotenv() # Load .env file for API key

    # --- List Available Models (Diagnostic Step) ---
    if not list_available_models():
        print("\nExiting due to error listing models.")
        sys.exit(1) # Exit if listing failed

    # --- Uncomment the next line if you ONLY want to list models and then stop ---
    # print("\nExiting after listing models (as requested by uncommented sys.exit).")
    # sys.exit(0)

    # --- Argument Parsing ---
    parser = argparse.ArgumentParser(description="Summarize all .txt transcript files in a folder using the Gemini API.")
    parser.add_argument("--input_folder", required=True, help="Path to the folder containing transcript text files.")
    parser.add_argument("--output_folder", required=True, help="Path to the folder where summary files will be saved.")
    parser.add_argument("--prompt_file", help="Optional path to a text file containing the base prompt instructions.", default='prompt.txt')
    # Add argument to specify model, default to gemini-1.0-pro
    parser.add_argument("--model", default='models/gemini-2.0-flash-thinking-exp-01-21', help="Name of the Gemini model to use (e.g., gemini-1.0-pro, gemini-1.5-flash-latest).")


    args = parser.parse_args()

    # --- Path Handling ---
    input_folder = Path(args.input_folder)
    output_folder = Path(args.output_folder)

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
    base_prompt = "Please provide a concise summary of the following transcript:" # Default prompt
    if args.prompt_file:
        try:
            prompt_file_path = Path(args.prompt_file)
            if not prompt_file_path.is_file():
                 print(f"Warning: Prompt file not found at {prompt_file_path}. Using default prompt.", file=sys.stderr)
            else:
                with open(prompt_file_path, 'r', encoding='utf-8') as f:
                    base_prompt = f.read().strip()
                print(f"Using custom prompt from: {prompt_file_path}")
        except Exception as e:
            print(f"Warning: Error reading prompt file {args.prompt_file}: {e}. Using default prompt.", file=sys.stderr)
    else:
        print("Using default prompt.")


    # --- File Processing Loop ---
    print(f"\nStarting summarization process for files in: {input_folder}")
    processed_count = 0
    error_count = 0

    for transcript_file_path in input_folder.glob('*.txt'):
        print(f"\nProcessing file: {transcript_file_path.name}...")

        try:
            with open(transcript_file_path, 'r', encoding='utf-8') as f:
                transcript = f.read()
            if not transcript.strip():
                 print(f"Skipping empty file: {transcript_file_path.name}")
                 continue
        except Exception as e:
            print(f"Error reading file {transcript_file_path.name}: {e}", file=sys.stderr)
            error_count += 1
            continue

        # --- Summarization Call ---
        # Pass the base_prompt and the chosen model name
        summary_result = summarize_transcript(transcript, base_prompt_text=base_prompt, model_name=args.model)

        # --- Output Handling ---
        if summary_result.startswith("Error:"):
            print(f"Failed to summarize {transcript_file_path.name}: {summary_result}", file=sys.stderr)
            error_count += 1
        else:
            output_filename = transcript_file_path.stem + '_summary.txt'
            output_file_path = output_folder / output_filename
            try:
                with open(output_file_path, 'w', encoding='utf-8') as f:
                    f.write(summary_result)
                print(f"Successfully saved summary to: {output_file_path}")
                processed_count += 1
            except Exception as e:
                print(f"Error writing summary file {output_file_path}: {e}", file=sys.stderr)
                error_count += 1

    print(f"\n--- Process Complete ---")
    print(f"Successfully processed and saved summaries for {processed_count} files.")
    if error_count > 0:
        print(f"Encountered errors with {error_count} files.")
    print(f"------------------------")

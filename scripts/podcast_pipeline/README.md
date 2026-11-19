# Automated Podcast Capture Pipeline

Checks `feeds.json` for new episodes, downloads the MP3 temporarily, uploads it to the Gemini File API, transcribes + extracts structured database records in one shot using `gemini-3.8-flash`, deletes the temporary MP3, and stages the result as `UNVERIFIED` in your database via `POST /api/admin/podcast-ingest`.

## Setup (Home PC)

1. Install dependencies:
   ```powershell
   cd scripts\podcast_pipeline
   pip install -r requirements.txt
   ```
2. Copy `.env.example` to `.env` and fill in:
   - `GEMINI_API_KEY`
   - `API_BASE_URL` (e.g. `https://innocence-archive-api.onrender.com/api`)
   - `PODCAST_INGEST_KEY` (must match `PODCAST_INGEST_KEY` in Render's `innocence-archive-api` environment variables)
3. Update `feeds.json` with the RSS URLs you want to monitor (`"active": true`).
4. Test with a dry run (writes JSON to `staged/` without touching the database):
   ```powershell
   python daily_capture.py --dry-run --limit 1
   ```
5. Run live:
   ```powershell
   python daily_capture.py --limit 3
   ```

## Daily Schedule (Windows Task Scheduler)

1. Open **Task Scheduler** → **Create Basic Task** → Daily (e.g. 6:00 AM).
2. Action: **Start a program**
   - Program/script: `python`
   - Add arguments: `daily_capture.py --limit 5`
   - Start in: `C:\path\to\innocence-archive\scripts\podcast_pipeline`
3. Review newly staged episodes and individuals in `/admin` (filter by **Unverified only**).

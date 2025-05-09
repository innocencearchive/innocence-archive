@echo off
setlocal enabledelayedexpansion

REM --- Configuration ---
set "AUDIO_FOLDER=C:\github\innocencearchive\scripts\podcast_project"
set "TRANSCRIPT_FOLDER=C:\github\innocencearchive\scripts\podcast_project\transcripts"
set "WHISPER_MODEL=base.en"
set "WHISPER_LANGUAGE=English"
set "AUDIO_EXTENSION=mp3" REM Change to m4a, wav, etc. if needed
REM --- End Configuration ---

REM Create output folder if it doesn't exist
if not exist "%TRANSCRIPT_FOLDER%" mkdir "%TRANSCRIPT_FOLDER%"

echo Starting batch transcription...

REM Loop through all audio files in the specified folder
for %%F in ("%AUDIO_FOLDER%\*.%AUDIO_EXTENSION%") do (
    echo Processing %%~nxF...
    py -m whisper "%%F" --model %WHISPER_MODEL% --language %WHISPER_LANGUAGE% --output_dir "%TRANSCRIPT_FOLDER%" --output_format txt
    echo Finished %%~nxF.
)

echo Batch transcription complete.
pause
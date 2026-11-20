@echo off
setlocal
cd /d "%~dp0"
if not exist "logs" mkdir "logs"

echo ======================================================================== >> "logs\capture.log"
echo [%date% %time%] Starting Innocence Archive Daily Podcast Capture >> "logs\capture.log"
echo ======================================================================== >> "logs\capture.log"

"C:\Python313\python.exe" -u daily_capture.py --limit 5 >> "logs\capture.log" 2>&1
set EXITCODE=%ERRORLEVEL%

echo [%date% %time%] Finished with exit code %EXITCODE% >> "logs\capture.log"
echo. >> "logs\capture.log"
exit /b %EXITCODE%

@echo off
echo Starting SAP CDS Watch Server in a separate window...
start "CDS Server" cmd /c "npx cds watch"
echo.
echo Waiting 5 seconds for the server to start up...
timeout /t 5 /nobreak > nul
echo.
echo Launching Playwright E2E UI Automation (Headed Chromium)...
node test-data/playwright_p2p.js
echo.
echo If the test has completed, you can close the CDS Server window.
pause

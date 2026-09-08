@echo off
setlocal
set "TMPPS=%TEMP%\kimivsgpt-install-%RANDOM%-%RANDOM%.ps1"
echo Downloading Kimi vs GPT Answer Auditor installer...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/syouziroupc/kimivsgpt/main/install-local.ps1' -OutFile '%TMPPS%'"
if errorlevel 1 goto :fail
powershell -NoProfile -ExecutionPolicy Bypass -File "%TMPPS%"
set "RC=%ERRORLEVEL%"
del /q "%TMPPS%" >nul 2>nul
if not "%RC%"=="0" goto :fail
echo.
echo Installation finished. Fully quit and restart ChatGPT Desktop.
pause
exit /b 0
:fail
echo.
echo Installation failed. See the error above.
del /q "%TMPPS%" >nul 2>nul
pause
exit /b 1

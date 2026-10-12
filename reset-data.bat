@echo off
setlocal
cd /d "%~dp0" || goto :failed

set "NEXA_USER_DATA=%APPDATA%\nexa-virtualpet"
set "NEXA_LEGACY_USER_DATA=%APPDATA%\gmp-desktop-pet"

echo This will reset NEXA's saved pet profile, encrypted API keys and personal memories,
echo uploaded custom sprites, and local appearance/settings preferences.
echo The NEXA VirtualPet app must be closed first.
echo.
choice /C YN /M "Reset this NEXA data and reopen setup"
if errorlevel 2 goto :cancelled
ver >nul

if exist "%NEXA_USER_DATA%\pet-setup.json" del /f /q "%NEXA_USER_DATA%\pet-setup.json"
if errorlevel 1 goto :failed
if exist "%NEXA_USER_DATA%\api-credentials.enc" del /f /q "%NEXA_USER_DATA%\api-credentials.enc"
if errorlevel 1 goto :failed
if exist "%NEXA_USER_DATA%\personal-memory.enc" del /f /q "%NEXA_USER_DATA%\personal-memory.enc"
if errorlevel 1 goto :failed
for %%F in ("%NEXA_USER_DATA%\pet-sprite-*") do if exist "%%~fF" del /f /q "%%~fF"
if errorlevel 1 goto :failed
if exist "%NEXA_USER_DATA%\Local Storage\" rmdir /s /q "%NEXA_USER_DATA%\Local Storage"
if errorlevel 1 goto :failed
if exist "%NEXA_LEGACY_USER_DATA%\" rmdir /s /q "%NEXA_LEGACY_USER_DATA%"
if errorlevel 1 goto :failed

echo.
echo NEXA saved data was reset. Starting setup...
call "%~dp0setup.bat"
exit /b %errorlevel%

:cancelled
echo Reset cancelled. No NEXA data was changed.
exit /b 0

:failed
echo.
echo NEXA data could not be completely reset. Close NEXA and check that you have permission to modify:
echo "%NEXA_USER_DATA%"
pause
exit /b 1

@echo off
setlocal
cd /d "%~dp0" || goto :failed

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Installing Node.js LTS...
  where winget >nul 2>nul
  if errorlevel 1 (
    echo Windows Package Manager is unavailable. Install Node.js 20 or later from https://nodejs.org/, then run this file again.
    goto :failed
  )
  winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements
  if errorlevel 1 (
    echo Node.js installation did not complete. Install Node.js 20 or later from https://nodejs.org/, then run this file again.
    goto :failed
  )
  if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
  if exist "%ProgramFiles%\nodejs\npm.cmd" set "PATH=%ProgramFiles%\nodejs;%PATH%"
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js with npm enabled, then run this file again.
  goto :failed
)

node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)"
if errorlevel 1 (
  echo Node.js 20 or later is required. Update Node.js from https://nodejs.org/ and run this file again.
  goto :failed
)

if not exist "package.json" (
  echo package.json was not found. Run this launcher from the NEXA project folder.
  goto :failed
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Installing NEXA dependencies. This can take several minutes...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :failed
)

if not exist "node_modules\robotjs\index.js" (
  echo Installing the WhatsApp desktop automation dependency...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :failed
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Electron was not downloaded during dependency installation. Retrying its install...
  call npm rebuild electron --no-audit --no-fund
  if errorlevel 1 goto :failed
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Electron is still missing. Check your internet connection, npm configuration, and antivirus quarantine.
  goto :failed
)

echo Starting NEXA VirtualPet from "%CD%"...
call npm start -- --setup
if errorlevel 1 goto :failed
exit /b 0

:failed
echo.
echo NEXA could not be started. Review the message above, then press any key to close.
pause >nul
exit /b 1

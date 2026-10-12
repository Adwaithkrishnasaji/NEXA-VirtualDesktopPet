# NEXA VirtualPet

## How to start the pet

### First run: setup.bat

Double-click `setup.bat` in the `NEXA VirtualPet` folder. It installs Node.js LTS through Windows Package Manager if Node.js is missing, verifies Node.js 20+, installs project dependencies if Electron or RobotJS is missing, and opens the setup window inside Electron. Enter the pet's preferences and save them; NEXA then creates the **NEXA VirtualPet** shortcut and starts the pet. If Windows Package Manager is unavailable, install Node.js 20 or later from [nodejs.org](https://nodejs.org/) and run `setup.bat` again.

`setup.bat` opens setup each time it is run. Existing saved settings are not replaced unless you complete and save the form.

### Reset development setup

Close the pet, then double-click `reset-data.bat` to remove NEXA's saved profile, encrypted provider keys, uploaded custom sprites, and local appearance/settings preferences. Confirm the prompt to reset; the launcher then starts `setup.bat` so you can test onboarding again. This does not remove project files or the desktop shortcut.

### Subsequent runs

After setup completes, double-click **NEXA VirtualPet** on your desktop. The shortcut starts the pet with its saved preferences; you do not need to run setup again. If the shortcut is unavailable, open PowerShell in the project folder and run `npm start`.

### Start from PowerShell

1. Install [Node.js 20 or later](https://nodejs.org/) if it is not already installed.
2. Open PowerShell in the `NEXA VirtualPet` folder and run:

   ```powershell
   npm install
   npm start
   ```

On the first launch, the Electron app automatically opens its setup window and asks for a pet name, Gemini API key, character style, and sprite. Do not open `setup.html` directly in Chrome or another browser: setup requires the app's secure Electron bridge. Complete setup in the Electron window to open the pet and create the Windows desktop shortcut. The Groq backup key and custom sprite are optional.

To change preferences later, use the pet's **Maintain and customize pet** setting, or run `setup.bat` again to reopen the full setup form.

See [NEXA_GUIDE.md](./NEXA_GUIDE.md) for features, maintenance, and customization details.

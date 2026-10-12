# NEXA VirtualPet

NEXA VirtualPet Beta 0.3.0-beta.1 is an Electron desktop pet with Gemini AI chat, optional Groq fallback, local pet controls, and optional voice and media features.

## First-run setup

On first launch, `setup.html` asks for a required pet name, Gemini API key, conversation character, and sprite selection, plus an optional Groq backup key, custom sprite, and feature interests. API keys are encrypted with Electron OS secure storage in the app's user-data folder. They are not stored in the plain-text setup file, browser storage, logs, or setup return values. If secure storage is unavailable, setup is blocked. Windows setup creates a NEXA VirtualPet shortcut on the user's desktop.

The setup character defaults to playful. Serious mode is off by default and remains off until the user enables it in Settings. Pet name, sprite, interests, theme, chat size, and mode preferences stay on the current device.

## Maintenance and sprites

Right-click the pet and choose **Customize pet**, or use **Maintain and customize pet** in Settings, to open `maintenance.html`. The maintenance page lets users change the pet name, choose among six animated sprites, select its conversational character, upload a custom sprite, and update/remove encrypted provider keys. Other appearance, voice, and serious-mode controls remain in the pet's Settings.

Sprite catalog: Pippa (rose bunny; ear wiggle and happy bounce), Bolt (sky-blue robot; antenna pulse and servo turn), Ember (tangerine fox; tail swish and playful pounce), Sprout (leaf-green frog; blink and hop), Luna (midnight cat; star shimmer and floating sway), and Sunny (golden chick; wing flap and cheerful bob). An uploaded custom image overrides the selected built-in sprite until the user switches back.

## Run

For onboarding, double-click `setup.bat` in the project folder. It installs Node.js LTS through Windows Package Manager if needed, checks for Node.js 20+, installs project dependencies if Electron is missing, and opens the setup form inside Electron. Completing the form saves preferences, creates the desktop shortcut, and starts the pet. Existing settings are preserved unless the form is successfully submitted. Use the desktop shortcut for subsequent starts, or run `npm start` from the project folder. Do not open `setup.html` directly in a browser.

For development testing, close NEXA and run `reset-data.bat`. After confirmation, it removes the saved profile, encrypted API keys and personal memories, uploaded sprites, and local settings, then starts setup again. Project files and the desktop shortcut are left in place.

## AI features

- Ask questions in the chat. Gemini is primary; Groq is used as a text-only backup if configured.
- Ask the pet to hide/show chat, resize its window, change supported settings, open or close apps it launched, search the web, or open supported websites. Launcher requests tolerate conversational wording such as `Hey, can you open WhatsApp?`. YouTube, Google, Instagram, and ChatGPT open in the default browser; Spotify and WhatsApp use their Windows app registrations where available.
- Use the expanded local desktop tools to create/list/complete tasks, create a new Desktop text file, list/search Desktop files, read a specifically requested small text file, copy explicitly selected text to the clipboard, inspect system status, battery and visible running apps, manage Wi-Fi, adjust supported screen brightness, lock the Windows workstation, open the Camera app, and schedule reminders. Desktop file tools do not delete, overwrite, move, rename, or upload files.
- Ask NEXA about current news, weather, or time-sensitive facts to retrieve live DuckDuckGo search results. Only the search query is sent to DuckDuckGo. Windows Wi-Fi toggling may require administrator permission; Bluetooth, Airplane mode, Night light, and Do not disturb open Windows Settings for the user to finish. Windows desktop PCs do not have a generic flashlight control API.
- Set alarms with `set an alarm at 07:30` or `alarm at 7:30 pm`; set reminders with `remind me to call home after 10 minutes` or `remind me take a break at 3:00 pm`. Alarms and reminders persist across restarts; when due, NEXA shows a Windows notification, opens the chat bubble, and plays an alert sound. NEXA must be running when they are due.
- Ask NEXA to update supported preferences in natural language: serious mode, spoken replies and volume, theme, chat height, position lock, and sprite offsets. The pet changes settings only on a direct request.
- Ask for YouTube or Spotify searches. Specific YouTube video IDs can be played in the in-chat player. Ask NEXA to play a song by name to search Spotify and start its top match, or say `next song` / `skip this song` to advance the active player.
- Combined requests such as `open Spotify and play Shape of You` are routed as Spotify playback requests, not as an application name.
- Requests such as `patt play cheyy` send the Windows media play/pause key to the active music player. This is a system-wide toggle and may pause playback if music is already playing. Spotify song playback requires Spotify Desktop; NEXA selects the matching song's Play control and verifies Spotify's now-playing title before reporting success.
- For YouTube song search and playback, add a YouTube Data API v3 key under Settings → AI provider keys. NEXA searches YouTube's music category, plays the most relevant match in its embedded player, and queues up to four additional matches for `next song`. The key is encrypted with OS secure storage and can be removed from Settings.
- Asking to open WhatsApp launches the installed WhatsApp Desktop app on Windows. NEXA can open a requested chat using WhatsApp search. A directly requested message is sent automatically to the exact chat name or international phone number and with the exact text supplied by the user. NEXA verifies the exact chat and draft and invokes WhatsApp's accessible Send button; if the chat is missing, ambiguous, or the draft/button cannot be verified, it does not send.
- Explicit requests such as `Send "I will arrive soon" to +14155552671` are handled directly without a confirmation dialog. The current user message must explicitly ask to send and contain the exact recipient and message; NEXA will not infer details from context or memories.
- Attach up to four images (20 MB total), share a selected screen/window, take a camera snapshot, or generate an image.
- Optional speech input uses the browser's SpeechRecognition support. Spoken replies use Edge TTS; replies are silent by default.
- Gemini and Groq can request the local application, browser, media, WhatsApp, task, Desktop-file, clipboard, system, Wi-Fi, Bluetooth, reminder, calculation, and pet-control actions through NEXA's validated tool handlers. WhatsApp sends run automatically only after the current message explicitly specifies the recipient and exact text.
- NEXA remembers explicit personal details and preferences shared in chat, including favorites. Memories are encrypted with Windows secure storage on this device and persist across restarts. Review or delete individual memories in Settings → Personal memory, ask NEXA what it remembers, or ask it to forget a detail. Relevant memories may be included in chat requests sent to the configured AI provider to personalize answers. Passwords, access tokens, and financial account details are not stored as memories.
- Serious mode provides direct, professional answers and suppresses the pet's playful tone.

## APPU and NEXA: advantages and disadvantages

Both pets can now use local desktop tools for app/site control, media, tasks, Desktop files, system status, connectivity settings, reminders, clipboard actions, and pet preferences. The implementation and interaction model still differ.

| Pet | Advantages | Disadvantages |
| --- | --- | --- |
| **APPU Cherukunnel** | Broader Windows app discovery and process tracking; its Agent Dock includes quick Focus, Tasks, System, Files, Calculator, and Help actions; explicitly requested WhatsApp messages can be sent automatically. | Requests to prepare WhatsApp drafts still require the user to send them; it has less guided first-run setup and fewer built-in sprite/appearance options than NEXA. |
| **NEXA VirtualPet** | Guided setup and maintenance, customizable sprites and settings, encrypted provider keys and personal memories, verified Spotify playback, an embedded YouTube music player, persistent reminders, and automatic WhatsApp sending for explicitly specified recipients and messages. | Desktop automation is Windows-specific; YouTube music search/playback requires a YouTube Data API key; its app discovery and quick-action dock are not as extensive as APPU's. |

Both pets send only when the user explicitly requests sending and provides the exact recipient and message; neither infers missing message details.

Online features send the relevant prompts, images, or search details to the selected third-party service. Screen sharing and camera snapshots happen only after the user presses their respective controls; inspect attached images before sending them. API usage may incur provider charges.

## Pet controls

The pet can open installed applications by name and only close app instances tracked as launched by NEXA. It also supports `dance`, `hide chat`, `show chat`, `increase chat window size`, `set chat window to 450 px`, position locking, theme changes, and restart. The chat closes and the pet sleeps after one minute without in-app activity; click the pet to wake it.

## Personal-data boundary

This commercial copy does not include prior personal memory, identity, portraits, personal API keys, or personal conversation history. Manglish personality phrases are generic and can be disabled by switching to serious mode.

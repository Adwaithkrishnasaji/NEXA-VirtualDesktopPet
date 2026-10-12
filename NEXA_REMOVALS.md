# NEXA cleanup inventory

This inventory records categories of material removed from the commercial copy. It intentionally does not reproduce personal values, dialogue, or credential contents.

## Personal material and branding

- Cleared and removed the copied memory store, including its saved user identity, preferences, and personal facts.
- Removed the six supplied portrait images (`Logo.jpg` and `Logo_2.jpg` through `Logo_6.jpg`) and replaced their use with a newly drawn generic SVG mascot.
- Removed the original pet name, personal identity, and associated branding from the UI, code, and product guide; the product is now labeled NEXA VirtualPet.
- Removed the original personalized Malayalam/Manglish personality text, personal greetings, idle lines, and canned responses. Generic Manglish phrases were later restored.
- Removed the original AI personality/serious response modes and later restored generic personality and serious modes.
- Removed the old product guide that described the personalized product.

## Credentials and external services

- Deleted the copied `.env` file without retaining or recording any credential values.
- Gemini and Groq AI chat, tool calling, image generation, Edge TTS, browser speech dictation, and speech-language detection were initially removed and have since been restored.
- YouTube/Spotify search, an in-chat YouTube player, WhatsApp draft creation, website shortcuts, and web search were initially removed and have since been restored.
- Screen/window and camera capture and image attachments were initially removed and have since been restored.
- The Google GenAI SDK, Groq SDK, and Edge TTS package were initially removed and have since been restored.

## Replaced application files

- Rebuilt `main.js`, `preload.js`, `renderer.js`, `localActions.js`, and `index.html` during the offline-only edition.
- `tools.js`, `speechLanguage.js`, and `idleQuotes.js` have since been restored. The copied personal `memory.js` and `memory.json` remain excluded.
- Replaced `APPU_GUIDE.md` with `NEXA_GUIDE.md`.

The remaining application retains its Electron desktop window, generic pet appearance, local settings, window positioning, animation, and guarded local application launch/close controls.

## First-run setup

- Added an in-app setup page requiring a new pet name, Gemini API key, character style, and built-in sprite selection, accepting an optional Groq key and user-provided sprite, and recording optional feature interests.
- API keys are encrypted using OS secure storage and kept separately from pet setup. Personal credentials, photos, identity, memory, and conversation history remain excluded.
- Added the NEXA Beta 0.3.0-beta.1 release label.
- Added a Windows desktop shortcut after successful first-run setup.
- Added a maintenance page for changing the pet name, conversation character, sprite, and encrypted provider keys.
- Added six original animated SVG sprites: Pippa (bunny), Bolt (robot), Ember (fox), Sprout (frog), Luna (cat), and Sunny (chick).

const speechBubble = document.getElementById('speech-bubble');
const petButton = document.getElementById('pet-button');
const petImage = document.getElementById('pet-image');
const conversation = document.getElementById('conversation');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const settingsButton = document.getElementById('settings-button');
const settingsPanel = document.getElementById('settings-panel');
const chatHeightInput = document.getElementById('chat-height');
const chatHeightValue = document.getElementById('chat-height-value');
const themeInput = document.getElementById('color-theme');
const positionLockedInput = document.getElementById('position-locked');
const spriteOffsetXInput = document.getElementById('sprite-offset-x');
const spriteOffsetYInput = document.getElementById('sprite-offset-y');
const spriteOffsetXValue = document.getElementById('sprite-offset-x-value');
const spriteOffsetYValue = document.getElementById('sprite-offset-y-value');
const agentState = document.getElementById('agent-state');
const modelVersion = document.getElementById('model-version');
const seriousModeInput = document.getElementById('serious-mode');
const voiceEnabledInput = document.getElementById('voice-enabled');
const voiceVolumeInput = document.getElementById('voice-volume');
const voiceVolumeValue = document.getElementById('voice-volume-value');
const imageFileInput = document.getElementById('image-file-input');
const youtubePlayer = document.getElementById('youtube-player');
const youtubeFrame = document.getElementById('youtube-frame');
const youtubePlayerTitle = document.getElementById('youtube-player-title');
const appInputDialog = document.getElementById('app-input-dialog');
const messageImages = [];
const chatHistory = [];
const STORAGE_KEY = 'nexa-virtualpet-settings';
const LEGACY_STORAGE_KEY = 'gmp-desktop-pet-settings';
const DEFAULT_SETTINGS = {
  chatHeight: 350,
  theme: 'lavender',
  positionLocked: false,
  spriteOffsetX: 0,
  spriteOffsetY: 0,
  seriousMode: false,
  voiceEnabled: false,
  voiceVolume: 80,
};
let nextRequestId = 0;
let activeResponse;
let recognition;
let recognitionActive = false;

let settings = loadSettings();
let chatOpen = false;
let lastActivity = Date.now();
let sleepTimer;
let dragStart;
let suppressPetClick = false;
let hasGreeted = false;

function loadSettings() {
  try {
    const storedSettings = localStorage.getItem(STORAGE_KEY);
    const saved = JSON.parse(storedSettings ?? localStorage.getItem(LEGACY_STORAGE_KEY) ?? '{}');
    if (storedSettings === null && localStorage.getItem(LEGACY_STORAGE_KEY) !== null) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      chatHeight: clampNumber(saved.chatHeight, 300, 620, DEFAULT_SETTINGS.chatHeight),
      spriteOffsetX: clampNumber(saved.spriteOffsetX, -100, 100, 0),
      spriteOffsetY: clampNumber(saved.spriteOffsetY, -100, 100, 0),
      theme: ['lavender', 'ocean', 'mint', 'sunset', 'dark'].includes(saved.theme)
        ? saved.theme
        : DEFAULT_SETTINGS.theme,
      positionLocked: saved.positionLocked === true,
      seriousMode: saved.seriousMode === true,
      voiceEnabled: saved.voiceEnabled === true,
      voiceVolume: clampNumber(saved.voiceVolume, 0, 100, DEFAULT_SETTINGS.voiceVolume),
    };
  } catch (error) {
    console.error('Could not load pet settings:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

function clampNumber(value, minimum, maximum, fallback) {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function applySettings() {
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.style.setProperty('--chat-height', `${settings.chatHeight}px`);
  document.documentElement.style.setProperty('--sprite-offset-x', `${settings.spriteOffsetX}px`);
  document.documentElement.style.setProperty('--sprite-offset-y', `${settings.spriteOffsetY}px`);
  chatHeightInput.value = String(settings.chatHeight);
  chatHeightValue.value = `${settings.chatHeight} px`;
  themeInput.value = settings.theme;
  positionLockedInput.checked = settings.positionLocked;
  spriteOffsetXInput.value = String(settings.spriteOffsetX);
  spriteOffsetYInput.value = String(settings.spriteOffsetY);
  spriteOffsetXValue.value = `${settings.spriteOffsetX} px`;
  spriteOffsetYValue.value = `${settings.spriteOffsetY} px`;
  seriousModeInput.checked = settings.seriousMode;
  voiceEnabledInput.checked = settings.voiceEnabled;
  voiceVolumeInput.value = String(settings.voiceVolume);
  voiceVolumeValue.value = `${settings.voiceVolume}%`;
  window.nexaApi.setPositionLocked(settings.positionLocked);
  window.nexaApi.setChatHeight(settings.chatHeight).catch((error) => {
    appendMessage(`Could not apply the chat size: ${error.message}`, 'message-error');
  });

  document.getElementById('open-maintenance').addEventListener('click', async () => {
    try {
      await window.nexaApi.openMaintenance();
    } catch (error) {
      appendMessage(`Could not open maintenance: ${error.message}`, 'message-error');
    }
  });
}

function appendMessage(text, className) {
  const message = document.createElement('p');
  message.className = `message ${className}`;
  message.textContent = text;
  conversation.append(message);
  conversation.scrollTop = conversation.scrollHeight;
  return message;
}

function appendImageMessage(dataUrl, className) {
  const message = document.createElement('p');
  message.className = `message ${className}`;
  const image = document.createElement('img');
  image.className = 'attached-preview';
  image.src = dataUrl;
  image.alt = 'Image attached to chat';
  message.append(image);
  conversation.append(message);
  conversation.scrollTop = conversation.scrollHeight;
  return message;
}

function setBusy(busy) {
  sendButton.disabled = busy;
  agentState.textContent = busy ? 'Thinking' : 'Ready';
}

function addThinkingMessage() {
  const message = document.createElement('p');
  message.className = 'message pet-message';
  message.setAttribute('aria-label', 'Thinking');
  const indicator = document.createElement('span');
  indicator.className = 'thinking';
  for (let dot = 0; dot < 3; dot += 1) indicator.append(document.createElement('span'));
  message.append(indicator);
  conversation.append(message);
  conversation.scrollTop = conversation.scrollHeight;
  return message;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const encoded = String(reader.result).split(',')[1];
      if (!encoded) reject(new Error('Could not read the selected image.'));
      else resolve(encoded);
    };
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

function displayImage(data, mimeType, altText) {
  const message = document.createElement('p');
  message.className = 'message pet-message';
  const image = document.createElement('img');
  image.className = 'attached-preview';
  image.src = `data:${mimeType};base64,${data}`;
  image.alt = altText;
  message.append(image);
  conversation.append(message);
  conversation.scrollTop = conversation.scrollHeight;
}

async function speakReply(text) {
  if (!settings.voiceEnabled) return;
  try {
    const encodedAudio = await window.nexaApi.speakText(text);
    const audio = new Audio(`data:audio/mpeg;base64,${encodedAudio}`);
    audio.volume = settings.voiceVolume / 100;
    await audio.play();
  } catch (error) {
    appendMessage(`Could not play the voice reply: ${error.message}`, 'message-error');
  }
}

async function askAI(text) {
  const requestId = ++nextRequestId;
  const attachments = messageImages.splice(0);
  const waitingMessage = addThinkingMessage();
  activeResponse = { requestId, message: waitingMessage };
  setBusy(true);
  try {
    const response = await window.nexaApi.requestAI(
      text,
      chatHistory.slice(-8),
      requestId,
      attachments,
      settings.seriousMode,
    );
    waitingMessage.textContent = response.reply;
    chatHistory.push({ role: 'user', parts: [{ text }] });
    chatHistory.push({ role: 'model', parts: [{ text: response.reply }] });
    if (chatHistory.length > 16) chatHistory.splice(0, chatHistory.length - 16);
    void speakReply(response.reply);
  } catch (error) {
    waitingMessage.textContent = `Could not get an AI response: ${error.message}`;
    waitingMessage.classList.add('message-error');
  } finally {
    activeResponse = undefined;
    setBusy(false);
  }
}

window.nexaApi.onAIStream(({ requestId, reply }) => {
  if (!activeResponse || activeResponse.requestId !== requestId || typeof reply !== 'string') return;
  activeResponse.message.textContent = reply;
  conversation.scrollTop = conversation.scrollHeight;
});

window.nexaApi.onPetControlRequest(async ({ requestId, action, height, value, setting, videoId, playlist, title }) => {
  try {
    let message;
    if (action === 'hideChat') {
      setChatOpen(false);
      message = 'Chat hidden.';
    } else if (action === 'showChat') {
      setChatOpen(true);
      message = 'Chat shown.';
    } else if (action === 'resizeChat') {
      settings.chatHeight = clampNumber(height, 300, 620, settings.chatHeight);
      saveSettings();
      applySettings();
      message = `Chat resized to ${settings.chatHeight} pixels.`;
    } else if (action === 'setSeriousMode') {
      settings.seriousMode = value === true || value === 'true' || value === 'on';
      saveSettings();
      applySettings();
      message = `Serious mode ${settings.seriousMode ? 'enabled' : 'disabled'}.`;
    } else if (action === 'setVoiceEnabled') {
      settings.voiceEnabled = value === true || value === 'true' || value === 'on';
      saveSettings();
      applySettings();
      message = `Spoken replies ${settings.voiceEnabled ? 'enabled' : 'disabled'}.`;
    } else if (action === 'setVoiceVolume') {
      settings.voiceVolume = clampNumber(Number(value), 0, 100, settings.voiceVolume);
      saveSettings();
      applySettings();
      message = `Voice volume set to ${settings.voiceVolume} percent.`;
    } else if (action === 'updateSetting') {
      const booleanSettings = new Set(['seriousMode', 'voiceEnabled', 'positionLocked']);
      const numericSettings = {
        chatHeight: [300, 620],
        voiceVolume: [0, 100],
        spriteOffsetX: [-100, 100],
        spriteOffsetY: [-100, 100],
      };
      if (setting === 'theme') {
        if (!['lavender', 'ocean', 'mint', 'sunset', 'dark'].includes(value)) throw new Error('Choose a supported theme.');
        settings.theme = value;
      } else if (booleanSettings.has(setting)) {
        if (![true, false, 'true', 'false', 'on', 'off'].includes(value)) throw new Error('Choose true or false.');
        settings[setting] = value === true || value === 'true' || value === 'on';
      } else if (Object.hasOwn(numericSettings, setting)) {
        const numericValue = Number(value);
        const [minimum, maximum] = numericSettings[setting];
        if (!Number.isInteger(numericValue) || numericValue < minimum || numericValue > maximum) {
          throw new Error(`${setting} must be an integer from ${minimum} to ${maximum}.`);
        }
        settings[setting] = numericValue;
      } else {
        throw new Error('That pet setting is not supported.');
      }
      saveSettings();
      applySettings();
      message = `${setting} updated.`;
    } else if (action === 'playYouTubeVideo') {
      if (!/^[A-Za-z0-9_-]{11}$/.test(videoId ?? '')) throw new Error('Choose a valid YouTube video ID.');
      const playlistParameter = typeof playlist === 'string' && playlist
        ? `&playlist=${encodeURIComponent(playlist)}`
        : '';
      youtubeFrame.src = `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&autoplay=1${playlistParameter}`;
      youtubePlayerTitle.textContent = typeof title === 'string' ? title : `YouTube video ${videoId}`;
      youtubePlayer.hidden = false;
      message = `Playing YouTube match: ${youtubePlayerTitle.textContent}.`;
    } else if (action === 'controlYouTubePlayer') {
      if (youtubePlayer.hidden || !youtubeFrame.contentWindow) throw new Error('There is no YouTube video open in the pet chat.');
      const functions = { play: 'playVideo', pause: 'pauseVideo', stop: 'stopVideo', next: 'nextVideo' };
      const command = functions[value];
      if (!command) throw new Error('That YouTube player action is not supported.');
      youtubeFrame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: command, args: [] }), 'https://www.youtube-nocookie.com');
      message = `YouTube video ${value} requested.`;
    } else {
      throw new Error('That pet setting is not supported.');
    }
    window.nexaApi.reportPetControlResult(requestId, null, { success: true, message });
  } catch (error) {
    window.nexaApi.reportPetControlResult(requestId, error.message);
  }
});

document.getElementById('close-youtube-player').addEventListener('click', () => {
  youtubeFrame.src = 'about:blank';
  youtubePlayer.hidden = true;
});

youtubePlayer.querySelectorAll('[data-youtube-action]').forEach((button) => {
  button.addEventListener('click', () => {
    const functions = { play: 'playVideo', pause: 'pauseVideo', stop: 'stopVideo', next: 'nextVideo' };
    const command = functions[button.dataset.youtubeAction];
    youtubeFrame.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: command, args: [] }), 'https://www.youtube-nocookie.com');
  });
});

function setChatOpen(open) {
  chatOpen = open;
  speechBubble.hidden = !open;
  petButton.setAttribute('aria-expanded', String(open));
  window.nexaApi.setMouseInteractive(open);
  if (open) {
    petImage.classList.remove('sleeping');
    clearTimeout(sleepTimer);
    lastActivity = Date.now();
    if (!hasGreeted && !settings.seriousMode && Array.isArray(window.petIdleQuotes) && window.petIdleQuotes.length) {
      appendMessage(window.petIdleQuotes[Math.floor(Math.random() * window.petIdleQuotes.length)], 'pet-message');
    }
    hasGreeted = true;
    messageInput.focus();
  } else {
    settingsPanel.hidden = true;
    settingsButton.setAttribute('aria-expanded', 'false');
  }
}

function noteActivity() {
  lastActivity = Date.now();
  clearTimeout(sleepTimer);
  sleepTimer = setTimeout(() => {
    if (sendButton.disabled) {
      noteActivity();
      return;
    }
    if (Date.now() - lastActivity >= 60_000) {
      if (chatOpen) setChatOpen(false);
      petImage.classList.add('sleeping');
      return;
    }
    noteActivity();
  }, 60_000);
}

function requestAppInput({ title, description, label, options, value = '', submitLabel = 'Continue' }) {
  const titleElement = document.getElementById('app-input-title');
  const descriptionElement = document.getElementById('app-input-description');
  const labelElement = document.getElementById('app-input-label');
  const textField = document.getElementById('app-input-field');
  const selectField = document.getElementById('app-input-select');
  const selectMode = Array.isArray(options);
  titleElement.textContent = title;
  descriptionElement.textContent = description;
  labelElement.textContent = label;
  textField.hidden = selectMode;
  textField.required = !selectMode;
  selectField.hidden = !selectMode;
  selectField.replaceChildren();
  if (selectMode) {
    for (const [index, option] of options.entries()) {
      const element = document.createElement('option');
      element.value = String(index);
      element.textContent = option;
      selectField.append(element);
    }
    selectField.value = value || '0';
  } else {
    textField.value = value;
    textField.maxLength = 2000;
  }
  appInputDialog.querySelector('button[value="accept"]').textContent = submitLabel;

  return new Promise((resolve) => {
    document.getElementById('app-input-cancel').onclick = () => appInputDialog.close('cancel');
    appInputDialog.addEventListener('close', () => {
      const accepted = appInputDialog.returnValue === 'accept';
      resolve(accepted ? (selectMode ? selectField.value : textField.value.trim()) : undefined);
    }, { once: true });
    appInputDialog.showModal();
    (selectMode ? selectField : textField).focus();
  });
}

async function refreshPersonalMemories() {
  const memoryList = document.getElementById('personal-memory-list');
  memoryList.replaceChildren();
  try {
    const { memories } = await window.nexaApi.listPersonalMemories();
    if (!memories.length) {
      memoryList.textContent = 'No saved memories.';
      return;
    }
    for (const memory of memories) {
      const item = document.createElement('div');
      item.className = 'personal-memory-item';
      const text = document.createElement('span');
      text.textContent = `${memory.category}: ${memory.value}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Delete';
      remove.setAttribute('aria-label', `Delete memory ${memory.category}`);
      remove.addEventListener('click', async () => {
        try {
          await window.nexaApi.deletePersonalMemory(memory.id);
          await refreshPersonalMemories();
        } catch (error) {
          appendMessage(`Could not delete memory: ${error.message}`, 'message-error');
        }
      });
      item.append(text, remove);
      memoryList.append(item);
    }
  } catch (error) {
    memoryList.textContent = `Could not load memories: ${error.message}`;
  }
}

async function handleMessage(text) {
  const normalized = window.normalizeLocalCommand(text).replace(/[.!?]+$/, '').trim();
  const localCommand = window.parseLocalCommand(text);
  const spotifyPlayRequest = window.parseSpotifyPlayRequest(text);
  const whatsappRequest = window.parseWhatsAppSendRequest(text, chatHistory);

  let timerIntent;
  try {
    timerIntent = await window.nexaApi.parseTimerIntent(text);
  } catch (error) {
    appendMessage(`Could not parse the timer request: ${error.message}`, 'message-error');
    return;
  }
  if (timerIntent) {
    setBusy(true);
    try {
      await window.nexaApi.scheduleReminder(timerIntent.message, timerIntent.dateTime, timerIntent.type);
      appendMessage(
        timerIntent.type === 'alarm'
          ? 'Alarm set cheythittundu, samayathu ezhunnettekkane!'
          : 'Reminder lock cheythu, marakkilla!',
        'pet-message',
      );
    } catch (error) {
      appendMessage(`Could not set the timer: ${error.message}`, 'message-error');
    } finally {
      setBusy(false);
    }
    return;
  }

  if (whatsappRequest) {
    setBusy(true);
    const pending = appendMessage(`Sending WhatsApp message to ${whatsappRequest.recipient}…`, 'pet-message');
    try {
      const result = await window.nexaApi.sendWhatsAppMessage(
        whatsappRequest.recipient,
        whatsappRequest.message,
        text,
        chatHistory,
      );
      pending.textContent = result.sent
        ? result.message
        : 'WhatsApp did not verify that the message was sent.';
      if (!result.sent) pending.classList.add('message-error');
    } catch (error) {
      pending.textContent = `Could not send WhatsApp message: ${error.message}`;
      pending.classList.add('message-error');
    }
    return;
  }

  if (spotifyPlayRequest) {
    setBusy(true);
    const pending = appendMessage(`Searching Spotify for "${spotifyPlayRequest.song}"…`, 'pet-message');
    try {
      const result = await window.nexaApi.playSpotifyMusic(spotifyPlayRequest.song);
      pending.textContent = result.message;
    } catch (error) {
      pending.textContent = `Could not play "${spotifyPlayRequest.song}" in Spotify: ${error.message}`;
      pending.classList.add('message-error');
    } finally {
      setBusy(false);
    }
    return;
  }

  if (/\b(?:increase|enlarge|expand|grow|bigger)\b.*\b(?:chat|window)\b|\b(?:chat|window)\b.*\b(?:increase|enlarge|expand|grow|bigger)\b/.test(normalized)) {
    await changeChatHeight(60);
    return;
  }
  if (/\b(?:decrease|reduce|shrink|smaller)\b.*\b(?:chat|window)\b|\b(?:chat|window)\b.*\b(?:decrease|reduce|shrink|smaller)\b/.test(normalized)) {
    await changeChatHeight(-60);
    return;
  }
  const requestedHeight = /\b(?:set|resize)\b.*\b(?:chat|window)\b.*?(\d{3})\s*(?:px|pixels)?\b/.exec(normalized);
  if (requestedHeight) {
    settings.chatHeight = clampNumber(Number(requestedHeight[1]), 300, 620, settings.chatHeight);
    saveSettings();
    applySettings();
    appendMessage(`Chat height set to ${settings.chatHeight} pixels.`, 'pet-message');
    return;
  }
  if (/^(?:lock|unlock)\s+(?:the\s+)?(?:pet(?:\s+position)?|position)$/.test(normalized)) {
    settings.positionLocked = normalized.startsWith('lock ');
    saveSettings();
    applySettings();
    appendMessage(`Pet position ${settings.positionLocked ? 'locked' : 'unlocked'}.`, 'pet-message');
    return;
  }
  if (/^(?:reset|restore)\s+(?:the\s+)?(?:pet\s+)?position$/.test(normalized)) {
    await window.nexaApi.resetWindowPosition();
    appendMessage('Pet position reset.', 'pet-message');
    return;
  }
  if (/^(?:restart|relaunch)\s+(?:the\s+)?pet$/.test(normalized)) {
    await window.nexaApi.restartPet();
    return;
  }
  const requestedTheme = /\b(?:set|change)\s+(?:the\s+)?theme\s+to\s+(lavender|ocean|mint|sunset|dark)\b/.exec(normalized);
  if (requestedTheme) {
    settings.theme = requestedTheme[1];
    saveSettings();
    applySettings();
    appendMessage(`Theme changed to ${settings.theme}.`, 'pet-message');
    return;
  }
  if (/^(?:hide|close)\s+(?:the\s+)?chat(?:\s+window)?$/.test(normalized)) {
    appendMessage('Chat closed.', 'pet-message');
    setChatOpen(false);
    return;
  }
  if (/^(?:show|open)\s+(?:the\s+)?chat(?:\s+window)?$/.test(normalized)) {
    appendMessage('Chat opened.', 'pet-message');
    setChatOpen(true);
    return;
  }
  if (/^(?:dance|dance please|do a dance)$/.test(normalized)) {
    await performDance();
    return;
  }
  if (localCommand?.action === 'launch') {
    const pending = appendMessage(`Opening ${localCommand.target}…`, 'pet-message');
    try {
      const result = await window.nexaApi.launchApp(localCommand.target);
      pending.textContent = result.message;
    } catch (error) {
      pending.textContent = error.message;
      pending.classList.add('message-error');
    }
    return;
  }
  if (localCommand?.action === 'close') {
    const pending = appendMessage(`Closing ${localCommand.target}…`, 'pet-message');
    try {
      await window.nexaApi.closeApp(localCommand.target);
      pending.textContent = `Closed ${localCommand.target}.`;
    } catch (error) {
      pending.textContent = error.message;
      pending.classList.add('message-error');
    }
    return;
  }
  if (/^(?:what time is it|what is the time|time now)$/.test(normalized)) {
    appendMessage(`Local time: ${new Date().toLocaleTimeString()}.`, 'pet-message');
    return;
  }
  if (/^(?:what is the date|what date is it|today's date)$/.test(normalized)) {
    appendMessage(`Local date: ${new Date().toLocaleDateString()}.`, 'pet-message');
    return;
  }
  await askAI(text);
}

async function changeChatHeight(amount) {
  settings.chatHeight = clampNumber(settings.chatHeight + amount, 300, 620, settings.chatHeight);
  saveSettings();
  document.documentElement.style.setProperty('--chat-height', `${settings.chatHeight}px`);
  chatHeightInput.value = String(settings.chatHeight);
  chatHeightValue.value = `${settings.chatHeight} px`;
  try {
    await window.nexaApi.setChatHeight(settings.chatHeight);
    appendMessage(`Chat height set to ${settings.chatHeight} pixels.`, 'pet-message');
  } catch (error) {
    appendMessage(`Could not resize chat: ${error.message}`, 'message-error');
  }
}

async function performDance() {
  const wasChatOpen = chatOpen;
  if (wasChatOpen) setChatOpen(false);
  petImage.classList.remove('sleeping');
  petImage.classList.add('dancing');
  await new Promise((resolve) => setTimeout(resolve, 1800));
  petImage.classList.remove('dancing');
  if (wasChatOpen) setChatOpen(true);
}

petButton.addEventListener('click', () => {
  if (suppressPetClick) {
    suppressPetClick = false;
    return;
  }
  setChatOpen(!chatOpen);
  noteActivity();
});

petButton.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  window.nexaApi.showContextMenu();
});

petButton.addEventListener('mouseenter', () => {
  if (!chatOpen) window.nexaApi.setMouseInteractive(true);
});

petButton.addEventListener('mouseleave', () => {
  if (!chatOpen) window.nexaApi.setMouseInteractive(false);
});

petButton.addEventListener('mousedown', (event) => {
  if (event.button !== 0 || settings.positionLocked) return;
  dragStart = { x: event.screenX, y: event.screenY };
  suppressPetClick = false;
  window.nexaApi.startWindowDrag(event.screenX, event.screenY);
});

window.addEventListener('mousemove', (event) => {
  if (!dragStart) return;
  if (Math.abs(event.screenX - dragStart.x) > 4 || Math.abs(event.screenY - dragStart.y) > 4) {
    suppressPetClick = true;
  }
});

window.addEventListener('mouseup', () => {
  if (!dragStart) return;
  window.nexaApi.endWindowDrag();
  dragStart = undefined;
});

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text || sendButton.disabled) return;
  noteActivity();
  appendMessage(text, 'user-message');
  messageInput.value = '';
  try {
    await handleMessage(text);
  } catch (error) {
    appendMessage(`Could not complete that request: ${error.message}`, 'message-error');
  } finally {
    if (!activeResponse) setBusy(false);
    messageInput.focus();
    noteActivity();
  }
});

document.getElementById('close-chat').addEventListener('click', () => setChatOpen(false));

settingsButton.addEventListener('click', () => {
  settingsPanel.hidden = !settingsPanel.hidden;
  settingsButton.setAttribute('aria-expanded', String(!settingsPanel.hidden));
  if (!settingsPanel.hidden) void refreshPersonalMemories();
  noteActivity();
});

document.getElementById('refresh-personal-memory').addEventListener('click', () => {
  void refreshPersonalMemories();
});

document.getElementById('clear-personal-memory').addEventListener('click', async () => {
  if (!window.confirm('Delete every saved personal memory? This cannot be undone.')) return;
  try {
    await window.nexaApi.clearPersonalMemories();
    await refreshPersonalMemories();
    appendMessage('All personal memories were deleted.', 'pet-message');
  } catch (error) {
    appendMessage(`Could not delete memories: ${error.message}`, 'message-error');
  }
});

themeInput.addEventListener('change', () => {
  settings.theme = themeInput.value;
  saveSettings();
  applySettings();
  noteActivity();
});

chatHeightInput.addEventListener('input', () => {
  settings.chatHeight = Number(chatHeightInput.value);
  chatHeightValue.value = `${settings.chatHeight} px`;
  document.documentElement.style.setProperty('--chat-height', `${settings.chatHeight}px`);
});

chatHeightInput.addEventListener('change', () => {
  saveSettings();
  window.nexaApi.setChatHeight(settings.chatHeight).catch((error) => {
    appendMessage(`Could not resize chat: ${error.message}`, 'message-error');
  });
  noteActivity();
});

spriteOffsetXInput.addEventListener('input', () => {
  settings.spriteOffsetX = Number(spriteOffsetXInput.value);
  spriteOffsetXValue.value = `${settings.spriteOffsetX} px`;
  document.documentElement.style.setProperty('--sprite-offset-x', `${settings.spriteOffsetX}px`);
  saveSettings();
});

spriteOffsetYInput.addEventListener('input', () => {
  settings.spriteOffsetY = Number(spriteOffsetYInput.value);
  spriteOffsetYValue.value = `${settings.spriteOffsetY} px`;
  document.documentElement.style.setProperty('--sprite-offset-y', `${settings.spriteOffsetY}px`);
  saveSettings();
});

positionLockedInput.addEventListener('change', () => {
  settings.positionLocked = positionLockedInput.checked;
  saveSettings();
  window.nexaApi.setPositionLocked(settings.positionLocked);
});

document.getElementById('reset-position').addEventListener('click', async () => {
  try {
    await window.nexaApi.resetWindowPosition();
    appendMessage('Pet position reset.', 'pet-message');
  } catch (error) {
    appendMessage(`Could not reset position: ${error.message}`, 'message-error');
  }
});

document.getElementById('restart-pet').addEventListener('click', () => {
  window.nexaApi.restartPet().catch((error) => {
    appendMessage(`Could not restart: ${error.message}`, 'message-error');
  });
});

seriousModeInput.addEventListener('change', () => {
  settings.seriousMode = seriousModeInput.checked;
  saveSettings();
  noteActivity();
});

voiceEnabledInput.addEventListener('change', () => {
  settings.voiceEnabled = voiceEnabledInput.checked;
  saveSettings();
  noteActivity();
});

voiceVolumeInput.addEventListener('input', () => {
  settings.voiceVolume = Number(voiceVolumeInput.value);
  voiceVolumeValue.value = `${settings.voiceVolume}%`;
});

voiceVolumeInput.addEventListener('change', () => {
  saveSettings();
  noteActivity();
});

document.getElementById('save-provider-keys').addEventListener('click', async () => {
  try {
    const status = await window.nexaApi.updateCredentials({
      geminiApiKey: document.getElementById('settings-gemini-key').value.trim(),
      groqApiKey: document.getElementById('settings-groq-key').value.trim(),
      youtubeApiKey: document.getElementById('settings-youtube-key').value.trim(),
    });
    document.getElementById('settings-gemini-key').value = '';
    document.getElementById('settings-groq-key').value = '';
    document.getElementById('settings-youtube-key').value = '';
    appendMessage(`API keys updated. Gemini: ${status.geminiConfigured ? 'ready' : 'missing'}; Groq backup: ${status.groqConfigured ? 'ready' : 'not configured'}; YouTube: ${status.youtubeConfigured ? 'ready' : 'not configured'}.`, 'pet-message');
  } catch (error) {
    appendMessage(`Could not update API keys: ${error.message}`, 'message-error');
  }
  noteActivity();
});

document.getElementById('remove-backup-key').addEventListener('click', async () => {
  if (!window.confirm('Remove the saved Groq backup key? Gemini will remain configured.')) return;
  try {
    await window.nexaApi.updateCredentials({ groqApiKey: null });
    appendMessage('Groq backup key removed.', 'pet-message');
  } catch (error) {
    appendMessage(`Could not remove the backup key: ${error.message}`, 'message-error');
  }
  noteActivity();
});

document.getElementById('remove-youtube-key').addEventListener('click', async () => {
  if (!window.confirm('Remove the saved YouTube Data API key? Song search and playback on YouTube will stop working.')) return;
  try {
    await window.nexaApi.updateCredentials({ youtubeApiKey: null });
    appendMessage('YouTube Data API key removed.', 'pet-message');
  } catch (error) {
    appendMessage(`Could not remove the YouTube API key: ${error.message}`, 'message-error');
  }
  noteActivity();
});

document.getElementById('attach-image').addEventListener('click', () => imageFileInput.click());

imageFileInput.addEventListener('change', async () => {
  const files = [...imageFileInput.files];
  imageFileInput.value = '';
  if (messageImages.length + files.length > 4) {
    appendMessage('Attach up to four images per message.', 'message-error');
    return;
  }
  for (const file of files) {
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)
      || file.size < 1 || file.size > 10 * 1024 * 1024) {
      appendMessage('Choose PNG, JPEG, WebP, or GIF images up to 10 MB each.', 'message-error');
      continue;
    }
    try {
      const data = await fileToBase64(file);
      messageImages.push({ mimeType: file.type, data });
      appendImageMessage(`data:${file.type};base64,${data}`, 'user-message');
    } catch (error) {
      appendMessage(error.message, 'message-error');
    }
  }
  noteActivity();
});

document.getElementById('capture-screen').addEventListener('click', async () => {
  try {
    const sources = await window.nexaApi.listCaptureSources();
    if (!sources.length) throw new Error('No screen or window capture sources are available.');
    const choice = await requestAppInput({
      title: 'Share a screen or window',
      description: 'Choose which screen or window to capture.',
      label: 'Available sources',
      options: sources.map((source) => source.name),
    });
    if (choice === undefined) return;
    const source = sources[Number(choice)];
    if (!source) throw new Error('Choose an available screen or window.');
    if (messageImages.length >= 4) throw new Error('Attach no more than four images per message.');
    const capture = await window.nexaApi.captureScreen(source.id);
    messageImages.push({ mimeType: capture.mimeType, data: capture.data });
    appendImageMessage(`data:${capture.mimeType};base64,${capture.data}`, 'user-message');
    appendMessage(`Screen captured: ${capture.name}. Add a question and send it to share this image with the AI.`, 'pet-message');
  } catch (error) {
    appendMessage(`Could not capture the screen: ${error.message}`, 'message-error');
  }
  noteActivity();
});

document.getElementById('capture-camera').addEventListener('click', async () => {
  let stream;
  try {
    if (messageImages.length >= 4) throw new Error('Attach no more than four images per message.');
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    const video = document.createElement('video');
    video.srcObject = stream;
    await new Promise((resolve) => video.addEventListener('loadedmetadata', resolve, { once: true }));
    await video.play();
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    messageImages.push({ mimeType: 'image/jpeg', data });
    appendImageMessage(`data:image/jpeg;base64,${data}`, 'user-message');
    appendMessage('Camera snapshot captured. Add a question and send it to share this image with the AI.', 'pet-message');
  } catch (error) {
    appendMessage(`Could not capture from the camera: ${error.message}`, 'message-error');
  } finally {
    stream?.getTracks().forEach((track) => track.stop());
    noteActivity();
  }
});

document.getElementById('generate-image').addEventListener('click', async () => {
  if (sendButton.disabled) return;
  const prompt = messageInput.value.trim() || await requestAppInput({
    title: 'Create an image',
    description: 'Describe the image you want NEXA to create.',
    label: 'Image description',
    value: '',
    submitLabel: 'Create image',
  });
  if (!prompt) return;
  try {
    setBusy(true);
    agentState.textContent = 'Creating image';
    const image = await window.nexaApi.generateImage(prompt);
    displayImage(image.data, image.mimeType, `Generated image: ${prompt}`);
  } catch (error) {
    appendMessage(`Could not create the image: ${error.message}`, 'message-error');
  } finally {
    setBusy(false);
    noteActivity();
  }
});

document.getElementById('voice-input').addEventListener('click', () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    appendMessage('Speech recognition is not available in this version of Chromium.', 'message-error');
    return;
  }
  if (!recognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      messageInput.value = event.results[0][0].transcript;
      messageInput.focus();
    };
    recognition.onerror = (event) => {
      appendMessage(`Voice input failed: ${event.error}.`, 'message-error');
    };
    recognition.onend = () => {
      recognitionActive = false;
      document.getElementById('voice-input').setAttribute('aria-pressed', 'false');
    };
  }
  if (recognitionActive) {
    try {
      recognition.stop();
    } catch (error) {
      appendMessage(`Could not stop voice input: ${error.message}`, 'message-error');
    }
    return;
  }
  try {
    recognitionActive = true;
    document.getElementById('voice-input').setAttribute('aria-pressed', 'true');
    recognition.start();
  } catch (error) {
    recognitionActive = false;
    document.getElementById('voice-input').setAttribute('aria-pressed', 'false');
    appendMessage(`Could not start voice input: ${error.message}`, 'message-error');
  }
  noteActivity();
});

document.getElementById('scroll-up').addEventListener('click', () => {
  conversation.scrollBy({ top: -180, behavior: 'smooth' });
  noteActivity();
});

document.getElementById('scroll-down').addEventListener('click', () => {
  conversation.scrollBy({ top: 180, behavior: 'smooth' });
  noteActivity();
});

window.nexaApi.onClearChat(() => {
  conversation.replaceChildren();
  appendMessage('Chat cleared.', 'pet-message');
});

window.nexaApi.onReminderDue((reminder) => {
  if (!reminder || typeof reminder.message !== 'string') return;
  const displayText = reminder.type === 'alarm' ? reminder.message : `Reminder: ${reminder.message}`;
  setChatOpen(true);
  appendMessage(displayText, 'pet-message');
  noteActivity();
  playReminderAlarmSound();
});

async function playReminderAlarmSound() {
  let context;
  try {
    if (!window.AudioContext) throw new Error('AudioContext is unavailable for reminder alarms.');
    context = new window.AudioContext();
    await context.resume();
    const startAt = context.currentTime + 0.05;
    for (let index = 0; index < 4; index += 1) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const onset = startAt + index * 0.45;
      oscillator.frequency.value = index % 2 ? 660 : 880;
      gain.gain.setValueAtTime(0.8, onset);
      gain.gain.exponentialRampToValueAtTime(0.001, onset + 0.3);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(onset);
      oscillator.stop(onset + 0.31);
    }
    await new Promise((resolve) => window.setTimeout(resolve, 2200));
    await context.close();
  } catch (error) {
    if (context && context.state !== 'closed') await context.close();
    appendMessage(`Alert sound could not be played: ${error.message}`, 'message-error');
  }
}

for (const element of [messageInput, conversation, settingsPanel]) {
  element.addEventListener('pointerdown', noteActivity);
  element.addEventListener('keydown', noteActivity);
}

window.addEventListener('beforeunload', () => {
  clearTimeout(sleepTimer);
  window.nexaApi.setMouseInteractive(false);
});

async function initializePet() {
  try {
    const setup = await window.nexaApi.readPetSetup();
    if (!setup.configured) {
      window.location.reload();
      return;
    }
    document.getElementById('pet-name').textContent = setup.petName;
    document.title = `${setup.petName} - NEXA VirtualPet`;
    petButton.setAttribute('aria-label', `Open or close ${setup.petName} chat`);
    petImage.src = setup.spriteUrl || `sprites/${setup.spriteKey}.svg`;
    petImage.title = `${setup.spriteName ?? 'NEXA VirtualPet'} sprite`;
    document.documentElement.style.setProperty(
      '--pet-avatar-image',
      `url("${setup.spriteUrl || `sprites/${setup.spriteKey}.svg`}")`,
    );
    modelVersion.textContent = setup.modelVersion;
    applySettings();
    agentState.textContent = 'Ready';
    const status = await window.nexaApi.getCredentialStatus();
    if (!status.geminiConfigured) {
      appendMessage('Gemini API key is missing. Add it under Settings → AI provider keys.', 'message-error');
    }
    noteActivity();
  } catch (error) {
    appendMessage(`Could not load pet setup: ${error.message}`, 'message-error');
  }
}

void initializePet();

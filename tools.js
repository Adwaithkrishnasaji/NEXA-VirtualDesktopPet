const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  launchApp,
  closeApp,
  openWebsite,
  searchWeb,
  openYouTubeSearch,
  playSong,
  playSpotifyMusic,
  playNextSong,
  sendWhatsAppMessage,
  calculate,
  spotifyMediaControl,
  listWifiNetworks,
  connectWifi,
  openConnectivitySettings,
  manageBluetoothConnection,
  listRunningApps,
  getSystemStatus,
  getBatteryStatus,
  setScreenBrightness,
  controlSystemSetting,
  lockDevice,
  openCamera,
} = require('./localActions');
const { selectWhatsAppChat } = require('./whatsappAutomation');

const toolDeclarations = [
  {
    name: 'remember_personal_detail',
    description: 'Save a personal fact or preference the user shared about themselves, such as favorite songs, places, people, interests, or other personal details. Save only explicit user-provided facts, never guesses. Memories are encrypted on this device and persist across restarts.',
    parameters: {
      type: 'OBJECT',
      properties: {
        category: { type: 'STRING', description: 'A short category, such as favorite color, favorite song, friend, or home.' },
        value: { type: 'STRING', description: 'The exact personal detail the user provided.' },
      },
      required: ['category', 'value'],
    },
  },
  {
    name: 'forget_personal_detail',
    description: 'Delete one saved personal memory when the user asks you to forget or delete it. Use a precise category or phrase from the stored memories; do not delete unrelated facts.',
    parameters: {
      type: 'OBJECT',
      properties: { query: { type: 'STRING', description: 'The category or phrase identifying the memory to delete.' } },
      required: ['query'],
    },
  },
  {
    name: 'list_personal_memories',
    description: 'List the personal memories currently saved for the user when they ask what you remember about them.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: [],
    },
  },
  {
    name: 'open_application',
    description: 'Open an installed Windows application or a supported YouTube, Google, Instagram, or ChatGPT website shortcut when the user explicitly asks.',
    parameters: {
      type: 'OBJECT',
      properties: { appName: { type: 'STRING', description: 'The application or supported website name.' } },
      required: ['appName'],
    },
  },
  {
    name: 'whatsapp_select_chat',
    description: 'Open a WhatsApp chat for the exact contact name the user provided.',
    parameters: {
      type: 'OBJECT',
      properties: { contactName: { type: 'STRING', description: 'The exact WhatsApp contact name.' } },
      required: ['contactName'],
    },
  },
  {
    name: 'whatsapp_send_message',
    description: 'Automatically send a WhatsApp message only when the current user message explicitly asks to send and supplies the exact contact name or international phone number and exact text. Do not infer either value. WhatsApp must verify the exact recipient and message before the send action.',
    parameters: {
      type: 'OBJECT',
      properties: {
        contactName: { type: 'STRING', description: 'The exact WhatsApp contact name or full international phone number.' },
        message: { type: 'STRING', description: 'The exact message text supplied by the user.' },
      },
      required: ['contactName', 'message'],
    },
  },
  {
    name: 'openApp',
    description: 'Open an installed desktop application when the user explicitly asks.',
    parameters: {
      type: 'OBJECT',
      properties: { appName: { type: 'STRING', description: 'The installed application name.' } },
      required: ['appName'],
    },
  },
  {
    name: 'closeApp',
    description: 'Close only an application instance this pet launched.',
    parameters: {
      type: 'OBJECT',
      properties: { appName: { type: 'STRING', description: 'The previously launched application name.' } },
      required: ['appName'],
    },
  },
  {
    name: 'openWebsite',
    description: 'Open a supported website only when directly requested.',
    parameters: {
      type: 'OBJECT',
      properties: { siteName: { type: 'STRING', enum: ['google', 'youtube', 'instagram', 'gmail', 'github', 'wikipedia', 'amazon', 'reddit', 'chatgpt'] } },
      required: ['siteName'],
    },
  },
  {
    name: 'searchWeb',
    description: 'Fetch up to six current DuckDuckGo web results with titles, URLs, and snippets for use in an answer. Use for current news, weather, live facts, or whenever the user explicitly asks for a web search. Search queries are sent to DuckDuckGo.',
    parameters: {
      type: 'OBJECT',
      properties: { query: { type: 'STRING', description: 'A web search query.' } },
      required: ['query'],
    },
  },
  {
    name: 'searchYouTube',
    description: 'Open YouTube search results for a video or song.',
    parameters: {
      type: 'OBJECT',
      properties: { query: { type: 'STRING', description: 'A video search query.' } },
      required: ['query'],
    },
  },
  {
    name: 'playYouTubeVideo',
    description: 'Play a specific YouTube video inside the pet chat only when the user clearly asks to play that video. Requires its 11-character video ID.',
    parameters: {
      type: 'OBJECT',
      properties: { videoId: { type: 'STRING', description: 'An 11-character YouTube video ID.' } },
      required: ['videoId'],
    },
  },
  {
    name: 'controlYouTubePlayer',
    description: 'Play, pause, stop, or skip to the next YouTube video currently shown in the pet chat when the user directly requests it.',
    parameters: {
      type: 'OBJECT',
      properties: { action: { type: 'STRING', enum: ['play', 'pause', 'stop', 'next'] } },
      required: ['action'],
    },
  },
  {
    name: 'play_youtube_music',
    description: 'Search YouTube for a song or artist and play the closest matching result in the NEXA chat player, with up to four more search matches queued. Requires the user-configured YouTube Data API key.',
    parameters: {
      type: 'OBJECT',
      properties: { song: { type: 'STRING', description: 'Song title and/or artist to search for and play.' } },
      required: ['song'],
    },
  },
  {
    name: 'play_next_youtube_song',
    description: 'Skip to the next queued YouTube search result in the NEXA chat player when the user asks for the next song or to skip this one.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: [],
    },
  },
  {
    name: 'searchMusic',
    description: 'Open song search results in Spotify or YouTube without starting a track. For a request to play a YouTube song, use play_youtube_music instead.',
    parameters: {
      type: 'OBJECT',
      properties: {
        provider: { type: 'STRING', enum: ['spotify', 'youtube'] },
        song: { type: 'STRING', description: 'Song or artist to search for.' },
      },
      required: ['provider', 'song'],
    },
  },
  {
    name: 'play_spotify_music',
    description: 'When the user names a song or artist, search Spotify and play its top matching result. For a request to resume or play the current track without a song name, send the Windows media play/pause key. This includes Manglish requests such as "patt play cheyy".',
    parameters: {
      type: 'OBJECT',
      properties: { song: { type: 'STRING', description: 'Optional song title and/or artist to search for and play on Spotify.' } },
      required: [],
    },
  },
  {
    name: 'play_next_song',
    description: 'Skip to the next track in the active music player when the user asks for the next song or to skip this song.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: [],
    },
  },
  {
    name: 'sendWhatsAppMessage',
    description: 'Automatically send a WhatsApp message only when the current user message directly asks to send its exact text to the exact chat name or international phone number it provides. Never infer or alter the recipient or message. WhatsApp verifies the exact chat and message before sending.',
    parameters: {
      type: 'OBJECT',
      properties: {
        recipient: { type: 'STRING', description: 'The exact visible WhatsApp chat name or full international phone number provided by the user.' },
        message: { type: 'STRING', description: 'The exact message provided by the user.' },
      },
      required: ['recipient', 'message'],
    },
  },
  {
    name: 'calculate',
    description: 'Evaluate a basic arithmetic expression.',
    parameters: {
      type: 'OBJECT',
      properties: { expression: { type: 'STRING', description: 'Numbers, parentheses, and basic arithmetic operators.' } },
      required: ['expression'],
    },
  },
  {
    name: 'createFile',
    description: 'Create a UTF-8 text file on the user Desktop without replacing an existing file. Use only when explicitly requested.',
    parameters: {
      type: 'OBJECT',
      properties: {
        fileName: { type: 'STRING', description: 'The requested file name.' },
        content: { type: 'STRING', description: 'Text content, up to 100,000 characters.' },
      },
      required: ['fileName', 'content'],
    },
  },
  {
    name: 'createTask',
    description: 'Add a task to the local task list only when the user explicitly asks to track it.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Actionable task title, up to 240 characters.' },
        dueDate: { type: 'STRING', description: 'Optional ISO date and time with timezone.' },
      },
      required: ['title'],
    },
  },
  { name: 'listTasks', description: 'List open tasks from the local task list when requested.', parameters: { type: 'OBJECT', properties: {} } },
  {
    name: 'completeTask',
    description: 'Mark one task complete only after the user clearly identifies it.',
    parameters: { type: 'OBJECT', properties: { taskId: { type: 'STRING', description: 'Task ID from listTasks.' } }, required: ['taskId'] },
  },
  { name: 'listDesktopFiles', description: 'List Desktop file names and metadata without reading contents.', parameters: { type: 'OBJECT', properties: {} } },
  {
    name: 'findDesktopFiles',
    description: 'Find files by name on the Desktop and its immediate folders without reading contents.',
    parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'Filename search text, 1 to 100 characters.' } }, required: ['query'] },
  },
  {
    name: 'readDesktopTextFile',
    description: 'Read a small plain-text file on the Desktop only after the user explicitly asks to inspect it. Allowed types: .txt, .md, .json, .csv, .log, and .js.',
    parameters: { type: 'OBJECT', properties: { fileName: { type: 'STRING', description: 'Exact relative file name from a Desktop file result.' } }, required: ['fileName'] },
  },
  {
    name: 'copyToClipboard',
    description: 'Copy text to the Windows clipboard only when the user explicitly asks.',
    parameters: { type: 'OBJECT', properties: { text: { type: 'STRING', description: 'Text to copy, up to 20,000 characters.' } }, required: ['text'] },
  },
  { name: 'getSystemStatus', description: 'Report local CPU, uptime, memory, and operating system status.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'listRunningApps', description: 'List names of applications with visible windows on this computer.', parameters: { type: 'OBJECT', properties: {} } },
  {
    name: 'controlSpotify',
    description: 'Send a play, pause, or toggle key to the active Windows media session when the user directly asks.',
    parameters: { type: 'OBJECT', properties: { action: { type: 'STRING', enum: ['play', 'pause', 'toggle'] } }, required: ['action'] },
  },
  {
    name: 'listWifiNetworks',
    description: 'List visible Wi-Fi network names. Never request or reveal Wi-Fi passwords.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'connectWifi',
    description: 'Connect to a visible Wi-Fi network only through an existing Windows profile. If no profile exists, open Windows Wi-Fi settings; never collect passwords in chat.',
    parameters: { type: 'OBJECT', properties: { ssid: { type: 'STRING', description: 'Exact SSID from listWifiNetworks.' } }, required: ['ssid'] },
  },
  {
    name: 'manageBluetoothConnection',
    description: 'Open Windows Bluetooth settings so the user can connect or disconnect a named device there. Do not claim the change is complete until the user confirms.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING', enum: ['connect', 'disconnect'] },
        deviceName: { type: 'STRING', description: 'The paired device name.' },
      },
      required: ['action', 'deviceName'],
    },
  },
  {
    name: 'controlSystemSetting',
    description: 'Turn a supported Windows setting on or off only when directly requested. Wi-Fi is changed directly and may require administrator permission. Bluetooth, airplane mode, Night light, and Do not disturb open Windows settings and require the user to complete the toggle there; report that no change occurred yet.',
    parameters: {
      type: 'OBJECT',
      properties: {
        setting: { type: 'STRING', enum: ['wifi', 'bluetooth', 'airplaneMode', 'nightLight', 'doNotDisturb'] },
        enabled: { type: 'BOOLEAN', description: 'Whether the setting should be on.' },
      },
      required: ['setting', 'enabled'],
    },
  },
  {
    name: 'setScreenBrightness',
    description: 'Set brightness for Windows displays that support the standard WMI brightness interface. Use only on a direct request and report unsupported display errors honestly.',
    parameters: {
      type: 'OBJECT',
      properties: { percent: { type: 'INTEGER', description: 'Brightness from 0 to 100.' } },
      required: ['percent'],
    },
  },
  { name: 'getBatteryStatus', description: 'Inspect Windows battery percentage and status; report when no battery is present.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'lockDevice', description: 'Lock this Windows workstation immediately, only on the user’s direct request.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'openCamera', description: 'Open the Windows Camera app when explicitly requested; the user controls permissions and capture.', parameters: { type: 'OBJECT', properties: {} } },
  {
    name: 'setReminder',
    description: 'Schedule a local reminder only when the user provided an unambiguous future date and time. Use an ISO 8601 date-time with timezone.',
    parameters: {
      type: 'OBJECT',
      properties: {
        message: { type: 'STRING', description: 'Reminder text, up to 300 characters.' },
        dateTime: { type: 'STRING', description: 'Future ISO 8601 date-time with timezone.' },
      },
      required: ['message', 'dateTime'],
    },
  },
  {
    name: 'controlPet',
    description: 'Hide or show the chat, resize it, or change a supported pet setting only when directly requested.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING', enum: ['hideChat', 'showChat', 'resizeChat', 'setSeriousMode', 'setVoiceEnabled', 'setVoiceVolume', 'updateSetting'] },
        value: { type: 'STRING', description: 'New value for a setting.' },
        height: { type: 'INTEGER', description: 'Chat height in pixels between 300 and 620.' },
        setting: { type: 'STRING', enum: ['seriousMode', 'voiceEnabled', 'voiceVolume', 'theme', 'chatHeight', 'positionLocked', 'spriteOffsetX', 'spriteOffsetY'] },
      },
      required: ['action'],
    },
  },
];

const groqToolNames = new Set([
  'remember_personal_detail',
  'forget_personal_detail',
  'list_personal_memories',
  'open_application',
  'openApp',
  'whatsapp_select_chat',
  'whatsapp_send_message',
  'play_spotify_music',
  'play_next_song',
  'play_youtube_music',
  'play_next_youtube_song',
  'closeApp',
  'openWebsite',
  'searchWeb',
  'searchYouTube',
  'playYouTubeVideo',
  'controlYouTubePlayer',
  'play_next_youtube_song',
  'searchMusic',
  'sendWhatsAppMessage',
  'calculate',
  'controlPet',
  'createFile',
  'createTask',
  'listTasks',
  'completeTask',
  'listDesktopFiles',
  'findDesktopFiles',
  'readDesktopTextFile',
  'copyToClipboard',
  'getSystemStatus',
  'listRunningApps',
  'controlSpotify',
  'listWifiNetworks',
  'connectWifi',
  'manageBluetoothConnection',
  'controlSystemSetting',
  'setScreenBrightness',
  'getBatteryStatus',
  'lockDevice',
  'openCamera',
  'setReminder',
]);
const groqToolDeclarations = toolDeclarations
  .filter((declaration) => groqToolNames.has(declaration.name))
  .map((declaration) => ({
    type: 'function',
    function: {
      name: declaration.name,
      description: declaration.description,
      parameters: {
        type: declaration.parameters.type.toLowerCase(),
        properties: Object.fromEntries(Object.entries(declaration.parameters.properties).map(([name, property]) => [
          name,
          { ...property, type: property.type.toLowerCase() },
        ])),
        required: declaration.parameters.required ?? [],
      },
    },
  }));

function assertDesktopFilePath(desktopPath, fileName) {
  if (typeof fileName !== 'string' || !fileName.trim() || fileName.length > 260) {
    throw new Error('Provide a valid Desktop file name.');
  }
  const root = path.resolve(desktopPath);
  const candidate = path.resolve(root, fileName.trim());
  const relative = path.relative(root, candidate);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('That file is outside the Desktop and cannot be accessed.');
  }
  return candidate;
}

async function readTaskList(taskPath) {
  try {
    const parsed = JSON.parse(await fs.readFile(taskPath, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error('Saved tasks must be a list.');
    return parsed.filter((task) => task && typeof task.id === 'string' && typeof task.title === 'string');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new Error(`Could not read the task list: ${error.message}`);
  }
}

async function writeTaskList(taskPath, tasks) {
  await fs.mkdir(path.dirname(taskPath), { recursive: true });
  const temporaryPath = `${taskPath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(tasks, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryPath, taskPath);
}

async function listDesktopFiles(desktopPath, query = '') {
  const found = [];
  const needle = query.toLocaleLowerCase();
  async function scan(directory, depth) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (found.length >= 80) return;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink() && depth < 1) {
        await scan(absolutePath, depth + 1);
      } else if (entry.isFile() && entry.name.toLocaleLowerCase().includes(needle)) {
        const stat = await fs.stat(absolutePath);
        found.push({
          fileName: path.relative(desktopPath, absolutePath),
          sizeBytes: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
      }
    }
  }
  await scan(desktopPath, 0);
  return found;
}

function sanitizeDesktopFileName(value) {
  const name = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 120);
  if (!name) throw new Error('A valid file name is required.');
  const safeName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? `_${name}` : name;
  return /\.txt$/i.test(safeName) ? safeName : `${safeName}.txt`;
}

async function createDesktopFile(args, desktopPath) {
  if (typeof args.fileName !== 'string' || typeof args.content !== 'string' || args.content.length > 100_000) {
    throw new Error('Provide a file name and content no larger than 100,000 characters.');
  }
  const safeName = sanitizeDesktopFileName(args.fileName);
  const base = safeName.slice(0, -path.extname(safeName).length);
  for (let index = 0; index < 1000; index += 1) {
    const candidate = path.join(desktopPath, `${base}${index ? ` (${index})` : ''}.txt`);
    try {
      await fs.writeFile(candidate, args.content, { encoding: 'utf8', flag: 'wx' });
      return { success: true, fileName: path.basename(candidate) };
    } catch (error) {
      if (error.code !== 'EEXIST') throw new Error(`Could not create the Desktop file: ${error.message}`);
    }
  }
  throw new Error('Could not find an available file name on the Desktop.');
}

async function executeTool(name, args, controlPet, authorizeWhatsAppSend, withSpotifyPlayback, managePersonalMemory, context = {}) {
  switch (name) {
    case 'remember_personal_detail':
      if (typeof managePersonalMemory !== 'function') throw new Error('Personal memory is unavailable.');
      return managePersonalMemory('remember', args);
    case 'forget_personal_detail':
      if (typeof managePersonalMemory !== 'function') throw new Error('Personal memory is unavailable.');
      return managePersonalMemory('forget', args);
    case 'list_personal_memories':
      if (typeof managePersonalMemory !== 'function') throw new Error('Personal memory is unavailable.');
      return managePersonalMemory('list', args);
    case 'open_application':
      return launchApp(args.appName);
    case 'whatsapp_select_chat':
      return selectWhatsAppChat(args.contactName);
    case 'whatsapp_send_message':
      return sendWhatsAppMessage(args.contactName, args.message, authorizeWhatsAppSend);
    case 'openApp':
      return launchApp(args.appName);
    case 'closeApp':
      return closeApp(args.appName);
    case 'openWebsite':
      return openWebsite(args.siteName);
    case 'searchWeb':
      return searchWeb(args.query);
    case 'searchYouTube':
      return openYouTubeSearch(args.query);
    case 'playYouTubeVideo':
      if (typeof controlPet !== 'function') throw new Error('Pet controls are unavailable.');
      return controlPet({ action: 'playYouTubeVideo', videoId: args.videoId });
    case 'controlYouTubePlayer':
      if (typeof controlPet !== 'function') throw new Error('Pet controls are unavailable.');
      return controlPet({ action: 'controlYouTubePlayer', value: args.action });
    case 'play_youtube_music':
      if (typeof controlPet !== 'function') throw new Error('Pet controls are unavailable.');
      return controlPet({ action: 'searchYouTubeMusic', query: args.song });
    case 'play_next_youtube_song':
      if (typeof controlPet !== 'function') throw new Error('Pet controls are unavailable.');
      return controlPet({ action: 'controlYouTubePlayer', value: 'next' });
    case 'searchMusic':
      return playSong(args.provider, args.song);
    case 'play_spotify_music':
      return typeof withSpotifyPlayback === 'function' && args.song
        ? withSpotifyPlayback(() => playSpotifyMusic(args.song))
        : playSpotifyMusic(args.song);
    case 'play_next_song':
      return playNextSong();
    case 'controlSpotify':
      return spotifyMediaControl(args.action);
    case 'sendWhatsAppMessage':
      return sendWhatsAppMessage(args.recipient, args.message, authorizeWhatsAppSend);
    case 'calculate':
      return { result: calculate(args.expression) };
    case 'createFile':
      return createDesktopFile(args, context.desktopPath);
    case 'createTask': {
      if (typeof args.title !== 'string' || !args.title.trim() || args.title.trim().length > 240) {
        throw new Error('Task titles must be between 1 and 240 characters.');
      }
      let dueDate;
      if (args.dueDate !== undefined) {
        if (typeof args.dueDate !== 'string') throw new Error('Use a future ISO date and time for the task due date.');
        dueDate = Date.parse(args.dueDate);
        if (!Number.isFinite(dueDate) || dueDate <= Date.now()) {
          throw new Error('Use a valid future due date or omit it.');
        }
      }
      const tasks = await readTaskList(context.taskPath);
      const idPrefix = `task-${Date.now().toString(36)}`;
      let idSuffix = 0;
      let taskId = `${idPrefix}${idSuffix.toString(36)}`;
      while (tasks.some((item) => item.id === taskId)) {
        idSuffix += 1;
        taskId = `${idPrefix}${idSuffix.toString(36)}`;
      }
      const task = {
        id: taskId,
        title: args.title.trim(),
        createdAt: new Date().toISOString(),
        ...(dueDate ? { dueDate: new Date(dueDate).toISOString() } : {}),
        completed: false,
      };
      tasks.push(task);
      await writeTaskList(context.taskPath, tasks);
      return { success: true, task };
    }
    case 'listTasks': {
      const tasks = (await readTaskList(context.taskPath)).filter((task) => !task.completed);
      return { tasks, count: tasks.length };
    }
    case 'completeTask': {
      if (typeof args.taskId !== 'string' || !/^task-[a-z0-9]+$/i.test(args.taskId)) {
        throw new Error('Choose a task ID returned by the task list.');
      }
      const tasks = await readTaskList(context.taskPath);
      const task = tasks.find((item) => item.id === args.taskId);
      if (!task) throw new Error('That task was not found. List tasks and try again.');
      task.completed = true;
      task.completedAt = new Date().toISOString();
      await writeTaskList(context.taskPath, tasks);
      return { success: true, task };
    }
    case 'listDesktopFiles':
      return { files: await listDesktopFiles(context.desktopPath), scope: 'Desktop and immediate folders only' };
    case 'findDesktopFiles':
      if (typeof args.query !== 'string' || !args.query.trim() || args.query.trim().length > 100) {
        throw new Error('Use a filename search between 1 and 100 characters.');
      }
      return { files: await listDesktopFiles(context.desktopPath, args.query.trim()), scope: 'Desktop and immediate folders only' };
    case 'readDesktopTextFile': {
      const candidate = assertDesktopFilePath(context.desktopPath, args.fileName);
      const allowedExtensions = new Set(['.txt', '.md', '.json', '.csv', '.log', '.js']);
      if (!allowedExtensions.has(path.extname(candidate).toLowerCase())) {
        throw new Error('For safety, only plain-text file types can be read from the Desktop.');
      }
      const [realDesktopPath, realFilePath] = await Promise.all([
        fs.realpath(context.desktopPath),
        fs.realpath(candidate),
      ]);
      const relativePath = path.relative(realDesktopPath, realFilePath);
      if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        throw new Error('That file resolves outside the Desktop and cannot be accessed.');
      }
      const stat = await fs.stat(realFilePath);
      if (!stat.isFile() || stat.size > 200_000) throw new Error('Choose a plain-text file smaller than 200 KB.');
      return { fileName: path.relative(context.desktopPath, candidate), content: await fs.readFile(realFilePath, 'utf8') };
    }
    case 'copyToClipboard':
      if (typeof args.text !== 'string' || !args.text || args.text.length > 20_000 || !context.clipboard) {
        throw new Error('Clipboard text must be between 1 and 20,000 characters.');
      }
      context.clipboard.writeText(args.text);
      return { success: true, characters: args.text.length };
    case 'getSystemStatus':
      return getSystemStatus();
    case 'listRunningApps':
      return listRunningApps();
    case 'listWifiNetworks':
      return listWifiNetworks();
    case 'connectWifi':
      return connectWifi(args.ssid);
    case 'manageBluetoothConnection':
      return manageBluetoothConnection(args.action, args.deviceName);
    case 'controlSystemSetting':
      return controlSystemSetting(args.setting, args.enabled);
    case 'setScreenBrightness':
      return setScreenBrightness(args.percent);
    case 'getBatteryStatus':
      return getBatteryStatus();
    case 'lockDevice':
      return lockDevice();
    case 'openCamera':
      return openCamera();
    case 'setReminder':
      if (typeof context.createReminder !== 'function') throw new Error('Reminder scheduling is unavailable.');
      return context.createReminder(args.message, args.dateTime);
    case 'controlPet':
      if (typeof controlPet !== 'function') throw new Error('Pet controls are unavailable.');
      return controlPet(args);
    default:
      throw new Error(`Unknown tool requested: ${name}`);
  }
}

module.exports = { executeTool, toolDeclarations, groqToolDeclarations };

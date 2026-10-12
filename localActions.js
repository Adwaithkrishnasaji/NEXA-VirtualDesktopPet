const { execFile, spawn } = require('node:child_process');
const path = require('node:path');
const { promisify } = require('node:util');
const os = require('node:os');
const { shell } = require('electron');
const { normalizeLocalCommand, parseLocalCommand } = require('./localCommand');

const execFileAsync = promisify(execFile);
function parseLocalTimerIntent(text, now = new Date()) {
  if (typeof text !== 'string') return undefined;
  const input = text.trim().replace(/^(?:(?:hey|hi|hello|nexa|please|can you)\b[\s,!.]*)+/i, '').trim();
  const timePattern = '(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?';
  const parseTime = (value) => {
    const match = new RegExp(`^${timePattern}$`, 'i').exec(value.trim());
    if (!match) return undefined;
    let hours = Number(match[1]);
    const minutes = Number(match[2] ?? 0);
    const meridiem = match[3]?.toLowerCase();
    if (minutes > 59 || hours > (meridiem ? 12 : 23) || hours < (meridiem ? 1 : 0)) return undefined;
    if (meridiem) hours = (hours % 12) + (meridiem === 'pm' ? 12 : 0);
    const dueAt = new Date(now);
    dueAt.setHours(hours, minutes, 0, 0);
    if (dueAt.getTime() <= now.getTime()) dueAt.setDate(dueAt.getDate() + 1);
    return dueAt;
  };
  const alarm = new RegExp(`^(?:set\\s+(?:an?\\s+)?)?alarm\\s+(?:at|for)\\s+${timePattern}[.!?]*$`, 'i').exec(input);
  if (alarm) {
    const dueAt = parseTime(alarm[1] + (alarm[2] === undefined ? '' : `:${alarm[2]}`) + (alarm[3] ? ` ${alarm[3]}` : ''));
    return dueAt ? { type: 'alarm', message: 'Your alarm', dateTime: dueAt.toISOString() } : undefined;
  }
  const durationReminder = /^(?:remind me to|remind me(?!\s+to\b))\s+(.+?)\s+(?:after|in)\s+(\d{1,5})\s*(minutes?|mins?|hours?|hrs?)[.!?]*$/i.exec(input);
  if (durationReminder) {
    const amount = Number(durationReminder[2]);
    const delayMinutes = amount * (durationReminder[3].toLowerCase().startsWith('h') ? 60 : 1);
    const message = durationReminder[1].trim();
    if (!message || message.length > 300 || !amount || delayMinutes > 525_600) return undefined;
    return {
      type: 'reminder',
      message,
      dateTime: new Date(now.getTime() + delayMinutes * 60_000).toISOString(),
    };
  }
  const timedReminder = new RegExp(`^(?:remind me to|remind me(?!\\s+to\\b))\\s+(.+?)\\s+at\\s+(${timePattern})[.!?]*$`, 'i').exec(input);
  if (timedReminder) {
    const dueAt = parseTime(timedReminder[2]);
    const message = timedReminder[1].trim();
    return dueAt && message ? { type: 'reminder', message, dateTime: dueAt.toISOString() } : undefined;
  }
  return undefined;
}
const launchedProcesses = new Map();
const canonicalAliases = new Map([
  ['calculator', 'calc'],
  ['paint', 'mspaint'],
  ['whats app', 'whatsapp'],
  ['whatsapp app', 'whatsapp'],
  ['whatsapp application', 'whatsapp'],
  ['whatsapp desktop', 'whatsapp'],
  ['whatsapp desktop app', 'whatsapp'],
  ['whatsapp desktop application', 'whatsapp'],
  ['you tube', 'youtube'],
  ['insta', 'instagram'],
  ['yt', 'youtube'],
]);
function getProcessNames(name, executable) {
  const aliases = {
    calc: ['calc', 'CalculatorApp'],
    mspaint: ['mspaint'],
    notepad: ['notepad'],
  };
  return aliases[name] || [path.basename(executable, path.extname(executable))];
}

async function snapshotProcessIds(processNames) {
  const snapshots = await Promise.all(processNames.map((name) => execFileAsync('tasklist.exe', [
    '/FO',
    'CSV',
    '/NH',
    '/FI',
    `IMAGENAME eq ${name}.exe`,
  ], { windowsHide: true, timeout: 5000 })));
  const ids = new Set();
  for (const { stdout } of snapshots) {
    for (const line of stdout.split(/\r?\n/)) {
      const match = /^"[^"]+","(\d+)"/.exec(line);
      if (match) ids.add(Number(match[1]));
    }
  }
  return ids;
}

function normalizeApplicationName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) {
    throw new Error('Enter an application name between 1 and 100 characters.');
  }
  const command = parseLocalCommand(value);
  const name = (command?.target ?? normalizeLocalCommand(value)).replace(/\.exe$/i, '');
  if (!/^[\p{L}\p{N} ._-]+$/u.test(name)) {
    throw new Error('Use an application name, not a path or command.');
  }
  return name.toLowerCase();
}

async function openWhatsAppDesktop() {
  if (process.platform !== 'win32') {
    throw new Error('Launching the WhatsApp desktop app is currently supported on Windows.');
  }
  try {
    await shell.openExternal('whatsapp://');
    return { success: true, closeable: false, application: 'WhatsApp Desktop' };
  } catch {
    let appId;
    try {
      const { stdout } = await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "$app = Get-StartApps | Where-Object { $_.Name -match 'WhatsApp' -or $_.AppID -match 'WhatsApp' } | Select-Object -First 1; if ($app) { $app.AppID }",
      ], { windowsHide: true, timeout: 5000 });
      appId = stdout.trim();
    } catch (error) {
      throw new Error(`Could not locate the WhatsApp desktop app: ${error.message}`);
    }
    if (!appId) {
      throw new Error('WhatsApp Desktop is not installed or registered on this PC. Install it from Microsoft Store, then try again.');
    }
    if (!/^[A-Za-z0-9_.!+-]+$/.test(appId)) {
      throw new Error('Windows returned an invalid WhatsApp app registration.');
    }
    const child = spawn('explorer.exe', [`shell:AppsFolder\\${appId}`], {
      detached: false,
      stdio: 'ignore',
      windowsHide: true,
    });
    try {
      await new Promise((resolve, reject) => {
        child.once('spawn', resolve);
        child.once('error', reject);
      });
    } catch (error) {
      throw new Error(`Could not start WhatsApp Desktop: ${error.message}`);
    }
    return { success: true, closeable: false, application: 'WhatsApp Desktop' };
  }
}

function getLaunchMessage(appName) {
  return `Po mone Dinesha, ${appName} thurannittundu!`;
}

async function startWindowsTarget(target, applicationName, trackName) {
  if (process.platform !== 'win32') {
    throw new Error('Launching local applications is currently supported on Windows.');
  }
  const processNames = trackName ? getProcessNames(trackName, `${trackName}.exe`) : [];
  const existingIds = trackName ? await snapshotProcessIds(processNames) : new Set();
  let stdout = '';
  let stderr = '';
  try {
    ({ stdout, stderr } = await execFileAsync(
      'cmd.exe',
      ['/d', '/s', '/c', `start "" "${target}"`],
      { windowsHide: true, timeout: 10_000 },
    ));
  } catch (error) {
    throw new Error(`Could not open ${applicationName}: ${error.message}`);
  }
  if (/windows cannot find|not recognized as an internal or external command/i.test(`${stdout}\n${stderr}`)) {
    throw new Error(`Could not open ${applicationName}: Windows could not find the requested application.`);
  }
  const processIds = new Set();
  if (trackName) {
    const deadline = Date.now() + 1600;
    do {
      const currentIds = await snapshotProcessIds(processNames);
      for (const processId of currentIds) {
        if (!existingIds.has(processId)) processIds.add(processId);
      }
      if (processIds.size && Date.now() >= deadline - 1100) break;
      await new Promise((resolve) => setTimeout(resolve, 150));
    } while (Date.now() < deadline);
    if (processIds.size) {
      launchedProcesses.set(trackName, { processNames, processIds: [...processIds] });
    }
  }
  return {
    success: true,
    closeable: processIds.size > 0,
    application: applicationName,
    message: getLaunchMessage(applicationName),
  };
}

async function launchApp(value) {
  const command = parseLocalCommand(value);
  const requestedName = normalizeApplicationName(command?.action === 'launch' ? command.target : value);
  const name = canonicalAliases.get(requestedName) || requestedName;
  if (name === 'whatsapp') {
    const result = await openWhatsAppDesktop();
    return { ...result, message: getLaunchMessage('WhatsApp') };
  }
  if (name === 'spotify') {
    try {
      await shell.openExternal('spotify:');
      return { success: true, closeable: false, application: 'Spotify', message: getLaunchMessage('Spotify') };
    } catch (protocolError) {
      try {
        return await startWindowsTarget('spotify:', 'Spotify');
      } catch (commandError) {
        throw new Error(`Could not open Spotify using its desktop protocol or Windows start command: ${commandError.message}`, {
          cause: protocolError,
        });
      }
    }
  }
  if (Object.hasOwn(websiteUrls, name)) {
    return openWebsite(name);
  }
  if (['chrome', 'notepad', 'calculator', 'calc'].includes(name)) {
    const target = name === 'calculator' ? 'calc' : name;
    return startWindowsTarget(
      target,
      name === 'calc' ? 'calculator' : name,
      target === 'calc' ? 'calc' : target,
    );
  }

  return startWindowsTarget(name, name, name);
}

async function closeApp(value) {
  const requestedName = normalizeApplicationName(value);
  const name = canonicalAliases.get(requestedName) || requestedName;
  const launched = launchedProcesses.get(name);
  if (!launched) {
    throw new Error(`No running ${requestedName} process launched by this pet is available to close.`);
  }
  if (process.platform !== 'win32') {
    throw new Error('Closing tracked applications is currently supported on Windows.');
  }

  const currentIds = await snapshotProcessIds(launched.processNames);
  const trackedIds = launched.processIds.filter((processId) => currentIds.has(processId));
  if (!trackedIds.length) {
    launchedProcesses.delete(name);
    throw new Error(`No running ${requestedName} process launched by this pet is available to close.`);
  }
  const processIdList = trackedIds.join(',');
  const script = `@(${processIdList}) | ForEach-Object { try { $process = Get-Process -Id $_ -ErrorAction Stop; "$($_):$($process.CloseMainWindow())" } catch { "$($_):False" } }`;
  const { stdout } = await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    script,
  ], { windowsHide: true, timeout: 5000 });
  if (!stdout.split(/\r?\n/).some((line) => /:\s*True\s*$/i.test(line))) {
    throw new Error(`${requestedName} did not expose a window that can be closed gracefully.`);
  }
  launchedProcesses.delete(name);
  return { success: true };
}

const websiteUrls = {
  google: 'https://google.com',
  youtube: 'https://youtube.com',
  gmail: 'https://mail.google.com/',
  github: 'https://github.com/',
  wikipedia: 'https://www.wikipedia.org/',
  amazon: 'https://www.amazon.com/',
  reddit: 'https://www.reddit.com/',
  instagram: 'https://instagram.com',
  chatgpt: 'https://chatgpt.com/',
};

async function openWebsite(siteName) {
  if (siteName === 'whatsapp') {
    const result = await openWhatsAppDesktop();
    return { ...result, message: getLaunchMessage('WhatsApp') };
  }
  const url = websiteUrls[siteName];
  if (!url) throw new Error('That website shortcut is not supported.');
  await shell.openExternal(url);
  return {
    success: true,
    siteName,
    message: getLaunchMessage(siteName),
  };
}

async function searchWeb(query) {
  if (typeof query !== 'string' || !query.trim() || query.trim().length > 300) {
    throw new Error('Search queries must be between 1 and 300 characters.');
  }
  return fetchDuckDuckGoResults(query.trim());
}

function decodeHtmlEntities(value) {
  const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  return value
    .replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (entity, code) => {
      if (code[0] === '#') {
        const number = code[1].toLowerCase() === 'x'
          ? Number.parseInt(code.slice(2), 16)
          : Number.parseInt(code.slice(1), 10);
        return Number.isFinite(number) && number > 0 && number <= 0x10ffff
          ? String.fromCodePoint(number)
          : entity;
      }
      return named[code.toLowerCase()] ?? entity;
    })
    .replace(/<[^>]*>/g, '')
    .trim();
}

async function fetchDuckDuckGoResults(query) {
  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 NEXAVirtualPet/1.0' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`DuckDuckGo search failed with HTTP ${response.status}.`);
  const html = await response.text();
  if (html.length > 2_000_000) throw new Error('DuckDuckGo returned an unexpectedly large search response.');
  const results = [];
  const resultBlocks = html.match(/<div[^>]*class="[^"]*\bresult\b[^"]*"[^>]*>[\s\S]*?(?=<div[^>]*class="[^"]*\bresult\b|$)/gi) ?? [];
  for (const block of resultBlocks) {
    const link = /<a[^>]*class="[^"]*\bresult__a\b[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    if (!link) continue;
    const rawHref = decodeHtmlEntities(link[1]);
    let url;
    try {
      const candidate = new URL(rawHref.startsWith('//') ? `https:${rawHref}` : rawHref);
      const redirected = candidate.searchParams.get('uddg');
      url = redirected ? new URL(redirected) : candidate;
    } catch {
      continue;
    }
    if (!['http:', 'https:'].includes(url.protocol)) continue;
    const snippet = /<a[^>]*class="[^"]*\bresult__snippet\b[^"]*"[^>]*>([\s\S]*?)<\/a>|<td[^>]*class="[^"]*\bresult__snippet\b[^"]*"[^>]*>([\s\S]*?)<\/td>/i.exec(block);
    results.push({
      title: decodeHtmlEntities(link[2]),
      url: url.href,
      snippet: decodeHtmlEntities(snippet?.[1] ?? snippet?.[2] ?? ''),
    });
    if (results.length === 6) break;
  }
  return { query, provider: 'DuckDuckGo', results };
}

async function spotifyMediaControl(action) {
  if (process.platform !== 'win32') {
    throw new Error('Media playback controls are currently supported on Windows.');
  }
  if (!['play', 'pause', 'toggle'].includes(action)) {
    throw new Error('Choose play, pause, or toggle for media playback.');
  }
  const virtualKey = { play: '0xFA', pause: '0xF8', toggle: '0xB3' }[action];
  const script = [
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class NexaMediaKey { [DllImport(\"user32.dll\")] public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra); }'",
    `[NexaMediaKey]::keybd_event(${virtualKey}, 0, 0, [UIntPtr]::Zero)`,
    'Start-Sleep -Milliseconds 100',
    `[NexaMediaKey]::keybd_event(${virtualKey}, 0, 2, [UIntPtr]::Zero)`,
  ].join('; ');
  await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    windowsHide: true,
    timeout: 5000,
  });
  return { success: true, action, message: `Sent the ${action} media control key.` };
}

async function runNetsh(args) {
  try {
    const { stdout } = await execFileAsync('netsh.exe', args, {
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    });
    return stdout;
  } catch (error) {
    throw new Error(`Windows network command failed: ${error.message}`);
  }
}

async function listWifiNetworks() {
  if (process.platform !== 'win32') throw new Error('Wi-Fi discovery is supported on Windows only.');
  const output = await runNetsh(['wlan', 'show', 'networks', 'mode=bssid']);
  const ssids = [...output.matchAll(/^\s*SSID\s+\d+\s*:\s*(.+?)\s*$/gim)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  return [...new Set(ssids)].map((ssid) => ({ ssid }));
}

async function openConnectivitySettings(deviceType) {
  if (process.platform !== 'win32') throw new Error('Windows connectivity settings are available on Windows only.');
  const settingsUri = {
    wifi: 'ms-settings:network-wifi',
    bluetooth: 'ms-settings:bluetooth',
  }[deviceType];
  if (!settingsUri) throw new Error('Choose Wi-Fi or Bluetooth settings.');
  try {
    await execFileAsync('explorer.exe', [settingsUri], { windowsHide: true, timeout: 5000 });
  } catch (error) {
    throw new Error(`Could not open Windows ${deviceType} settings: ${error.message}`);
  }
  return { success: true, deviceType };
}

async function connectWifi(ssid) {
  if (process.platform !== 'win32') throw new Error('Wi-Fi connection is supported on Windows only.');
  if (typeof ssid !== 'string' || !ssid.trim() || ssid.trim().length > 32 || /[\u0000-\u001f]/.test(ssid)) {
    throw new Error('Choose a valid Wi-Fi network name (1 to 32 characters).');
  }
  const requested = ssid.trim();
  const visible = await listWifiNetworks();
  if (!visible.some(({ ssid: item }) => item === requested)) {
    throw new Error(`Wi-Fi network "${requested}" is not currently visible. List networks again before connecting.`);
  }
  const profileOutput = await runNetsh(['wlan', 'show', 'profiles']);
  const savedProfiles = [...profileOutput.matchAll(/^\s*(?:All|Current) User Profile\s*:\s*(.+?)\s*$/gim)]
    .map((match) => match[1].trim());
  if (!savedProfiles.includes(requested)) {
    await openConnectivitySettings('wifi');
    return {
      success: false,
      needsUserAction: true,
      ssid: requested,
      message: `Opened Windows Wi-Fi settings for "${requested}". Connect there; NEXA never requests or stores Wi-Fi passwords.`,
    };
  }
  await runNetsh(['wlan', 'connect', `name=${requested}`, `ssid=${requested}`]);
  return { success: true, ssid: requested, message: `Asked Windows to connect to saved Wi-Fi profile "${requested}".` };
}

async function manageBluetoothConnection(action, deviceName) {
  if (!['connect', 'disconnect'].includes(action)) throw new Error('Choose connect or disconnect for Bluetooth.');
  if (typeof deviceName !== 'string' || !deviceName.trim() || deviceName.trim().length > 100) {
    throw new Error('Provide the Bluetooth device name.');
  }
  const result = await openConnectivitySettings('bluetooth');
  return {
    ...result,
    deviceName: deviceName.trim(),
    action,
    message: `Opened Windows Bluetooth settings. Find "${deviceName.trim()}" there to ${action}; confirm once Windows completes it.`,
  };
}

async function listRunningApps() {
  if (process.platform !== 'win32') throw new Error('Listing running applications is supported on Windows only.');
  const script = "Get-Process | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -ExpandProperty ProcessName -Unique | Sort-Object";
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    windowsHide: true,
    timeout: 8000,
  });
  return { applications: stdout.split(/\r?\n/).map((name) => name.trim()).filter(Boolean).slice(0, 100) };
}

function getSystemStatus() {
  const cpus = os.cpus();
  return {
    platform: `${os.type()} ${os.release()}`,
    cpu: { model: cpus[0]?.model ?? 'Unknown', cores: cpus.length },
    uptimeSeconds: Math.round(os.uptime()),
    loadAverage: os.loadavg(),
    memory: { totalBytes: os.totalmem(), availableBytes: os.freemem() },
  };
}

async function getBatteryStatus() {
  if (process.platform !== 'win32') throw new Error('Battery inspection is supported on Windows only.');
  const script = [
    '$battery = Get-CimInstance -ClassName Win32_Battery -ErrorAction Stop | Select-Object -First 1 EstimatedChargeRemaining, BatteryStatus, Name',
    'if ($null -eq $battery) { @{ available = $false; message = "No battery was detected." } | ConvertTo-Json -Compress; exit 0 }',
    '@{ available = $true; percent = $battery.EstimatedChargeRemaining; statusCode = $battery.BatteryStatus; name = $battery.Name } | ConvertTo-Json -Compress',
  ].join('; ');
  return JSON.parse((await runPowerShell(script)).trim());
}

async function setScreenBrightness(percent) {
  if (process.platform !== 'win32') throw new Error('Screen brightness control is supported on Windows only.');
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw new Error('Brightness must be an integer from 0 to 100.');
  }
  const script = [
    `$brightness = ${percent}`,
    '$methods = @(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods -ErrorAction Stop)',
    'if ($methods.Count -eq 0) { throw "No brightness-controllable display was found." }',
    '$methods | ForEach-Object { $result = $_.WmiSetBrightness(1, [byte]$brightness); if ($result.ReturnValue -ne 0) { throw "The display rejected the brightness change." } }',
    '@{ success = $true; brightness = $brightness; displays = $methods.Count } | ConvertTo-Json -Compress',
  ].join('; ');
  return JSON.parse((await runPowerShell(script)).trim());
}

async function controlSystemSetting(setting, enabled) {
  if (process.platform !== 'win32') throw new Error('System settings controls are supported on Windows only.');
  if (typeof enabled !== 'boolean') throw new Error('Choose whether the setting should be on or off.');
  if (setting === 'wifi') {
    const script = [
      '$adapters = @(Get-NetAdapter -Physical -ErrorAction Stop | Where-Object { $_.NdisPhysicalMedium -eq 9 })',
      'if ($adapters.Count -ne 1) { throw "Expected exactly one physical Wi-Fi adapter; found $($adapters.Count)." }',
      '$adapter = $adapters[0]',
      `$desired = '${enabled ? 'Up' : 'Down'}'`,
      'if ($adapter.AdminStatus -ne $desired) { if ($desired -eq "Up") { Enable-NetAdapter -InterfaceIndex $adapter.ifIndex -Confirm:$false -ErrorAction Stop } else { Disable-NetAdapter -InterfaceIndex $adapter.ifIndex -Confirm:$false -ErrorAction Stop } }',
      '$current = Get-NetAdapter -InterfaceIndex $adapter.ifIndex -ErrorAction Stop',
      '@{ success = ($current.AdminStatus -eq $desired); setting = "wifi"; enabled = ($current.AdminStatus -eq "Up"); adapter = $current.Name } | ConvertTo-Json -Compress',
    ].join('; ');
    return JSON.parse((await runPowerShell(script)).trim());
  }
  const settings = {
    bluetooth: { uri: 'ms-settings:bluetooth', label: 'Bluetooth' },
    airplaneMode: { uri: 'ms-settings:network-airplanemode', label: 'Airplane mode' },
    nightLight: { uri: 'ms-settings:nightlight', label: 'Night light' },
    doNotDisturb: { uri: 'ms-settings:notifications', label: 'Do not disturb' },
  };
  if (typeof setting !== 'string' || !Object.hasOwn(settings, setting)) {
    throw new Error('Choose Wi-Fi, Bluetooth, airplane mode, night light, or do not disturb.');
  }
  const target = settings[setting];
  await shell.openExternal(target.uri);
  return {
    success: false,
    needsUserAction: true,
    setting,
    enabled,
    message: `Opened Windows ${target.label} settings. Turn it ${enabled ? 'on' : 'off'} there. Windows does not expose a reliable supported direct toggle for this setting to ordinary desktop apps; the requested state has not been changed yet.`,
  };
}

async function lockDevice() {
  if (process.platform !== 'win32') throw new Error('Locking the device is supported on Windows only.');
  const script = [
    "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class NexaDeviceLock { [DllImport(\"user32.dll\", SetLastError=true)] public static extern bool LockWorkStation(); }'",
    'if (-not [NexaDeviceLock]::LockWorkStation()) { throw "Windows refused to lock the workstation." }',
    '@{ success = $true; message = "Windows workstation lock requested." } | ConvertTo-Json -Compress',
  ].join('; ');
  return JSON.parse((await runPowerShell(script)).trim());
}

async function openCamera() {
  if (process.platform !== 'win32') throw new Error('Opening the Windows Camera app is supported on Windows only.');
  await shell.openExternal('microsoft.windows.camera:');
  return { success: true, message: 'Opened the Windows Camera app. Camera access and capture remain under your control there.' };
}

async function runPowerShell(script) {
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    });
    return stdout;
  } catch (error) {
    throw new Error(`Windows system command failed: ${error.message}`);
  }
}

async function openYouTubeSearch(query) {
  if (typeof query !== 'string' || !query.trim() || query.trim().length > 200) {
    throw new Error('YouTube searches must be between 1 and 200 characters.');
  }
  await shell.openExternal(`https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim())}`);
  return { success: true, provider: 'youtube', query: query.trim() };
}

async function playSong(provider, song) {
  if (typeof song !== 'string' || !song.trim() || song.trim().length > 200) {
    throw new Error('Song searches must be between 1 and 200 characters.');
  }
  if (provider === 'youtube') {
    return openYouTubeSearch(song);
  }
  if (provider !== 'spotify') throw new Error('Choose Spotify or YouTube.');
  await shell.openExternal(`https://open.spotify.com/search/${encodeURIComponent(song.trim())}`);
  return { success: true, provider, query: song.trim() };
}

async function sendWindowsMediaKey(virtualKey, action) {
  if (process.platform !== 'win32') {
    throw new Error('Media playback controls are currently supported on Windows.');
  }
  const script = [
    'Add-Type -TypeDefinition \'using System; using System.Runtime.InteropServices; public static class MediaKey { [DllImport("user32.dll")] public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extraInfo); }\'',
    `[MediaKey]::keybd_event(${virtualKey}, 0, 0, [UIntPtr]::Zero)`,
    `[MediaKey]::keybd_event(${virtualKey}, 0, 2, [UIntPtr]::Zero)`,
  ].join('; ');
  try {
    await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      script,
    ], { windowsHide: true, timeout: 5000 });
  } catch (error) {
    throw new Error(`Could not send the ${action} media command: ${error.message}`);
  }
}

async function playSpotifyMusic(song) {
  if (song === undefined || song === null || (typeof song === 'string' && !song.trim())) {
    await sendWindowsMediaKey('0xB3', 'play/pause');
    return { success: true, message: 'Sent the system media play/pause command.' };
  }
  if (typeof song !== 'string' || song.trim().length > 200
    || /[\u0000-\u001f\u007f]/.test(song)) {
    throw new Error('Song searches must be between 1 and 200 characters.');
  }
  if (process.platform !== 'win32') {
    throw new Error('Spotify song playback automation is currently supported on Windows.');
  }
  const query = song.trim();
  try {
    await shell.openExternal(`spotify:search:track:${encodeURIComponent(query)}`);
  } catch (error) {
    throw new Error(`Could not open Spotify search: ${error.message}`);
  }
  const encodedQuery = Buffer.from(query, 'utf8').toString('base64');
  const playMatchingTrack = [
    'Add-Type -AssemblyName UIAutomationClient',
    'Add-Type -AssemblyName UIAutomationTypes',
    `$query = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedQuery}'))`,
    "function Normalize-TrackName([string]$value) { [regex]::Replace($value.ToLowerInvariant(), '[^\\p{L}\\p{N}]+', ' ').Trim() }",
    '$spotify = Get-Process Spotify -ErrorAction Stop | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1',
    'if (-not $spotify) { throw "Spotify desktop window was not found." }',
    '$normalizedQuery = Normalize-TrackName $query',
    '$exactMatch = $null',
    '$trackButtons = @()',
    '$deadline = (Get-Date).AddSeconds(8)',
    'do {',
    '  $spotify.Refresh()',
    '  $root = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$spotify.MainWindowHandle)',
    '  $buttons = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)',
    '  $trackButtons = @()',
    '  for ($index = 0; $index -lt $buttons.Count; $index++) {',
    '    $button = $buttons.Item($index)',
    '    if ($button.Current.ControlType -ne [System.Windows.Automation.ControlType]::Button) { continue }',
    '    $name = $button.Current.Name',
    "    if ($name -match '^(Play|Pause)\\s+(.+)$') { $trackButtons += [pscustomobject]@{ Element = $button; Name = $Matches[2]; Action = $Matches[1] } }",
    '  }',
    "  $exactMatch = $trackButtons | Where-Object { $_.Action -eq 'Pause' -and (Normalize-TrackName $_.Name) -eq $normalizedQuery } | Select-Object -First 1",
    "  if (-not $exactMatch) { $exactMatch = $trackButtons | Where-Object { $_.Action -eq 'Play' -and (Normalize-TrackName $_.Name) -eq $normalizedQuery } | Select-Object -First 1 }",
    '  if (-not $exactMatch -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 400 }',
    '} while (-not $exactMatch -and (Get-Date) -lt $deadline)',
    '$alreadyPlaying = ($null -ne $exactMatch -and $exactMatch.Action -eq "Pause")',
    'if (-not $exactMatch) {',
    '  $queryWords = @($normalizedQuery -split "\\s+" | Where-Object { $_.Length -gt 1 -and $_ -notin @("play", "song", "music", "spotify", "please", "by") })',
    '  if ($queryWords.Count -eq 0) { throw "Enter a song title to search." }',
    '  $ranked = @(',
    '    foreach ($track in $trackButtons | Where-Object { $_.Action -eq "Play" }) {',
    '    $trackName = Normalize-TrackName $track.Name',
    '    $matchedWords = @($queryWords | Where-Object { $trackName -match ("(^|\\s)" + [regex]::Escape($_) + "($|\\s)") }).Count',
    '    $matchedQuery = ($matchedWords -eq $queryWords.Count)',
    '    $exactTitle = ($trackName -eq $normalizedQuery)',
    '    [pscustomobject]@{ Track = $track; Score = ($matchedWords / $queryWords.Count); ExactTitle = $exactTitle; MatchedQuery = $matchedQuery }',
    '    }',
    '  )',
    '  $selection = $ranked | Sort-Object -Property ExactTitle, Score -Descending | Select-Object -First 1',
    '  if (-not $selection -or -not $selection.MatchedQuery) { throw "Spotify search did not return a sufficiently close song match." }',
    '  $exactMatch = $selection.Track',
    '}',
    'if (-not $alreadyPlaying) {',
    '  try { $exactMatch.Element.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke() }',
    '  catch { throw "Spotify found the song but could not activate its Play control: $($_.Exception.Message)" }',
    '}',
    '$normalizedTrack = Normalize-TrackName $exactMatch.Name',
    '$playingTitle = ""',
    '$consecutivePlaybackChecks = 0',
    '$confirmationDeadline = (Get-Date).AddSeconds(15)',
    'while ($consecutivePlaybackChecks -lt 3 -and (Get-Date) -lt $confirmationDeadline) {',
    '  Start-Sleep -Milliseconds 700',
    '  $spotify.Refresh()',
    '  $playingTitle = $spotify.MainWindowTitle',
    '  $root = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$spotify.MainWindowHandle)',
    '  $buttons = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)',
    '  $nowPlaying = $false',
    '  for ($index = 0; $index -lt $buttons.Count; $index++) {',
    '    $button = $buttons.Item($index)',
    '    if ($button.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and $button.Current.Name -match "^Pause\\s+(.+?)\\s+by\\s+(.+)$" -and (Normalize-TrackName $Matches[1]) -eq $normalizedTrack) { $nowPlaying = $true; break }',
    '  }',
    '  if ($nowPlaying -and (Normalize-TrackName $playingTitle).Contains($normalizedTrack)) { $consecutivePlaybackChecks++ } else { $consecutivePlaybackChecks = 0 }',
    '}',
    'if ($consecutivePlaybackChecks -lt 3) { throw "Spotify did not confirm sustained playback of the selected track. Search is open; no success was reported." }',
    '@{ track = $exactMatch.Name; title = $playingTitle; alreadyPlaying = $alreadyPlaying } | ConvertTo-Json -Compress',
  ].join('\n');
  let playback;
  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      playMatchingTrack,
    ], { windowsHide: true, timeout: 35_000 });
    playback = JSON.parse(stdout.trim());
  } catch (error) {
    throw new Error(`Could not play the Spotify search match: ${error.message}`);
  }
  return {
    success: true,
    provider: 'spotify',
    query,
    message: playback.alreadyPlaying
      ? `Spotify is already playing "${playback.title || playback.track}".`
      : `Playing "${playback.title || playback.track}" in Spotify.`,
  };
}

async function playNextSong() {
  await sendWindowsMediaKey('0xB0', 'next-track');
  return { success: true, message: 'Skipped to the next track in the active music player.' };
}

async function sendWhatsAppMessage(recipient, message, authorizeSend) {
  if (typeof recipient !== 'string' || !recipient.trim() || recipient.trim().length > 100
    || /[\u0000-\u001f\u007f]/.test(recipient)) {
    throw new Error('Provide an exact WhatsApp chat name or international phone number.');
  }
  const exactRecipient = recipient.trim();
  const phoneMatch = /^\+?[0-9\s().-]{7,24}$/.test(exactRecipient);
  let digits;
  if (phoneMatch) {
    digits = exactRecipient.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15 || digits.startsWith('0')) {
      throw new Error('Enter a valid international phone number with 7 to 15 digits.');
    }
  }
  if (typeof message !== 'string' || !message.trim() || message.trim().length > 2000) {
    throw new Error('Messages must be between 1 and 2,000 characters.');
  }
  if (typeof authorizeSend !== 'function') throw new Error('An explicit WhatsApp send request is required.');
  const exactMessage = message.trim();
  await authorizeSend({ recipient: exactRecipient, message: exactMessage });
  if (process.platform !== 'win32') {
    throw new Error('Sending messages through WhatsApp Desktop is currently supported on Windows.');
  }

  if (digits) {
    await shell.openExternal(`whatsapp://send?phone=${digits}&text=${encodeURIComponent(exactMessage)}`);
  } else {
    await openWhatsAppDesktop();
  }
  const script = [
    'Add-Type -AssemblyName UIAutomationClient',
    'Add-Type -AssemblyName UIAutomationTypes',
    '$recipient = $env:NEXA_WHATSAPP_RECIPIENT',
    '$message = $env:NEXA_WHATSAPP_MESSAGE',
    '$isPhone = $env:NEXA_WHATSAPP_IS_PHONE -eq "true"',
    '$deadline = (Get-Date).AddSeconds(30)',
    'while ((Get-Date) -lt $deadline) {',
    "  $processes = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -match 'WhatsApp' -and $_.MainWindowHandle -ne 0 }",
    '  foreach ($process in $processes) {',
    '    try {',
    '      $window = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$process.MainWindowHandle)',
    '      if (-not $isPhone) {',
    '        $chatTypes = @([System.Windows.Automation.ControlType]::ListItem, [System.Windows.Automation.ControlType]::TreeItem, [System.Windows.Automation.ControlType]::DataItem)',
    '        $chatMatches = New-Object System.Collections.Generic.List[System.Windows.Automation.AutomationElement]',
    '        $matchedChatIds = New-Object "System.Collections.Generic.HashSet[string]"',
    '        foreach ($chatType in $chatTypes) {',
    '          $chatCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, $chatType)',
    '          $chatItems = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $chatCondition)',
    '          foreach ($chatItem in $chatItems) { if (-not $chatItem.Current.IsOffscreen -and $chatItem.Current.Name.Trim() -ieq $recipient) { $chatId = [string]::Join(".", $chatItem.GetRuntimeId()); if ($matchedChatIds.Add($chatId)) { $chatMatches.Add($chatItem) } } }',
    '        }',
    '        if ($chatMatches.Count -gt 1) { throw "More than one visible chat exactly matches the recipient. Use the full international phone number instead." }',
    '        if ($chatMatches.Count -eq 0) {',
    '          $nameCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $recipient)',
    '          $textItems = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $nameCondition)',
    '          $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker',
    '          foreach ($textItem in $textItems) {',
    '            $ancestor = $walker.GetParent($textItem)',
    '            while ($ancestor -and $ancestor.Current.ControlType -ne [System.Windows.Automation.ControlType]::Window) {',
    '              if ($chatTypes -contains $ancestor.Current.ControlType -and -not $ancestor.Current.IsOffscreen) { $chatId = [string]::Join(".", $ancestor.GetRuntimeId()); if ($matchedChatIds.Add($chatId)) { $chatMatches.Add($ancestor) }; break }',
    '              $ancestor = $walker.GetParent($ancestor)',
    '            }',
    '          }',
    '        }',
    '        if ($chatMatches.Count -gt 1) { throw "More than one visible chat exactly matches the recipient. Use the full international phone number instead." }',
    '        if ($chatMatches.Count -eq 0) { throw "No visible WhatsApp chat exactly matches the recipient. Use its full international phone number or check the chat name." }',
    '        if ($chatMatches.Count -eq 1) {',
    '          try { $chatMatches[0].GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Select() } catch { try { $chatMatches[0].GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke() } catch { $chatMatches[0].SetFocus() } }',
    '          Start-Sleep -Milliseconds 500',
    '        }',
    '      } else {',
    '        $expectedPhone = $recipient -replace "\\D", ""',
    '        $allElements = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)',
    '        $phoneVisible = $false',
    '        for ($elementIndex = 0; $elementIndex -lt $allElements.Count; $elementIndex++) {',
    '          $label = $allElements.Item($elementIndex)',
    '          if ($label.Current.IsOffscreen) { continue }',
    '          $visibleDigits = $label.Current.Name -replace "\\D", ""',
    '          if ($visibleDigits.Contains($expectedPhone)) { $phoneVisible = $true; break }',
    '        }',
    '        if (-not $phoneVisible) { throw "WhatsApp did not expose the exact phone number in the selected chat. Nothing was sent." }',
    '      }',
    '      $composerTypes = @([System.Windows.Automation.ControlType]::Edit, [System.Windows.Automation.ControlType]::Document)',
    '      $messageEdits = @()',
    '      foreach ($composerType in $composerTypes) {',
    '        $editCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, $composerType)',
    '        $edits = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $editCondition)',
    '        $messageEdits += @($edits | Where-Object { $_.Current.IsEnabled -and $_.Current.Name -match "(?i)message" })',
    '      }',
    '      if ($messageEdits.Count -ne 1) { continue }',
    '      $composer = $messageEdits[0]',
    '      $composer.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue($message)',
    '      if ($composer.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value -cne $message) { throw "WhatsApp did not accept the exact message text." }',
    '      $buttonCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)',
    '      $buttons = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $buttonCondition)',
    "      foreach ($button in $buttons) { if ($button.Current.Name -match '^(Send|Send message)$' -and $button.Current.IsEnabled) { $button.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke(); Write-Output 'NEXA_WHATSAPP_SENT'; exit 0 } }",
    '      throw "The exact message is in the composer, but WhatsApp did not expose an accessible Send button."',
    '    } catch { if ($_.Exception.Message -match "visible chat exactly matches|No visible WhatsApp chat|exact message|accessible Send button") { throw } }',
    '  }',
    '  Start-Sleep -Milliseconds 500',
    '}',
    'throw "WhatsApp Desktop could not find the requested exact chat and a message composer. Nothing was sent."',
  ].join('\n');
  let stdout;
  try {
    ({ stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      script,
    ], {
      windowsHide: true,
      timeout: 35_000,
      env: {
        ...process.env,
        NEXA_WHATSAPP_RECIPIENT: exactRecipient,
        NEXA_WHATSAPP_MESSAGE: exactMessage,
        NEXA_WHATSAPP_IS_PHONE: String(Boolean(digits)),
      },
    }));
  } catch (error) {
    throw new Error(`Could not send the WhatsApp message: ${error.message}`);
  }
  if (!stdout.includes('NEXA_WHATSAPP_SENT')) {
    throw new Error('WhatsApp did not confirm the message was sent.');
  }
  return {
    success: true,
    sent: true,
    recipient: digits ? `+${digits}` : exactRecipient,
    message: `${exactRecipient}-nu message ayachittundu!`,
  };
}

function calculate(expression) {
  if (typeof expression !== 'string' || expression.length > 120) {
    throw new Error('Calculations must be 1 to 120 characters long.');
  }
  const tokens = expression.match(/\d+(?:\.\d*)?|\.\d+|[()+*/%\-]/g);
  if (!tokens || tokens.join('') !== expression.replace(/\s+/g, '')) {
    throw new Error('Use numbers, parentheses, and basic arithmetic operators only.');
  }
  let position = 0;
  function parseExpression() {
    let value = parseTerm();
    while (tokens[position] === '+' || tokens[position] === '-') {
      const operator = tokens[position++];
      const right = parseTerm();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }
  function parseTerm() {
    let value = parseFactor();
    while (['*', '/', '%'].includes(tokens[position])) {
      const operator = tokens[position++];
      const right = parseFactor();
      if ((operator === '/' || operator === '%') && right === 0) throw new Error('Division by zero is undefined.');
      value = operator === '*' ? value * right : operator === '/' ? value / right : value % right;
    }
    return value;
  }
  function parseFactor() {
    const token = tokens[position++];
    if (token === '+' || token === '-') {
      const value = parseFactor();
      return token === '-' ? -value : value;
    }
    if (token === '(') {
      const value = parseExpression();
      if (tokens[position++] !== ')') throw new Error('Please check the parentheses.');
      return value;
    }
    if (!token || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) {
      throw new Error('Provide a valid arithmetic expression.');
    }
    return Number(token);
  }
  const value = parseExpression();
  if (position !== tokens.length || !Number.isFinite(value)) throw new Error('Provide a valid arithmetic expression.');
  return value;
}

module.exports = {
  launchApp, closeApp, openWebsite, searchWeb, openYouTubeSearch, playSong, playSpotifyMusic,
  playNextSong, sendWhatsAppMessage, calculate, websiteUrls, spotifyMediaControl,
  parseLocalTimerIntent,
  listWifiNetworks, connectWifi, openConnectivitySettings, manageBluetoothConnection,
  listRunningApps, getSystemStatus,
  getBatteryStatus, setScreenBrightness, controlSystemSetting, lockDevice, openCamera,
};

(function exposeLocalCommandParser(root) {
  const fillerPattern = /\b(hey|hi|hello|please|can you|could you|would you|will you|nexa|shampu)\b/gi;
  const webShortcuts = new Set(['youtube', 'google', 'instagram']);
  const applicationAliases = new Map([
    ['whats app', 'whatsapp'],
    ['you tube', 'youtube'],
    ['insta', 'instagram'],
    ['yt', 'youtube'],
  ]);

  function normalizeTarget(value) {
    const target = value.trim();
    return applicationAliases.get(target) ?? target;
  }

  function normalizeLocalCommand(value) {
    if (typeof value !== 'string') return '';
    return value
      .replace(fillerPattern, ' ')
      .replace(/[^\p{L}\p{N} ._'-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function parseLocalCommand(value) {
    if (parseSpotifyPlayRequest(value)) return undefined;

    const normalized = normalizeLocalCommand(value)
      .replace(/\bwhats\s+app\b/g, 'whatsapp')
      .replace(/\byou\s+tube\b/g, 'youtube')
      .replace(/\s+(?:on\s+(?:my\s+)?(?:pc|computer|laptop))$/, '')
      .replace(/\s+(?:desktop\s+)?(?:app|application|website|site|web\s+app)$/, '')
      .trim();
    const launchMatch = /^(?:open(?:\s+up)?|launch|start|run|visit|browse(?:\s+to)?|go\s+to)\s+(.+)$/.exec(normalized);
    if (launchMatch) return { action: 'launch', target: normalizeTarget(launchMatch[1]) };

    const closeMatch = /^(?:close|quit|exit)\s+(.+)$/.exec(normalized);
    if (closeMatch) return { action: 'close', target: normalizeTarget(closeMatch[1]) };

    if (webShortcuts.has(normalized)) return { action: 'launch', target: normalized };
    return undefined;
  }

  function parseSpotifyPlayRequest(value) {
    const normalized = normalizeLocalCommand(value)
      .replace(/\bwhats\s+app\b/g, 'whatsapp')
      .replace(/\byou\s+tube\b/g, 'youtube')
      .replace(/[.!?]+$/, '')
      .trim();
    const patterns = [
      /^(?:open|launch|start)\s+spotify\s+and\s+(?:play|find\s+and\s+play|search\s+and\s+play)\s+(?:the\s+)?(.+)$/,
      /^(?:play|find\s+and\s+play|search\s+and\s+play)\s+(?:the\s+)?(.+?)\s+(?:on|in)\s+spotify$/,
    ];
    for (const pattern of patterns) {
      const match = pattern.exec(normalized);
      if (!match) continue;
      const song = match[1].replace(/\s+(?:song|track)$/, '').trim();
      if (song) return { action: 'playSpotifyMusic', song };
    }
    return undefined;
  }

  root.normalizeLocalCommand = normalizeLocalCommand;
  root.parseLocalCommand = parseLocalCommand;
  root.parseSpotifyPlayRequest = parseSpotifyPlayRequest;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { normalizeLocalCommand, parseLocalCommand, parseSpotifyPlayRequest };
  }
}(globalThis));

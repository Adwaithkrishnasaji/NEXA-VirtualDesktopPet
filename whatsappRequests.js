(function exposeWhatsAppRequestParser(root) {
  function getHistoryText(entry) {
    return Array.isArray(entry?.parts)
      ? entry.parts.map((part) => typeof part?.text === 'string' ? part.text : '').join('\n')
      : '';
  }

  function parseWhatsAppSendRequest(text, history) {
    if (typeof text !== 'string') return undefined;
    const trimmed = text.trim().replace(/^(?:(?:hey|hi|hello|nexa|shampu|please|can you)\b[\s,!.]*)+/i, '').trim();
    const quotedRequest = /^(?:please\s+)?(?:send|message|text)\s+(?:this\s+)?["“]([^"”]{1,2000})["”]\s+(?:to|for)\s+(.+?)(?:\s+(?:on|via)\s+whatsapp)?[.!?]*$/i.exec(trimmed);
    if (quotedRequest) {
      return { message: quotedRequest[1].trim(), recipient: quotedRequest[2].trim() };
    }

    const numberRequest = /^(?:please\s+)?(?:send|text|message)\s+(?:this\s+)?(?:message\s+)?(?:to|for)\s+(\+?[0-9][0-9\s().-]{6,23})\s*(?::|[-–—]\s*)\s*(?:"([^"]{1,2000})"|“([^”]{1,2000})”|(.+?))[.!?]*$/i.exec(trimmed);
    if (numberRequest) {
      return {
        recipient: numberRequest[1].trim(),
        message: (numberRequest[2] ?? numberRequest[3] ?? numberRequest[4]).trim(),
      };
    }

    const namedRequest = /^(?:please\s+)?(?:send|text|message)\s+(?:this\s+)?(?:message\s+)?(?:to|for)\s+(.+?)\s*:\s*(?:"([^"]{1,2000})"|“([^”]{1,2000})”|(.+?))[.!?]*$/i.exec(trimmed);
    if (namedRequest) {
      return {
        recipient: namedRequest[1].trim(),
        message: (namedRequest[2] ?? namedRequest[3] ?? namedRequest[4]).trim(),
      };
    }

    if (!/^(?:please\s+)?(?:now\s+)?send\s+(?:that|this)\s+message(?:\s+to\s+.+)?[.!?]*$/i.test(trimmed)) {
      return undefined;
    }

    for (const entry of [...(Array.isArray(history) ? history : [])].reverse()) {
      const previousText = getHistoryText(entry);
      const numberMatch = /(?:\+\s*\d[\d\s().-]{5,22}\d)/.exec(previousText);
      const messageMatch = /(?:message|text)\s*(?:is|:)?\s*["“]([^"”]{1,2000})["”]/i.exec(previousText);
      if (numberMatch && messageMatch) {
        return {
          recipient: numberMatch[0].trim(),
          message: messageMatch[1].trim(),
        };
      }
    }
    return undefined;
  }

  root.parseWhatsAppSendRequest = parseWhatsAppSendRequest;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseWhatsAppSendRequest };
  }
}(globalThis));

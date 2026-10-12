async function searchYouTubeMatches(query, apiKey) {
  if (typeof query !== 'string' || !query.trim() || query.trim().length > 200
    || /[\u0000-\u001f\u007f]/.test(query)) {
    throw new Error('Song searches must be between 1 and 200 characters.');
  }
  if (typeof apiKey !== 'string' || !apiKey) {
    throw new Error('YouTube song search needs an API key. Add one under Settings → AI provider keys.');
  }
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.search = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoCategoryId: '10',
    maxResults: '5',
    order: 'relevance',
    q: query.trim(),
    key: apiKey,
  }).toString();
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    throw new Error(`YouTube search request failed: ${error.message}`);
  }
  if (!response.ok) {
    throw new Error(`YouTube search failed (HTTP ${response.status}). Check the YouTube Data API key and API quota.`);
  }
  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`YouTube returned an invalid search response: ${error.message}`);
  }
  const matches = Array.isArray(data.items)
    ? data.items.filter((item) => /^[A-Za-z0-9_-]{11}$/.test(item.id?.videoId ?? ''))
    : [];
  if (!matches.length) throw new Error('YouTube did not return a playable match for that song.');
  return matches.map((item) => ({
    videoId: item.id.videoId,
    title: typeof item.snippet?.title === 'string' ? item.snippet.title.slice(0, 200) : '',
  }));
}

module.exports = { searchYouTubeMatches };

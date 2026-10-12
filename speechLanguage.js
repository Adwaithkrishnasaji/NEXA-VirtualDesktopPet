const malayalamWords = new Set([
  'alle', 'aano', 'aanu', 'aaraanu', 'aaraannu', 'ahnu', 'allenkil', 'avide',
  'aayirikkum', 'engane', 'enthokke', 'cheyyam', 'cheyyu', 'cheythu', 'chaya',
  'enthada', 'enthanu', 'enthu', 'evide', 'ivide', 'irikkua', 'irikkunnu',
  'irikkuva', 'kando', 'kaaryam', 'kayilundo', 'kayyilundo', 'kelkku', 'kittum',
  'kudikkan', 'kudikkaan', 'manassilayi', 'marannu', 'mathi', 'nammal',
  'nattukarkellam', 'nalla', 'nallathu', 'njan', 'ningal', 'ningale', 'ningalude',
  'onn', 'onnude', 'ormayundu', 'paranjaal', 'paranjal', 'parayu', 'parayuka',
  'parayuvane', 'podey', 'poyi', 'saadhanam', 'sadhanam', 'pinne', 'sugham',
  'sughamalle', 'sughamallo', 'sughamano', 'sukham', 'sukhamano', 'thanne',
  'thurannu', 'undu', 'venam', 'veruthe', 'vishakkunnu', 'vallathum', 'valare',
  'enikku', 'enikk', 'ente', 'ningalkku',
]);

const distinctiveMalayalamWords = new Set([
  'alle', 'aaraanu', 'aaraannu', 'avide', 'cheyyam', 'cheyyu', 'cheythu',
  'enthada', 'enthanu', 'enthu', 'evide', 'ivide', 'irikkunnu', 'irikkuva',
  'engane', 'enthokke', 'allenkil', 'nattukarkellam', 'mathi', 'nammal',
  'kayilundo', 'kayyilundo', 'kudikkan', 'kudikkaan', 'manassilayi', 'marannu',
  'njan', 'ningal', 'ningale', 'ningalude', 'onnude', 'ormayundu', 'paranjaal',
  'paranjal', 'parayu', 'parayuka', 'parayuvane', 'podey', 'poyi', 'saadhanam',
  'sadhanam', 'sugham', 'sughamalle', 'sughamallo', 'sughamano', 'sukham',
  'sukhamano', 'thurannu', 'undu', 'venam', 'veruthe', 'vishakkunnu',
  'vallathum', 'enikku', 'enikk', 'ente', 'pinne',
]);

function detectSpeechLanguage(text) {
  if (typeof text !== 'string') throw new TypeError('Speech language detection requires a string.');
  if (/[\u0D00-\u0D7F]/u.test(text)) return 'ml';
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const matches = new Set(words.filter((word) => malayalamWords.has(word)));
  if ([...matches].some((word) => distinctiveMalayalamWords.has(word))) return 'ml';
  return matches.size >= 2 ? 'ml' : 'en';
}

module.exports = { detectSpeechLanguage };

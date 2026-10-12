const blockedCategories = /\b(password|passcode|api\s*key|access\s*token|secret|security\s*code|credit\s*card|bank\s*account)\b/i;

function extractPersonalDetails(text) {
  if (typeof text !== 'string') return [];
  const facts = [];
  const valueEnd = '(?=\\s+(?:and\\s+)?(?:my|i)\\s+|\\s*[.!?;\\r\\n]|$)';
  const patterns = [
    new RegExp(`\\bmy\\s+([a-z][a-z -]{0,50}?)\\s+(?:is|are)\\s+(.{1,300}?)${valueEnd}`, 'gi'),
    new RegExp(`\\bi\\s+am\\s+allergic\\s+to\\s+(.{1,300}?)${valueEnd}`, 'gi'),
    new RegExp(`\\bi\\s+live\\s+in\\s+(.{1,300}?)${valueEnd}`, 'gi'),
    new RegExp(`\\bi\\s+work\\s+(at|as)\\s+(.{1,300}?)${valueEnd}`, 'gi'),
  ];
  for (const [index, pattern] of patterns.entries()) {
    for (const match of text.matchAll(pattern)) {
      let category;
      let value;
      if (index === 0) {
        [, category, value] = match;
      } else if (index === 1) {
        category = 'allergy';
        [, value] = match;
      } else if (index === 2) {
        category = 'home';
        [, value] = match;
      } else {
        category = match[1] === 'at' ? 'workplace' : 'occupation';
        value = match[2];
      }
      category = category.trim().replace(/\bfav(?:ou?rite)?\b/gi, 'favorite');
      value = value.trim().replace(/[\s,;]+$/, '');
      if (!category || !value || blockedCategories.test(category)) continue;
      facts.push({ category, value });
    }
  }
  return facts.filter((fact, index) => facts.findIndex((candidate) => (
    candidate.category.toLowerCase() === fact.category.toLowerCase()
      && candidate.value.toLowerCase() === fact.value.toLowerCase()
  )) === index);
}

function validatePersonalMemory(category, value) {
  if (typeof category !== 'string' || typeof value !== 'string') {
    throw new Error('A memory needs a text category and detail.');
  }
  const cleanCategory = category.trim()
    .replace(/\s+/g, ' ')
    .replace(/\bfav(?:ou?rite)?\b/gi, 'favorite');
  const cleanValue = value.trim().replace(/\s+/g, ' ');
  if (!cleanCategory || cleanCategory.length > 60 || /[\u0000-\u001f\u007f]/.test(cleanCategory)) {
    throw new Error('Memory categories must be between 1 and 60 characters.');
  }
  if (!cleanValue || cleanValue.length > 300 || /[\u0000-\u001f\u007f]/.test(cleanValue)) {
    throw new Error('Memory details must be between 1 and 300 characters.');
  }
  if (blockedCategories.test(cleanCategory)) {
    throw new Error('Passwords, access tokens, and financial account details are not saved as memories.');
  }
  return { category: cleanCategory, value: cleanValue };
}

function allowsMultipleValues(category) {
  return /^(?:favorite\s+)?(?:songs?|places?|people|persons?|artists?|foods?|movies?|books?|games?|hobbies|friends?|family members?)$/i
    .test(category);
}

module.exports = { extractPersonalDetails, validatePersonalMemory, allowsMultipleValues };

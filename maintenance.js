const profileForm = document.getElementById('profile-form');
const credentialsForm = document.getElementById('credentials-form');
const spriteGallery = document.getElementById('sprite-gallery');
const spriteInput = document.getElementById('sprite-file');
const spritePreview = document.getElementById('sprite-preview');
const keepCustomSpriteInput = document.getElementById('keep-custom-sprite');
const profileError = document.getElementById('profile-error');
const pageStatus = document.getElementById('page-status');
const maxSpriteSize = 5 * 1024 * 1024;
let selectedSprite = 'pippa';
let spriteDataUrl = null;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected sprite.'));
    reader.readAsDataURL(file);
  });
}

function renderSpriteGallery(sprites) {
  spriteGallery.replaceChildren();
  for (const sprite of sprites) {
    const label = document.createElement('label');
    label.className = 'sprite-option';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'spriteKey';
    radio.value = sprite.id;
    radio.checked = sprite.id === selectedSprite;
    radio.addEventListener('change', () => {
      selectedSprite = sprite.id;
      keepCustomSpriteInput.checked = false;
      spriteDataUrl = null;
      spriteInput.value = '';
      spritePreview.hidden = true;
    });
    const image = document.createElement('img');
    image.src = `sprites/${sprite.id}.svg`;
    image.alt = '';
    const details = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = `${sprite.name} · ${sprite.type}`;
    const description = document.createElement('small');
    description.textContent = `${sprite.color}; ${sprite.animation}`;
    details.append(name, description);
    label.append(radio, image, details);
    spriteGallery.append(label);
  }
}

spriteInput.addEventListener('change', async () => {
  profileError.hidden = true;
  spriteDataUrl = null;
  spritePreview.hidden = true;
  const [file] = spriteInput.files;
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)
    || file.size < 1 || file.size > maxSpriteSize) {
    spriteInput.value = '';
    profileError.textContent = 'Choose a non-empty PNG, JPEG, WebP, or GIF up to 5 MB.';
    profileError.hidden = false;
    return;
  }
  try {
    spriteDataUrl = await readFileAsDataUrl(file);
    spritePreview.src = spriteDataUrl;
    spritePreview.hidden = false;
    keepCustomSpriteInput.checked = false;
  } catch (error) {
    profileError.textContent = error.message;
    profileError.hidden = false;
  }
});

profileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  profileError.hidden = true;
  const petName = document.getElementById('pet-name').value.trim();
  if (!petName || petName.length > 32 || /[\u0000-\u001f\u007f]/.test(petName)) {
    profileError.textContent = 'Enter a pet name between 1 and 32 characters.';
    profileError.hidden = false;
    return;
  }
  const button = document.getElementById('save-profile');
  button.disabled = true;
  button.textContent = 'Saving…';
  try {
    const result = await window.nexaApi.saveMaintenanceProfile({
      petName,
      spriteKey: selectedSprite,
      character: document.getElementById('character-style').value,
      spriteDataUrl,
      keepCustomSprite: keepCustomSpriteInput.checked,
    });
    pageStatus.textContent = `${result.petName}'s profile was saved. The pet window has been updated.`;
    keepCustomSpriteInput.checked = result.usingCustomSprite;
    if (spriteDataUrl) {
      spritePreview.src = spriteDataUrl;
      spritePreview.hidden = false;
    }
    spriteDataUrl = null;
    spriteInput.value = '';
  } catch (error) {
    profileError.textContent = error.message;
    profileError.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = 'Save pet profile';
  }
});

credentialsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  pageStatus.textContent = '';
  try {
    const result = await window.nexaApi.updateCredentials({
      geminiApiKey: document.getElementById('gemini-api-key').value.trim(),
      groqApiKey: document.getElementById('groq-api-key').value.trim(),
      youtubeApiKey: document.getElementById('youtube-api-key').value.trim(),
    });
    document.getElementById('gemini-api-key').value = '';
    document.getElementById('groq-api-key').value = '';
    document.getElementById('youtube-api-key').value = '';
    document.getElementById('credential-status').textContent =
      `Gemini: ${result.geminiConfigured ? 'configured' : 'missing'} · Groq backup: ${result.groqConfigured ? 'configured' : 'not configured'} · YouTube: ${result.youtubeConfigured ? 'configured' : 'not configured'}.`;
    pageStatus.textContent = 'Provider keys were encrypted and updated.';
  } catch (error) {
    pageStatus.textContent = `Could not update keys: ${error.message}`;
  }
});

document.getElementById('remove-youtube-key').addEventListener('click', async () => {
  if (!window.confirm('Remove the saved YouTube Data API key?')) return;
  try {
    const result = await window.nexaApi.updateCredentials({ youtubeApiKey: null });
    document.getElementById('credential-status').textContent =
      `Gemini: ${result.geminiConfigured ? 'configured' : 'missing'} · Groq backup: ${result.groqConfigured ? 'configured' : 'not configured'} · YouTube: not configured.`;
    pageStatus.textContent = 'YouTube Data API key removed.';
  } catch (error) {
    pageStatus.textContent = `Could not remove YouTube key: ${error.message}`;
  }
});

document.getElementById('remove-groq-key').addEventListener('click', async () => {
  if (!window.confirm('Remove the saved Groq backup key?')) return;
  try {
    const result = await window.nexaApi.updateCredentials({ groqApiKey: null });
    document.getElementById('credential-status').textContent =
      `Gemini: ${result.geminiConfigured ? 'configured' : 'missing'} · Groq backup: not configured.`;
    pageStatus.textContent = 'Groq backup key removed.';
  } catch (error) {
    pageStatus.textContent = `Could not remove Groq key: ${error.message}`;
  }
});

async function initializeMaintenance() {
  try {
    const profile = await window.nexaApi.readMaintenanceProfile();
    document.getElementById('model-version').textContent = profile.modelVersion;
    document.getElementById('pet-name').value = profile.petName;
    document.getElementById('character-style').value = profile.character;
    selectedSprite = profile.spriteKey;
    renderSpriteGallery(profile.availableSprites);
    keepCustomSpriteInput.checked = Boolean(profile.spriteUrl);
    if (profile.spriteUrl) {
      spritePreview.src = profile.spriteUrl;
      spritePreview.hidden = false;
    }
    document.getElementById('credential-status').textContent =
      `Gemini: ${profile.credentials.geminiConfigured ? 'configured' : 'missing'} · Groq backup: ${profile.credentials.groqConfigured ? 'configured' : 'not configured'} · YouTube: ${profile.credentials.youtubeConfigured ? 'configured' : 'not configured'}.`;
    if (!profile.encryptionAvailable) {
      pageStatus.textContent = 'OS secure storage is unavailable; provider keys cannot be safely updated.';
      credentialsForm.querySelector('button[type="submit"]').disabled = true;
      document.getElementById('remove-groq-key').disabled = true;
      document.getElementById('remove-youtube-key').disabled = true;
    }
  } catch (error) {
    pageStatus.textContent = `Could not load pet maintenance: ${error.message}`;
    profileForm.querySelectorAll('input, select, button').forEach((element) => { element.disabled = true; });
    credentialsForm.querySelectorAll('input, button').forEach((element) => { element.disabled = true; });
  }
}

void initializeMaintenance();

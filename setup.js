const form = document.getElementById('setup-form');
const petNameInput = document.getElementById('pet-name');
const geminiApiKeyInput = document.getElementById('gemini-api-key');
const groqApiKeyInput = document.getElementById('groq-api-key');
const spriteInput = document.getElementById('sprite-file');
const spritePreview = document.getElementById('sprite-preview');
const spriteGallery = document.getElementById('sprite-gallery');
const characterInput = document.getElementById('character-style');
const errorMessage = document.getElementById('setup-error');
const finishButton = document.getElementById('finish-setup');
const maxSpriteSize = 5 * 1024 * 1024;
const fallbackSprites = [
  { id: 'pippa', name: 'Pippa', type: 'Bunny', color: 'Rose', animation: 'Ear wiggle and happy bounce' },
  { id: 'bolt', name: 'Bolt', type: 'Robot', color: 'Sky blue', animation: 'Antenna pulse and servo turn' },
  { id: 'ember', name: 'Ember', type: 'Fox', color: 'Tangerine', animation: 'Tail swish and playful pounce' },
  { id: 'sprout', name: 'Sprout', type: 'Frog', color: 'Leaf green', animation: 'Blink and springy hop' },
  { id: 'luna', name: 'Luna', type: 'Cat', color: 'Midnight', animation: 'Star shimmer and floating sway' },
  { id: 'sunny', name: 'Sunny', type: 'Chick', color: 'Golden', animation: 'Wing flap and cheerful bob' },
];

let spriteDataUrl = null;
let selectedSprite = 'pippa';

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
      spriteDataUrl = null;
      spriteInput.value = '';
      spritePreview.hidden = true;
    });
    const image = document.createElement('img');
    image.src = new URL(`sprites/${sprite.id}.svg`, window.location.href).href;
    image.alt = `${sprite.name}, a ${sprite.color.toLowerCase()} ${sprite.type.toLowerCase()}`;
    image.addEventListener('error', () => {
      image.classList.add('sprite-preview-unavailable');
      image.alt = `${sprite.name} animation preview unavailable`;
    }, { once: true });
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

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

async function pasteApiKey(button) {
  const input = document.getElementById(button.dataset.pasteTarget);
  try {
    const clipboardText = await window.nexaApi.readClipboardText();
    const pastedText = clipboardText.trim();
    if (!pastedText) {
      showError('The clipboard is empty. Copy your API key, then choose Paste.');
      return;
    }
    input.value = pastedText;
    input.focus();
    errorMessage.hidden = true;
  } catch (error) {
    showError(`Could not paste from the clipboard: ${error.message}`);
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected sprite.'));
    reader.readAsDataURL(file);
  });
}

async function showSetupVersion() {
  try {
    const setup = await window.nexaApi.readPetSetup();
    renderSpriteGallery(Array.isArray(setup.availableSprites) && setup.availableSprites.length
      ? setup.availableSprites
      : fallbackSprites);
    if (setup.configured) {
      showError('This pet is already configured. Close this window and start the pet again.');
      finishButton.disabled = true;
      return;
    }
    if (!setup.encryptionAvailable) {
      showError('This device does not provide OS secure storage. NEXA will not save API keys without encryption.');
      finishButton.disabled = true;
      return;
    }
    document.getElementById('model-version').textContent = setup.modelVersion;
    document.getElementById('footer-version').textContent = setup.modelVersion;
  } catch (error) {
    renderSpriteGallery(fallbackSprites);
    showError(`Could not load setup: ${error.message}`);
    finishButton.disabled = true;
  }
}

document.querySelectorAll('.paste-button').forEach((button) => {
  button.addEventListener('click', () => {
    void pasteApiKey(button);
  });
});

spriteInput.addEventListener('change', async () => {
  errorMessage.hidden = true;
  spriteDataUrl = null;
  spritePreview.hidden = true;
  const [file] = spriteInput.files;
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
    spriteInput.value = '';
    showError('Choose a PNG, JPEG, WebP, or GIF sprite.');
    return;
  }
  if (file.size === 0 || file.size > maxSpriteSize) {
    spriteInput.value = '';
    showError('The sprite must be larger than 0 bytes and no larger than 5 MB.');
    return;
  }
  try {
    spriteDataUrl = await readFileAsDataUrl(file);
    spritePreview.src = spriteDataUrl;
    spritePreview.hidden = false;
  } catch (error) {
    showError(error.message);
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorMessage.hidden = true;
  const petName = petNameInput.value.trim();
  const geminiApiKey = geminiApiKeyInput.value.trim();
  const groqApiKey = groqApiKeyInput.value.trim();
  if (!petName) {
    petNameInput.focus();
    showError('A pet name is required.');
    return;
  }
  if (petName.length > 32 || /[\u0000-\u001f\u007f]/.test(petName)) {
    petNameInput.focus();
    showError('Use a pet name between 1 and 32 characters without control characters.');
    return;
  }
  if (geminiApiKey.length < 20 || geminiApiKey.length > 512 || /[\s\u0000-\u001f\u007f]/u.test(geminiApiKey)) {
    geminiApiKeyInput.focus();
    showError('Enter a Gemini API key between 20 and 512 characters without spaces.');
    return;
  }
  if (groqApiKey
    && (groqApiKey.length < 20 || groqApiKey.length > 512 || /[\s\u0000-\u001f\u007f]/u.test(groqApiKey))) {
    groqApiKeyInput.focus();
    showError('The optional Groq key must be between 20 and 512 characters without spaces.');
    return;
  }

  const featureInterests = [...form.querySelectorAll('input[name="featureInterest"]:checked')]
    .map((input) => input.value);
  finishButton.disabled = true;
  finishButton.textContent = 'Saving setup…';
  try {
    const result = await window.nexaApi.savePetSetup({
      petName,
      spriteDataUrl,
      spriteKey: selectedSprite,
      character: characterInput.value,
      featureInterests,
      geminiApiKey,
      groqApiKey,
    });
    geminiApiKeyInput.value = '';
    groqApiKeyInput.value = '';
    if (!result.shortcutCreated) {
      showError(`Pet setup was saved, but the desktop shortcut could not be created: ${result.shortcutError}`);
    }
  } catch (error) {
    finishButton.disabled = false;
    finishButton.textContent = 'Save setup and start pet';
    showError(error.message);
  }
});

renderSpriteGallery(fallbackSprites);
void showSetupVersion();

// Global state
let sdk = null;
let chatClient = null;
let imageClient = null;
let npcs = new Map(); // Map<name, NPCClient>
let currentNPC = null;
let p5Instance = null;
let lastGeneratedImage = null; // Store last generated image for download
let img2imgData = null; // Store img2img input image
let chatAttachments = []; // Store chat image attachments

// NPC Actions state
let actionsNPC = null;
let definedActions = [];

// DOM Elements
const elements = {
  // Config
  gameIdInput: document.getElementById('game-id-input'),
  authMethod: document.getElementById('auth-method'),
  tokenInputContainer: document.getElementById('token-input-container'),
  developerTokenInput: document.getElementById('developer-token-input'),
  chatModel: document.getElementById('chat-model'),
  imageModel: document.getElementById('image-model'),
  initButton: document.getElementById('init-button'),
  logoutButton: document.getElementById('logout-button'),
  debugToggle: document.getElementById('debug-toggle'),
  statusIndicator: document.getElementById('status-indicator'),
  creditDisplay: document.getElementById('credit-display'),
  creditValue: document.getElementById('credit-value'),

  // Chat
  chatSystemPrompt: document.getElementById('chat-system-prompt'),
  chatStreaming: document.getElementById('chat-streaming'),
  chatTemperature: document.getElementById('chat-temperature'),
  temperatureValue: document.getElementById('temperature-value'),
  chatMessages: document.getElementById('chat-messages'),
  chatInput: document.getElementById('chat-input'),
  chatSend: document.getElementById('chat-send'),
  chatClear: document.getElementById('chat-clear'),
  chatImageInput: document.getElementById('chat-image-input'),
  chatAttachments: document.getElementById('chat-attachments'),
  chatAttachmentPreviews: document.getElementById('chat-attachment-previews'),

  // Image
  imageSize: document.getElementById('image-size'),
  imagePrompt: document.getElementById('image-prompt'),
  imageGenerate: document.getElementById('image-generate'),
  imageLoading: document.getElementById('image-loading'),
  imageGallery: document.getElementById('image-gallery'),
  p5CanvasContainer: document.getElementById('p5-canvas-container'),
  imageDownloadContainer: document.getElementById('image-download-container'),
  downloadImageBtn: document.getElementById('download-image-btn'),
  imageTransparent: document.getElementById('image-transparent'),
  img2imgInput: document.getElementById('img2img-input'),
  img2imgFilename: document.getElementById('img2img-filename'),
  img2imgClear: document.getElementById('img2img-clear'),
  img2imgPreview: document.getElementById('img2img-preview'),

  // NPC
  npcList: document.getElementById('npc-list'),
  npcName: document.getElementById('npc-name'),
  npcSystemPrompt: document.getElementById('npc-system-prompt'),
  npcCreate: document.getElementById('npc-create'),
  npcConversationContainer: document.getElementById('npc-conversation-container'),
  npcMessages: document.getElementById('npc-messages'),
  npcInput: document.getElementById('npc-input'),
  npcSend: document.getElementById('npc-send'),
  npcSave: document.getElementById('npc-save'),
  npcLoad: document.getElementById('npc-load'),
  npcReset: document.getElementById('npc-reset'),

  // Recharge
  rechargeButton: document.getElementById('recharge-button'),

  // NPC Actions
  actionsNpcPrompt: document.getElementById('actions-npc-prompt'),
  actionsList: document.getElementById('actions-list'),
  customActionName: document.getElementById('custom-action-name'),
  customActionDesc: document.getElementById('custom-action-desc'),
  addCustomAction: document.getElementById('add-custom-action'),
  createActionsNpc: document.getElementById('create-actions-npc'),
  actionsConversationContainer: document.getElementById('actions-conversation-container'),
  actionEvents: document.getElementById('action-events'),
  actionsMessages: document.getElementById('actions-messages'),
  actionsInput: document.getElementById('actions-input'),
  actionsSend: document.getElementById('actions-send'),
  actionsReset: document.getElementById('actions-reset'),
  presetMerchant: document.getElementById('action-preset-merchant'),
  presetQuest: document.getElementById('action-preset-quest'),
  presetGuard: document.getElementById('action-preset-guard'),
};

// Initialize
function init() {
  setupEventListeners();
  setupP5Canvas();
  loadSavedConfig();
  initializeI18n();
  initializeNpcActions();
}

// Initialize i18n
function initializeI18n() {
  // Set language selector
  const langSelector = document.getElementById('language-selector');
  langSelector.value = i18n.getCurrentLanguage();

  // Update page with current language
  i18n.updatePage();

  // Listen for language changes
  langSelector.addEventListener('change', (e) => {
    i18n.setLanguage(e.target.value);
  });
}

// Setup Event Listeners
function setupEventListeners() {
  // Tab switching
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });

  // Auth method toggle
  elements.authMethod.addEventListener('change', (e) => {
    elements.tokenInputContainer.classList.toggle('hidden', e.target.value !== 'token');
  });

  // Initialize SDK
  elements.initButton.addEventListener('click', initializeSDK);

  // Logout
  elements.logoutButton.addEventListener('click', logout);

  // Debug toggle
  elements.debugToggle.addEventListener('change', (e) => {
    if (sdk) {
      sdk.setDebug(e.target.checked);
    }
  });

  // Chat
  elements.chatSend.addEventListener('click', sendChatMessage);
  elements.chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });
  elements.chatClear.addEventListener('click', clearChatHistory);

  // Temperature slider
  elements.chatTemperature.addEventListener('input', (e) => {
    elements.temperatureValue.textContent = e.target.value;
  });

  // Image
  elements.imageGenerate.addEventListener('click', generateImage);
  elements.downloadImageBtn.addEventListener('click', downloadImage);

  // Img2img file input
  elements.img2imgInput.addEventListener('change', handleImg2imgInput);
  elements.img2imgClear.addEventListener('click', clearImg2imgInput);

  // Chat image attachments
  elements.chatImageInput.addEventListener('change', handleChatImageInput);

  // NPC
  elements.npcCreate.addEventListener('click', createNPC);
  elements.npcList.addEventListener('change', selectNPC);
  elements.npcSend.addEventListener('click', sendNPCMessage);
  elements.npcInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendNPCMessage();
  });
  elements.npcSave.addEventListener('click', saveNPCHistory);
  elements.npcLoad.addEventListener('click', loadNPCHistory);
  elements.npcReset.addEventListener('click', resetNPCHistory);

  // Recharge
  elements.rechargeButton.addEventListener('click', openRecharge);

  // NPC Actions
  elements.presetMerchant.addEventListener('click', () => loadActionPreset('merchant'));
  elements.presetQuest.addEventListener('click', () => loadActionPreset('quest'));
  elements.presetGuard.addEventListener('click', () => loadActionPreset('guard'));
  elements.addCustomAction.addEventListener('click', addCustomAction);
  elements.createActionsNpc.addEventListener('click', createActionsNPC);
  elements.actionsSend.addEventListener('click', sendActionsMessage);
  elements.actionsInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendActionsMessage();
  });
  elements.actionsReset.addEventListener('click', resetActionsConversation);

  // Quick action messages
  document.querySelectorAll('.quick-action-msg').forEach(btn => {
    btn.addEventListener('click', () => {
      elements.actionsInput.value = btn.dataset.msg;
      sendActionsMessage();
    });
  });
}

// Setup P5.js Canvas
function setupP5Canvas() {
  const sketch = (p) => {
    let currentImage = null;

    p.setup = () => {
      const canvas = p.createCanvas(512, 512);
      canvas.parent('p5-canvas-container');
      p.background(240);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(16);
      p.fill(150);
      p.text('Generated images will appear here', p.width / 2, p.height / 2);
    };

    p.displayImage = (img) => {
      currentImage = img;
      p.clear();
      p.background(240);

      // Calculate scaling to fit canvas
      const scale = Math.min(p.width / img.width, p.height / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (p.width - w) / 2;
      const y = (p.height - h) / 2;

      p.image(img, x, y, w, h);
    };
  };

  p5Instance = new p5(sketch);
}

// Tab Switching
function switchTab(tabName) {
  // Update buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('text-blue-600', 'border-blue-600');
      btn.classList.remove('text-gray-500', 'border-transparent');
    } else {
      btn.classList.remove('text-blue-600', 'border-blue-600');
      btn.classList.add('text-gray-500', 'border-transparent');
    }
  });

  // Update content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-tab`);
  });
}

// Load Saved Config
function loadSavedConfig() {
  const saved = localStorage.getItem('playkit-playground-config');
  if (saved) {
    try {
      const config = JSON.parse(saved);
      if (config.gameId) elements.gameIdInput.value = config.gameId;
      if (config.authMethod) {
        elements.authMethod.value = config.authMethod;
        // Update token container visibility
        elements.tokenInputContainer.classList.toggle('hidden', config.authMethod !== 'token');
      }
      if (config.chatModel) elements.chatModel.value = config.chatModel;
      if (config.imageModel) elements.imageModel.value = config.imageModel;
      if (config.developerToken) elements.developerTokenInput.value = config.developerToken;
    } catch (e) {
      console.error('Failed to load saved config:', e);
    }
  }
}

// Save Config
function saveConfig() {
  const config = {
    gameId: elements.gameIdInput.value,
    authMethod: elements.authMethod.value,
    chatModel: elements.chatModel.value,
    imageModel: elements.imageModel.value,
    developerToken: elements.developerTokenInput.value,
  };
  localStorage.setItem('playkit-playground-config', JSON.stringify(config));
}

// Update Status
function updateStatus(authenticated) {
  const [dot, text] = elements.statusIndicator.children;
  if (authenticated) {
    dot.className = 'w-3 h-3 bg-green-500 rounded-full';
    text.textContent = i18n.t('status.authenticated');
    elements.logoutButton.classList.remove('hidden');
  } else {
    dot.className = 'w-3 h-3 bg-red-500 rounded-full';
    text.textContent = i18n.t('status.notInitialized');
    elements.logoutButton.classList.add('hidden');
    elements.creditDisplay.style.display = 'none';
  }
}

// Update Credit Display
async function updateCreditDisplay() {
  if (!sdk) return;

  try {
    const authState = sdk.getAuthManager().getAuthState();
    console.log('[Credit] Auth state:', authState);

    // Only show credit for player tokens
    if (authState.tokenType === 'player') {
      const playerInfo = await sdk.getPlayerInfo();
      console.log('[Credit] Player info:', playerInfo);

      // Check for both 'credit' and 'credits' (API返回的是'credits')
      const creditValue = playerInfo.credits || playerInfo.credit;

      if (playerInfo && creditValue !== undefined) {
        // Convert string to number if needed
        const creditNum = typeof creditValue === 'string' ? parseFloat(creditValue) : creditValue;
        elements.creditValue.textContent = creditNum.toFixed(2);
        elements.creditDisplay.style.display = 'block';
        console.log('[Credit] Displayed credit:', creditNum);
      } else {
        console.log('[Credit] No credit info available');
        elements.creditDisplay.style.display = 'none';
      }
    } else {
      console.log('[Credit] Not player token, hiding credit display');
      elements.creditDisplay.style.display = 'none';
    }
  } catch (error) {
    console.error('Failed to fetch player info:', error);
    elements.creditDisplay.style.display = 'none';
  }
}

// Initialize SDK
async function initializeSDK() {
  const gameId = elements.gameIdInput.value.trim();
  if (!gameId) {
    showNotification(i18n.t('enterGameId'), 'error');
    return;
  }

  const authMethod = elements.authMethod.value;
  const developerToken = elements.developerTokenInput.value.trim();

  if (authMethod === 'token' && !developerToken) {
    showNotification(i18n.t('enterToken'), 'error');
    return;
  }

  elements.initButton.disabled = true;
  elements.initButton.textContent = i18n.t('initButtonLoading');

  try {
    // Create SDK instance
    const config = {
      gameId,
      debug: elements.debugToggle.checked,
    };

    if (authMethod === 'token') {
      config.developerToken = developerToken;
    }

    sdk = new PlayKitSDK.PlayKitSDK(config);

    // Setup event listeners
    sdk.on('authenticated', (authState) => {
      console.log('Authenticated:', authState);
      updateStatus(true);
    });

    sdk.on('unauthenticated', () => {
      console.log('Unauthenticated');
      updateStatus(false);
    });

    sdk.on('error', (error) => {
      console.error('SDK Error:', error);
      showNotification(`Error: ${error.message}`, 'error');
    });

    // Setup recharge events
    sdk.on('recharge_opened', () => {
      console.log('Recharge window opened');
    });

    sdk.on('insufficient_credits', (error) => {
      console.log('Insufficient credits detected');
      showNotification('Insufficient credits! Please recharge.', 'error');
    });

    sdk.on('balance_updated', async (credits) => {
      console.log('Balance updated:', credits);
      await updateCreditDisplay();
    });

    // Initialize
    await sdk.initialize();

    // Enable automatic balance checking (every 30 seconds)
    if (authMethod === 'auto') {
      sdk.enableAutoBalanceCheck(30000);
    }

    // Create clients
    chatClient = sdk.createChatClient(elements.chatModel.value);
    imageClient = sdk.createImageClient(elements.imageModel.value);

    // Enable UI
    elements.chatSend.disabled = false;
    elements.imageGenerate.disabled = false;
    elements.npcCreate.disabled = false;
    elements.createActionsNpc.disabled = false;

    // Update credit display for player accounts
    await updateCreditDisplay();

    showNotification(i18n.t('initSuccess'), 'success');
    saveConfig();

    elements.initButton.textContent = i18n.t('reinitButton');
  } catch (error) {
    console.error('Initialization failed:', error);
    showNotification(`${i18n.t('initFailed')}: ${error.message}`, 'error');
    elements.initButton.textContent = i18n.t('initButton');
    updateStatus(false);
  } finally {
    elements.initButton.disabled = false;
  }
}

// Logout
async function logout() {
  if (!sdk) return;

  try {
    await sdk.logout();
    showNotification(i18n.t('logoutSuccess'), 'success');
    updateStatus(false);

    // Reset state
    sdk = null;
    chatClient = null;
    imageClient = null;
    npcs.clear();
    currentNPC = null;

    // Disable UI
    elements.chatSend.disabled = true;
    elements.imageGenerate.disabled = true;
    elements.npcCreate.disabled = true;

    // Clear messages
    elements.chatMessages.innerHTML = `<p class="text-gray-400 text-sm">${i18n.t('messagesPlaceholder')}</p>`;
    elements.npcMessages.innerHTML = `<p class="text-gray-400 text-sm">${i18n.t('npcPlaceholder')}</p>`;

  } catch (error) {
    console.error('Logout failed:', error);
    showNotification(`${i18n.t('logoutFailed')}: ${error.message}`, 'error');
  }
}

// Chat Functions
function clearChatHistory() {
  if (confirm(i18n.t('confirmClearChat') || 'Are you sure you want to clear all chat messages?')) {
    elements.chatMessages.innerHTML = `<p class="text-gray-400 text-sm">${i18n.t('messagesPlaceholder')}</p>`;
    showNotification(i18n.t('chatHistoryCleared') || 'Chat history cleared', 'success');
  }
}

async function sendChatMessage() {
  if (!chatClient) {
    showNotification(i18n.t('initFirst'), 'error');
    return;
  }

  const message = elements.chatInput.value.trim();
  if (!message && chatAttachments.length === 0) return;

  // Build user message display text
  let displayText = message;
  if (chatAttachments.length > 0) {
    displayText += chatAttachments.length > 0 ? ` [${chatAttachments.length} image(s) attached]` : '';
  }

  // Add user message
  addChatMessage('user', displayText);
  elements.chatInput.value = '';
  elements.chatSend.disabled = true;

  try {
    const systemPrompt = elements.chatSystemPrompt.value.trim();
    const streaming = elements.chatStreaming.checked;
    const temperature = parseFloat(elements.chatTemperature.value);

    // Build messages array
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // Build user message content (multimodal if attachments exist)
    let userContent;
    if (chatAttachments.length > 0) {
      // Multimodal message using SDK helper
      const images = chatAttachments.map(att => ({ url: att.url }));
      const multimodalMsg = PlayKitSDK.createMultimodalMessage('user', message, images);
      userContent = multimodalMsg.content;
    } else {
      userContent = message;
    }
    messages.push({ role: 'user', content: userContent });

    // Clear attachments after building message
    clearChatAttachments();

    if (streaming) {
      // Streaming response with temperature
      const aiMessageId = addChatMessage('assistant', '');
      const aiMessageElement = document.getElementById(aiMessageId);

      await chatClient.textGenerationStream({
        messages,
        temperature,
        onChunk: (chunk) => {
          aiMessageElement.textContent += chunk;
          elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
        }
      });
    } else {
      // Non-streaming response with temperature
      const result = await chatClient.textGeneration({
        messages,
        temperature
      });
      addChatMessage('assistant', result.content);
    }
  } catch (error) {
    console.error('Chat error:', error);
    addChatMessage('system', `Error: ${error.message}`, 'error');
  } finally {
    elements.chatSend.disabled = false;
  }
}

function addChatMessage(role, content, type = '') {
  const messageDiv = document.createElement('div');
  const messageId = `msg-${Date.now()}-${Math.random()}`;
  messageDiv.id = messageId;
  messageDiv.className = 'message mb-3 p-3 rounded-lg';

  if (role === 'user') {
    messageDiv.classList.add('bg-blue-100', 'ml-auto', 'max-w-[80%]');
    messageDiv.innerHTML = `<div class="text-sm font-medium text-blue-900 mb-1">${i18n.t('you')}</div><div class="text-gray-800">${escapeHtml(content)}</div>`;
  } else if (role === 'assistant') {
    messageDiv.classList.add('bg-gray-100', 'mr-auto', 'max-w-[80%]');
    messageDiv.innerHTML = `<div class="text-sm font-medium text-gray-900 mb-1">${i18n.t('ai')}</div><div class="text-gray-800">${escapeHtml(content)}</div>`;
  } else {
    messageDiv.classList.add('bg-red-100', 'mx-auto', 'max-w-[80%]');
    messageDiv.innerHTML = `<div class="text-sm font-medium text-red-900">${escapeHtml(content)}</div>`;
  }

  // Clear placeholder if exists
  if (elements.chatMessages.querySelector('.text-gray-400')) {
    elements.chatMessages.innerHTML = '';
  }

  elements.chatMessages.appendChild(messageDiv);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

  return messageId;
}

// Image Generation
async function generateImage() {
  if (!imageClient) {
    showNotification(i18n.t('initFirst'), 'error');
    return;
  }

  const prompt = elements.imagePrompt.value.trim();
  // Allow empty prompt if img2img is provided
  if (!prompt && !img2imgData) {
    showNotification(i18n.t('enterImageDesc'), 'error');
    return;
  }

  elements.imageGenerate.disabled = true;
  elements.imageLoading.classList.remove('hidden');
  elements.imageDownloadContainer.classList.add('hidden');

  try {
    const size = elements.imageSize.value;
    const transparent = elements.imageTransparent.checked;

    let result;
    if (img2imgData) {
      // Img2img generation
      result = await imageClient.img2img([img2imgData], prompt || undefined, {
        size,
        transparent: transparent || undefined
      });
      showNotification(i18n.t('img2imgSuccess') || 'Image-to-image generation successful!', 'success');
    } else {
      // Text-to-image generation
      result = await imageClient.generateImage({
        prompt,
        size,
        transparent: transparent || undefined
      });
      showNotification(i18n.t('imageGenSuccess'), 'success');
    }

    // Store for download
    lastGeneratedImage = result;

    // Display in P5 canvas
    const img = await result.toHTMLImage();
    const p5Image = p5Instance.loadImage(img.src, () => {
      p5Instance.displayImage(p5Image);
    });

    // Add to gallery
    addImageToGallery(result, prompt || 'img2img');

    // Show download button
    elements.imageDownloadContainer.classList.remove('hidden');

    // Show transparent success info if applicable
    if (transparent && result.transparentSuccess !== undefined) {
      const successText = result.transparentSuccess ? 'Background removed successfully' : 'Background removal may not be complete';
      showNotification(successText, result.transparentSuccess ? 'success' : 'info');
    }
  } catch (error) {
    console.error('Image generation error:', error);
    showNotification(`${i18n.t('imageGenFailed')}: ${error.message}`, 'error');
  } finally {
    elements.imageGenerate.disabled = false;
    elements.imageLoading.classList.add('hidden');
  }
}

// Set image size from preset buttons
function setImageSize(size) {
  elements.imageSize.value = size;
  // Highlight selected preset
  document.querySelectorAll('.size-preset-btn').forEach(btn => {
    if (btn.dataset.size === size) {
      btn.classList.add('bg-blue-50', 'border-blue-500', 'text-blue-700');
    } else {
      btn.classList.remove('bg-blue-50', 'border-blue-500', 'text-blue-700');
    }
  });
}

// Download the last generated image
function downloadImage() {
  if (!lastGeneratedImage) {
    showNotification(i18n.t('noImageToDownload') || 'No image to download', 'error');
    return;
  }

  const link = document.createElement('a');
  link.download = `playkit-image-${Date.now()}.png`;
  link.href = lastGeneratedImage.toDataURL();
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showNotification(i18n.t('imageDownloaded') || 'Image downloaded!', 'success');
}

// Handle img2img file input
function handleImg2imgInput(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    showNotification(i18n.t('invalidImageFile') || 'Please select a valid image file', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const dataUrl = event.target.result;
    img2imgData = PlayKitSDK.ImageClient.dataUrlToImageInput(dataUrl);

    // Update UI
    elements.img2imgFilename.textContent = file.name;
    elements.img2imgClear.classList.remove('hidden');

    // Show preview
    elements.img2imgPreview.src = dataUrl;
    elements.img2imgPreview.classList.remove('hidden');

    showNotification(i18n.t('img2imgLoaded') || 'Image loaded for img2img', 'success');
  };
  reader.readAsDataURL(file);
}

// Clear img2img input
function clearImg2imgInput() {
  img2imgData = null;
  elements.img2imgInput.value = '';
  elements.img2imgFilename.textContent = i18n.t('noFileSelected') || 'No file selected';
  elements.img2imgClear.classList.add('hidden');
  elements.img2imgPreview.src = '';
  elements.img2imgPreview.classList.add('hidden');
}

// Handle chat image attachment input
function handleChatImageInput(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      chatAttachments.push({
        type: 'image',
        url: dataUrl,
        name: file.name
      });
      renderChatAttachments();
    };
    reader.readAsDataURL(file);
  }

  // Clear input for re-selection
  e.target.value = '';
}

// Render chat attachment previews
function renderChatAttachments() {
  if (chatAttachments.length === 0) {
    elements.chatAttachmentPreviews.innerHTML = '';
    elements.chatAttachments.classList.add('hidden');
    return;
  }

  elements.chatAttachments.classList.remove('hidden');
  elements.chatAttachmentPreviews.innerHTML = '';

  chatAttachments.forEach((attachment, index) => {
    const preview = document.createElement('div');
    preview.className = 'relative inline-block';
    preview.innerHTML = `
      <img src="${attachment.url}" class="w-16 h-16 object-cover rounded border" alt="${escapeHtml(attachment.name)}">
      <button onclick="removeChatAttachment(${index})" class="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center hover:bg-red-600">&times;</button>
    `;
    elements.chatAttachmentPreviews.appendChild(preview);
  });
}

// Remove a chat attachment
function removeChatAttachment(index) {
  chatAttachments.splice(index, 1);
  renderChatAttachments();
}

// Clear all chat attachments
function clearChatAttachments() {
  chatAttachments = [];
  renderChatAttachments();
}

function addImageToGallery(result, prompt) {
  const galleryItem = document.createElement('div');
  galleryItem.className = 'relative group';

  const img = document.createElement('img');
  img.src = result.toDataURL();
  img.alt = prompt;
  img.className = 'w-full h-48 object-cover rounded-lg border-2 border-gray-200 cursor-pointer hover:border-blue-500 transition-colors';

  img.addEventListener('click', async () => {
    const p5Image = p5Instance.loadImage(img.src, () => {
      p5Instance.displayImage(p5Image);
    });
  });

  const overlay = document.createElement('div');
  overlay.className = 'absolute inset-0 bg-black bg-opacity-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center';
  overlay.innerHTML = `<p class="text-white text-sm px-2 text-center">${escapeHtml(prompt)}</p>`;

  galleryItem.appendChild(img);
  galleryItem.appendChild(overlay);
  elements.imageGallery.insertBefore(galleryItem, elements.imageGallery.firstChild);
}

// NPC Functions
function createNPC() {
  if (!sdk) {
    showNotification(i18n.t('initFirst'), 'error');
    return;
  }

  const name = elements.npcName.value.trim();
  const systemPrompt = elements.npcSystemPrompt.value.trim();

  if (!name) {
    showNotification(i18n.t('enterNPCName'), 'error');
    return;
  }

  if (!systemPrompt) {
    showNotification(i18n.t('enterNPCPrompt'), 'error');
    return;
  }

  if (npcs.has(name)) {
    showNotification(i18n.t('npcExists'), 'error');
    return;
  }

  // Create NPC client
  const npcClient = sdk.createNPCClient({
    systemPrompt,
    model: elements.chatModel.value,
  });

  npcs.set(name, npcClient);

  // Add to dropdown
  const option = document.createElement('option');
  option.value = name;
  option.textContent = name;
  elements.npcList.appendChild(option);

  // Select the new NPC
  elements.npcList.value = name;
  selectNPC();

  // Clear inputs
  elements.npcName.value = '';
  elements.npcSystemPrompt.value = '';

  showNotification(i18n.t('npcCreated', { name }), 'success');
}

function selectNPC() {
  const name = elements.npcList.value;
  if (!name) {
    elements.npcConversationContainer.classList.add('hidden');
    currentNPC = null;
    return;
  }

  currentNPC = npcs.get(name);
  elements.npcConversationContainer.classList.remove('hidden');
  elements.npcMessages.innerHTML = `<p class="text-gray-400 text-sm">${i18n.t('startConversation', { name })}</p>`;
}

async function sendNPCMessage() {
  if (!currentNPC) {
    showNotification(i18n.t('selectNPCFirst'), 'error');
    return;
  }

  const message = elements.npcInput.value.trim();
  if (!message) return;

  addNPCMessage('user', message);
  elements.npcInput.value = '';
  elements.npcSend.disabled = true;

  try {
    const aiMessageId = addNPCMessage('assistant', '');
    const aiMessageElement = document.getElementById(aiMessageId);

    await currentNPC.talkStream(message, (chunk) => {
      aiMessageElement.textContent += chunk;
      elements.npcMessages.scrollTop = elements.npcMessages.scrollHeight;
    });
  } catch (error) {
    console.error('NPC error:', error);
    addNPCMessage('system', `Error: ${error.message}`, 'error');
  } finally {
    elements.npcSend.disabled = false;
  }
}

function addNPCMessage(role, content) {
  const messageDiv = document.createElement('div');
  const messageId = `npc-msg-${Date.now()}-${Math.random()}`;
  messageDiv.id = messageId;
  messageDiv.className = 'message mb-3 p-3 rounded-lg';

  if (role === 'user') {
    messageDiv.classList.add('bg-blue-100', 'ml-auto', 'max-w-[80%]');
    messageDiv.innerHTML = `<div class="text-sm font-medium text-blue-900 mb-1">${i18n.t('you')}</div><div class="text-gray-800">${escapeHtml(content)}</div>`;
  } else if (role === 'assistant') {
    messageDiv.classList.add('bg-gray-100', 'mr-auto', 'max-w-[80%]');
    const npcName = elements.npcList.value;
    messageDiv.innerHTML = `<div class="text-sm font-medium text-gray-900 mb-1">${npcName}</div><div class="text-gray-800">${escapeHtml(content)}</div>`;
  } else {
    messageDiv.classList.add('bg-red-100', 'mx-auto', 'max-w-[80%]');
    messageDiv.innerHTML = `<div class="text-sm font-medium text-red-900">${escapeHtml(content)}</div>`;
  }

  // Clear placeholder if exists
  if (elements.npcMessages.querySelector('.text-gray-400')) {
    elements.npcMessages.innerHTML = '';
  }

  elements.npcMessages.appendChild(messageDiv);
  elements.npcMessages.scrollTop = elements.npcMessages.scrollHeight;

  return messageId;
}

function saveNPCHistory() {
  if (!currentNPC) return;

  const name = elements.npcList.value;
  const key = `npc-history-${name}`;

  currentNPC.saveHistory(key);
  showNotification(i18n.t('historySaved', { name }), 'success');
}

function loadNPCHistory() {
  if (!currentNPC) return;

  const name = elements.npcList.value;
  const key = `npc-history-${name}`;

  const loaded = currentNPC.loadHistory(key);
  if (loaded) {
    showNotification(i18n.t('historyLoaded', { name }), 'success');
    elements.npcMessages.innerHTML = `<p class="text-gray-400 text-sm">${i18n.t('historyLoadedMsg')}</p>`;
  } else {
    showNotification(i18n.t('noHistory'), 'error');
  }
}

function resetNPCHistory() {
  if (!currentNPC) return;

  if (confirm(i18n.t('confirmReset'))) {
    currentNPC.resetHistory();
    const name = elements.npcList.value;
    elements.npcMessages.innerHTML = `<p class="text-gray-400 text-sm">${i18n.t('historyResetMsg', { name })}</p>`;
    showNotification(i18n.t('historyReset'), 'success');
  }
}

// Utility Functions
function showNotification(message, type = 'info') {
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  };

  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300`;
  notification.textContent = message;
  notification.style.transform = 'translateX(400px)';

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 10);

  setTimeout(() => {
    notification.style.transform = 'translateX(400px)';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Open recharge window
function openRecharge() {
  if (!sdk) {
    showNotification('Please initialize SDK first', 'error');
    return;
  }

  sdk.openRechargeWindow();
  showNotification('Recharge window opened', 'success');
}

// ===== NPC Actions Functions =====

// Action presets
const ACTION_PRESETS = {
  merchant: {
    prompt: "You are a friendly merchant in a fantasy town. You sell potions, weapons, and armor. You're always looking for good deals and love to haggle. When the player wants to buy something, use the openShop action. When saying goodbye, use the farewell action.",
    actions: [
      { actionName: 'openShop', description: 'Open the shop interface to show available items for purchase', parameters: [] },
      { actionName: 'showItem', description: 'Show details about a specific item', parameters: [
        { name: 'itemName', description: 'Name of the item to show', type: 'string', required: true }
      ]},
      { actionName: 'offerDiscount', description: 'Offer a discount to the player', parameters: [
        { name: 'percentage', description: 'Discount percentage (1-50)', type: 'number', required: true }
      ]},
      { actionName: 'farewell', description: 'Say goodbye and close the conversation', parameters: [] }
    ]
  },
  quest: {
    prompt: "You are a mysterious quest giver in a fantasy RPG. You have important missions for brave adventurers. You speak in an enigmatic manner. Use giveQuest when offering a mission, and updateQuestLog when providing information about ongoing quests.",
    actions: [
      { actionName: 'giveQuest', description: 'Give a new quest to the player', parameters: [
        { name: 'questName', description: 'Name of the quest', type: 'string', required: true },
        { name: 'difficulty', description: 'Quest difficulty level', type: 'stringEnum', enumOptions: ['easy', 'medium', 'hard', 'legendary'], required: true }
      ]},
      { actionName: 'updateQuestLog', description: 'Update the quest log with new information', parameters: [
        { name: 'message', description: 'The update message', type: 'string', required: true }
      ]},
      { actionName: 'giveReward', description: 'Give a reward to the player', parameters: [
        { name: 'rewardType', description: 'Type of reward', type: 'stringEnum', enumOptions: ['gold', 'item', 'experience'], required: true },
        { name: 'amount', description: 'Amount of the reward', type: 'number', required: true }
      ]}
    ]
  },
  guard: {
    prompt: "You are a stern city guard protecting the gates. You're suspicious of strangers but fair. You can grant or deny entry, issue warnings, or call for backup if needed.",
    actions: [
      { actionName: 'grantEntry', description: 'Allow the player to enter the city', parameters: [] },
      { actionName: 'denyEntry', description: 'Deny entry to the player', parameters: [
        { name: 'reason', description: 'Reason for denial', type: 'string', required: true }
      ]},
      { actionName: 'issueWarning', description: 'Issue an official warning to the player', parameters: [
        { name: 'severity', description: 'Severity of warning', type: 'stringEnum', enumOptions: ['mild', 'serious', 'final'], required: true }
      ]},
      { actionName: 'callBackup', description: 'Call for additional guards', parameters: [] }
    ]
  }
};

// Initialize NPC Actions with default merchant preset
function initializeNpcActions() {
  loadActionPreset('merchant');
}

// Load an action preset
function loadActionPreset(presetName) {
  const preset = ACTION_PRESETS[presetName];
  if (!preset) return;

  elements.actionsNpcPrompt.value = preset.prompt;
  definedActions = JSON.parse(JSON.stringify(preset.actions)); // Deep clone
  renderActionsList();

  // Highlight the selected preset button
  [elements.presetMerchant, elements.presetQuest, elements.presetGuard].forEach(btn => {
    btn.classList.remove('ring-2', 'ring-offset-2');
  });

  const buttonMap = {
    merchant: elements.presetMerchant,
    quest: elements.presetQuest,
    guard: elements.presetGuard
  };

  if (buttonMap[presetName]) {
    buttonMap[presetName].classList.add('ring-2', 'ring-offset-2');
  }
}

// Render the actions list
function renderActionsList() {
  elements.actionsList.innerHTML = '';

  if (definedActions.length === 0) {
    elements.actionsList.innerHTML = '<p class="text-gray-400 text-xs">No actions defined yet...</p>';
    return;
  }

  definedActions.forEach((action, index) => {
    const actionDiv = document.createElement('div');
    actionDiv.className = 'flex items-center justify-between bg-white border border-gray-200 rounded px-3 py-2';

    const paramsText = action.parameters && action.parameters.length > 0
      ? `(${action.parameters.map(p => p.name).join(', ')})`
      : '()';

    actionDiv.innerHTML = `
      <div class="flex-1">
        <span class="font-mono text-sm text-blue-600">${escapeHtml(action.actionName)}</span>
        <span class="text-xs text-gray-500">${paramsText}</span>
        <p class="text-xs text-gray-500 truncate">${escapeHtml(action.description)}</p>
      </div>
      <button class="ml-2 text-red-500 hover:text-red-700 text-sm" data-index="${index}">
        &times;
      </button>
    `;

    // Remove button handler
    actionDiv.querySelector('button').addEventListener('click', () => {
      definedActions.splice(index, 1);
      renderActionsList();
    });

    elements.actionsList.appendChild(actionDiv);
  });
}

// Add a custom action
function addCustomAction() {
  const name = elements.customActionName.value.trim();
  const desc = elements.customActionDesc.value.trim();

  if (!name) {
    showNotification('Please enter an action name', 'error');
    return;
  }

  if (!desc) {
    showNotification('Please enter an action description', 'error');
    return;
  }

  // Check for duplicate
  if (definedActions.some(a => a.actionName === name)) {
    showNotification('An action with this name already exists', 'error');
    return;
  }

  definedActions.push({
    actionName: name,
    description: desc,
    parameters: []
  });

  elements.customActionName.value = '';
  elements.customActionDesc.value = '';
  renderActionsList();
  showNotification(`Action "${name}" added`, 'success');
}

// Create NPC with actions
function createActionsNPC() {
  if (!sdk) {
    showNotification('Please initialize SDK first', 'error');
    return;
  }

  const systemPrompt = elements.actionsNpcPrompt.value.trim();
  if (!systemPrompt) {
    showNotification('Please enter an NPC character description', 'error');
    return;
  }

  if (definedActions.length === 0) {
    showNotification('Please define at least one action', 'error');
    return;
  }

  // Create NPC client
  actionsNPC = sdk.createNPCClient({
    systemPrompt,
    model: elements.chatModel.value,
  });

  // Show conversation container
  elements.actionsConversationContainer.classList.remove('hidden');
  elements.actionsMessages.innerHTML = '<p class="text-gray-400 text-sm">NPC ready! Talk to trigger actions...</p>';
  elements.actionEvents.innerHTML = '<p class="text-gray-500"># NPC created with ' + definedActions.length + ' actions</p>';

  showNotification('NPC with Actions created!', 'success');
}

// Send message to actions NPC
async function sendActionsMessage() {
  if (!actionsNPC) {
    showNotification('Please create an NPC with actions first', 'error');
    return;
  }

  const message = elements.actionsInput.value.trim();
  if (!message) return;

  // Add user message to UI
  addActionsMessage('user', message);
  elements.actionsInput.value = '';
  elements.actionsSend.disabled = true;

  try {
    // Use talkWithActions
    const response = await actionsNPC.talkWithActions(message, definedActions);

    if (response) {
      // Add NPC text response
      if (response.text) {
        addActionsMessage('assistant', response.text);
      }

      // Process action calls
      if (response.hasActions && response.actionCalls) {
        for (const actionCall of response.actionCalls) {
          logActionEvent(actionCall);

          // Report success for demo purposes
          actionsNPC.reportActionResult(actionCall.id, JSON.stringify({ success: true, message: 'Action executed' }));
        }
      }
    } else {
      addActionsMessage('system', 'No response from NPC', 'error');
    }
  } catch (error) {
    console.error('Actions NPC error:', error);
    addActionsMessage('system', `Error: ${error.message}`, 'error');
  } finally {
    elements.actionsSend.disabled = false;
  }
}

// Add message to actions chat
function addActionsMessage(role, content, type = '') {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message mb-3 p-3 rounded-lg';

  if (role === 'user') {
    messageDiv.classList.add('bg-blue-100', 'ml-auto', 'max-w-[80%]');
    messageDiv.innerHTML = `<div class="text-sm font-medium text-blue-900 mb-1">You</div><div class="text-gray-800">${escapeHtml(content)}</div>`;
  } else if (role === 'assistant') {
    messageDiv.classList.add('bg-gray-100', 'mr-auto', 'max-w-[80%]');
    messageDiv.innerHTML = `<div class="text-sm font-medium text-gray-900 mb-1">NPC</div><div class="text-gray-800">${escapeHtml(content)}</div>`;
  } else {
    messageDiv.classList.add('bg-red-100', 'mx-auto', 'max-w-[80%]');
    messageDiv.innerHTML = `<div class="text-sm font-medium text-red-900">${escapeHtml(content)}</div>`;
  }

  // Clear placeholder if exists
  if (elements.actionsMessages.querySelector('.text-gray-400')) {
    elements.actionsMessages.innerHTML = '';
  }

  elements.actionsMessages.appendChild(messageDiv);
  elements.actionsMessages.scrollTop = elements.actionsMessages.scrollHeight;
}

// Log action event
function logActionEvent(actionCall) {
  const timestamp = new Date().toLocaleTimeString();
  const argsStr = JSON.stringify(actionCall.arguments, null, 0);

  const eventLine = document.createElement('div');
  eventLine.className = 'mb-1';
  eventLine.innerHTML = `
    <span class="text-gray-500">[${timestamp}]</span>
    <span class="text-yellow-400">ACTION:</span>
    <span class="text-green-400">${escapeHtml(actionCall.actionName)}</span>
    <span class="text-blue-400">${escapeHtml(argsStr)}</span>
  `;

  // Clear placeholder if exists
  if (elements.actionEvents.querySelector('.text-gray-500:first-child')) {
    elements.actionEvents.innerHTML = '';
  }

  elements.actionEvents.appendChild(eventLine);
  elements.actionEvents.scrollTop = elements.actionEvents.scrollHeight;
}

// Reset actions conversation
function resetActionsConversation() {
  if (!confirm('Reset the conversation and create a new NPC?')) return;

  actionsNPC = null;
  elements.actionsConversationContainer.classList.add('hidden');
  elements.actionsMessages.innerHTML = '<p class="text-gray-400 text-sm">Talk to the NPC and watch for actions...</p>';
  elements.actionEvents.innerHTML = '<p class="text-gray-500"># Action events will appear here...</p>';

  showNotification('Conversation reset', 'success');
}

// Initialize on load
init();

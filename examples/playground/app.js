// Global state
let sdk = null;
let chatClient = null;
let imageClient = null;
let npcs = new Map(); // Map<name, NPCClient>
let currentNPC = null;
let p5Instance = null;

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

  // Chat
  chatSystemPrompt: document.getElementById('chat-system-prompt'),
  chatStreaming: document.getElementById('chat-streaming'),
  chatMessages: document.getElementById('chat-messages'),
  chatInput: document.getElementById('chat-input'),
  chatSend: document.getElementById('chat-send'),

  // Image
  imageSize: document.getElementById('image-size'),
  imagePrompt: document.getElementById('image-prompt'),
  imageGenerate: document.getElementById('image-generate'),
  imageLoading: document.getElementById('image-loading'),
  imageGallery: document.getElementById('image-gallery'),
  p5CanvasContainer: document.getElementById('p5-canvas-container'),

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
};

// Initialize
function init() {
  setupEventListeners();
  setupP5Canvas();
  loadSavedConfig();
  initializeI18n();
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

  // Image
  elements.imageGenerate.addEventListener('click', generateImage);

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
      if (config.authMethod) elements.authMethod.value = config.authMethod;
      if (config.chatModel) elements.chatModel.value = config.chatModel;
      if (config.imageModel) elements.imageModel.value = config.imageModel;
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

    // Initialize
    await sdk.initialize();

    // Create clients
    chatClient = sdk.createChatClient(elements.chatModel.value);
    imageClient = sdk.createImageClient(elements.imageModel.value);

    // Enable UI
    elements.chatSend.disabled = false;
    elements.imageGenerate.disabled = false;
    elements.npcCreate.disabled = false;

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
async function sendChatMessage() {
  if (!chatClient) {
    showNotification(i18n.t('initFirst'), 'error');
    return;
  }

  const message = elements.chatInput.value.trim();
  if (!message) return;

  // Add user message
  addChatMessage('user', message);
  elements.chatInput.value = '';
  elements.chatSend.disabled = true;

  try {
    const systemPrompt = elements.chatSystemPrompt.value.trim();
    const streaming = elements.chatStreaming.checked;

    if (streaming) {
      // Streaming response
      const aiMessageId = addChatMessage('assistant', '');
      const aiMessageElement = document.getElementById(aiMessageId);

      await chatClient.chatStream(
        message,
        (chunk) => {
          aiMessageElement.textContent += chunk;
          elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
        },
        systemPrompt ? { systemPrompt } : undefined
      );
    } else {
      // Non-streaming response
      const response = await chatClient.chat(
        message,
        systemPrompt ? { systemPrompt } : undefined
      );
      addChatMessage('assistant', response);
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
  if (!prompt) {
    showNotification(i18n.t('enterImageDesc'), 'error');
    return;
  }

  elements.imageGenerate.disabled = true;
  elements.imageLoading.classList.remove('hidden');

  try {
    const size = elements.imageSize.value;
    const result = await imageClient.generate(prompt, { size });

    // Display in P5 canvas
    const img = await result.toImageElement();
    const p5Image = p5Instance.loadImage(img.src, () => {
      p5Instance.displayImage(p5Image);
    });

    // Add to gallery
    addImageToGallery(result, prompt);

    showNotification(i18n.t('imageGenSuccess'), 'success');
  } catch (error) {
    console.error('Image generation error:', error);
    showNotification(`${i18n.t('imageGenFailed')}: ${error.message}`, 'error');
  } finally {
    elements.imageGenerate.disabled = false;
    elements.imageLoading.classList.add('hidden');
  }
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

// Initialize on load
init();

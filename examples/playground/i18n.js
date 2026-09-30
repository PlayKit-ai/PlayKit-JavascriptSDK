// i18n translations
const translations = {
  en: {
    // Header
    title: 'PlayKit SDK Playground',
    subtitle: 'Test AI features and explore the SDK',
    status: {
      notInitialized: 'Not Initialized',
      authenticated: 'Authenticated',
    },

    // Sidebar
    configuration: 'Configuration',
    gameId: 'Game ID',
    gameIdPlaceholder: 'your-game-id',
    authentication: 'Authentication',
    authAuto: 'Auto Login (Player)',
    authToken: 'Developer Token',
    developerToken: 'Developer Token',
    developerTokenPlaceholder: 'dev-token-xxxxx',
    chatModel: 'Chat Model',
    chatModelHint: 'e.g., gpt-4o, gpt-4o-mini, gpt-4',
    imageModel: 'Image Model',
    imageModelHint: 'e.g., flux-1-schnell, dall-e-3',
    initButton: 'Initialize SDK',
    initButtonLoading: 'Initializing...',
    reinitButton: 'Re-initialize',
    loginButton: 'Login',
    logoutButton: 'Logout',
    debugMode: 'Enable Debug Mode',
    rechargeButton: 'Recharge Now',

    // Tabs
    tabTextGen: 'Text Generation',
    tabImageGen: 'Image Generation',

    // Text Generation Tab
    textGenTitle: 'Text Generation',
    systemPrompt: 'System Prompt (Optional)',
    systemPromptPlaceholder: 'You are a helpful assistant...',
    enableStreaming: 'Enable Streaming',
    messagesPlaceholder: 'Messages will appear here...',
    inputPlaceholder: 'Type your message...',
    sendButton: 'Send',
    clearHistory: 'Clear History',

    // Image Generation Tab
    imageGenTitle: 'Image Generation',
    imageSize: 'Image Size',
    imageSizeSquare: '1024x1024 (Square)',
    imageSizeLandscape: '1792x1024 (Landscape)',
    imageSizePortrait: '1024x1792 (Portrait)',
    imageSizeSmall: '512x512 (Small)',
    imageSizeTiny: '256x256 (Tiny)',
    imageDescription: 'Image Description',
    imagePromptPlaceholder: 'A beautiful sunset over the ocean...',
    generateButton: 'Generate Image',
    generatingImage: 'Generating image...',
    canvasPlaceholder: 'Generated images will appear here',
    downloadImage: 'Download Image',
    noImageToDownload: 'No image to download',
    imageDownloaded: 'Image downloaded!',

    // Img2img
    img2img: 'Image-to-Image',
    img2imgInput: 'Input Image (img2img)',
    img2imgHint: 'Upload an image to transform',
    selectImage: 'Select Image',
    noImageSelected: 'No image selected',
    noFileSelected: 'No file selected',
    img2imgLoaded: 'Image loaded for img2img',
    img2imgSuccess: 'Image-to-image generation successful!',
    invalidImageFile: 'Please select a valid image file',

    // Transparent background
    transparentBg: 'Transparent Background',
    transparentBgHint: 'Remove background from generated image',

    // Multimodal chat
    attachImage: 'Attach Image',
    attachedImages: 'Attached Images',

    // Temperature
    temperature: 'Temperature',
    tempPrecise: 'Precise (0)',
    tempBalanced: 'Balanced (1)',
    tempCreative: 'Creative (2)',

    // Messages
    you: 'You',
    ai: 'AI',
    system: 'System',

    // Notifications
    enterGameId: 'Please enter a Game ID',
    enterToken: 'Please enter a Developer Token',
    initSuccess: 'SDK initialized successfully!',
    initFailed: 'Initialization failed',
    logoutSuccess: 'Logged out successfully',
    logoutFailed: 'Logout failed',
    initFirst: 'Please initialize SDK first',
    enterImageDesc: 'Please enter an image description',
    imageGenSuccess: 'Image generated successfully!',
    imageGenFailed: 'Image generation failed',
    confirmClearChat: 'Are you sure you want to clear all chat messages?',
    chatHistoryCleared: 'Chat history cleared',

    // Errors
    error: 'Error',
    chatError: 'Chat error',
  },

  zh: {
    // Header
    title: 'PlayKit SDK 调试工具',
    subtitle: '测试 AI 功能并探索 SDK',
    status: {
      notInitialized: '未初始化',
      authenticated: '已认证',
    },

    // Sidebar
    configuration: '配置',
    gameId: 'Game ID',
    gameIdPlaceholder: '你的-game-id',
    authentication: '认证方式',
    authAuto: '自动登录（玩家）',
    authToken: '开发者 Token',
    developerToken: '开发者 Token',
    developerTokenPlaceholder: 'dev-token-xxxxx',
    chatModel: '文本模型',
    chatModelHint: '例如：gpt-4o, gpt-4o-mini, gpt-4',
    imageModel: '图像模型',
    imageModelHint: '例如：flux-1-schnell, dall-e-3',
    initButton: '初始化 SDK',
    initButtonLoading: '初始化中...',
    reinitButton: '重新初始化',
    loginButton: '登录',
    logoutButton: '退出登录',
    debugMode: '启用调试模式',
    rechargeButton: '立即充值',

    // Tabs
    tabTextGen: '文本生成',
    tabImageGen: '图像生成',

    // Text Generation Tab
    textGenTitle: '文本生成',
    systemPrompt: '系统提示词（可选）',
    systemPromptPlaceholder: '你是一个有用的助手...',
    enableStreaming: '启用流式响应',
    messagesPlaceholder: '消息将在这里显示...',
    inputPlaceholder: '输入你的消息...',
    sendButton: '发送',
    clearHistory: '清除历史',

    // Image Generation Tab
    imageGenTitle: '图像生成',
    imageSize: '图像尺寸',
    imageSizeSquare: '1024x1024（正方形）',
    imageSizeLandscape: '1792x1024（横向）',
    imageSizePortrait: '1024x1792（纵向）',
    imageSizeSmall: '512x512（小）',
    imageSizeTiny: '256x256（微型）',
    imageDescription: '图像描述',
    imagePromptPlaceholder: '海洋上空美丽的日落...',
    generateButton: '生成图像',
    generatingImage: '生成图像中...',
    canvasPlaceholder: '生成的图像将在这里显示',
    downloadImage: '下载图片',
    noImageToDownload: '没有可下载的图片',
    imageDownloaded: '图片已下载！',

    // Img2img
    img2img: '图生图',
    img2imgInput: '输入图片（图生图）',
    img2imgHint: '上传图片进行转换',
    selectImage: '选择图片',
    noImageSelected: '未选择图片',
    noFileSelected: '未选择文件',
    img2imgLoaded: '图片已加载用于图生图',
    img2imgSuccess: '图生图生成成功！',
    invalidImageFile: '请选择有效的图片文件',

    // Transparent background
    transparentBg: '透明背景',
    transparentBgHint: '移除生成图像的背景',

    // Multimodal chat
    attachImage: '添加图片',
    attachedImages: '已添加图片',

    // Temperature
    temperature: '温度',
    tempPrecise: '精确 (0)',
    tempBalanced: '平衡 (1)',
    tempCreative: '创意 (2)',

    // Messages
    you: '你',
    ai: 'AI',
    system: '系统',

    // Notifications
    enterGameId: '请输入 Game ID',
    enterToken: '请输入开发者 Token',
    initSuccess: 'SDK 初始化成功！',
    initFailed: '初始化失败',
    logoutSuccess: '退出登录成功',
    logoutFailed: '退出登录失败',
    initFirst: '请先初始化 SDK',
    enterImageDesc: '请输入图像描述',
    imageGenSuccess: '图像生成成功！',
    imageGenFailed: '图像生成失败',
    confirmClearChat: '确定要清除所有聊天消息吗？',
    chatHistoryCleared: '聊天历史已清除',

    // Errors
    error: '错误',
    chatError: '聊天错误',
  },
};

// i18n manager
class I18n {
  constructor() {
    this.currentLang = this.loadLanguage();
    this.translations = translations;
  }

  loadLanguage() {
    const saved = localStorage.getItem('playkit-playground-lang');
    if (saved && ['en', 'zh'].includes(saved)) {
      return saved;
    }
    // Auto-detect browser language
    const browserLang = navigator.language.toLowerCase();
    return browserLang.startsWith('zh') ? 'zh' : 'en';
  }

  saveLanguage(lang) {
    localStorage.setItem('playkit-playground-lang', lang);
  }

  setLanguage(lang) {
    if (!['en', 'zh'].includes(lang)) return;
    this.currentLang = lang;
    this.saveLanguage(lang);
    this.updatePage();
  }

  t(key, params = {}) {
    const keys = key.split('.');
    let value = this.translations[this.currentLang];

    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }

    // Replace parameters
    if (typeof value === 'string') {
      Object.keys(params).forEach((param) => {
        value = value.replace(`{${param}}`, params[param]);
      });
    }

    return value || key;
  }

  updatePage() {
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.getAttribute('data-i18n');
      const translated = this.t(key);

      if (element.tagName === 'OPTION') {
        element.textContent = translated;
      } else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        // Don't update value or placeholder for inputs
        element.textContent = translated;
      } else {
        element.textContent = translated;
      }
    });

    // Update placeholders separately
    document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
      const key = element.getAttribute('data-i18n-placeholder');
      const translated = this.t(key);
      element.placeholder = translated;
    });

    // Update language selector
    const langSelector = document.getElementById('language-selector');
    if (langSelector) {
      langSelector.value = this.currentLang;
    }
  }

  getCurrentLanguage() {
    return this.currentLang;
  }
}

// Export global instance
const i18n = new I18n();

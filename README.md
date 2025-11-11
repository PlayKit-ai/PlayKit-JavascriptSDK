# PlayKit SDK for JavaScript

[![npm version](https://img.shields.io/npm/v/playkit-sdk.svg)](https://www.npmjs.com/package/playkit-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**PlayKit SDK** 是一个强大的 JavaScript/TypeScript SDK，用于在 Web 游戏中集成 AI 功能。支持 AI 对话、图像生成、NPC 对话管理等功能。

## 特性

- 🤖 **AI 聊天** - 使用 GPT-4、GPT-3.5 等模型进行文本生成
- 🎨 **图像生成** - 使用 DALL-E 等模型生成图像
- 💬 **NPC 对话** - 自动管理对话历史的简化 API
- 🔐 **认证系统** - JWT 交换、令牌管理
- 📡 **流式响应** - 实时流式文本生成
- 🎮 **框架无关** - 适配任何 JavaScript 游戏引擎（P5.js、Phaser、PixiJS 等）
- 📦 **多种打包格式** - 支持 ESM、CJS、UMD
- 🔒 **安全存储** - 使用 Web Crypto API 加密令牌
- 📘 **TypeScript 支持** - 完整的类型定义

## 安装

```bash
npm install playkit-sdk
```

或使用 yarn:

```bash
yarn add playkit-sdk
```

## 快速开始

### 基础设置

```typescript
import { PlayKitSDK } from 'playkit-sdk';

// 初始化 SDK
const sdk = new PlayKitSDK({
  gameId: 'your-game-id',
  developerToken: 'your-dev-token', // 开发环境
});

// 初始化（必须在使用前调用）
await sdk.initialize();
```

### 基础聊天

```typescript
// 创建聊天客户端
const chat = sdk.createChatClient('gpt-4o-mini');

// 简单对话
const response = await chat.chat('你好，介绍一下你自己');
console.log(response);

// 带系统提示词的对话
const response = await chat.chat(
  '我应该如何探索这个地下城？',
  'You are a wise dungeon guide.'
);
```

### 流式聊天

```typescript
await chat.chatStream(
  '讲一个关于勇敢骑士的故事',
  (chunk) => {
    // 每收到一个文本片段就调用
    process.stdout.write(chunk);
  },
  (fullText) => {
    // 完成时调用
    console.log('\n完成:', fullText);
  }
);
```

### 高级聊天（完整配置）

```typescript
const result = await chat.textGeneration({
  messages: [
    { role: 'system', content: 'You are a helpful game assistant.' },
    { role: 'user', content: 'What should I do next?' },
  ],
  temperature: 0.7,
  maxTokens: 500,
});

console.log(result.content);
console.log('使用的 tokens:', result.usage);
```

### 图像生成

```typescript
// 创建图像客户端
const imageClient = sdk.createImageClient('dall-e-3');

// 生成图像
const image = await imageClient.generate('A futuristic cyberpunk city at night');

// 使用图像
console.log('Base64:', image.base64);
console.log('Data URL:', image.toDataURL());

// 在浏览器中显示
const imgElement = await image.toHTMLImage();
document.body.appendChild(imgElement);

// 带配置的图像生成
const image = await imageClient.generateImage({
  prompt: 'A dragon flying over mountains',
  size: '1024x1024',
  seed: 42, // 可重现的结果
  quality: 'hd',
  style: 'vivid',
});
```

### NPC 对话管理

```typescript
// 创建 NPC 客户端（自动管理历史）
const npc = sdk.createNPCClient({
  systemPrompt: 'You are a mysterious wizard who speaks in riddles.',
  temperature: 0.8,
  maxHistoryLength: 20,
});

// 与 NPC 对话
const reply1 = await npc.talk('Who are you?');
console.log('Wizard:', reply1);

const reply2 = await npc.talk('What is your quest?');
console.log('Wizard:', reply2);

// 流式 NPC 对话
await npc.talkStream(
  'Tell me a prophecy',
  (chunk) => process.stdout.write(chunk),
  (fullText) => console.log('\n[对话结束]')
);

// 历史管理
console.log('历史长度:', npc.getHistoryLength());
npc.clearHistory();

// 保存/加载历史
const savedHistory = npc.saveHistory();
localStorage.setItem('npc_history', savedHistory);

// 稍后...
const loaded = npc.loadHistory(localStorage.getItem('npc_history'));
```

### 玩家管理

```typescript
// 生产环境：使用 JWT 登录
await sdk.login('player-jwt-token');

// 获取玩家信息
const playerInfo = await sdk.getPlayerInfo();
console.log('Player ID:', playerInfo.userId);
console.log('Credits:', playerInfo.credits);
```

## 在 P5.js 中使用

```javascript
let sdk, npc, generatedImage;

async function setup() {
  createCanvas(800, 600);

  // 初始化 SDK
  sdk = new PlayKitSDK({
    gameId: 'your-game-id',
    developerToken: 'your-dev-token'
  });
  await sdk.initialize();

  // 创建 NPC
  npc = sdk.createNPCClient({
    systemPrompt: 'You are a friendly game character.'
  });
}

async function mousePressed() {
  // 与 NPC 对话
  const reply = await npc.talk('Hello!');
  console.log(reply);

  // 生成图像
  const imageClient = sdk.createImageClient();
  const img = await imageClient.generate('A magical forest');

  // 转换为 P5 可用的格式
  const htmlImg = await img.toHTMLImage();
  generatedImage = loadImage(htmlImg.src);
}

function draw() {
  background(220);

  if (generatedImage) {
    image(generatedImage, 0, 0, 400, 400);
  }

  text('Click to talk to NPC or generate image', 10, height - 20);
}
```

## 在 Vanilla JavaScript 中使用

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/playkit-sdk@latest/dist/index.umd.js"></script>
</head>
<body>
  <div id="output"></div>
  <input id="userInput" type="text" placeholder="输入消息...">
  <button onclick="sendMessage()">发送</button>

  <script>
    let sdk, chat;

    async function init() {
      sdk = new PlayKitSDK.PlayKitSDK({
        gameId: 'your-game-id',
        developerToken: 'your-dev-token'
      });

      await sdk.initialize();
      chat = sdk.createChatClient();
    }

    async function sendMessage() {
      const input = document.getElementById('userInput').value;
      const output = document.getElementById('output');

      output.innerHTML += `<p><strong>你:</strong> ${input}</p>`;

      // 流式显示回复
      output.innerHTML += `<p><strong>AI:</strong> <span id="aiReply"></span></p>`;
      const replyElement = document.getElementById('aiReply');

      await chat.chatStream(
        input,
        (chunk) => { replyElement.innerHTML += chunk; }
      );

      document.getElementById('userInput').value = '';
    }

    init();
  </script>
</body>
</html>
```

## API 文档

### PlayKitSDK

主 SDK 类，所有功能的入口点。

```typescript
class PlayKitSDK {
  constructor(config: SDKConfig)

  // 初始化（必须调用）
  async initialize(): Promise<void>

  // 认证
  async login(jwt: string): Promise<string>
  async logout(): Promise<void>
  isAuthenticated(): boolean

  // 玩家信息
  async getPlayerInfo(): Promise<PlayerInfo>

  // 创建客户端
  createChatClient(model?: string): ChatClient
  createImageClient(model?: string): ImageClient
  createNPCClient(config?: NPCConfig): NPCClient

  // 事件
  on('authenticated', (authState) => void)
  on('unauthenticated', () => void)
  on('ready', () => void)
  on('error', (error) => void)
}
```

### ChatClient

文本生成客户端。

```typescript
class ChatClient {
  // 简单对话
  async chat(message: string, systemPrompt?: string): Promise<string>

  // 流式对话
  async chatStream(
    message: string,
    onChunk: (chunk: string) => void,
    onComplete?: (fullText: string) => void,
    systemPrompt?: string
  ): Promise<void>

  // 完整配置的文本生成
  async textGeneration(config: ChatConfig): Promise<ChatResult>

  // 流式文本生成
  async textGenerationStream(config: ChatStreamConfig): Promise<void>

  // 结构化输出
  async generateStructured<T>(config: StructuredOutputConfig): Promise<T>
}
```

### ImageClient

图像生成客户端。

```typescript
class ImageClient {
  // 简单图像生成
  async generate(prompt: string, size?: ImageSize): Promise<GeneratedImage>

  // 单张图像
  async generateImage(config: ImageGenerationConfig): Promise<GeneratedImage>

  // 多张图像
  async generateImages(config: ImageGenerationConfig): Promise<GeneratedImage[]>
}

interface GeneratedImage {
  base64: string
  originalPrompt: string
  revisedPrompt?: string
  generatedAt: number
  size?: ImageSize

  toDataURL(): string
  toHTMLImage(): Promise<HTMLImageElement>
}
```

### NPCClient

NPC 对话客户端（自动管理历史）。

```typescript
class NPCClient {
  // 对话
  async talk(message: string): Promise<string>
  async talkStream(
    message: string,
    onChunk: (chunk: string) => void,
    onComplete?: (fullText: string) => void
  ): Promise<void>

  // 结构化对话
  async talkStructured<T>(message: string, schemaName: string): Promise<T>

  // 系统提示词
  setSystemPrompt(prompt: string): void
  getSystemPrompt(): string

  // 历史管理
  getHistory(): Message[]
  clearHistory(): void
  saveHistory(): string
  loadHistory(saveData: string): boolean
  revertToMessage(index: number): void
  getHistoryLength(): number

  // 事件
  on('response', (text: string) => void)
  on('history_cleared', () => void)
  on('history_loaded', () => void)
}
```

## 配置选项

### SDKConfig

```typescript
interface SDKConfig {
  gameId: string                  // 游戏 ID（必需）
  developerToken?: string         // 开发令牌（开发环境）
  playerJWT?: string              // 玩家 JWT（生产环境）
  baseURL?: string                // API 基础 URL
  defaultChatModel?: string       // 默认聊天模型
  defaultImageModel?: string      // 默认图像模型
  debug?: boolean                 // 调试模式
}
```

### ChatConfig

```typescript
interface ChatConfig {
  messages: Message[]             // 消息数组
  model?: string                  // 模型名称
  temperature?: number            // 温度 (0.0-2.0)
  maxTokens?: number              // 最大 tokens
  seed?: number                   // 随机种子
  stop?: string[]                 // 停止序列
  topP?: number                   // Top-p 采样
}
```

### ImageGenerationConfig

```typescript
interface ImageGenerationConfig {
  prompt: string                  // 提示词
  size?: ImageSize                // 图像大小
  n?: number                      // 生成数量 (1-10)
  seed?: number                   // 随机种子
  model?: string                  // 模型
  quality?: 'standard' | 'hd'     // 质量
  style?: 'vivid' | 'natural'     // 风格
}
```

## 支持的模型

### 聊天模型
- `gpt-4o` - GPT-4 Omni（最强）
- `gpt-4o-mini` - GPT-4 Omni Mini（推荐，性价比高）
- `gpt-4` - GPT-4
- `gpt-3.5-turbo` - GPT-3.5 Turbo

### 图像模型
- `dall-e-3` - DALL-E 3（推荐）
- `dall-e-2` - DALL-E 2

## 图像尺寸

支持的图像尺寸：
- `256x256`
- `512x512`
- `1024x1024`
- `1792x1024`
- `1024x1792`

## 错误处理

```typescript
import { PlayKitError } from 'playkit-sdk';

try {
  const chat = sdk.createChatClient();
  const result = await chat.chat('Hello');
} catch (error) {
  if (error instanceof PlayKitError) {
    console.error('PlayKit Error:', error.message);
    console.error('Error Code:', error.code);
    console.error('Status Code:', error.statusCode);
  } else {
    console.error('Unknown error:', error);
  }
}
```

## 事件系统

SDK 和各个客户端都支持事件系统：

```typescript
// SDK 事件
sdk.on('authenticated', (authState) => {
  console.log('已认证:', authState);
});

sdk.on('error', (error) => {
  console.error('SDK 错误:', error);
});

// NPC 事件
npc.on('response', (text) => {
  console.log('NPC 回复:', text);
});

npc.on('history_cleared', () => {
  console.log('历史已清除');
});
```

## 浏览器兼容性

- Chrome/Edge 60+
- Firefox 55+
- Safari 11+
- 需要支持：
  - ES2017
  - Fetch API
  - ReadableStream
  - Web Crypto API（用于加密）

## 开发环境 vs 生产环境

### 开发环境
使用开发者令牌（费用从开发者账户扣除）：

```typescript
const sdk = new PlayKitSDK({
  gameId: 'your-game-id',
  developerToken: 'dev-token-xxx'
});
```

### 生产环境
使用玩家 JWT（费用从玩家账户扣除）：

```typescript
const sdk = new PlayKitSDK({
  gameId: 'your-game-id'
});

await sdk.initialize();

// 玩家登录
await sdk.login('player-jwt-from-your-backend');
```

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 支持

- 📧 Email: support@developerworks.com
- 🐛 Issues: [GitHub Issues](https://github.com/developerworks/playkit-sdk-js/issues)
- 📖 文档: [完整文档](https://docs.developerworks.com)

## 更新日志

### 1.0.0-beta.1
- 首个公开测试版
- 支持 AI 聊天（文本生成）
- 支持图像生成
- NPC 对话管理
- 认证和玩家管理
- 流式响应支持

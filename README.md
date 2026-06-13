# PlayKit SDK for JavaScript

[![npm version](https://img.shields.io/npm/v/playkit-sdk.svg)](https://www.npmjs.com/package/playkit)

JavaScript/TypeScript SDK for integrating AI capabilities into web-based games.

## Features

- AI-powered text generation using GPT models
- Image generation using DALL-E models
- NPC conversation management with automatic history tracking
- JWT-based authentication and token management
- Real-time streaming responses
- Framework-agnostic design (compatible with P5.js, Phaser, PixiJS, etc.)
- Multiple bundle formats (ESM, CJS, UMD)
- Encrypted token storage using Web Crypto API
- Full TypeScript support with type definitions
- Player balance management and recharge functionality

## Installation

```bash
npm install playkit-sdk
```

## Quick Start

### Basic Setup

```typescript
import { PlayKitSDK } from 'playkit-sdk';

const sdk = new PlayKitSDK({
  gameId: 'your-game-id',
  developerToken: 'your-dev-token', // For development
});

await sdk.initialize();
```

### Text Generation

```typescript
const chat = sdk.createChatClient('gpt-4o-mini');

// Simple chat
const response = await chat.chat('Hello, introduce yourself');
console.log(response);

// With system prompt
const response = await chat.chat(
  'How should I explore this dungeon?',
  'You are a wise dungeon guide.'
);
```

### Streaming Text

```typescript
await chat.chatStream(
  'Tell a story about a brave knight',
  (chunk) => {
    process.stdout.write(chunk);
  },
  (fullText) => {
    console.log('\nComplete:', fullText);
  }
);
```

### Reasoning (Thinking)

Reasoning-capable models can think before answering. Enable it with the
`thinking` option (set the `effort` level) and read the model's reasoning
separately from its answer.

```typescript
// Non-streaming: reasoning is returned on `result.reasoning`
const result = await chat.textGeneration({
  messages: [{ role: 'user', content: 'Solve: 17 * 24, show your work.' }],
  thinking: { effort: 'high' },
});

console.log('Answer:', result.content);
console.log('Reasoning:', result.reasoning);

// Streaming: reasoning arrives via the `onReasoning` callback,
// kept separate from the answer text in `onChunk`
await chat.textGenerationStream({
  messages: [{ role: 'user', content: 'Solve: 17 * 24, show your work.' }],
  thinking: { effort: 'high' },
  onReasoning: (chunk) => process.stdout.write(`[thinking] ${chunk}`),
  onChunk: (chunk) => process.stdout.write(chunk),
  onComplete: (fullText) => console.log('\nComplete:', fullText),
});
```

### Image Generation

```typescript
const imageClient = sdk.createImageClient('dall-e-3');

const image = await imageClient.generate('A futuristic cyberpunk city at night');

console.log('Base64:', image.base64);
console.log('Data URL:', image.toDataURL());

// Display in browser
const imgElement = await image.toHTMLImage();
document.body.appendChild(imgElement);
```

### Text-to-Speech (TTS)

```typescript
const tts = sdk.createTTSClient(); // defaults to 'default-tts-model'

// Get raw audio bytes plus usage metadata
const result = await tts.synthesize({
  text: 'Welcome to the game, brave adventurer!',
  voice: 'male-qn-qingse',
  format: 'mp3',
});
console.log('Characters billed:', result.usageCharacters);
console.log('Audio length (ms):', result.audioLengthMs);

// Or get a playable object URL directly (browser)
const url = await tts.synthesizeToObjectURL({ text: 'Hello there!' });
const audio = new Audio(url);
audio.play();

// List the available voices
const { voices, total } = await tts.listVoices();
console.log(`${total} voices available`);
for (const voice of voices) {
  console.log(voice.voiceId, voice.name, voice.kind); // kind: 'system' | 'custom'
}
```

### NPC Conversations

```typescript
const npc = sdk.createNPCClient({
  systemPrompt: 'You are a mysterious wizard who speaks in riddles.',
  temperature: 0.8,
  maxHistoryLength: 20,
});

const reply1 = await npc.talk('Who are you?');
console.log('Wizard:', reply1);

const reply2 = await npc.talk('What is your quest?');
console.log('Wizard:', reply2);

// Save/load history
const savedHistory = npc.saveHistory();
localStorage.setItem('npc_history', savedHistory);

// Later...
npc.loadHistory(localStorage.getItem('npc_history'));
```

### Player Balance Management

```typescript
// Get player info and balance
const playerInfo = await sdk.getPlayerInfo();
console.log('Player ID:', playerInfo.userId);
console.log('Credits:', playerInfo.credits);

// Open recharge window
sdk.openRechargeWindow();

// Show insufficient balance modal
await sdk.showInsufficientBalanceModal();

// Enable automatic balance checking
sdk.enableAutoBalanceCheck(30000); // Check every 30 seconds

// Listen to balance events
sdk.on('balance_updated', (credits) => {
  console.log('New balance:', credits);
});

sdk.on('insufficient_credits', (error) => {
  console.log('User needs to recharge');
});
```

## Usage with P5.js

```javascript
let sdk, npc, generatedImage;

async function setup() {
  createCanvas(800, 600);

  sdk = new PlayKitSDK({
    gameId: 'your-game-id',
    developerToken: 'your-dev-token'
  });
  await sdk.initialize();

  npc = sdk.createNPCClient({
    systemPrompt: 'You are a friendly game character.'
  });
}

async function mousePressed() {
  const reply = await npc.talk('Hello!');
  console.log(reply);

  const imageClient = sdk.createImageClient();
  const img = await imageClient.generate('A magical forest');

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

## Usage with Vanilla JavaScript

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/playkit-sdk@latest/dist/playkit-sdk.umd.js"></script>
</head>
<body>
  <div id="output"></div>
  <input id="userInput" type="text" placeholder="Type a message...">
  <button onclick="sendMessage()">Send</button>

  <script>
    let sdk, chat;

    async function init() {
      // window.PlayKitSDK is the constructor itself.
      // Legacy form `new PlayKitSDK.PlayKitSDK({ ... })` still works for v1.x BC.
      sdk = new PlayKitSDK({
        gameId: 'your-game-id',
        developerToken: 'your-dev-token'
      });

      await sdk.initialize();
      chat = sdk.createChatClient();
    }

    async function sendMessage() {
      const input = document.getElementById('userInput').value;
      const output = document.getElementById('output');

      output.innerHTML += `<p><strong>You:</strong> ${input}</p>`;
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


## License

Proprietary License - see [LICENSE](LICENSE) file for details.

This SDK is proprietary software owned by Agentland Lab. Use of this SDK is subject to the terms and conditions of the license agreement.

## Support

- Email: support@playkit.ai
- Issues: [GitHub Issues](https://github.com/cnqdztp/PlayKit-JavascriptSDK/issues)

## Changelog

### 1.4.0
- Added text-to-speech (TTS) client
- Added `thinking` reasoning-effort option on chat (`thinking: { effort: 'high' }`)
- Surface model reasoning: `result.reasoning` (non-streaming) and the `onReasoning` callback (streaming)

### 1.0.0-beta.1
- Initial public beta release
- AI chat support (text generation)
- Image generation support
- NPC conversation management
- Authentication and player management
- Streaming response support
- Player balance management and recharge functionality

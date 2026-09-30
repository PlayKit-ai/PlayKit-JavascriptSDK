# PlayKit SDK for JavaScript

[![npm version](https://img.shields.io/npm/v/playkit-sdk.svg)](https://www.npmjs.com/package/playkit)

JavaScript/TypeScript SDK for integrating AI capabilities into web-based games.

## Features

- AI-powered text generation using GPT models
- Image generation using DALL-E models
- JWT-based authentication and token management
- Real-time streaming responses
- Framework-agnostic design (compatible with P5.js, Phaser, PixiJS, etc.)
- Multiple bundle formats (ESM, CJS, UMD)
- Encrypted token storage using Web Crypto API
- Full TypeScript support with type definitions
- Player balance management and recharge functionality

## Installation

```bash
npm install ./playkit-sdk-2.0.0-next.1.tgz
```

## Quick Start

The 2.0 prerelease is built locally with `npm run build` and packaged with `npm pack`.

### Basic Setup

```typescript
import { PlayKitSDK } from 'playkit-sdk';

const sdk = new PlayKitSDK({
  gameId: 'your-game-id',
  developerToken: 'your-dev-token', // For development
});

await sdk.initialize();
```

### Chat

```ts
const chat = sdk.createChatClient();
const result = await chat.generate({
  model: 'default-chat',
  messages: [
    { role: 'system', content: 'You are a dungeon guide.' },
    { role: 'user', content: 'Where should I go?' },
  ],
  temperature: 0.4,
  maxTokens: 500,
});
console.log(result.content, result.usage, result.requestId);
```

### Streaming

`stream` returns the complete result after the stream finishes. Errors reject
its promise; an `AbortSignal` cancels the request. `onEvent` exposes tool and
metadata events as well as text and reasoning events.

```ts
const controller = new AbortController();
const result = await chat.stream({
  messages: [{ role: 'user', content: 'Tell me a story.' }],
  thinking: { effort: 'high' },
  signal: controller.signal,
  onChunk: text => process.stdout.write(text),
  onReasoning: text => console.log(text),
  onEvent: event => {
    if (event.type === 'tool-input-available') console.log(event.input);
  },
});
console.log(result.usage, result.tool_calls);
```

### Structured output and tools

Pass JSON Schema directly; the full message history reaches the model. The
server validates generated output. The generic type describes the parsed result.
Tools and structured output are mutually exclusive for a single call.

```ts
const result = await chat.generate<{ direction: string }>({
  messages: [{ role: 'user', content: 'Choose the next direction.' }],
  schema: {
    type: 'object',
    properties: { direction: { type: 'string' } },
    required: ['direction'],
    additionalProperties: false,
  },
});
console.log(result.output?.direction);

const withTools = await chat.generate({
  messages: [{ role: 'user', content: 'Look at my inventory.' }],
  tools: [{ type: 'function', function: {
    name: 'get_inventory', description: 'Read the player inventory',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  } }],
});
console.log(withTools.tool_calls);
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
let sdk, chat, generatedImage;

async function setup() {
  createCanvas(800, 600);

  sdk = new PlayKitSDK({
    gameId: 'your-game-id',
    developerToken: 'your-dev-token'
  });
  await sdk.initialize();

  chat = sdk.createChatClient();
}

async function mousePressed() {
  const reply = await chat.generate({
    messages: [{ role: 'user', content: 'Hello!' }]
  });
  console.log(reply.content);

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
}
```

## Usage with Vanilla JavaScript

```html
<!DOCTYPE html>
<html>
<head>
  <script src="./dist/playkit-sdk.umd.js"></script>
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
      await chat.stream({
        messages: [{ role: 'user', content: input }],
        onChunk: (chunk) => { replyElement.textContent += chunk; },
      });

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
- Authentication and player management
- Streaming response support
- Player balance management and recharge functionality

## Managed prompts

Create prompt definitions, immutable versions, release labels, datasets and
experiments in the PlayKit web console or through the REST management API.
The JavaScript SDK executes existing prompts through Chat.

```ts
const chat = sdk.createChatClient();
const result = await chat.generate({
  prompt: { name: 'dialogue/greeting' },
  variables: { speakerName: 'Mira' },
  placeholders: { history: [{ role: 'user', content: 'Hello' }] },
});
console.log(result.content, result.prompt?.version, result.requestId);

await chat.stream({
  prompt: { name: 'dialogue/greeting' },
  variables: { speakerName: 'Mira' },
  placeholders: { history: [{ role: 'user', content: 'Hello' }] },
  onChunk: text => process.stdout.write(text),
});
```

Messages and managed prompts are mutually exclusive. The gateway resolves the
prompt, substitutes variables and message placeholders, and uses the version's
saved configuration. Client-wide defaults do not override that configuration.
The response identifies the actual version used.

Calls without a selector version or label use the channel's release. Authorized
developer tokens may explicitly select a version or label and supply per-call
model parameters. Player tokens use the channel release and its saved parameters.

Prompt retrieval for external model calls, template compilation, creation,
publication and experimentation belong to the web/API management workflow.

# PlayKit SDK Playground

An interactive playground for testing and exploring PlayKit SDK features.

## Features

- **Multiple Authentication Methods**: Choose between developer token (for testing) or automatic player login (for production)
- **Text Generation**: Test AI chat with customizable models and system prompts, with streaming support
- **Image Generation**: Generate images with any model (default: flux-1-schnell), display them in a P5.js canvas, and browse a gallery
- **NPC Conversations**: Create and manage multiple NPCs with custom personalities, save/load conversation history
- **Flexible Model Selection**: Enter any chat or image model name (not limited to preset options)
- **Bilingual Support**: Switch between English and Chinese (中文) interface
- **Beautiful UI**: Modern interface built with Tailwind CSS

## Setup

### 1. Build the SDK

Make sure you've built the SDK first:

```bash
cd ../..
npm install
npm run build
```

### 2. Run the Playground

Simply open `index.html` in your browser:

```bash
# Using Python
python -m http.server 8000

# Or using Node.js http-server
npx http-server -p 8000
```

Then visit: `http://localhost:8000/examples/playground/`

## Usage

### Getting Started

1. **Enter Your Game ID**: Get this from [PlayKit Platform](https://playkit.ai)

2. **Choose Authentication Method**:
   - **Auto Login (Player)**: Best for production, shows login UI if needed
   - **Developer Token**: Quick testing, costs charged to your account

3. **Select Models**:
   - Chat Model: Enter any model name (default: gpt-4o). Examples: gpt-4o, gpt-4o-mini, gpt-4, claude-3-opus
   - Image Model: Enter any model name (default: flux-1-schnell). Examples: flux-1-schnell, dall-e-3, sd-3.0

4. **Choose Language**: Select English or 中文 from the language selector in the header

5. **Click "Initialize SDK"**: Wait for authentication to complete

### Text Generation

1. (Optional) Add a system prompt to customize AI behavior
2. Toggle streaming on/off
3. Type your message and click "Send"
4. Watch the AI respond in real-time (if streaming is enabled)

### Image Generation

1. Select image size (Square, Landscape, or Portrait)
2. Enter a detailed image description
3. Click "Generate Image"
4. View the result in the P5.js canvas
5. Click any image in the gallery to view it again

### NPC Conversations

1. **Create an NPC**:
   - Enter a name (e.g., "Guard", "Shopkeeper")
   - Write a system prompt defining the NPC's personality
   - Click "Create NPC"

2. **Chat with NPC**:
   - Select the NPC from the dropdown
   - Type your message and send
   - The NPC will respond based on its personality

3. **Manage History**:
   - **Save History**: Save conversation to localStorage
   - **Load History**: Restore saved conversation
   - **Reset**: Clear conversation and start fresh

## Features in Detail

### Authentication

The playground supports both authentication modes:

**Developer Token Mode** (Development):
- Quick setup for testing
- Costs charged to your developer account
- No player login required

**Auto Login Mode** (Production):
- Automatic login UI if not authenticated
- Costs charged to player
- Best for released games

### Streaming

Text generation and NPC conversations support streaming:
- See responses appear word-by-word
- More engaging user experience
- Uses Server-Sent Events (SSE)

### P5.js Integration

Images are displayed using P5.js canvas:
- Automatic scaling to fit canvas
- Click gallery images to re-display them
- Smooth rendering and transitions

### Local Storage

The playground automatically saves:
- Your configuration (Game ID, models)
- NPC conversation histories
- Auth tokens (encrypted)

## Keyboard Shortcuts

- `Enter` in chat/NPC input: Send message
- `Tab` between fields for quick navigation

## Tips

1. **Start Simple**: Try "Hello, who are you?" for chat testing
2. **Image Prompts**: Be descriptive! "A red dragon flying over a medieval castle at sunset" works better than "dragon"
3. **NPC Personalities**: Include role, personality traits, and background in system prompt
4. **Save Often**: Use "Save History" for NPCs you want to continue later
5. **Debug Mode**: Enable for detailed console logs

## Troubleshooting

### "Please initialize SDK first"
Make sure you've entered a Game ID and clicked "Initialize SDK"

### Authentication Failed
- Check your Game ID is correct
- Verify developer token (if using token mode)
- Check browser console for detailed errors

### Image Generation Slow
- DALL-E 3 is slower but higher quality
- Try DALL-E 2 for faster results
- Larger images take longer to generate

### NPC Not Responding
- Ensure SDK is initialized
- Check you've created and selected an NPC
- Verify your system prompt is not empty

## Browser Compatibility

- Chrome/Edge 60+
- Firefox 55+
- Safari 11+

Requires:
- ES2017 support
- Fetch API
- ReadableStream
- Web Crypto API
- localStorage

## Resources

- [PlayKit SDK Documentation](https://docs.agentlandlab.com)
- [PlayKit Platform](https://playkit.ai)
- [P5.js Reference](https://p5js.org/reference/)
- [Tailwind CSS Docs](https://tailwindcss.com)

## License

MIT

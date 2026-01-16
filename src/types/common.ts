/**
 * Common types used across the SDK
 */

/**
 * Message role in a conversation
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Tool call made by the assistant
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Text content part in a multimodal message
 */
export interface TextContentPart {
  type: 'text';
  text: string;
}

/**
 * Image content part in a multimodal message (OpenAI format)
 */
export interface ImageContentPart {
  type: 'image_url';
  image_url: {
    /** Image URL or base64 data URL (e.g., 'data:image/png;base64,...') */
    url: string;
    /** Optional detail level for vision models */
    detail?: 'auto' | 'low' | 'high';
  };
}

/**
 * Audio content part in a multimodal message (OpenAI format)
 */
export interface AudioContentPart {
  type: 'input_audio';
  input_audio: {
    /** Base64-encoded audio data */
    data: string;
    /** Audio format (e.g., 'wav', 'mp3', 'webm') */
    format: 'wav' | 'mp3' | 'webm' | 'flac' | 'ogg';
  };
}

/**
 * Content part types for multimodal messages
 */
export type MessageContentPart = TextContentPart | ImageContentPart | AudioContentPart;

/**
 * Message content - can be a simple string or array of content parts for multimodal
 */
export type MessageContent = string | MessageContentPart[];

/**
 * A message in a conversation
 */
export interface Message {
  role: MessageRole;
  /** Content can be a string or array of content parts (for multimodal) */
  content: MessageContent;
  /** Tool calls made by the assistant (when role is 'assistant') */
  tool_calls?: ToolCall[];
  /** Tool call ID this message responds to (when role is 'tool') */
  tool_call_id?: string;
}

/**
 * Helper to create a text message
 */
export function createTextMessage(role: MessageRole, text: string): Message {
  return { role, content: text };
}

/**
 * Helper to create a multimodal message with text and images
 */
export function createMultimodalMessage(
  role: MessageRole,
  text: string,
  images?: Array<{ url: string; detail?: 'auto' | 'low' | 'high' }>,
  audios?: Array<{ data: string; format: 'wav' | 'mp3' | 'webm' | 'flac' | 'ogg' }>
): Message {
  const content: MessageContentPart[] = [];

  // Add text part first
  if (text) {
    content.push({ type: 'text', text });
  }

  // Add image parts
  if (images) {
    for (const img of images) {
      content.push({
        type: 'image_url',
        image_url: { url: img.url, detail: img.detail },
      });
    }
  }

  // Add audio parts
  if (audios) {
    for (const audio of audios) {
      content.push({
        type: 'input_audio',
        input_audio: { data: audio.data, format: audio.format },
      });
    }
  }

  return { role, content };
}

/**
 * Generic API result wrapper
 */
export interface APIResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

/**
 * Authentication method type
 * - 'device': Device Authorization flow with PKCE (recommended, opens browser for auth)
 * - 'headless': Embedded verification code login (creates global tokens)
 *
 * @deprecated 'headless' is deprecated and will be removed in v2.0. Use 'device' instead.
 */
export type AuthMethod = 'device' | 'headless';

/**
 * SDK Configuration options
 */
export interface SDKConfig {
  /** Game ID provided by PlayKit */
  gameId: string;

  /** Developer token for testing (optional, for development only) */
  developerToken?: string;

  /** Player JWT token for production (optional) */
  playerJWT?: string;

  /** Base URL for API endpoints (optional, defaults to production) */
  baseURL?: string;

  /**
   * Authentication method to use
   * - 'device': Device Authorization flow with PKCE (recommended, opens browser for auth)
   * - 'headless': Embedded verification code login (creates global tokens)
   * Default: 'device'
   */
  authMethod?: AuthMethod;

  /** Default chat model to use */
  defaultChatModel?: string;

  /** Default image model to use */
  defaultImageModel?: string;

  /** Default transcription model to use */
  defaultTranscriptionModel?: string;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Authentication state
 */
export interface AuthState {
  isAuthenticated: boolean;
  token?: string;
  tokenType?: 'developer' | 'player';
  expiresAt?: number;
}

/**
 * Daily refresh result included in player info
 */
export interface DailyRefreshResult {
  /** Whether credits were actually added */
  refreshed: boolean;
  /** Human-readable message about the result */
  message: string;
  /** Balance before the refresh attempt */
  balanceBefore?: number;
  /** Balance after the refresh attempt */
  balanceAfter?: number;
  /** Amount of credits added (0 if not refreshed) */
  amountAdded?: number;
}

/**
 * Player information
 */
export interface PlayerInfo {
  userId: string;
  credits: number;
  /** Player nickname (per-game nickname > first_name > null) */
  nickname?: string | null;
  /** Daily refresh result (automatically triggered on player-info request) */
  dailyRefresh?: DailyRefreshResult;
}

/**
 * Set nickname request
 */
export interface SetNicknameRequest {
  nickname: string;
}

/**
 * Set nickname response
 */
export interface SetNicknameResponse {
  success: boolean;
  nickname: string;
  gameId: string;
}

/**
 * Error types that can be thrown by the SDK
 */
export class PlayKitError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'PlayKitError';
  }
}

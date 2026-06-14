/**
 * Common types used across the SDK
 */

import type { LogConfig } from '../utils/Logger';
import type { Effort } from './chat';

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
 * Canonical PlayKit tool-call content part.
 * Matches the server's internal model-message shape while legacy `tool_calls`
 * fields remain accepted for backward compatibility.
 */
export interface ToolCallContentPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  input: unknown;
  providerExecuted?: boolean;
}

/**
 * Canonical PlayKit tool-result output.
 */
export type ToolResultOutput =
  | { type: 'text'; value: string }
  | { type: 'json'; value: unknown }
  | { type: 'execution-denied'; reason?: string }
  | { type: 'error-text'; value: string }
  | { type: 'error-json'; value: unknown };

/**
 * Canonical PlayKit tool-result content part.
 */
export interface ToolResultContentPart {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  output: ToolResultOutput;
}

/**
 * Content part types for multimodal messages
 */
export type MessageContentPart =
  | TextContentPart
  | ImageContentPart
  | AudioContentPart
  | ToolCallContentPart
  | ToolResultContentPart;

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
  /**
   * Legacy OpenAI-compatible tool calls made by the assistant.
   * Prefer canonical `{ type: 'tool-call' }` content parts for new history.
   */
  tool_calls?: ToolCall[];
  /**
   * Legacy OpenAI-compatible tool call ID this message responds to.
   * Prefer canonical `{ type: 'tool-result' }` content parts for new history.
   */
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
 * Convert an OpenAI-compatible tool call returned by the API into the canonical
 * PlayKit message content part used for future requests.
 */
export function createToolCallContentPart(toolCall: ToolCall): ToolCallContentPart {
  let input: unknown = {};
  const args = toolCall.function?.arguments;
  if (typeof args === 'string' && args.trim()) {
    try {
      input = JSON.parse(args);
    } catch {
      input = args;
    }
  }

  return {
    type: 'tool-call',
    toolCallId: toolCall.id,
    toolName: toolCall.function.name,
    input,
  };
}

/**
 * Create a canonical PlayKit tool-result content part.
 */
export function createToolResultContentPart(
  toolCallId: string,
  toolName: string,
  result: string | unknown
): ToolResultContentPart {
  if (typeof result === 'string') {
    return {
      type: 'tool-result',
      toolCallId,
      toolName,
      output: { type: 'text', value: result },
    };
  }

  return {
    type: 'tool-result',
    toolCallId,
    toolName,
    output: { type: 'json', value: result },
  };
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
 * Configuration for developerToken fallback behavior
 * When developerToken authentication fails, the SDK can automatically
 * fall back to player login flow.
 */
export interface DeveloperTokenFallbackConfig {
  /**
   * Whether to enable automatic fallback to player login when developerToken fails.
   * Default: true
   */
  enabled?: boolean;
}

/**
 * SDK running mode
 * - 'browser': Default mode with UI support (login dialogs, indicators, etc.)
 * - 'server': Server/Node.js mode, disables UI-related features
 */
export type SDKMode = 'browser' | 'server';

/**
 * SDK Configuration options
 */
export interface SDKConfig {
  /** Game ID provided by PlayKit */
  gameId: string;

  /** Developer token for testing (optional, for development only) */
  developerToken?: string;

  /**
   * Player token to use directly (optional)
   * When provided, SDK will use this token without triggering login flow.
   * Useful for server-side usage where token is passed from client.
   */
  playerToken?: string;

  /**
   * Whether to auto-detect platform token from localStorage (same-domain scenario).
   * When enabled, SDK will check localStorage for a token stored by the platform
   * (e.g., Agentland-Space) and use it directly without triggering Device Auth.
   * Default: true
   */
  autoDetectPlatformToken?: boolean;

  /**
   * localStorage key name for platform token detection.
   * Default: 'shared_token'
   */
  platformTokenKey?: string;

  /** Base URL for API endpoints (optional, defaults to production) */
  baseURL?: string;

  /**
   * SDK running mode
   * - 'browser': Default mode with UI support (login dialogs, indicators, etc.)
   * - 'server': Server/Node.js mode, disables UI-related features
   * Default: 'browser'
   */
  mode?: SDKMode;

  /** Default chat model to use */
  defaultChatModel?: string;

  /**
   * Default reasoning ("thinking") effort to use for chat requests.
   *
   * Resolution order per request: per-request `thinking.effort` > this SDK-level
   * default > omit (the server then defaults to off). Sent on the wire as
   * `thinking: { effort }`. Use `'off'` to explicitly disable reasoning.
   */
  defaultThinkingEffort?: Effort;

  /** Default image model to use */
  defaultImageModel?: string;

  /** Default transcription model to use */
  defaultTranscriptionModel?: string;

  /** Default text-to-speech model to use */
  defaultTTSModel?: string;

  /**
   * Enable debug logging
   * @deprecated Use `logging.level` instead. Will be removed in v2.0.
   */
  debug?: boolean;

  /**
   * Logging configuration
   * Controls how SDK logs are handled
   *
   * @example
   * ```typescript
   * const sdk = new PlayKitSDK({
   *   gameId: 'your-game-id',
   *   logging: {
   *     level: LogLevel.DEBUG,
   *     consoleEnabled: false,
   *     handlers: [myCustomHandler],
   *   }
   * });
   * ```
   */
  logging?: LogConfig;

  /**
   * Configuration for developerToken fallback behavior.
   * When developerToken validation fails, the SDK can automatically
   * fall back to player login flow.
   *
   * @example
   * ```typescript
   * // Default: fallback enabled
   * const sdk = new PlayKitSDK({
   *   gameId: 'your-game-id',
   *   developerToken: 'my-token',
   * });
   *
   * // Disable fallback
   * const sdk = new PlayKitSDK({
   *   gameId: 'your-game-id',
   *   developerToken: 'my-token',
   *   developerTokenFallback: { enabled: false },
   * });
   * ```
   */
  developerTokenFallback?: DeveloperTokenFallbackConfig;
}

/**
 * Authentication state
 */
export interface AuthState {
  isAuthenticated: boolean;
  token?: string;
  tokenType?: 'developer' | 'player';
  expiresAt?: number;
  /** Refresh token for obtaining new access tokens */
  refreshToken?: string;
  /** Refresh token expiration timestamp (milliseconds) */
  refreshExpiresAt?: number;
}

/**
 * Token refresh result
 */
export interface TokenRefreshResult {
  /** New access token */
  accessToken: string;
  /** Token type (always "Bearer") */
  tokenType: string;
  /** Access token expiration time in seconds */
  expiresIn: number;
  /** Refresh token (same as before or rotated) */
  refreshToken: string;
  /** Refresh token expiration time in seconds */
  refreshExpiresIn: number;
  /** Token scope */
  scope: string;
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
  /** Display balance (unified across all token types) */
  balance: number;
  /**
   * @deprecated Use `balance` instead. Will be removed in v2.0.
   */
  credits?: number;
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

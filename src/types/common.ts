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
 * A message in a conversation
 */
export interface Message {
  role: MessageRole;
  content: string;
  /** Tool calls made by the assistant (when role is 'assistant') */
  tool_calls?: ToolCall[];
  /** Tool call ID this message responds to (when role is 'tool') */
  tool_call_id?: string;
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
 */
export type AuthMethod = 'headless' | 'external-auth';

/**
 * SDK Configuration options
 */
export interface SDKConfig {
  /** Game ID provided by DeveloperWorks */
  gameId: string;

  /** Developer token for testing (optional, for development only) */
  developerToken?: string;

  /** Player JWT token for production (optional) */
  playerJWT?: string;

  /** Base URL for API endpoints (optional, defaults to production) */
  baseURL?: string;

  /**
   * Authentication method to use
   * - 'headless': Embedded verification code login (for Unity SDK, creates global tokens)
   * - 'external-auth': OAuth popup flow (for web/WebGL games, creates game-specific tokens)
   * Default: 'external-auth'
   */
  authMethod?: AuthMethod;

  /** Default chat model to use */
  defaultChatModel?: string;

  /** Default image model to use */
  defaultImageModel?: string;

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
 * Player information
 */
export interface PlayerInfo {
  userId: string;
  credits: number;
  /** Player nickname (per-game nickname > first_name > null) */
  nickname?: string | null;
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

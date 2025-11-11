/**
 * PlayKit SDK for JavaScript
 * AI integration for web-based games
 */

// Main SDK
export { PlayKitSDK } from './core/PlayKitSDK';

// Core clients
export { ChatClient } from './core/ChatClient';
export { ImageClient } from './core/ImageClient';
export { NPCClient } from './core/NPCClient';
export type { NPCConfig } from './core/NPCClient';
export { PlayerClient } from './core/PlayerClient';

// Authentication
export { AuthManager } from './auth/AuthManager';
export { TokenStorage } from './auth/TokenStorage';

// Types
export type {
  // Common types
  Message,
  MessageRole,
  APIResult,
  SDKConfig,
  AuthState,
  PlayerInfo,
  PlayKitError,
  // Chat types
  ChatConfig,
  ChatStreamConfig,
  ChatResult,
  StructuredOutputConfig,
  ChatCompletionResponse,
  StreamChunk,
  // Image types
  ImageSize,
  ImageGenerationConfig,
  GeneratedImage,
  ImageGenerationResponse,
} from './types';

// Utilities
export { StreamParser } from './utils/StreamParser';

// Default export
export { PlayKitSDK as default } from './core/PlayKitSDK';

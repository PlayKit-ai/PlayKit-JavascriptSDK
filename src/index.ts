/**
 * PlayKit SDK for JavaScript
 * AI integration for web-based games
 */

// Main SDK
export { PlayKitSDK } from './core/PlayKitSDK';

// Core clients
export { ChatClient } from './core/ChatClient';
export type {
  ChatWithToolsConfig,
  ChatWithToolsStreamConfig,
  StructuredGenerationConfig,
  StructuredResult,
} from './core/ChatClient';
export { ImageClient } from './core/ImageClient';
export { TranscriptionClient } from './core/TranscriptionClient';
export { NPCClient } from './core/NPCClient';
export type { NPCConfig, ConversationSaveData, MemoryEntry } from './core/NPCClient';
export { PlayerClient } from './core/PlayerClient';

// Schema Library
export { SchemaLibrary, defaultSchemaLibrary } from './core/SchemaLibrary';
export type { SchemaEntry } from './core/SchemaLibrary';

// AI Context Manager
export { AIContextManager, defaultContextManager } from './core/AIContextManager';
export type { AIContextManagerConfig, AIContextManagerEvents } from './core/AIContextManager';

// Authentication
export { AuthManager } from './auth/AuthManager';
export { TokenStorage } from './auth/TokenStorage';
/**
 * @deprecated Use DeviceAuthFlowManager instead. Will be removed in v2.0
 */
export { AuthFlowManager } from './auth/AuthFlowManager';
export { DeviceAuthFlowManager } from './auth/DeviceAuthFlowManager';
export type {
  DeviceAuthFlowOptions,
  DeviceAuthResult,
  DeviceAuthInitResult,
  TokenScope,
  GameInfo,
} from './auth/DeviceAuthFlowManager';

// Recharge
export { RechargeManager } from './recharge/RechargeManager';

// Helper functions
export {
  createTextMessage,
  createMultimodalMessage,
} from './types/common';

// Types
export type {
  // Common types
  Message,
  MessageRole,
  MessageContent,
  MessageContentPart,
  TextContentPart,
  ImageContentPart,
  AudioContentPart,
  APIResult,
  SDKConfig,
  SDKMode,
  AuthState,
  TokenRefreshResult,
  PlayerInfo,
  SetNicknameRequest,
  SetNicknameResponse,
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
  ImageInput,
  ImageGenerationConfig,
  GeneratedImage,
  ImageGenerationResponse,
  // Transcription types
  TranscriptionConfig,
  TranscriptionOptions,
  TranscriptionResult,
  TranscriptionSegment,
} from './types';

// Recharge types
export type {
  RechargeConfig,
  RechargeModalOptions,
  RechargeEvents,
} from './types/recharge';

// Utilities
export { StreamParser } from './utils/StreamParser';
export { TokenValidator, defaultTokenValidator } from './utils/TokenValidator';
export type {
  ValidatedPlayerInfo,
  TokenVerificationResult,
  TokenValidatorOptions,
} from './utils/TokenValidator';

// Storage abstraction (for custom storage providers)
export { BrowserStorage, MemoryStorage, createStorage, isLocalStorageAvailable } from './utils/Storage';
export type { IStorage } from './utils/Storage';
export type { TokenStorageOptions } from './auth/TokenStorage';

// Logger
export { Logger, LogLevel, BufferLogHandler, CallbackLogHandler } from './utils/Logger';
export type { LogEntry, LogHandler, LogConfig } from './utils/Logger';

// Default export
export { PlayKitSDK as default } from './core/PlayKitSDK';

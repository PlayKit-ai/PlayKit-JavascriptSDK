/**
 * PlayKit SDK for JavaScript
 * AI integration for web-based games
 */

// Main SDK
export { PlayKitSDK } from './core/PlayKitSDK';

export { PlayKitError } from './types/common';

// Core clients
export { ChatClient } from './core/ChatClient';
export { ImageClient } from './core/ImageClient';
export { TranscriptionClient } from './core/TranscriptionClient';
export { TTSClient } from './core/TTSClient';
export { PlayerClient } from './core/PlayerClient';

// Authentication
export { AuthManager } from './auth/AuthManager';
export { TokenStorage } from './auth/TokenStorage';
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
  DeveloperTokenFallbackConfig,
  // Chat types
  ChatConfig,
  ChatStreamConfig,
  ChatResult,
  ChatCompletionResponse,
  ChatParameters,
  ChatInput,
  ChatOutput,
  ChatStreamEvent,
  ChatStreamMetadata,
  ChatUsage,
  ChatTool,
  JsonSchema,
  ToolChoice,
  PromptRunReceipt,
  PromptSelector,
  PromptVariables,
  PromptPlaceholders,
  Effort,
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
  // TTS types
  TTSConfig,
  TTSOptions,
  TTSResult,
  TTSTimestampsConfig,
  TTSTimestampsResult,
  Alignment,
  AlignmentItem,
  VoiceMixEntry,
  VoiceSettings,
  VoiceInfo,
  VoiceListResult,
} from './types';

// Recharge types
export type {
  RechargeConfig,
  RechargeModalOptions,
  RechargeEvents,
} from './types/recharge';

// Utilities
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

// Ambient global for the UMD bundle.
// Loading dist/playkit-sdk.umd.js puts the SDK on window.PlayKitSDK as a
// callable class. `PlayKitSDK.PlayKitSDK` self-reference is preserved so
// v1.x code (`new window.PlayKitSDK.PlayKitSDK(cfg)`) keeps working.
declare global {
  interface Window {
    PlayKitSDK: typeof import('./core/PlayKitSDK').PlayKitSDK & {
      PlayKitSDK: typeof import('./core/PlayKitSDK').PlayKitSDK;
    };
  }
}


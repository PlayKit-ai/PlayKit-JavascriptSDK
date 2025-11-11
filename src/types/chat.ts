/**
 * Chat and text generation types
 */

import { Message } from './common';

/**
 * Configuration for text generation
 */
export interface ChatConfig {
  /** Array of messages in the conversation */
  messages: Message[];

  /** Model to use for generation */
  model?: string;

  /** Temperature for generation (0.0 - 2.0) */
  temperature?: number;

  /** Maximum tokens to generate */
  maxTokens?: number;

  /** Random seed for reproducible results */
  seed?: number;

  /** Stop sequences */
  stop?: string[];

  /** Top-p sampling */
  topP?: number;
}

/**
 * Configuration for streaming text generation
 */
export interface ChatStreamConfig extends ChatConfig {
  /** Callback for each chunk of text */
  onChunk: (chunk: string) => void;

  /** Callback when generation is complete */
  onComplete?: (fullText: string) => void;

  /** Callback for errors during streaming */
  onError?: (error: Error) => void;
}

/**
 * Result of a text generation request
 */
export interface ChatResult {
  /** Generated text content */
  content: string;

  /** Model used for generation */
  model: string;

  /** Finish reason */
  finishReason: 'stop' | 'length' | 'content_filter' | 'null';

  /** Token usage information */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  /** Unique ID for this completion */
  id?: string;

  /** Timestamp of creation */
  created?: number;
}

/**
 * Configuration for structured output generation
 */
export interface StructuredOutputConfig {
  /** Name of the schema to use */
  schemaName: string;

  /** Prompt for generation */
  prompt: string;

  /** Model to use */
  model?: string;

  /** Temperature */
  temperature?: number;

  /** Additional messages for context */
  messages?: Message[];
}

/**
 * OpenAI-compatible chat completion response
 */
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: Message;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Streaming chunk formats
 */
export interface StreamChunk {
  type: 'text-delta' | 'done' | 'error';
  id?: string;
  delta?: string;
  error?: string;
}

import type { Message, ToolCall } from './common';

/** Select an existing prompt for execution through the gateway. */
export type PromptSelector = { name: string; version?: number; label?: string };
export type PromptVariables = Record<string, string | number | boolean>;
export type PromptPlaceholders = Record<string, Message[]>;

export type Effort = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'max';
export type JsonSchema = Record<string, unknown>;
export interface ChatTool {
  type: 'function';
  function: { name: string; description?: string; parameters: JsonSchema };
}
export type ToolChoice =
  | 'auto'
  | 'required'
  | 'none'
  | { type: 'function'; function: { name: string } };
export interface ChatParameters {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  seed?: number;
  stop?: string[];
  presencePenalty?: number;
  frequencyPenalty?: number;
  thinking?: { effort: Effort };
  variant?: string;
  signal?: AbortSignal;
}
export type ChatInput =
  | { messages: Message[]; prompt?: never; variables?: never; placeholders?: never; cache?: never }
  | {
      prompt: PromptSelector;
      messages?: never;
      variables?: PromptVariables;
      placeholders?: PromptPlaceholders;
      cache?: boolean;
    };
export type ChatOutput =
  | {
      tools?: ChatTool[];
      tool_choice?: ToolChoice;
      schema?: never;
      output?: never;
      schemaName?: never;
      schemaDescription?: never;
      enum?: never;
    }
  | {
      schema: JsonSchema;
      output?: 'object' | 'array' | 'enum' | 'no-schema';
      schemaName?: string;
      schemaDescription?: string;
      enum?: string[];
      tools?: never;
      tool_choice?: never;
    };
export type ChatConfig = ChatInput & ChatParameters & ChatOutput;
export interface PromptRunReceipt {
  version: number;
  versionId: string;
  requestId: string | null;
}
export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
export interface ChatResult<T = unknown> {
  content: string;
  output?: T;
  model: string;
  requestedModel?: string;
  finishReason: string;
  usage?: ChatUsage;
  id?: string;
  created?: number;
  requestId?: string;
  tool_calls?: ToolCall[];
  reasoning?: string;
  prompt?: PromptRunReceipt;
}
export interface ChatStreamMetadata {
  model?: string;
  requestedModel?: string;
  requestId?: string;
  structuredOutput?: boolean;
  usage?: ChatUsage;
  prompt?: PromptRunReceipt;
}
/** UI-message SSE events emitted by the PlayKit v2 gateway. */
export interface ChatStreamEvent {
  type: string;
  delta?: string;
  messageId?: string;
  finishReason?: string;
  messageMetadata?: ChatStreamMetadata;
  toolCallId?: string;
  toolName?: string;
  input?: unknown;
  errorText?: string;
  reason?: string;
  [key: string]: unknown;
}
export type ChatStreamConfig = ChatConfig & {
  onChunk?: (text: string) => void;
  onReasoning?: (text: string) => void;
  onEvent?: (event: ChatStreamEvent) => void;
};
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  output?: unknown;
  choices: {
    index: number;
    message: Message & { reasoning_content?: string };
    finish_reason: string;
  }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

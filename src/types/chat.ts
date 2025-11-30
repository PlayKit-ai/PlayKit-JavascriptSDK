/**
 * Chat and text generation types
 */

import { Message, ToolCall } from './common';

/**
 * Tool definition for function calling
 */
export interface ChatTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

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

  /** Tools available for the model to use */
  tools?: ChatTool[];

  /** Tool choice: 'auto', 'required', 'none', or specific tool */
  tool_choice?: 'auto' | 'required' | 'none' | { type: 'function'; function: { name: string } };
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
  finishReason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'null';

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

  /** Tool calls made by the model */
  tool_calls?: ToolCall[];
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

// ===== NPC Action Types =====

/**
 * NPC Action parameter types
 */
export type NpcActionParamType = 'string' | 'number' | 'boolean' | 'stringEnum';

/**
 * NPC Action parameter definition
 */
export interface NpcActionParameter {
  name: string;
  description: string;
  type: NpcActionParamType;
  required?: boolean;
  enumOptions?: string[];
}

/**
 * NPC Action definition
 */
export interface NpcAction {
  actionName: string;
  description: string;
  parameters?: NpcActionParameter[];
  enabled?: boolean;
}

/**
 * NPC Action call result
 */
export interface NpcActionCall {
  id: string;
  actionName: string;
  arguments: Record<string, any>;
}

/**
 * Response from NPC with actions
 */
export interface NpcActionResponse {
  text: string;
  actionCalls: NpcActionCall[];
  hasActions: boolean;
}

/**
 * Helper to convert NpcAction to ChatTool
 */
export function npcActionToTool(action: NpcAction): ChatTool {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const param of action.parameters || []) {
    const propDef: Record<string, any> = { description: param.description };

    switch (param.type) {
      case 'string':
        propDef.type = 'string';
        break;
      case 'number':
        propDef.type = 'number';
        break;
      case 'boolean':
        propDef.type = 'boolean';
        break;
      case 'stringEnum':
        propDef.type = 'string';
        if (param.enumOptions?.length) {
          propDef.enum = param.enumOptions;
        }
        break;
    }

    properties[param.name] = propDef;
    if (param.required !== false) {
      required.push(param.name);
    }
  }

  return {
    type: 'function',
    function: {
      name: action.actionName,
      description: action.description,
      parameters: {
        type: 'object',
        properties,
        required,
      },
    },
  };
}

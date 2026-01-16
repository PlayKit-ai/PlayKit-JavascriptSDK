/**
 * Chat client for AI text generation
 */

import { ChatConfig, ChatResult, ChatStreamConfig, StructuredOutputConfig, ChatTool, ToolCall, Message } from '../types';
import { ChatProvider } from '../providers/ChatProvider';
import { StreamParser } from '../utils/StreamParser';
import { SchemaLibrary } from './SchemaLibrary';

/**
 * Config for text generation with tools
 */
export interface ChatWithToolsConfig extends ChatConfig {
  tools: ChatTool[];
  tool_choice?: 'auto' | 'required' | 'none' | { type: 'function'; function: { name: string } };
}

/**
 * Config for streaming text generation with tools
 */
export interface ChatWithToolsStreamConfig extends ChatWithToolsConfig {
  onChunk: (chunk: string) => void;
  onComplete?: (result: ChatResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Extended config for structured output generation
 */
export interface StructuredGenerationConfig {
  /** Name of the schema (required if using schema library) */
  schemaName?: string;
  
  /** Direct JSON schema (alternative to schemaName) */
  schema?: Record<string, any>;
  
  /** Schema description (used with direct schema) */
  schemaDescription?: string;
  
  /** Text prompt for generation */
  prompt: string;
  
  /** Model to use for generation */
  model?: string;
  
  /** Temperature for generation */
  temperature?: number;
  
  /** Maximum tokens to generate */
  maxTokens?: number;
  
  /** System message for context */
  systemMessage?: string;
  
  /** Additional messages for context (conversation format) */
  messages?: Message[];
}

/**
 * Result of structured output generation
 */
export interface StructuredResult<T> {
  /** The generated object */
  object: T;
  
  /** Model used for generation */
  model: string;
  
  /** Finish reason */
  finishReason?: string;
  
  /** Token usage information */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class ChatClient {
  private provider: ChatProvider;
  private model: string;
  private schemaLibrary: SchemaLibrary | null = null;

  constructor(provider: ChatProvider, model?: string) {
    this.provider = provider;
    this.model = model || 'gpt-4o-mini';
  }

  // ===== Schema Library Management =====

  /**
   * Set a custom schema library for structured output
   * @param schemaLibrary The schema library to use
   */
  setSchemaLibrary(schemaLibrary: SchemaLibrary): void {
    this.schemaLibrary = schemaLibrary;
  }

  /**
   * Get the current schema library
   */
  getSchemaLibrary(): SchemaLibrary | null {
    return this.schemaLibrary;
  }

  /**
   * Get all available schema names from the current library
   * @returns Array of schema names
   */
  getAvailableSchemas(): string[] {
    return this.schemaLibrary?.getSchemaNames() ?? [];
  }

  /**
   * Check if a schema exists in the current library
   * @param schemaName Name of the schema to check
   * @returns True if schema exists
   */
  hasSchema(schemaName: string): boolean {
    return this.schemaLibrary?.hasSchema(schemaName) ?? false;
  }

  // ===== Text Generation =====

  /**
   * Generate text (non-streaming)
   */
  async textGeneration(config: ChatConfig): Promise<ChatResult> {
    const chatConfig = {
      ...config,
      model: config.model || this.model,
    };

    const response = await this.provider.chatCompletion(chatConfig);

    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No choices in response');
    }

    return {
      content: choice.message.content,
      model: response.model,
      finishReason: choice.finish_reason as any,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      id: response.id,
      created: response.created,
    };
  }

  /**
   * Generate text with streaming
   */
  async textGenerationStream(config: ChatStreamConfig): Promise<void> {
    const chatConfig = {
      ...config,
      model: config.model || this.model,
    };

    const reader = await this.provider.chatCompletionStream(chatConfig);

    await StreamParser.streamWithCallbacks(
      reader,
      config.onChunk,
      config.onComplete,
      config.onError
    );
  }

  // ===== Structured Output Generation =====

  /**
   * Generate structured output using a schema from the library
   * @param schemaName Name of the schema in the library
   * @param prompt Text prompt for generation
   * @param options Additional options
   * @returns Generated object of type T
   */
  async generateStructuredByName<T = any>(
    schemaName: string,
    prompt: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      systemMessage?: string;
    }
  ): Promise<T> {
    if (!this.schemaLibrary) {
      throw new Error('[ChatClient] No schema library set. Use setSchemaLibrary() first.');
    }

    const schemaEntry = this.schemaLibrary.getSchema(schemaName);
    if (!schemaEntry) {
      throw new Error(`[ChatClient] Schema '${schemaName}' not found in library`);
    }

    return this.generateStructuredWithSchema<T>(
      schemaEntry.schema,
      prompt,
      {
        schemaName,
        schemaDescription: schemaEntry.description,
        ...options,
      }
    );
  }

  /**
   * Generate structured output using a direct JSON schema
   * @param schema JSON schema definition
   * @param prompt Text prompt for generation
   * @param options Additional options
   * @returns Generated object of type T
   */
  async generateStructuredWithSchema<T = any>(
    schema: Record<string, any>,
    prompt: string,
    options?: {
      schemaName?: string;
      schemaDescription?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      systemMessage?: string;
    }
  ): Promise<T> {
    const model = options?.model || this.model;
    const schemaName = options?.schemaName || 'response';
    const schemaDescription = options?.schemaDescription || '';

    return await this.provider.generateStructured<T>(
      schemaName,
      prompt,
      model,
      options?.temperature,
      schema,
      schemaDescription
    );
  }

  /**
   * Generate structured output using messages (conversation format)
   * @param schemaName Name of the schema in the library
   * @param messages Conversation messages
   * @param options Additional options
   * @returns Generated object of type T
   */
  async generateStructuredWithMessages<T = any>(
    schemaName: string,
    messages: Message[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<T> {
    if (!this.schemaLibrary) {
      throw new Error('[ChatClient] No schema library set. Use setSchemaLibrary() first.');
    }

    const schemaEntry = this.schemaLibrary.getSchema(schemaName);
    if (!schemaEntry) {
      throw new Error(`[ChatClient] Schema '${schemaName}' not found in library`);
    }

    // Extract user message content from the last user message
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    const prompt = lastUserMessage?.content || '';

    // Build system message from messages array
    const systemMessage = messages.find(m => m.role === 'system')?.content;

    return this.generateStructuredWithSchema<T>(
      schemaEntry.schema,
      prompt,
      {
        schemaName,
        schemaDescription: schemaEntry.description,
        systemMessage,
        ...options,
      }
    );
  }

  /**
   * Generate structured output using flexible configuration
   * Supports both schema library and direct schema
   * @param config Structured generation configuration
   * @returns Generated object of type T
   */
  async generateStructuredAdvanced<T = any>(config: StructuredGenerationConfig): Promise<StructuredResult<T>> {
    let schema: Record<string, any>;
    let schemaName: string;
    let schemaDescription: string;

    // Determine schema source
    if (config.schema) {
      // Direct schema provided
      schema = config.schema;
      schemaName = config.schemaName || 'response';
      schemaDescription = config.schemaDescription || '';
    } else if (config.schemaName) {
      // Use schema from library
      if (!this.schemaLibrary) {
        throw new Error('[ChatClient] No schema library set. Use setSchemaLibrary() or provide schema directly.');
      }

      const schemaEntry = this.schemaLibrary.getSchema(config.schemaName);
      if (!schemaEntry) {
        throw new Error(`[ChatClient] Schema '${config.schemaName}' not found in library`);
      }

      schema = schemaEntry.schema;
      schemaName = config.schemaName;
      schemaDescription = schemaEntry.description;
    } else {
      throw new Error('[ChatClient] Either schemaName or schema must be provided');
    }

    const model = config.model || this.model;
    const result = await this.provider.generateStructured<T>(
      schemaName,
      config.prompt,
      model,
      config.temperature,
      schema,
      schemaDescription
    );

    return {
      object: result,
      model,
    };
  }

  /**
   * Generate structured output using a JSON schema
   * @deprecated Use generateStructuredByName, generateStructuredWithSchema, or generateStructuredAdvanced instead
   */
  async generateStructured<T = any>(config: StructuredOutputConfig): Promise<T> {
    const model = config.model || this.model;
    return await this.provider.generateStructured(
      config.schemaName,
      config.prompt,
      model,
      config.temperature
    );
  }

  // ===== Simple Chat Methods =====

  /**
   * Simple chat with single message
   */
  async chat(message: string, systemPrompt?: string): Promise<string> {
    const messages = [];

    if (systemPrompt) {
      messages.push({ role: 'system' as const, content: systemPrompt });
    }

    messages.push({ role: 'user' as const, content: message });

    const result = await this.textGeneration({ messages });
    return result.content;
  }

  /**
   * Simple chat with streaming
   */
  async chatStream(
    message: string,
    onChunk: (chunk: string) => void,
    onComplete?: (fullText: string) => void,
    systemPrompt?: string
  ): Promise<void> {
    const messages = [];

    if (systemPrompt) {
      messages.push({ role: 'system' as const, content: systemPrompt });
    }

    messages.push({ role: 'user' as const, content: message });

    await this.textGenerationStream({
      messages,
      onChunk,
      onComplete,
    });
  }

  // ===== Tool Calling =====

  /**
   * Generate text with tool calling support (non-streaming)
   */
  async textGenerationWithTools(config: ChatWithToolsConfig): Promise<ChatResult> {
    const chatConfig = {
      ...config,
      model: config.model || this.model,
    };

    const response = await this.provider.chatCompletionWithTools(chatConfig);

    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No choices in response');
    }

    return {
      content: choice.message.content || '',
      model: response.model,
      finishReason: choice.finish_reason as any,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      id: response.id,
      created: response.created,
      tool_calls: choice.message.tool_calls,
    };
  }

  /**
   * Generate text with tool calling support (streaming)
   * Text streams first, complete result with tool_calls returned in onComplete
   */
  async textGenerationWithToolsStream(config: ChatWithToolsStreamConfig): Promise<void> {
    const chatConfig = {
      ...config,
      model: config.model || this.model,
    };

    const reader = await this.provider.chatCompletionWithToolsStream(chatConfig);

    let fullContent = '';
    let toolCalls: ToolCall[] = [];

    await StreamParser.streamWithCallbacks(
      reader,
      (chunk) => {
        fullContent += chunk;
        config.onChunk(chunk);
      },
      () => {
        // On complete, provide full result
        if (config.onComplete) {
          config.onComplete({
            content: fullContent,
            model: chatConfig.model || this.model,
            finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          });
        }
      },
      config.onError
    );
  }
}

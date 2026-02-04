/**
 * Chat provider for HTTP communication with chat API
 */

import { ChatConfig, ChatCompletionResponse, PlayKitError, SDKConfig, ChatTool, MessageContent } from '../types';
import { AuthManager } from '../auth/AuthManager';
import { PlayerClient } from '../core/PlayerClient';

/**
 * Helper to extract string from MessageContent
 */
function contentToString(content: MessageContent | null | undefined): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  // For array of content parts, extract text parts
  const textParts = content.filter(part => part.type === 'text');
  return textParts.map(part => (part as { type: 'text'; text: string }).text).join('');
}

/**
 * Chat config with tools support
 */
export interface ChatConfigWithTools extends ChatConfig {
  tools?: ChatTool[];
  tool_choice?: 'auto' | 'required' | 'none' | { type: 'function'; function: { name: string } };
}

const DEFAULT_BASE_URL = 'https://playkit.ai';

export class ChatProvider {
  private authManager: AuthManager;
  private config: SDKConfig;
  private baseURL: string;
  private playerClient?: PlayerClient;

  constructor(authManager: AuthManager, config: SDKConfig) {
    this.authManager = authManager;
    this.config = config;
    this.baseURL = config.baseURL || DEFAULT_BASE_URL;
  }

  /**
   * Set player client for balance checking
   */
  setPlayerClient(playerClient: PlayerClient): void {
    this.playerClient = playerClient;
  }

  /**
   * Make a chat completion request (non-streaming)
   */
  async chatCompletion(chatConfig: ChatConfig): Promise<ChatCompletionResponse> {
    // Ensure token is valid, auto-refresh if needed (browser mode only)
    await this.authManager.ensureValidToken();

    const token = this.authManager.getToken();
    if (!token) {
      throw new PlayKitError('Not authenticated', 'NOT_AUTHENTICATED');
    }

    const model = chatConfig.model || this.config.defaultChatModel || 'gpt-4o-mini';
    const endpoint = `/ai/${this.config.gameId}/v2/chat`;

    const requestBody = {
      model,
      messages: chatConfig.messages,
      temperature: chatConfig.temperature ?? 0.7,
      stream: false,
      max_tokens: chatConfig.maxTokens || null,
      seed: chatConfig.seed || null,
      stop: chatConfig.stop || null,
      top_p: chatConfig.topP || null,
    };

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Chat request failed' }));
        const playKitError = new PlayKitError(
          error.message || 'Chat request failed',
          error.code,
          response.status
        );

        // Check for insufficient credits error
        if (error.code === 'INSUFFICIENT_CREDITS' || response.status === 402) {
          if (this.playerClient) {
            await this.playerClient.handleInsufficientCredits(playKitError);
          }
        }

        throw playKitError;
      }

      const result = await response.json();

      // Check balance after successful API call
      if (this.playerClient) {
        this.playerClient.checkBalanceAfterApiCall().catch(() => {
          // Silently fail
        });
      }

      return result;
    } catch (error) {
      if (error instanceof PlayKitError) {
        throw error;
      }
      throw new PlayKitError(
        error instanceof Error ? error.message : 'Unknown error',
        'CHAT_ERROR'
      );
    }
  }

  /**
   * Make a streaming chat completion request
   */
  async chatCompletionStream(
    chatConfig: ChatConfig
  ): Promise<ReadableStreamDefaultReader<Uint8Array>> {
    // Ensure token is valid, auto-refresh if needed (browser mode only)
    await this.authManager.ensureValidToken();

    const token = this.authManager.getToken();
    if (!token) {
      throw new PlayKitError('Not authenticated', 'NOT_AUTHENTICATED');
    }

    const model = chatConfig.model || this.config.defaultChatModel || 'gpt-4o-mini';
    const endpoint = `/ai/${this.config.gameId}/v2/chat`;

    const requestBody = {
      model,
      messages: chatConfig.messages,
      temperature: chatConfig.temperature ?? 0.7,
      stream: true,
      max_tokens: chatConfig.maxTokens || null,
      seed: chatConfig.seed || null,
      stop: chatConfig.stop || null,
      top_p: chatConfig.topP || null,
    };

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Chat stream request failed' }));
        const playKitError = new PlayKitError(
          error.message || 'Chat stream request failed',
          error.code,
          response.status
        );

        // Check for insufficient credits error
        if (error.code === 'INSUFFICIENT_CREDITS' || response.status === 402) {
          if (this.playerClient) {
            await this.playerClient.handleInsufficientCredits(playKitError);
          }
        }

        throw playKitError;
      }

      if (!response.body) {
        throw new PlayKitError('Response body is null', 'NO_RESPONSE_BODY');
      }

      // Check balance after successful API call
      if (this.playerClient) {
        this.playerClient.checkBalanceAfterApiCall().catch(() => {
          // Silently fail
        });
      }

      return response.body.getReader();
    } catch (error) {
      if (error instanceof PlayKitError) {
        throw error;
      }
      throw new PlayKitError(
        error instanceof Error ? error.message : 'Unknown error',
        'CHAT_STREAM_ERROR'
      );
    }
  }

  /**
   * Make a chat completion request with tools (non-streaming)
   */
  async chatCompletionWithTools(chatConfig: ChatConfigWithTools): Promise<ChatCompletionResponse> {
    const token = this.authManager.getToken();
    if (!token) {
      throw new PlayKitError('Not authenticated', 'NOT_AUTHENTICATED');
    }

    const model = chatConfig.model || this.config.defaultChatModel || 'gpt-4o-mini';
    const endpoint = `/ai/${this.config.gameId}/v2/chat`;

    const requestBody: Record<string, any> = {
      model,
      messages: chatConfig.messages,
      temperature: chatConfig.temperature ?? 0.7,
      stream: false,
      max_tokens: chatConfig.maxTokens || null,
      seed: chatConfig.seed || null,
      stop: chatConfig.stop || null,
      top_p: chatConfig.topP || null,
    };

    // Add tools if provided
    if (chatConfig.tools?.length) {
      requestBody.tools = chatConfig.tools;
    }
    if (chatConfig.tool_choice) {
      requestBody.tool_choice = chatConfig.tool_choice;
    }

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Chat request failed' }));
        const playKitError = new PlayKitError(
          error.message || 'Chat request failed',
          error.code,
          response.status
        );

        if (error.code === 'INSUFFICIENT_CREDITS' || response.status === 402) {
          if (this.playerClient) {
            await this.playerClient.handleInsufficientCredits(playKitError);
          }
        }

        throw playKitError;
      }

      const result = await response.json();

      if (this.playerClient) {
        this.playerClient.checkBalanceAfterApiCall().catch(() => {});
      }

      return result;
    } catch (error) {
      if (error instanceof PlayKitError) {
        throw error;
      }
      throw new PlayKitError(
        error instanceof Error ? error.message : 'Unknown error',
        'CHAT_ERROR'
      );
    }
  }

  /**
   * Make a streaming chat completion request with tools
   */
  async chatCompletionWithToolsStream(
    chatConfig: ChatConfigWithTools
  ): Promise<ReadableStreamDefaultReader<Uint8Array>> {
    const token = this.authManager.getToken();
    if (!token) {
      throw new PlayKitError('Not authenticated', 'NOT_AUTHENTICATED');
    }

    const model = chatConfig.model || this.config.defaultChatModel || 'gpt-4o-mini';
    const endpoint = `/ai/${this.config.gameId}/v2/chat`;

    const requestBody: Record<string, any> = {
      model,
      messages: chatConfig.messages,
      temperature: chatConfig.temperature ?? 0.7,
      stream: true,
      max_tokens: chatConfig.maxTokens || null,
      seed: chatConfig.seed || null,
      stop: chatConfig.stop || null,
      top_p: chatConfig.topP || null,
    };

    // Add tools if provided
    if (chatConfig.tools?.length) {
      requestBody.tools = chatConfig.tools;
    }
    if (chatConfig.tool_choice) {
      requestBody.tool_choice = chatConfig.tool_choice;
    }

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Chat stream request failed' }));
        const playKitError = new PlayKitError(
          error.message || 'Chat stream request failed',
          error.code,
          response.status
        );

        if (error.code === 'INSUFFICIENT_CREDITS' || response.status === 402) {
          if (this.playerClient) {
            await this.playerClient.handleInsufficientCredits(playKitError);
          }
        }

        throw playKitError;
      }

      if (!response.body) {
        throw new PlayKitError('Response body is null', 'NO_RESPONSE_BODY');
      }

      if (this.playerClient) {
        this.playerClient.checkBalanceAfterApiCall().catch(() => {});
      }

      return response.body.getReader();
    } catch (error) {
      if (error instanceof PlayKitError) {
        throw error;
      }
      throw new PlayKitError(
        error instanceof Error ? error.message : 'Unknown error',
        'CHAT_STREAM_ERROR'
      );
    }
  }

  /**
   * Generate structured output using JSON schema
   * Uses the /chat endpoint with response_format for structured output
   * @param schemaName Name of the schema
   * @param prompt Text prompt for generation
   * @param model Model to use
   * @param temperature Temperature for generation
   * @param schema Optional JSON schema (if not provided, uses schemaName as reference)
   * @param schemaDescription Optional description of the schema
   */
  async generateStructured<T = any>(
    schemaName: string,
    prompt: string,
    model?: string,
    temperature?: number,
    schema?: Record<string, any>,
    schemaDescription?: string
  ): Promise<T> {
    // Ensure token is valid, auto-refresh if needed (browser mode only)
    await this.authManager.ensureValidToken();

    const token = this.authManager.getToken();
    if (!token) {
      throw new PlayKitError('Not authenticated', 'NOT_AUTHENTICATED');
    }

    const modelToUse = model || this.config.defaultChatModel || 'gpt-4o-mini';
    const endpoint = `/ai/${this.config.gameId}/v2/chat`;

    const messages = [{ role: 'user' as const, content: prompt }];

    const requestBody: Record<string, any> = {
      model: modelToUse,
      messages,
      temperature: temperature ?? 0.7,
      stream: false,
    };

    // Add response_format with json_schema if schema is provided
    if (schema) {
      requestBody.response_format = {
        type: 'json_schema',
        json_schema: {
          name: schemaName,
          description: schemaDescription || '',
          schema: schema,
          strict: true,
        },
      };
    }

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Structured generation failed' }));
        const playKitError = new PlayKitError(
          error.message || 'Structured generation failed',
          error.code,
          response.status
        );

        if (error.code === 'INSUFFICIENT_CREDITS' || response.status === 402) {
          if (this.playerClient) {
            await this.playerClient.handleInsufficientCredits(playKitError);
          }
        }

        throw playKitError;
      }

      const result: ChatCompletionResponse = await response.json();

      if (this.playerClient) {
        this.playerClient.checkBalanceAfterApiCall().catch(() => {});
      }

      // Parse the response content as JSON
      const rawContent = result.choices[0]?.message.content;
      if (!rawContent) {
        throw new PlayKitError('No content in response', 'NO_CONTENT');
      }

      try {
        const content = contentToString(rawContent);
        return JSON.parse(content);
      } catch (parseError) {
        throw new PlayKitError('Failed to parse structured output', 'PARSE_ERROR');
      }
    } catch (error) {
      if (error instanceof PlayKitError) {
        throw error;
      }
      throw new PlayKitError(
        error instanceof Error ? error.message : 'Unknown error',
        'STRUCTURED_GENERATION_ERROR'
      );
    }
  }
}

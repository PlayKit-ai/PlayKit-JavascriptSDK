/**
 * Chat provider for HTTP communication with chat API
 */

import { ChatConfig, ChatCompletionResponse, PlayKitError, SDKConfig, ChatTool } from '../types';
import { AuthManager } from '../auth/AuthManager';
import { StreamParser } from '../utils/StreamParser';
import { PlayerClient } from '../core/PlayerClient';

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
    const token = this.authManager.getToken();
    if (!token) {
      throw new PlayKitError('Not authenticated', 'NOT_AUTHENTICATED');
    }

    const model = chatConfig.model || this.config.defaultChatModel || 'gpt-4o-mini';
    const endpoint = `/ai/${this.config.gameId}/v1/chat`;

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
        if (error.code === 'INSUFFICIENT_CREDITS' || error.code === 'PLAYER_INSUFFICIENT_CREDIT' || error.code === 'INSUFFICIENT_DEVELOPER_BALANCE' || response.status === 402) {
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
    const token = this.authManager.getToken();
    if (!token) {
      throw new PlayKitError('Not authenticated', 'NOT_AUTHENTICATED');
    }

    const model = chatConfig.model || this.config.defaultChatModel || 'gpt-4o-mini';
    const endpoint = `/ai/${this.config.gameId}/v1/chat`;

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
        if (error.code === 'INSUFFICIENT_CREDITS' || error.code === 'PLAYER_INSUFFICIENT_CREDIT' || error.code === 'INSUFFICIENT_DEVELOPER_BALANCE' || response.status === 402) {
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
    const endpoint = `/ai/${this.config.gameId}/v1/chat`;

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

        if (error.code === 'INSUFFICIENT_CREDITS' || error.code === 'PLAYER_INSUFFICIENT_CREDIT' || error.code === 'INSUFFICIENT_DEVELOPER_BALANCE' || response.status === 402) {
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
    const endpoint = `/ai/${this.config.gameId}/v1/chat`;

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

        if (error.code === 'INSUFFICIENT_CREDITS' || error.code === 'PLAYER_INSUFFICIENT_CREDIT' || error.code === 'INSUFFICIENT_DEVELOPER_BALANCE' || response.status === 402) {
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
   */
  async generateStructured(
    schemaName: string,
    prompt: string,
    model?: string,
    temperature?: number,
    schema?: Record<string, any>,
    schemaDescription?: string
  ): Promise<any> {
    const token = this.authManager.getToken();
    if (!token) {
      throw new PlayKitError('Not authenticated', 'NOT_AUTHENTICATED');
    }

    const modelToUse = model || this.config.defaultChatModel || 'gpt-4o-mini';
    const endpoint = `/ai/${this.config.gameId}/v1/chat`;

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

        if (error.code === 'INSUFFICIENT_CREDITS' || error.code === 'PLAYER_INSUFFICIENT_CREDIT' || error.code === 'INSUFFICIENT_DEVELOPER_BALANCE' || response.status === 402) {
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
      const content = result.choices[0]?.message.content;
      if (!content) {
        throw new PlayKitError('No content in response', 'NO_CONTENT');
      }

      try {
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

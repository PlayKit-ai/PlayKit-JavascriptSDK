/**
 * Chat provider for HTTP communication with chat API
 */

import { ChatConfig, ChatCompletionResponse, PlayKitError, SDKConfig } from '../types';
import { AuthManager } from '../auth/AuthManager';
import { StreamParser } from '../utils/StreamParser';

const DEFAULT_BASE_URL = 'https://playkit.agentlandlab.com';

export class ChatProvider {
  private authManager: AuthManager;
  private config: SDKConfig;
  private baseURL: string;

  constructor(authManager: AuthManager, config: SDKConfig) {
    this.authManager = authManager;
    this.config = config;
    this.baseURL = config.baseURL || DEFAULT_BASE_URL;
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
        throw new PlayKitError(
          error.message || 'Chat request failed',
          error.code,
          response.status
        );
      }

      return await response.json();
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
        throw new PlayKitError(
          error.message || 'Chat stream request failed',
          error.code,
          response.status
        );
      }

      if (!response.body) {
        throw new PlayKitError('Response body is null', 'NO_RESPONSE_BODY');
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
   */
  async generateStructured(
    schemaName: string,
    prompt: string,
    model?: string,
    temperature?: number
  ): Promise<any> {
    const messages = [{ role: 'user' as const, content: prompt }];

    const chatConfig: ChatConfig = {
      messages,
      model: model || this.config.defaultChatModel,
      temperature: temperature ?? 0.7,
    };

    // Add schema information to the request
    // (Implementation depends on how the API handles structured output)
    const response = await this.chatCompletion(chatConfig);

    // Parse the response content as JSON
    const content = response.choices[0]?.message.content;
    if (!content) {
      throw new PlayKitError('No content in response', 'NO_CONTENT');
    }

    try {
      return JSON.parse(content);
    } catch (error) {
      throw new PlayKitError('Failed to parse structured output', 'PARSE_ERROR');
    }
  }
}

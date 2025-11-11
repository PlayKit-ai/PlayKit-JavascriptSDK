/**
 * Chat client for AI text generation
 */

import { ChatConfig, ChatResult, ChatStreamConfig, StructuredOutputConfig } from '../types';
import { ChatProvider } from '../providers/ChatProvider';
import { StreamParser } from '../utils/StreamParser';

export class ChatClient {
  private provider: ChatProvider;
  private model: string;

  constructor(provider: ChatProvider, model?: string) {
    this.provider = provider;
    this.model = model || 'gpt-4o-mini';
  }

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

  /**
   * Generate structured output using a JSON schema
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
}

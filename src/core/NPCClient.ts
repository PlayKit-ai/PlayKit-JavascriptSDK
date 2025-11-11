/**
 * NPC Client for simplified conversation management
 * Automatically handles conversation history
 */

import EventEmitter from 'eventemitter3';
import { Message } from '../types';
import { ChatClient } from './ChatClient';

export interface NPCConfig {
  /** System prompt defining the NPC's personality */
  systemPrompt?: string;

  /** Model to use for the NPC */
  model?: string;

  /** Temperature for generation */
  temperature?: number;

  /** Maximum number of messages to keep in history */
  maxHistoryLength?: number;
}

export class NPCClient extends EventEmitter {
  private chatClient: ChatClient;
  private systemPrompt: string;
  private history: Message[];
  private temperature: number;
  private maxHistoryLength: number;

  constructor(chatClient: ChatClient, config?: NPCConfig) {
    super();
    this.chatClient = chatClient;
    this.systemPrompt = config?.systemPrompt || 'You are a helpful assistant.';
    this.temperature = config?.temperature ?? 0.7;
    this.maxHistoryLength = config?.maxHistoryLength || 50;
    this.history = [];
  }

  /**
   * Set the system prompt (NPC personality)
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  /**
   * Get the current system prompt
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * Talk to the NPC (non-streaming)
   */
  async talk(message: string): Promise<string> {
    // Add user message to history
    const userMessage: Message = { role: 'user', content: message };
    this.history.push(userMessage);

    // Build messages array with system prompt
    const messages: Message[] = [
      { role: 'system', content: this.systemPrompt },
      ...this.history,
    ];

    // Generate response
    const result = await this.chatClient.textGeneration({
      messages,
      temperature: this.temperature,
    });

    // Add assistant response to history
    const assistantMessage: Message = { role: 'assistant', content: result.content };
    this.history.push(assistantMessage);

    // Trim history if needed
    this.trimHistory();

    this.emit('response', result.content);
    return result.content;
  }

  /**
   * Talk to the NPC with streaming
   */
  async talkStream(
    message: string,
    onChunk: (chunk: string) => void,
    onComplete?: (fullText: string) => void
  ): Promise<void> {
    // Add user message to history
    const userMessage: Message = { role: 'user', content: message };
    this.history.push(userMessage);

    // Build messages array with system prompt
    const messages: Message[] = [
      { role: 'system', content: this.systemPrompt },
      ...this.history,
    ];

    // Generate response
    await this.chatClient.textGenerationStream({
      messages,
      temperature: this.temperature,
      onChunk,
      onComplete: (fullText) => {
        // Add assistant response to history
        const assistantMessage: Message = { role: 'assistant', content: fullText };
        this.history.push(assistantMessage);

        // Trim history if needed
        this.trimHistory();

        this.emit('response', fullText);
        if (onComplete) {
          onComplete(fullText);
        }
      },
    });
  }

  /**
   * Talk with structured output
   */
  async talkStructured<T = any>(message: string, schemaName: string): Promise<T> {
    // Add user message to history
    const userMessage: Message = { role: 'user', content: message };
    this.history.push(userMessage);

    // Generate structured response
    const result = await this.chatClient.generateStructured<T>({
      schemaName,
      prompt: message,
      messages: [{ role: 'system', content: this.systemPrompt }, ...this.history],
      temperature: this.temperature,
    });

    // Add a text representation to history
    const assistantMessage: Message = {
      role: 'assistant',
      content: JSON.stringify(result),
    };
    this.history.push(assistantMessage);

    this.trimHistory();

    return result;
  }

  /**
   * Get conversation history
   */
  getHistory(): Message[] {
    return [...this.history];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.history = [];
    this.emit('history_cleared');
  }

  /**
   * Save history to JSON string
   */
  saveHistory(): string {
    return JSON.stringify({
      systemPrompt: this.systemPrompt,
      history: this.history,
    });
  }

  /**
   * Load history from JSON string
   */
  loadHistory(saveData: string): boolean {
    try {
      const data = JSON.parse(saveData);
      this.systemPrompt = data.systemPrompt || this.systemPrompt;
      this.history = data.history || [];
      this.emit('history_loaded');
      return true;
    } catch (error) {
      console.error('Failed to load history', error);
      return false;
    }
  }

  /**
   * Revert to a specific point in history
   */
  revertToMessage(index: number): void {
    if (index >= 0 && index < this.history.length) {
      this.history = this.history.slice(0, index + 1);
      this.emit('history_reverted', index);
    }
  }

  /**
   * Append a message to history manually
   */
  appendMessage(message: Message): void {
    this.history.push(message);
    this.trimHistory();
  }

  /**
   * Trim history to max length
   */
  private trimHistory(): void {
    if (this.history.length > this.maxHistoryLength) {
      // Keep the most recent messages
      this.history = this.history.slice(-this.maxHistoryLength);
    }
  }

  /**
   * Get the number of messages in history
   */
  getHistoryLength(): number {
    return this.history.length;
  }
}

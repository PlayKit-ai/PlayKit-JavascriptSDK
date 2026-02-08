/**
 * NPC Client for simplified conversation management
 * Automatically handles conversation history
 * 
 * Key Features:
 * - Call talk() for all interactions - actions are handled automatically
 * - Memory system for persistent NPC context
 * - Reply prediction for suggesting player responses
 * - Automatic conversation history management
 */

import EventEmitter from 'eventemitter3';
import { Message, NpcAction, NpcActionResponse, npcActionToTool } from '../types';
import { ChatClient } from './ChatClient';
import { AIContextManager } from './AIContextManager';
import { Logger } from '../utils/Logger';

/**
 * Memory entry for NPC context
 */
export interface MemoryEntry {
  name: string;
  content: string;
}

/**
 * Data structure for saving and loading conversation history
 */
export interface ConversationSaveData {
  /** @deprecated Use characterDesign instead */
  systemPrompt?: string;
  characterDesign: string;
  memories: MemoryEntry[];
  history: Message[];
}

export interface NPCConfig {
  /** 
   * Character design/system prompt for this NPC
   * Preferred over systemPrompt
   */
  characterDesign?: string;

  /** 
   * @deprecated Use characterDesign instead 
   */
  systemPrompt?: string;

  /** Model to use for the NPC */
  model?: string;

  /** Temperature for generation */
  temperature?: number;

  /** Maximum number of messages to keep in history */
  maxHistoryLength?: number;

  /** Automatically generate player reply predictions after NPC responds */
  generateReplyPrediction?: boolean;

  /** Number of reply predictions to generate (2-6, default: 4) */
  predictionCount?: number;

  /** Fast model to use for predictions (optional, uses default if not set) */
  fastModel?: string;
}

export class NPCClient extends EventEmitter {
  private chatClient: ChatClient;
  private characterDesign: string;
  private memories: Map<string, string>;
  private history: Message[];
  private temperature: number;
  private maxHistoryLength: number;
  private generateReplyPrediction: boolean;
  private predictionCount: number;
  private fastModel?: string;
  private _isTalking: boolean = false;
  private logger = Logger.getLogger('NPCClient');

  constructor(chatClient: ChatClient, config?: NPCConfig) {
    super();
    this.chatClient = chatClient;
    // Support both characterDesign and legacy systemPrompt
    this.characterDesign = config?.characterDesign || config?.systemPrompt || 'You are a helpful assistant.';
    this.temperature = config?.temperature ?? 0.7;
    this.maxHistoryLength = config?.maxHistoryLength || 50;
    this.generateReplyPrediction = config?.generateReplyPrediction ?? false;
    this.predictionCount = Math.max(2, Math.min(6, config?.predictionCount ?? 4));
    this.fastModel = config?.fastModel;
    this.history = [];
    this.memories = new Map();
  }

  // ===== State Properties =====

  /**
   * Whether the NPC is currently processing a request
   */
  get isTalking(): boolean {
    return this._isTalking;
  }

  // ===== Character Design & Memory System =====

  /**
   * Set the character design for the NPC.
   * The system prompt is composed of CharacterDesign + all Memories.
   */
  setCharacterDesign(design: string): void {
    this.characterDesign = design;
  }

  /**
   * Get the current character design
   */
  getCharacterDesign(): string {
    return this.characterDesign;
  }

  /**
   * @deprecated Use setCharacterDesign instead.
   * This method is kept for backwards compatibility.
   */
  setSystemPrompt(prompt: string): void {
    this.logger.warn('setSystemPrompt is deprecated. Use setCharacterDesign instead.');
    this.setCharacterDesign(prompt);
  }

  /**
   * @deprecated Use getCharacterDesign instead.
   * This method is kept for backwards compatibility.
   */
  getSystemPrompt(): string {
    return this.buildSystemPrompt();
  }

  /**
   * Set or update a memory for the NPC.
   * Memories are appended to the character design to form the system prompt.
   * Set memoryContent to null or empty to remove the memory.
   * @param memoryName The name/key of the memory
   * @param memoryContent The content of the memory. Null or empty to remove.
   */
  setMemory(memoryName: string, memoryContent: string | null): void {
    if (!memoryName) {
      this.logger.warn('Memory name cannot be empty');
      return;
    }

    if (!memoryContent) {
      // Remove memory if content is null or empty
      if (this.memories.has(memoryName)) {
        this.memories.delete(memoryName);
        this.emit('memory_removed', memoryName);
      }
    } else {
      // Add or update memory
      this.memories.set(memoryName, memoryContent);
      this.emit('memory_set', memoryName, memoryContent);
    }
  }

  /**
   * Get a specific memory by name.
   * @param memoryName The name of the memory to retrieve
   * @returns The memory content, or undefined if not found
   */
  getMemory(memoryName: string): string | undefined {
    return this.memories.get(memoryName);
  }

  /**
   * Get all memory names currently stored.
   * @returns Array of memory names
   */
  getMemoryNames(): string[] {
    return Array.from(this.memories.keys());
  }

  /**
   * Clear all memories (but keep character design).
   */
  clearMemories(): void {
    this.memories.clear();
    this.emit('memories_cleared');
  }

  /**
   * Build the complete system prompt from CharacterDesign + Memories.
   */
  private buildSystemPrompt(): string {
    const parts: string[] = [];

    if (this.characterDesign) {
      parts.push(this.characterDesign);
    }

    if (this.memories.size > 0) {
      const memoryStrings = Array.from(this.memories.entries())
        .map(([name, content]) => `[${name}]: ${content}`);
      parts.push('Memories:\n' + memoryStrings.join('\n'));
    }

    return parts.join('\n\n');
  }

  // ===== Reply Prediction =====

  /**
   * Enable or disable automatic reply prediction
   */
  setGenerateReplyPrediction(enabled: boolean): void {
    this.generateReplyPrediction = enabled;
  }

  /**
   * Set the number of predictions to generate
   */
  setPredictionCount(count: number): void {
    this.predictionCount = Math.max(2, Math.min(6, count));
  }

  /**
   * Manually generate reply predictions based on current conversation.
   * Uses the fast model for quick generation.
   * @param tempPrompt Optional temporary prompt to influence the prediction style/tone
   * @param count Number of predictions to generate (default: uses predictionCount property)
   * @returns Array of predicted player replies, or empty array on failure
   */
  async generateReplyPredictions(tempPrompt?: string, count?: number): Promise<string[]> {
    const predictionNum = count ?? this.predictionCount;

    if (this.history.length < 2) {
      this.logger.info('Not enough conversation history to generate predictions');
      return [];
    }

    try {
      // Get last NPC message
      const lastNpcMessage = [...this.history]
        .reverse()
        .find(m => m.role === 'assistant')?.content;

      if (!lastNpcMessage) {
        this.logger.info('No NPC message found to generate predictions from');
        return [];
      }

      // Build recent history (last 6 non-system messages)
      const recentHistory = this.history
        .filter(m => m.role !== 'system')
        .slice(-6)
        .map(m => `${m.role}: ${m.content}`);

      // Get player context from AIContextManager
      const contextManager = AIContextManager.getInstance();
      const playerContext = contextManager.buildPlayerContext();

      // Build player character section
      let playerCharacterSection = '';
      if (playerContext || tempPrompt) {
        playerCharacterSection = '\nPlayer Character:\n';
        if (playerContext) {
          playerCharacterSection += playerContext + '\n';
        }
        if (tempPrompt) {
          playerCharacterSection += `Additional guidance: ${tempPrompt}\n`;
        }
      }

      // Build prompt for prediction generation
      const prompt = `Based on the conversation history below, generate exactly ${predictionNum} natural and contextually appropriate responses that the player might say next.

Context:
- This is a conversation between a player and an NPC in a game
- The NPC just said: "${lastNpcMessage}"
${playerCharacterSection}
Conversation history:
${recentHistory.join('\n')}

Requirements:
1. Each response should be 1-2 sentences maximum
2. Responses should be diverse in tone and intent
3. Include a mix of questions, statements, and action-oriented responses
4. Responses should feel natural for the player character${playerContext || tempPrompt ? ' and match their personality/tone' : ''}

Output ONLY a JSON array of ${predictionNum} strings, nothing else:
["response1", "response2", "response3", "response4"]`;

      const result = await this.chatClient.textGeneration({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        model: this.fastModel,
      });

      if (!result.content) {
        this.logger.warn('Failed to generate predictions: empty response');
        return [];
      }

      // Parse JSON response
      const predictions = this.parsePredictionsFromJson(result.content, predictionNum);

      if (predictions.length > 0) {
        this.emit('replyPredictions', predictions);
      }

      return predictions;
    } catch (error) {
      this.logger.error('Error generating predictions:', error);
      return [];
    }
  }

  /**
   * Parse predictions from JSON array response
   */
  private parsePredictionsFromJson(response: string, expectedCount: number): string[] {
    try {
      // Try to find JSON array in response
      const startIndex = response.indexOf('[');
      const endIndex = response.lastIndexOf(']');

      if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
        this.logger.warn('Could not find JSON array in prediction response');
        return this.extractPredictionsFromText(response, expectedCount);
      }

      const jsonArray = response.substring(startIndex, endIndex + 1);
      const parsed = JSON.parse(jsonArray);

      if (Array.isArray(parsed)) {
        return parsed
          .filter(item => typeof item === 'string' && item.trim())
          .slice(0, expectedCount);
      }

      return [];
    } catch (error) {
      this.logger.warn('Failed to parse predictions JSON:', error);
      return this.extractPredictionsFromText(response, expectedCount);
    }
  }

  /**
   * Fallback: Extract predictions from text when JSON parsing fails
   */
  private extractPredictionsFromText(response: string, expectedCount: number): string[] {
    const predictions: string[] = [];
    const lines = response.split(/[\n\r]+/).filter(line => line.trim());

    for (const line of lines) {
      let cleaned = line.trim();

      // Skip empty lines and JSON brackets
      if (!cleaned || cleaned === '[' || cleaned === ']') continue;

      // Remove common prefixes like "1.", "- ", etc.
      if (/^\d+\./.test(cleaned)) {
        cleaned = cleaned.replace(/^\d+\.\s*/, '');
      } else if (cleaned.startsWith('- ')) {
        cleaned = cleaned.substring(2);
      }

      // Remove surrounding quotes
      if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.slice(1, -1);
      }

      // Remove trailing comma
      if (cleaned.endsWith(',')) {
        cleaned = cleaned.slice(0, -1).trim();
      }

      if (cleaned && predictions.length < expectedCount) {
        predictions.push(cleaned);
      }
    }

    return predictions;
  }

  /**
   * Internal method to trigger prediction generation after NPC response
   */
  private async triggerReplyPrediction(): Promise<void> {
    if (!this.generateReplyPrediction) return;

    // Fire and forget - don't block the main response
    this.generateReplyPredictions().catch(err => {
      this.logger.error('Background prediction generation failed:', err);
    });
  }

  // ===== Main API - Talk Methods =====

  /**
   * Talk to the NPC (non-streaming)
   */
  async talk(message: string): Promise<string> {
    this._isTalking = true;

    try {
      // Add user message to history
      const userMessage: Message = { role: 'user', content: message };
      this.history.push(userMessage);

      // Build messages array with system prompt
      const messages: Message[] = [
        { role: 'system', content: this.buildSystemPrompt() },
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

      // Trigger reply prediction generation (fire and forget)
      this.triggerReplyPrediction();

      return result.content;
    } finally {
      this._isTalking = false;
    }
  }

  /**
   * Talk to the NPC with streaming
   */
  async talkStream(
    message: string,
    onChunk: (chunk: string) => void,
    onComplete?: (fullText: string) => void
  ): Promise<void> {
    this._isTalking = true;

    try {
      // Add user message to history
      const userMessage: Message = { role: 'user', content: message };
      this.history.push(userMessage);

      // Build messages array with system prompt
      const messages: Message[] = [
        { role: 'system', content: this.buildSystemPrompt() },
        ...this.history,
      ];

      // Generate response
      await this.chatClient.textGenerationStream({
        messages,
        temperature: this.temperature,
        onChunk,
        onComplete: (fullText) => {
          this._isTalking = false;

          // Add assistant response to history
          const assistantMessage: Message = { role: 'assistant', content: fullText };
          this.history.push(assistantMessage);

          // Trim history if needed
          this.trimHistory();

          this.emit('response', fullText);

          // Trigger reply prediction generation (fire and forget)
          this.triggerReplyPrediction();

          if (onComplete) {
            onComplete(fullText);
          }
        },
      });
    } catch (error) {
      this._isTalking = false;
      throw error;
    }
  }

  /**
   * Talk with structured output
   * @deprecated Use talkWithActions instead for NPC decision-making with actions
   */
  async talkStructured<T = any>(message: string, schemaName: string): Promise<T> {
    this.logger.warn('talkStructured is deprecated. Use talkWithActions instead for NPC decision-making with actions.');
    // Add user message to history
    const userMessage: Message = { role: 'user', content: message };
    this.history.push(userMessage);

    // Generate structured response
    const result = await this.chatClient.generateStructured<T>({
      schemaName,
      prompt: message,
      messages: [{ role: 'system', content: this.buildSystemPrompt() }, ...this.history],
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
   * Talk to the NPC with available actions (non-streaming)
   * @param message The message to send
   * @param actions List of actions the NPC can perform
   * @returns Response containing text and any action calls
   */
  async talkWithActions(message: string, actions: NpcAction[]): Promise<NpcActionResponse> {
    this._isTalking = true;

    try {
      // Add user message to history
      const userMessage: Message = { role: 'user', content: message };
      this.history.push(userMessage);

      // Convert NpcActions to ChatTools
      const tools = actions
        .filter(a => a && a.enabled !== false)
        .map(a => npcActionToTool(a));

      // Build messages array with system prompt
      const messages: Message[] = [
        { role: 'system', content: this.buildSystemPrompt() },
        ...this.history,
      ];

      // Generate response with tools
      const result = await this.chatClient.textGenerationWithTools({
        messages,
        temperature: this.temperature,
        tools,
        tool_choice: 'auto',
      });

      // Build response
      const response: NpcActionResponse = {
        text: result.content || '',
        actionCalls: [],
        hasActions: false,
      };

      // Extract tool calls if any
      if (result.tool_calls) {
        response.actionCalls = result.tool_calls.map(tc => ({
          id: tc.id,
          actionName: tc.function.name,
          arguments: this.parseToolArguments(tc.function.arguments),
        }));
        response.hasActions = response.actionCalls.length > 0;
      }

      // Add assistant response to history
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.text,
        tool_calls: result.tool_calls,
      };
      this.history.push(assistantMessage);

      this.trimHistory();
      this.emit('response', response.text);
      if (response.hasActions) {
        this.emit('actions', response.actionCalls);
      }

      // Trigger reply prediction generation (fire and forget)
      this.triggerReplyPrediction();

      return response;
    } finally {
      this._isTalking = false;
    }
  }

  /**
   * Talk to the NPC with actions (streaming)
   * Text streams first, action calls are returned in onComplete
   */
  async talkWithActionsStream(
    message: string,
    actions: NpcAction[],
    onChunk: (chunk: string) => void,
    onComplete?: (response: NpcActionResponse) => void
  ): Promise<void> {
    this._isTalking = true;

    try {
      // Add user message to history
      const userMessage: Message = { role: 'user', content: message };
      this.history.push(userMessage);

      // Convert NpcActions to ChatTools
      const tools = actions
        .filter(a => a && a.enabled !== false)
        .map(a => npcActionToTool(a));

      // Build messages array with system prompt
      const messages: Message[] = [
        { role: 'system', content: this.buildSystemPrompt() },
        ...this.history,
      ];

      // Generate response with tools (streaming)
      await this.chatClient.textGenerationWithToolsStream({
        messages,
        temperature: this.temperature,
        tools,
        tool_choice: 'auto',
        onChunk,
        onComplete: (result) => {
          this._isTalking = false;

          // Build response
          const response: NpcActionResponse = {
            text: result.content || '',
            actionCalls: [],
            hasActions: false,
          };

          // Extract tool calls if any
          if (result.tool_calls) {
            response.actionCalls = result.tool_calls.map(tc => ({
              id: tc.id,
              actionName: tc.function.name,
              arguments: this.parseToolArguments(tc.function.arguments),
            }));
            response.hasActions = response.actionCalls.length > 0;
          }

          // Add assistant response to history
          const assistantMessage: Message = {
            role: 'assistant',
            content: response.text,
            tool_calls: result.tool_calls,
          };
          this.history.push(assistantMessage);

          this.trimHistory();
          this.emit('response', response.text);
          if (response.hasActions) {
            this.emit('actions', response.actionCalls);
          }

          // Trigger reply prediction generation (fire and forget)
          this.triggerReplyPrediction();

          if (onComplete) {
            onComplete(response);
          }
        },
      });
    } catch (error) {
      this._isTalking = false;
      throw error;
    }
  }

  // ===== Action Results Reporting =====

  /**
   * Report action results back to the conversation
   * Call this after executing actions to let the NPC know the results
   */
  reportActionResults(results: Record<string, string>): void {
    for (const [callId, result] of Object.entries(results)) {
      this.history.push({
        role: 'tool',
        tool_call_id: callId,
        content: result,
      });
    }
  }

  /**
   * Report a single action result
   */
  reportActionResult(callId: string, result: string): void {
    this.history.push({
      role: 'tool',
      tool_call_id: callId,
      content: result,
    });
  }

  /**
   * Parse tool arguments from JSON string
   */
  private parseToolArguments(args: string): Record<string, any> {
    try {
      return JSON.parse(args);
    } catch {
      return {};
    }
  }

  // ===== Conversation History Management =====

  /**
   * Get conversation history
   */
  getHistory(): Message[] {
    return [...this.history];
  }

  /**
   * Get the number of messages in history
   */
  getHistoryLength(): number {
    return this.history.length;
  }

  /**
   * Clear conversation history.
   * The character design and memories will be preserved.
   */
  clearHistory(): void {
    this.history = [];
    this.emit('history_cleared');
  }

  /**
   * Revert the last exchange (user message and assistant response) from history.
   * @returns true if reverted, false if not enough history
   */
  revertHistory(): boolean {
    let lastAssistantIndex = -1;
    let lastUserIndex = -1;

    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].role === 'assistant' && lastAssistantIndex === -1) {
        lastAssistantIndex = i;
      } else if (this.history[i].role === 'user' && lastAssistantIndex !== -1 && lastUserIndex === -1) {
        lastUserIndex = i;
        break;
      }
    }

    if (lastAssistantIndex !== -1 && lastUserIndex !== -1) {
      // Remove in reverse order to maintain indices
      this.history.splice(lastAssistantIndex, 1);
      this.history.splice(lastUserIndex, 1);
      this.emit('history_reverted');
      return true;
    }

    return false;
  }

  /**
   * Revert (remove) the last N chat messages from history
   * @param count Number of messages to remove
   * @returns Number of messages actually removed
   */
  revertChatMessages(count: number): number {
    if (count <= 0) return 0;

    const messagesToRemove = Math.min(count, this.history.length);
    const originalCount = this.history.length;

    this.history = this.history.slice(0, -messagesToRemove);

    const actuallyRemoved = originalCount - this.history.length;
    if (actuallyRemoved > 0) {
      this.emit('history_reverted', actuallyRemoved);
    }

    return actuallyRemoved;
  }

  /**
   * Revert to a specific point in history
   * @deprecated Use revertHistory() or revertChatMessages() instead
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
   * Alias for appendMessage (Unity SDK compatibility)
   */
  appendChatMessage(role: string, content: string): void {
    if (!role || !content) {
      this.logger.warn('Role and content cannot be empty');
      return;
    }
    this.appendMessage({ role: role as any, content });
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

  // ===== Save/Load =====

  /**
   * Save the current conversation history to a serializable format.
   * Includes characterDesign, memories, and history.
   */
  saveHistory(): string {
    const saveData: ConversationSaveData = {
      characterDesign: this.characterDesign,
      memories: Array.from(this.memories.entries()).map(([name, content]) => ({ name, content })),
      history: this.history,
    };
    return JSON.stringify(saveData);
  }

  /**
   * Load conversation history from serialized data.
   * Restores characterDesign, memories, and history.
   */
  loadHistory(saveData: string): boolean {
    try {
      const data = JSON.parse(saveData) as Partial<ConversationSaveData>;
      
      // Load character design (with backwards compatibility for old systemPrompt field)
      this.characterDesign = data.characterDesign || data.systemPrompt || this.characterDesign;
      
      // Load memories
      this.memories.clear();
      if (data.memories && Array.isArray(data.memories)) {
        for (const memory of data.memories) {
          if (memory.name && memory.content) {
            this.memories.set(memory.name, memory.content);
          }
        }
      }

      // Load history (skip system messages as they'll be rebuilt from characterDesign + memories)
      this.history = (data.history || []).filter(m => m.role !== 'system');
      
      this.emit('history_loaded');
      return true;
    } catch (error) {
      this.logger.error('Failed to load history:', error);
      return false;
    }
  }
}

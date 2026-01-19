/**
 * Global AI Context Manager for managing NPC conversations and player context.
 * 
 * Features:
 * - Player description management
 * - NPC conversation tracking
 * - Automatic conversation compaction (AutoCompact)
 */

import EventEmitter from 'eventemitter3';
import { NPCClient } from './NPCClient';
import { ChatClient } from './ChatClient';
import { Logger } from '../utils/Logger';

/**
 * Configuration for AIContextManager
 */
export interface AIContextManagerConfig {
  /** Enable automatic conversation compaction */
  enableAutoCompact?: boolean;
  
  /** Minimum number of messages before compaction is eligible (default: 20) */
  autoCompactMinMessages?: number;
  
  /** Time in seconds after last conversation before compaction (default: 300 = 5 minutes) */
  autoCompactTimeoutSeconds?: number;
  
  /** Check interval for auto-compaction in milliseconds (default: 60000 = 1 minute) */
  autoCompactCheckInterval?: number;
  
  /** Fast model to use for summarization (optional) */
  fastModel?: string;
}

/**
 * Internal state tracking for each NPC's conversation
 */
interface NpcConversationState {
  /** The last time a conversation exchange occurred with this NPC */
  lastConversationTime: Date;
  
  /** Whether the conversation has been compacted since the last exchange */
  isCompacted: boolean;
  
  /** Number of times this NPC's conversation has been compacted */
  compactionCount: number;
}

/**
 * Events emitted by AIContextManager
 */
export interface AIContextManagerEvents {
  /** Fired when an NPC's conversation is compacted */
  npcCompacted: (npc: NPCClient) => void;
  
  /** Fired when compaction fails for an NPC */
  compactionFailed: (npc: NPCClient, error: string) => void;
  
  /** Fired when player description changes */
  playerDescriptionChanged: (description: string | null) => void;
}

/**
 * Global AI Context Manager
 * Manages NPC conversations and player context across the application
 */
export class AIContextManager extends EventEmitter<AIContextManagerEvents> {
  private static _instance: AIContextManager | null = null;

  private config: Required<AIContextManagerConfig>;
  private playerDescription: string | null = null;
  private npcStates: Map<NPCClient, NpcConversationState> = new Map();
  private autoCompactTimer: ReturnType<typeof setInterval> | null = null;
  private chatClientFactory: (() => ChatClient) | null = null;
  private logger = Logger.getLogger('AIContextManager');

  constructor(config?: AIContextManagerConfig) {
    super();
    
    this.config = {
      enableAutoCompact: config?.enableAutoCompact ?? false,
      autoCompactMinMessages: config?.autoCompactMinMessages ?? 20,
      autoCompactTimeoutSeconds: config?.autoCompactTimeoutSeconds ?? 300,
      autoCompactCheckInterval: config?.autoCompactCheckInterval ?? 60000,
      fastModel: config?.fastModel ?? '',
    };

    // Start auto-compact check if enabled
    if (this.config.enableAutoCompact) {
      this.startAutoCompactCheck();
    }
  }

  // ===== Singleton Pattern =====

  /**
   * Get the singleton instance of AIContextManager
   * Creates a new instance if one doesn't exist
   */
  static getInstance(config?: AIContextManagerConfig): AIContextManager {
    if (!AIContextManager._instance) {
      AIContextManager._instance = new AIContextManager(config);
    }
    return AIContextManager._instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    if (AIContextManager._instance) {
      AIContextManager._instance.destroy();
      AIContextManager._instance = null;
    }
  }

  // ===== Configuration =====

  /**
   * Set the chat client factory for creating chat clients for summarization
   * Required for compaction to work
   */
  setChatClientFactory(factory: () => ChatClient): void {
    this.chatClientFactory = factory;
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<AIContextManagerConfig>): void {
    const wasAutoCompactEnabled = this.config.enableAutoCompact;
    
    this.config = { ...this.config, ...config };
    
    // Handle auto-compact state change
    if (config.enableAutoCompact !== undefined) {
      if (config.enableAutoCompact && !wasAutoCompactEnabled) {
        this.startAutoCompactCheck();
      } else if (!config.enableAutoCompact && wasAutoCompactEnabled) {
        this.stopAutoCompactCheck();
      }
    }
  }

  // ===== Player Description =====

  /**
   * Set the player's description for AI context.
   * Used when generating reply predictions and for NPC context.
   * @param description Description of the player character
   */
  setPlayerDescription(description: string): void {
    this.playerDescription = description;
    this.emit('playerDescriptionChanged', description);
  }

  /**
   * Get the current player description.
   * @returns The player description, or null if not set
   */
  getPlayerDescription(): string | null {
    return this.playerDescription;
  }

  /**
   * Clear the player description.
   */
  clearPlayerDescription(): void {
    this.playerDescription = null;
    this.emit('playerDescriptionChanged', null);
  }

  // ===== NPC Tracking =====

  /**
   * Register an NPC for context management.
   * @param npc The NPC client to register
   */
  registerNpc(npc: NPCClient): void {
    if (!npc) return;

    if (!this.npcStates.has(npc)) {
      this.npcStates.set(npc, {
        lastConversationTime: new Date(),
        isCompacted: false,
        compactionCount: 0,
      });
    }
  }

  /**
   * Unregister an NPC (call when NPC is destroyed/removed).
   * @param npc The NPC client to unregister
   */
  unregisterNpc(npc: NPCClient): void {
    if (!npc) return;
    this.npcStates.delete(npc);
  }

  /**
   * Record that a conversation occurred with an NPC.
   * Called after each Talk() exchange.
   * @param npc The NPC client that had a conversation
   */
  recordConversation(npc: NPCClient): void {
    if (!npc) return;

    if (!this.npcStates.has(npc)) {
      this.registerNpc(npc);
    }

    const state = this.npcStates.get(npc)!;
    state.lastConversationTime = new Date();
    state.isCompacted = false; // Reset compaction flag on new conversation
  }

  /**
   * Get all registered NPCs
   */
  getRegisteredNpcs(): NPCClient[] {
    return Array.from(this.npcStates.keys());
  }

  /**
   * Get the conversation state for an NPC
   */
  getNpcState(npc: NPCClient): NpcConversationState | undefined {
    return this.npcStates.get(npc);
  }

  // ===== Auto Compaction =====

  /**
   * Check if an NPC is eligible for compaction.
   * @param npc The NPC to check
   * @returns True if eligible for compaction
   */
  isEligibleForCompaction(npc: NPCClient): boolean {
    if (!npc) return false;
    
    const state = this.npcStates.get(npc);
    if (!state) return false;

    // Check if already compacted since last conversation
    if (state.isCompacted) return false;

    // Check message count
    const history = npc.getHistory();
    const nonSystemMessages = history.filter(m => m.role !== 'system').length;
    if (nonSystemMessages < this.config.autoCompactMinMessages) return false;

    // Check time since last conversation
    const timeSinceLastConversation = (Date.now() - state.lastConversationTime.getTime()) / 1000;
    if (timeSinceLastConversation < this.config.autoCompactTimeoutSeconds) return false;

    return true;
  }

  /**
   * Manually trigger conversation compaction for a specific NPC.
   * Summarizes the conversation history and stores it as a memory.
   * @param npc The NPC to compact
   * @returns True if compaction succeeded
   */
  async compactConversation(npc: NPCClient): Promise<boolean> {
    if (!npc) {
      this.logger.warn('Cannot compact: NPC is null');
      return false;
    }

    if (!this.chatClientFactory) {
      this.logger.error('Cannot compact: No chat client factory set. Call setChatClientFactory() first.');
      return false;
    }

    const history = npc.getHistory();
    const nonSystemMessages = history.filter(m => m.role !== 'system');

    if (nonSystemMessages.length < 2) {
      this.logger.info('Skipping compaction: not enough messages');
      return false;
    }

    try {
      this.logger.info(`Starting compaction (${nonSystemMessages.length} messages)`);

      // Build conversation text for summarization
      const conversationText = nonSystemMessages
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      // Create summarization prompt
      const summaryPrompt = `Summarize the following conversation concisely. Focus on:
1. Key topics discussed
2. Important information exchanged
3. Any decisions or commitments made
4. The emotional tone

Keep the summary under 200 words. Write in third person.

Conversation:
${conversationText}`;

      // Use chat client for summarization
      const chatClient = this.chatClientFactory();
      
      const result = await chatClient.textGeneration({
        messages: [{ role: 'user', content: summaryPrompt }],
        temperature: 0.5,
        model: this.config.fastModel || undefined,
      });

      if (!result.content) {
        const error = 'Empty response from summarization';
        this.logger.error(`Compaction failed: ${error}`);
        this.emit('compactionFailed', npc, error);
        return false;
      }

      // Clear history and add summary as memory
      npc.clearHistory();
      npc.setMemory('PreviousConversationSummary', result.content);

      // Update state
      const state = this.npcStates.get(npc);
      if (state) {
        state.isCompacted = true;
        state.compactionCount++;
      }

      this.logger.info(`Compaction completed. Summary: ${result.content.substring(0, 100)}...`);
      this.emit('npcCompacted', npc);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Compaction error: ${errorMessage}`);
      this.emit('compactionFailed', npc, errorMessage);
      return false;
    }
  }

  /**
   * Compact all registered NPCs that meet the eligibility criteria.
   * @returns Number of NPCs successfully compacted
   */
  async compactAllEligible(): Promise<number> {
    const eligibleNpcs = Array.from(this.npcStates.keys()).filter(npc => 
      this.isEligibleForCompaction(npc)
    );

    if (eligibleNpcs.length === 0) {
      return 0;
    }

    this.logger.info(`Compacting ${eligibleNpcs.length} eligible NPCs`);

    let successCount = 0;
    for (const npc of eligibleNpcs) {
      const success = await this.compactConversation(npc);
      if (success) successCount++;
    }

    return successCount;
  }

  // ===== Auto Compact Timer =====

  /**
   * Start the auto-compact check timer
   */
  private startAutoCompactCheck(): void {
    if (this.autoCompactTimer) {
      this.stopAutoCompactCheck();
    }

    this.autoCompactTimer = setInterval(() => {
      this.runAutoCompactCheck();
    }, this.config.autoCompactCheckInterval);
  }

  /**
   * Stop the auto-compact check timer
   */
  private stopAutoCompactCheck(): void {
    if (this.autoCompactTimer) {
      clearInterval(this.autoCompactTimer);
      this.autoCompactTimer = null;
    }
  }

  /**
   * Run a single auto-compact check
   */
  private async runAutoCompactCheck(): Promise<void> {
    if (!this.config.enableAutoCompact) return;

    const eligibleNpcs = Array.from(this.npcStates.keys()).filter(npc => 
      this.isEligibleForCompaction(npc)
    );

    for (const npc of eligibleNpcs) {
      // Fire and forget - don't block
      this.compactConversation(npc).catch(err => {
        this.logger.error('Auto-compact error:', err);
      });
    }
  }

  // ===== Lifecycle =====

  /**
   * Enable auto-compaction
   */
  enableAutoCompact(): void {
    this.config.enableAutoCompact = true;
    this.startAutoCompactCheck();
  }

  /**
   * Disable auto-compaction
   */
  disableAutoCompact(): void {
    this.config.enableAutoCompact = false;
    this.stopAutoCompactCheck();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopAutoCompactCheck();
    this.npcStates.clear();
    this.playerDescription = null;
    this.removeAllListeners();
  }
}

/**
 * Default AIContextManager instance
 * Can be used as a global context manager
 */
export const defaultContextManager = AIContextManager.getInstance();


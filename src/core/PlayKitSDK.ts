/**
 * Main SDK class - Entry point for PlayKit SDK
 */

import EventEmitter from 'eventemitter3';
import { SDKConfig, PlayerInfo } from '../types';
import { AuthManager } from '../auth/AuthManager';
import { PlayerClient } from './PlayerClient';
import { ChatProvider } from '../providers/ChatProvider';
import { ImageProvider } from '../providers/ImageProvider';
import { ChatClient } from './ChatClient';
import { ImageClient } from './ImageClient';
import { NPCClient, NPCConfig } from './NPCClient';

export class PlayKitSDK extends EventEmitter {
  private config: SDKConfig;
  private authManager: AuthManager;
  private playerClient: PlayerClient;
  private chatProvider: ChatProvider;
  private imageProvider: ImageProvider;
  private initialized: boolean = false;

  constructor(config: SDKConfig) {
    super();
    this.config = {
      defaultChatModel: 'gpt-4o-mini',
      defaultImageModel: 'dall-e-3',
      debug: false,
      ...config,
    };

    // Initialize managers and providers
    this.authManager = new AuthManager(this.config);
    this.playerClient = new PlayerClient(this.authManager, this.config);
    this.chatProvider = new ChatProvider(this.authManager, this.config);
    this.imageProvider = new ImageProvider(this.authManager, this.config);

    // Forward authentication events
    this.authManager.on('authenticated', (authState) => {
      this.emit('authenticated', authState);
      if (this.config.debug) {
        console.log('[PlayKitSDK] Authenticated', authState);
      }
    });

    this.authManager.on('unauthenticated', () => {
      this.emit('unauthenticated');
      if (this.config.debug) {
        console.log('[PlayKitSDK] Not authenticated');
      }
    });

    this.authManager.on('error', (error) => {
      this.emit('error', error);
      if (this.config.debug) {
        console.error('[PlayKitSDK] Auth error', error);
      }
    });
  }

  /**
   * Initialize the SDK
   * Must be called before using any features
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      if (this.config.debug) {
        console.warn('[PlayKitSDK] Already initialized');
      }
      return;
    }

    try {
      await this.authManager.initialize();
      this.initialized = true;
      this.emit('ready');

      if (this.config.debug) {
        console.log('[PlayKitSDK] Initialized successfully');
      }
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Check if SDK is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.authManager.isAuthenticated();
  }

  /**
   * Exchange JWT for player token
   */
  async login(jwt: string): Promise<string> {
    return await this.authManager.exchangeJWT(jwt);
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    await this.authManager.logout();
  }

  /**
   * Get player information
   */
  async getPlayerInfo(): Promise<PlayerInfo> {
    return await this.playerClient.getPlayerInfo();
  }

  /**
   * Create a chat client
   */
  createChatClient(model?: string): ChatClient {
    return new ChatClient(this.chatProvider, model || this.config.defaultChatModel);
  }

  /**
   * Create an image client
   */
  createImageClient(model?: string): ImageClient {
    return new ImageClient(this.imageProvider, model || this.config.defaultImageModel);
  }

  /**
   * Create an NPC client
   */
  createNPCClient(config?: NPCConfig & { model?: string }): NPCClient {
    const chatClient = this.createChatClient(config?.model);
    return new NPCClient(chatClient, config);
  }

  /**
   * Get authentication manager (advanced usage)
   */
  getAuthManager(): AuthManager {
    return this.authManager;
  }

  /**
   * Get player client (advanced usage)
   */
  getPlayerClient(): PlayerClient {
    return this.playerClient;
  }

  /**
   * Enable or disable debug mode
   */
  setDebug(enabled: boolean): void {
    this.config.debug = enabled;
  }
}

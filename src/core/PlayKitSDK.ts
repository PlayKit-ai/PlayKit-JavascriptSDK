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
import { RechargeConfig } from '../types/recharge';

export class PlayKitSDK extends EventEmitter {
  private config: SDKConfig & { recharge?: RechargeConfig };
  private authManager: AuthManager;
  private playerClient: PlayerClient;
  private chatProvider: ChatProvider;
  private imageProvider: ImageProvider;
  private initialized: boolean = false;
  private devTokenIndicator: HTMLDivElement | null = null;

  constructor(config: SDKConfig & { recharge?: RechargeConfig }) {
    super();
    this.config = {
      defaultChatModel: 'gpt-4o-mini',
      defaultImageModel: 'dall-e-3',
      debug: false,
      ...config,
    };

    // Initialize managers and providers
    this.authManager = new AuthManager(this.config);
    this.playerClient = new PlayerClient(this.authManager, this.config, this.config.recharge);
    this.chatProvider = new ChatProvider(this.authManager, this.config);
    this.imageProvider = new ImageProvider(this.authManager, this.config);

    // Connect providers to player client for balance checking
    this.chatProvider.setPlayerClient(this.playerClient);
    this.imageProvider.setPlayerClient(this.playerClient);

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

    // Forward recharge events
    this.playerClient.on('recharge_opened', () => this.emit('recharge_opened'));
    this.playerClient.on('recharge_modal_shown', () => this.emit('recharge_modal_shown'));
    this.playerClient.on('recharge_modal_dismissed', () => this.emit('recharge_modal_dismissed'));
    this.playerClient.on('insufficient_credits', (error) => this.emit('insufficient_credits', error));
    this.playerClient.on('balance_low', (credits) => this.emit('balance_low', credits));
    this.playerClient.on('balance_updated', (credits) => this.emit('balance_updated', credits));
    this.playerClient.on('player_info_updated', (info) => this.emit('player_info_updated', info));
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

      // Show developer token indicator if using developer token
      if (this.config.developerToken && typeof window !== 'undefined') {
        this.showDeveloperTokenIndicator();
      }

      // Always verify token validity and fetch user info after authentication
      if (this.authManager.isAuthenticated()) {
        try {
          await this.playerClient.getPlayerInfo();
          if (this.config.debug) {
            console.log('[PlayKitSDK] Token validated and user info fetched');
          }
        } catch (error) {
          // If token is invalid, logout and restart auth flow
          if (this.config.debug) {
            console.error('[PlayKitSDK] Token validation failed:', error);
          }
          await this.authManager.logout();

          // Auto-restart login flow in browser environment
          if (typeof window !== 'undefined') {
            if (this.config.debug) {
              console.log('[PlayKitSDK] Restarting authentication flow...');
            }
            const useExternalAuth = this.config.authMethod === 'external-auth';
            await this.authManager.startAuthFlow(useExternalAuth);

            // Retry getting player info after re-authentication
            await this.playerClient.getPlayerInfo();
            if (this.config.debug) {
              console.log('[PlayKitSDK] Re-authentication successful, token validated');
            }
          } else {
            throw new Error('Token validation failed: ' + (error instanceof Error ? error.message : String(error)));
          }
        }
      }

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
   * Show developer token indicator in top-left corner
   */
  private showDeveloperTokenIndicator(): void {
    if (this.devTokenIndicator) {
      return; // Already shown
    }

    // Create indicator element
    this.devTokenIndicator = document.createElement('div');
    this.devTokenIndicator.textContent = 'DeveloperToken';
    this.devTokenIndicator.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background-color: #dc2626;
      color: white;
      padding: 4px 12px;
      border-radius: 4px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 12px;
      font-weight: 600;
      z-index: 999999;
      pointer-events: none;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    `;

    document.body.appendChild(this.devTokenIndicator);
  }

  /**
   * Hide developer token indicator
   */
  private hideDeveloperTokenIndicator(): void {
    if (this.devTokenIndicator) {
      this.devTokenIndicator.remove();
      this.devTokenIndicator = null;
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
    const token = await this.authManager.exchangeJWT(jwt);

    // Verify token validity and fetch user info
    try {
      await this.playerClient.getPlayerInfo();
      if (this.config.debug) {
        console.log('[PlayKitSDK] Login successful, token validated and user info fetched');
      }
    } catch (error) {
      // If token is invalid, logout and re-throw error
      if (this.config.debug) {
        console.error('[PlayKitSDK] Token validation failed after login:', error);
      }
      await this.authManager.logout();
      throw new Error('Token validation failed: ' + (error instanceof Error ? error.message : String(error)));
    }

    return token;
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    await this.authManager.logout();
    this.hideDeveloperTokenIndicator();
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

  /**
   * Show insufficient balance modal
   */
  async showInsufficientBalanceModal(customMessage?: string): Promise<void> {
    return await this.playerClient.showInsufficientBalanceModal(customMessage);
  }

  /**
   * Open recharge window in new tab
   */
  openRechargeWindow(): void {
    this.playerClient.openRechargeWindow();
  }

  /**
   * Enable automatic periodic balance checking
   * @param intervalMs - Check interval in milliseconds (default: 30000)
   */
  enableAutoBalanceCheck(intervalMs?: number): void {
    this.playerClient.enableAutoBalanceCheck(intervalMs);
  }

  /**
   * Disable automatic balance checking
   */
  disableAutoBalanceCheck(): void {
    this.playerClient.disableAutoBalanceCheck();
  }

  /**
   * Get player's current cached balance
   */
  getCachedBalance(): number | null {
    const playerInfo = this.playerClient.getCachedPlayerInfo();
    return playerInfo?.credits ?? null;
  }

  /**
   * Refresh and get player's current balance
   */
  async refreshBalance(): Promise<number> {
    const playerInfo = await this.playerClient.refreshPlayerInfo();
    return playerInfo.credits;
  }
}

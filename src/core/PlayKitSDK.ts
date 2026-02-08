/**
 * Main SDK class - Entry point for PlayKit SDK
 */

import EventEmitter from 'eventemitter3';
import { SDKConfig, PlayerInfo, TokenRefreshResult, SetNicknameResponse, PlayKitError, DeveloperTokenFallbackConfig } from '../types';
import type { DeviceAuthInitResult, DeviceAuthResult, TokenScope } from '../auth/DeviceAuthFlowManager';
import { AuthManager } from '../auth/AuthManager';
import { PlayerClient } from './PlayerClient';
import { ChatProvider } from '../providers/ChatProvider';
import { ImageProvider } from '../providers/ImageProvider';
import { TranscriptionProvider } from '../providers/TranscriptionProvider';
import { ChatClient } from './ChatClient';
import { ImageClient } from './ImageClient';
import { TranscriptionClient } from './TranscriptionClient';
import { NPCClient, NPCConfig } from './NPCClient';
import { RechargeConfig } from '../types/recharge';
import { AIContextManager, AIContextManagerConfig } from './AIContextManager';
import { SchemaLibrary } from './SchemaLibrary';
import { Logger, LogLevel, LogConfig } from '../utils/Logger';

export class PlayKitSDK extends EventEmitter {
  private config: SDKConfig & { recharge?: RechargeConfig; aiContext?: AIContextManagerConfig };
  private authManager: AuthManager;
  private playerClient: PlayerClient;
  private chatProvider: ChatProvider;
  private imageProvider: ImageProvider;
  private transcriptionProvider: TranscriptionProvider;
  private contextManager: AIContextManager;
  private schemaLibrary: SchemaLibrary;
  private initialized: boolean = false;
  private devTokenIndicator: HTMLDivElement | null = null;
  private logger: Logger;
  private fallbackConfig: DeveloperTokenFallbackConfig;

  constructor(config: SDKConfig & { recharge?: RechargeConfig; aiContext?: AIContextManagerConfig }) {
    super();
    this.config = {
      defaultChatModel: 'gpt-4o-mini',
      defaultImageModel: 'dall-e-3',
      debug: false,
      ...config,
    };

    // Initialize logging system
    this.initializeLogging(this.config);
    this.logger = Logger.getLogger('PlayKitSDK');

    // Initialize fallback configuration with defaults
    this.fallbackConfig = {
      enabled: true,
      ...config.developerTokenFallback,
    };

    // Initialize managers and providers
    this.authManager = new AuthManager(this.config);
    this.playerClient = new PlayerClient(this.authManager, this.config, this.config.recharge);
    this.chatProvider = new ChatProvider(this.authManager, this.config);
    this.imageProvider = new ImageProvider(this.authManager, this.config);
    this.transcriptionProvider = new TranscriptionProvider(this.authManager, this.config);

    // Connect providers to player client for balance checking
    this.chatProvider.setPlayerClient(this.playerClient);
    this.imageProvider.setPlayerClient(this.playerClient);
    this.transcriptionProvider.setPlayerClient(this.playerClient);

    // Initialize AI context manager
    this.contextManager = new AIContextManager(this.config.aiContext);
    // Set chat client factory for compaction
    this.contextManager.setChatClientFactory(() => this.createChatClient());

    // Initialize schema library
    this.schemaLibrary = new SchemaLibrary();

    // Forward authentication events
    this.authManager.on('authenticated', (authState) => {
      this.emit('authenticated', authState);
      this.logger.debug('Authenticated', authState);
    });

    this.authManager.on('unauthenticated', () => {
      this.emit('unauthenticated');
      this.logger.debug('Not authenticated');
    });

    this.authManager.on('error', (error) => {
      this.emit('error', error);
      this.logger.error('Auth error', error);
    });

    this.authManager.on('token_refreshed', (authState) => {
      this.emit('token_refreshed', authState);
      this.logger.debug('Token refreshed', authState);
    });

    // Forward recharge events
    this.playerClient.on('recharge_opened', () => this.emit('recharge_opened'));
    this.playerClient.on('recharge_modal_shown', () => this.emit('recharge_modal_shown'));
    this.playerClient.on('recharge_modal_dismissed', () => this.emit('recharge_modal_dismissed'));
    this.playerClient.on('insufficient_credits', (error) => this.emit('insufficient_credits', error));
    this.playerClient.on('balance_low', (credits) => this.emit('balance_low', credits));
    this.playerClient.on('balance_updated', (credits) => this.emit('balance_updated', credits));
    this.playerClient.on('player_info_updated', (info) => this.emit('player_info_updated', info));
    this.playerClient.on('daily_credits_refreshed', (result) => this.emit('daily_credits_refreshed', result));
    this.playerClient.on('nickname_changed', (nickname) => this.emit('nickname_changed', nickname));
  }

  /**
   * Initialize the SDK
   * Must be called before using any features
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('Already initialized');
      return;
    }

    try {
      await this.authManager.initialize();
      this.initialized = true;

      // Show developer token indicator if using developer token (browser mode only)
      const isDeveloperTokenMode = this.authManager.isDeveloperTokenAuth();
      if (isDeveloperTokenMode && this.config.mode !== 'server' && typeof window !== 'undefined') {
        this.showDeveloperTokenIndicator();
      }

      // Always verify token validity and fetch user info after authentication
      if (this.authManager.isAuthenticated()) {
        try {
          await this.playerClient.getPlayerInfo();
          this.logger.debug('Token validated and user info fetched');
        } catch (error) {
          // Check if this is a developerToken failure
          if (isDeveloperTokenMode) {
            await this.handleDeveloperTokenFailure(error);
          } else {
            // If token is invalid, logout and restart auth flow
            this.logger.error('Token validation failed:', error);
            await this.authManager.logout();

            // Auto-restart login flow in browser environment
            if (typeof window !== 'undefined') {
              this.logger.debug('Restarting authentication flow...');
              const authMethod = this.config.authMethod || 'device';
              await this.authManager.startAuthFlow(authMethod);

              // Retry getting player info after re-authentication
              await this.playerClient.getPlayerInfo();
              this.logger.debug('Re-authentication successful, token validated');
            } else {
              throw new Error('Token validation failed: ' + (error instanceof Error ? error.message : String(error)));
            }
          }
        }
      }

      this.emit('ready');

      this.logger.debug('Initialized successfully');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Handle developerToken authentication failure with optional fallback to player login.
   * This is called when a developerToken is provided but fails validation.
   *
   * @param error - The error that caused the developerToken failure
   */
  private async handleDeveloperTokenFailure(error: unknown): Promise<void> {
    const willFallback = this.fallbackConfig.enabled !== false &&
                         typeof window !== 'undefined' &&
                         this.config.mode !== 'server';

    // Emit developer_token_failed event
    this.emit('developer_token_failed', {
      error,
      willFallback,
    });
    this.logger.warn('DeveloperToken validation failed', { error, willFallback });

    // Clear developer token state and indicator
    this.authManager.clearDeveloperToken();
    this.hideDeveloperTokenIndicator();

    if (!willFallback) {
      // Fallback disabled or not in browser - throw the error
      throw new PlayKitError(
        'DeveloperToken validation failed: ' + (error instanceof Error ? error.message : String(error)),
        'DEVELOPER_TOKEN_INVALID'
      );
    }

    // Emit fallback started event
    const fallbackMethod = this.config.authMethod || 'device';
    this.emit('developer_token_fallback_started', { fallbackMethod });
    this.logger.debug('Starting fallback to player login', { fallbackMethod });

    try {
      // Start player login flow
      await this.authManager.startAuthFlow(fallbackMethod);

      // Verify the new token
      await this.playerClient.getPlayerInfo();

      // Emit fallback completed event
      const authState = this.authManager.getAuthState();
      this.emit('developer_token_fallback_completed', { authState });
      this.logger.debug('DeveloperToken fallback completed successfully');
    } catch (fallbackError) {
      // Emit fallback failed event
      this.emit('developer_token_fallback_failed', { error: fallbackError });
      this.logger.error('DeveloperToken fallback failed', fallbackError);
      throw fallbackError;
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
      this.logger.debug('Login successful, token validated and user info fetched');
    } catch (error) {
      // If token is invalid, logout and re-throw error
      this.logger.error('Token validation failed after login:', error);
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
   * Ensure SDK is initialized before making API calls
   * @throws PlayKitError if not initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new PlayKitError(
        'SDK not initialized. Call await sdk.initialize() before using API methods.',
        'NOT_INITIALIZED'
      );
    }
  }

  /**
   * Get player information
   */
  async getPlayerInfo(): Promise<PlayerInfo> {
    this.ensureInitialized();
    return await this.playerClient.getPlayerInfo();
  }

  /**
   * Create a chat client
   * Automatically uses the SDK's schema library
   */
  createChatClient(model?: string): ChatClient {
    this.ensureInitialized();
    const client = new ChatClient(this.chatProvider, model || this.config.defaultChatModel);
    // Automatically use the SDK's schema library
    client.setSchemaLibrary(this.schemaLibrary);
    return client;
  }

  /**
   * Create an image client
   */
  createImageClient(model?: string): ImageClient {
    this.ensureInitialized();
    return new ImageClient(this.imageProvider, model || this.config.defaultImageModel);
  }

  /**
   * Create a transcription client for audio-to-text
   * @param model - Transcription model to use (default: 'whisper-large')
   */
  createTranscriptionClient(model?: string): TranscriptionClient {
    this.ensureInitialized();
    return new TranscriptionClient(this.transcriptionProvider, model || this.config.defaultTranscriptionModel);
  }

  /**
   * Create an NPC client
   * Automatically registers with AIContextManager
   */
  createNPCClient(config?: NPCConfig & { model?: string }): NPCClient {
    this.ensureInitialized();
    const chatClient = this.createChatClient(config?.model);
    const npc = new NPCClient(chatClient, config);

    // Register with context manager
    this.contextManager.registerNpc(npc);

    return npc;
  }

  /**
   * Get current authentication token (convenience method)
   * Returns undefined if not authenticated
   */
  getToken(): string | undefined {
    return this.authManager.getToken();
  }

  /**
   * Get current authentication state (convenience method)
   */
  getAuthState(): import('../types').AuthState {
    return this.authManager.getAuthState();
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
   * Get AI context manager
   * Use this to manage player descriptions, NPC tracking, and conversation compaction
   */
  getContextManager(): AIContextManager {
    return this.contextManager;
  }

  /**
   * Get the schema library
   * Use this to register schemas for structured output generation
   */
  getSchemaLibrary(): SchemaLibrary {
    return this.schemaLibrary;
  }

  /**
   * Set the player description for AI context
   * Convenience method - delegates to AIContextManager
   */
  setPlayerDescription(description: string): void {
    this.contextManager.setPlayerDescription(description);
  }

  /**
   * Get the player description
   * Convenience method - delegates to AIContextManager
   */
  getPlayerDescription(): string | null {
    return this.contextManager.getPlayerDescription();
  }

  /**
   * Enable or disable debug mode
   * @deprecated Use configureLogging() instead
   */
  setDebug(enabled: boolean): void {
    this.config.debug = enabled;
    Logger.setGlobalLevel(enabled ? LogLevel.DEBUG : LogLevel.WARN);
  }

  /**
   * Configure the logging system
   * @param config Logging configuration
   */
  configureLogging(config: LogConfig): void {
    Logger.configure(config);
  }

  /**
   * Get a logger instance for external use
   * @param source The source/module identifier
   */
  static getLogger(source: string): Logger {
    return Logger.getLogger(source);
  }

  /**
   * Initialize logging system based on config
   */
  private initializeLogging(config: SDKConfig): void {
    // Handle legacy debug option for backwards compatibility
    if (config.debug !== undefined && config.logging === undefined) {
      Logger.setGlobalLevel(config.debug ? LogLevel.DEBUG : LogLevel.WARN);
    }

    // Apply new logging config
    if (config.logging) {
      Logger.configure(config.logging);
    }
  }

  /**
   * Show insufficient balance modal
   */
  async showInsufficientBalanceModal(customMessage?: string): Promise<void> {
    this.ensureInitialized();
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
    return playerInfo?.balance ?? null;
  }

  /**
   * Refresh and get player's current balance
   */
  async refreshBalance(): Promise<number> {
    this.ensureInitialized();
    const playerInfo = await this.playerClient.refreshPlayerInfo();
    return playerInfo.balance;
  }

  // ============================================================
  // Player Profile Methods
  // ============================================================

  /**
   * Get player's nickname (cached)
   * @returns Nickname or null if not set
   */
  getNickname(): string | null {
    return this.playerClient.getNickname();
  }

  /**
   * Set player's nickname for the current game
   * @param nickname - 1-16 characters (letters, numbers, Chinese, underscores, spaces)
   * @returns SetNicknameResponse with success status and gameId
   * @throws PlayKitError if validation fails or token type is invalid
   */
  async setNickname(nickname: string): Promise<SetNicknameResponse> {
    this.ensureInitialized();
    return await this.playerClient.setNickname(nickname);
  }

  // ============================================================
  // Headless Device Auth Methods (for terminal/CLI environments)
  // ============================================================

  /**
   * Initiate device auth without opening browser or showing UI.
   * Use this for headless/terminal environments where you need to handle
   * the auth URL yourself (e.g., display QR code, print to console).
   *
   * @param scope - Requested scope (default: 'player:play')
   * @returns Promise resolving to DeviceAuthInitResult with auth URL and session info
   *
   * @example
   * ```ts
   * // Terminal/CLI usage
   * const { authUrl, sessionId, codeVerifier, expiresIn } = await sdk.initiateLogin();
   * console.log('Please visit:', authUrl);
   * // Or generate QR code from authUrl
   *
   * // Then poll for completion
   * const result = await sdk.completeLogin(sessionId, codeVerifier, {
   *   onStatus: (status) => console.log('Status:', status),
   *   timeoutMs: expiresIn * 1000,
   * });
   * console.log('Logged in! Token:', result.access_token);
   * ```
   */
  async initiateLogin(scope?: TokenScope): Promise<DeviceAuthInitResult> {
    return this.authManager.initiateDeviceAuth(scope);
  }

  /**
   * Complete the login flow after initiateLogin().
   * Polls for authorization until user completes login or timeout.
   * On success, automatically updates auth state.
   *
   * @param sessionId - Session ID from initiateLogin()
   * @param codeVerifier - Code verifier from initiateLogin()
   * @param options - Optional callbacks for status updates
   * @returns Promise resolving to DeviceAuthResult with tokens
   */
  async completeLogin(
    sessionId: string,
    codeVerifier: string,
    options?: {
      /** Callback for status updates */
      onStatus?: (status: 'pending' | 'slow_down' | 'authorized' | 'denied' | 'expired') => void;
      /** Timeout in milliseconds (default: 600000 = 10 minutes) */
      timeoutMs?: number;
      /** Poll interval in milliseconds (default: 5000 = 5 seconds) */
      pollIntervalMs?: number;
    }
  ): Promise<DeviceAuthResult> {
    return this.authManager.pollDeviceAuth(sessionId, codeVerifier, options);
  }

  /**
   * Cancel ongoing device auth flow
   */
  cancelLogin(): void {
    this.authManager.cancelDeviceAuthFlow();
  }

  // ============================================================
  // Token Refresh Methods
  // ============================================================

  /**
   * Check if the current token is expired
   */
  isTokenExpired(): boolean {
    return this.authManager.isTokenExpired();
  }

  /**
   * Check if the access token can be refreshed
   * @returns true if a valid refresh token exists
   */
  canRefreshToken(): boolean {
    return this.authManager.canRefresh();
  }

  /**
   * Manually refresh the access token using the stored refresh token.
   *
   * Note: In browser mode, token refresh is handled automatically before API calls.
   * This method is useful for:
   * - Proactively refreshing tokens before they expire
   * - Server-side applications managing their own token lifecycle
   *
   * @returns Promise resolving to TokenRefreshResult with new tokens
   * @throws PlayKitError if no refresh token is available or refresh fails
   *
   * @example
   * ```ts
   * // Manual refresh before a long operation
   * if (sdk.isTokenExpired() && sdk.canRefreshToken()) {
   *   const result = await sdk.refreshToken();
   *   console.log('Token refreshed, expires in:', result.expiresIn, 'seconds');
   * }
   * ```
   */
  async refreshToken(): Promise<TokenRefreshResult> {
    return this.authManager.refreshToken();
  }
}

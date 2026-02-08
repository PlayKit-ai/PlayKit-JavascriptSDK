/**
 * Authentication manager
 * Handles JWT exchange and token management
 */

import EventEmitter from 'eventemitter3';
import { AuthState, PlayKitError, SDKConfig, TokenRefreshResult } from '../types';
import { TokenStorage } from './TokenStorage';
import { AuthFlowManager } from './AuthFlowManager';
import { DeviceAuthFlowManager, DeviceAuthFlowOptions, DeviceAuthResult, DeviceAuthInitResult, TokenScope } from './DeviceAuthFlowManager';
import { Logger } from '../utils/Logger';

// @ts-ignore - replaced at build time
const DEFAULT_BASE_URL = __PLAYKIT_BASE_URL__;
const JWT_EXCHANGE_ENDPOINT = '/api/external/exchange-jwt';
const TOKEN_REFRESH_ENDPOINT = '/api/auth/refresh';

export class AuthManager extends EventEmitter {
  private storage: TokenStorage;
  private authState: AuthState;
  private config: SDKConfig;
  private baseURL: string;
  private authFlowManager: AuthFlowManager | null = null;
  private deviceAuthFlowManager: DeviceAuthFlowManager | null = null;
  private logger = Logger.getLogger('AuthManager');
  /** Shared promise for current device auth flow - allows multiple callers to await the same result */
  private currentDeviceAuthFlowPromise: Promise<DeviceAuthResult> | null = null;
  /** Shared promise for current auth flow (startAuthFlow) - allows multiple callers to await the same result */
  private currentAuthFlowPromise: Promise<void> | null = null;

  constructor(config: SDKConfig) {
    super();
    this.config = config;
    // Create TokenStorage with appropriate mode for server vs browser environment
    this.storage = new TokenStorage({
      mode: config.mode === 'server' ? 'server' : 'browser',
    });
    this.baseURL = config.baseURL || DEFAULT_BASE_URL;
    this.authState = {
      isAuthenticated: false,
    };
  }

  /**
   * Initialize authentication
   */
  async initialize(): Promise<void> {
    await this.storage.initialize();

    // Check for developer token (development mode)
    if (this.config.developerToken) {
      this.authState = {
        isAuthenticated: true,
        token: this.config.developerToken,
        tokenType: 'developer',
      };
      this.emit('authenticated', this.authState);
      return;
    }

    // Check if player token was provided directly (useful for server-side usage)
    if (this.config.playerToken) {
      this.authState = {
        isAuthenticated: true,
        token: this.config.playerToken,
        tokenType: 'player',
        // No expiration info available when token is provided directly
      };
      this.emit('authenticated', this.authState);
      return;
    }

    // Try to load saved auth state (game-specific)
    const savedState = await this.storage.loadAuthState(this.config.gameId);
    if (savedState && savedState.token) {
      // Check if token is still valid
      if (savedState.expiresAt && Date.now() < savedState.expiresAt) {
        this.authState = savedState;
        this.emit('authenticated', this.authState);
        return;
      }

      // Token expired, but check if we can refresh (browser mode only)
      if (
        this.config.mode !== 'server' &&
        savedState.refreshToken &&
        (!savedState.refreshExpiresAt || Date.now() < savedState.refreshExpiresAt)
      ) {
        this.logger.debug('Access token expired, attempting refresh');
        this.authState = savedState; // Load state with refresh token
        try {
          await this.refreshToken();
          return; // Successfully refreshed
        } catch (error) {
          this.logger.warn('Token refresh failed during initialization', error);
          // Continue to re-authentication
        }
      }
    }

    // Check if player JWT was provided
    if (this.config.playerJWT) {
      await this.exchangeJWT(this.config.playerJWT);
      return;
    }

    // Check for platform-injected token (same-domain scenario)
    // This allows seamless auth when SDK runs in a context where the platform
    // (e.g., Agentland-Space) has already stored a token in localStorage
    if (this.config.autoDetectPlatformToken !== false && typeof window !== 'undefined') {
      const platformToken = this.detectPlatformToken();
      if (platformToken) {
        this.logger.info('Platform token detected, using for authentication');
        this.authState = {
          isAuthenticated: true,
          token: platformToken,
          tokenType: 'player',
        };
        this.emit('authenticated', this.authState);
        return;
      }
    }

    // Not authenticated - trigger auto-login UI
    this.emit('unauthenticated');

    // In server mode, don't try to show UI - just throw error
    if (this.config.mode === 'server') {
      throw new PlayKitError(
        'No authentication token provided. In server mode, please provide developerToken, playerToken, or playerJWT.',
        'NOT_AUTHENTICATED'
      );
    }

    // Auto-start login flow in browser environment
    if (typeof window !== 'undefined') {
      // Default to device auth if not specified
      const authMethod = this.config.authMethod || 'device';
      await this.startAuthFlow(authMethod);
      // If we reach here, authentication was successful
      // If it failed, startAuthFlow() will have thrown an error
    } else {
      // Node.js environment - cannot show UI, must provide token manually
      throw new PlayKitError(
        'No authentication token provided. Please provide developerToken, playerToken, playerJWT, or call login() manually.',
        'NOT_AUTHENTICATED'
      );
    }
  }

  /**
   * Start the authentication flow UI
   *
   * @param authMethod - Authentication method to use ('device' or 'headless')
   * @deprecated 'headless' authentication is deprecated and will be removed in v2.0. Use 'device' instead.
   */
  async startAuthFlow(authMethod: 'device' | 'headless' = 'device'): Promise<void> {
    // If a flow is already in progress, return the shared promise so all callers await the same result
    if (this.currentAuthFlowPromise) {
      this.logger.debug('Auth flow already in progress, waiting for existing flow');
      return this.currentAuthFlowPromise;
    }

    // Store the flow promise so subsequent calls can await the same result
    const flowPromise = this.executeAuthFlow(authMethod);
    this.currentAuthFlowPromise = flowPromise;

    try {
      return await flowPromise;
    } finally {
      this.currentAuthFlowPromise = null;
    }
  }

  /**
   * Internal method that executes the actual auth flow
   * @private
   */
  private async executeAuthFlow(authMethod: 'device' | 'headless' = 'device'): Promise<void> {
    // Deprecation warning for headless auth
    if (authMethod === 'headless') {
      this.logger.warn(
        '"headless" authentication is deprecated and will be removed in v2.0. ' +
        'Please migrate to "device" authentication.'
      );
    }

    try {
      if (authMethod === 'device') {
        // Use Device Authorization flow (recommended)
        this.deviceAuthFlowManager = new DeviceAuthFlowManager(this.baseURL, this.config.gameId);

        const result = await this.deviceAuthFlowManager.startFlow({
          scope: 'player:play',
        });

        // Update auth state with the player token and refresh token
        this.authState = {
          isAuthenticated: true,
          token: result.access_token,
          tokenType: 'player',
          expiresAt: Date.now() + result.expires_in * 1000,
          refreshToken: result.refresh_token,
          refreshExpiresAt: Date.now() + result.refresh_expires_in * 1000,
        };

        // Save to storage
        await this.storage.saveAuthState(this.config.gameId, this.authState);

        this.emit('authenticated', this.authState);

        // Clean up
        this.deviceAuthFlowManager.destroy();
        this.deviceAuthFlowManager = null;
      } else {
        // Use headless verification code flow
        this.authFlowManager = new AuthFlowManager(this.baseURL);

        // Get global token from auth flow
        const globalToken = await this.authFlowManager.startFlow();

        // Exchange for player token
        await this.exchangeJWT(globalToken);

        // Clean up
        this.authFlowManager.destroy();
        this.authFlowManager = null;
      }
    } catch (error) {
      // User canceled or error occurred
      this.authFlowManager?.destroy();
      this.authFlowManager = null;
      this.deviceAuthFlowManager?.destroy();
      this.deviceAuthFlowManager = null;

      // Re-emit error
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Exchange JWT for player token
   */
  async exchangeJWT(jwt: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseURL}${JWT_EXCHANGE_ENDPOINT}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gameId: this.config.gameId }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'JWT exchange failed' }));
        throw new PlayKitError(
          error.message || 'JWT exchange failed',
          error.code,
          response.status
        );
      }

      const data = await response.json();
      const playerToken = data.playerToken || data.token;

      if (!playerToken) {
        throw new PlayKitError('No player token received from server');
      }

      // Calculate expiration (assume 24 hours if not provided)
      const expiresIn = data.expiresIn || 86400;
      const expiresAt = Date.now() + expiresIn * 1000;

      this.authState = {
        isAuthenticated: true,
        token: playerToken,
        tokenType: 'player',
        expiresAt,
      };

      // Save to storage
      await this.storage.saveAuthState(this.config.gameId, this.authState);

      this.emit('authenticated', this.authState);
      return playerToken;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get current authentication token
   */
  getToken(): string | undefined {
    return this.authState.token;
  }

  /**
   * Get current authentication state
   */
  getAuthState(): AuthState {
    return { ...this.authState };
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  /**
   * Check if current authentication is using developerToken
   */
  isDeveloperTokenAuth(): boolean {
    return this.authState.tokenType === 'developer';
  }

  /**
   * Clear developerToken authentication state.
   * Used when falling back to player login after developerToken failure.
   */
  clearDeveloperToken(): void {
    if (this.authState.tokenType === 'developer') {
      this.authState = {
        isAuthenticated: false,
      };
      // Also clear the developerToken from config to prevent re-use
      this.config.developerToken = undefined;
    }
  }

  /**
   * Detect platform-injected token (for same-domain scenarios).
   * Checks localStorage and window object for tokens stored by the platform.
   *
   * @returns Platform token if found, null otherwise
   */
  private detectPlatformToken(): string | null {
    if (typeof window === 'undefined') return null;

    try {
      // Check localStorage with configured key
      const key = this.config.platformTokenKey || 'shared_token';
      const token = localStorage.getItem(key);

      if (token) {
        this.logger.debug(`Platform token found in localStorage[${key}]`);
        return token;
      }

      // Also check window object for injected token
      const windowToken = (window as { __PLAYKIT_PLATFORM_TOKEN__?: string }).__PLAYKIT_PLATFORM_TOKEN__;
      if (windowToken) {
        this.logger.debug('Platform token found in window.__PLAYKIT_PLATFORM_TOKEN__');
        return windowToken;
      }
    } catch (error) {
      this.logger.warn('Error detecting platform token:', error);
    }

    return null;
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(): boolean {
    if (!this.authState.expiresAt) return false;
    return Date.now() >= this.authState.expiresAt;
  }

  /**
   * Check if token is about to expire (within threshold)
   * @param thresholdMs - Threshold in milliseconds (default: 5 minutes)
   */
  isTokenExpiringSoon(thresholdMs: number = 5 * 60 * 1000): boolean {
    if (!this.authState.expiresAt) return false;
    return Date.now() >= this.authState.expiresAt - thresholdMs;
  }

  /**
   * Ensure the access token is valid, refreshing if needed (browser mode only).
   * Call this before making API requests to automatically handle token refresh.
   *
   * In server mode, this method does nothing (tokens should be managed externally).
   *
   * @param thresholdMs - Refresh if token expires within this time (default: 5 minutes)
   * @returns Promise that resolves when token is valid
   * @throws PlayKitError if token cannot be refreshed and is expired
   */
  async ensureValidToken(thresholdMs: number = 5 * 60 * 1000): Promise<void> {
    // Skip auto-refresh in server mode
    if (this.config.mode === 'server') {
      return;
    }

    // Skip if not authenticated
    if (!this.authState.isAuthenticated || !this.authState.token) {
      return;
    }

    // Check if token needs refresh
    if (!this.isTokenExpiringSoon(thresholdMs)) {
      return; // Token is still valid
    }

    // Try to refresh if possible
    if (this.canRefresh()) {
      this.logger.debug('Token expiring soon, refreshing automatically');
      try {
        await this.refreshToken();
      } catch (error) {
        this.logger.warn('Auto-refresh failed', error);
        // If refresh fails and token is already expired, throw
        if (this.isTokenExpired()) {
          throw error;
        }
        // Otherwise, continue with potentially expired token
      }
    } else if (this.isTokenExpired()) {
      // Token expired and cannot refresh
      throw new PlayKitError(
        'Access token has expired and no refresh token is available',
        'TOKEN_EXPIRED'
      );
    }
  }

  /**
   * Logout and clear authentication
   */
  async logout(): Promise<void> {
    this.authState = {
      isAuthenticated: false,
    };
    this.storage.clearAuthState(this.config.gameId);
    this.emit('unauthenticated');
  }

  /**
   * Clear all stored data
   */
  clearAll(): void {
    this.storage.clearAll();
  }

  /**
   * Start the Device Authorization Flow
   * Best for desktop apps, CLI tools, Unity Editor, or environments without browser popups
   *
   * @param options - Device auth flow options
   * @returns Promise resolving to DeviceAuthResult with tokens
   *
   * @example
   * ```ts
   * const result = await authManager.startDeviceAuthFlow({
   *   scope: 'player:play',
   *   onAuthUrl: (url) => console.log('Please open:', url),
   *   onPollStatus: (status) => console.log('Status:', status),
   * });
   * console.log('Access token:', result.access_token);
   * ```
   */
  async startDeviceAuthFlow(options: DeviceAuthFlowOptions = {}): Promise<DeviceAuthResult> {
    // If a flow is already in progress, return the shared promise so all callers get the same result
    if (this.currentDeviceAuthFlowPromise) {
      this.logger.debug('Device auth flow already in progress, waiting for existing flow');
      return this.currentDeviceAuthFlowPromise;
    }

    // Store the flow promise so subsequent calls can await the same result
    const flowPromise = this.executeDeviceAuthFlow(options);
    this.currentDeviceAuthFlowPromise = flowPromise;

    try {
      return await flowPromise;
    } finally {
      this.currentDeviceAuthFlowPromise = null;
    }
  }

  /**
   * Internal method that executes the actual device auth flow
   * @private
   */
  private async executeDeviceAuthFlow(options: DeviceAuthFlowOptions = {}): Promise<DeviceAuthResult> {
    try {
      this.deviceAuthFlowManager = new DeviceAuthFlowManager(this.baseURL, this.config.gameId);

      const result = await this.deviceAuthFlowManager.startFlow(options);

      // Update auth state with the token and refresh token
      this.authState = {
        isAuthenticated: true,
        token: result.access_token,
        tokenType: result.scope === 'developer:full' ? 'developer' : 'player',
        expiresAt: Date.now() + result.expires_in * 1000,
        refreshToken: result.refresh_token,
        refreshExpiresAt: Date.now() + result.refresh_expires_in * 1000,
      };

      // Save to storage
      await this.storage.saveAuthState(this.config.gameId, this.authState);

      this.emit('authenticated', this.authState);

      return result;
    } finally {
      // Clean up
      this.deviceAuthFlowManager?.destroy();
      this.deviceAuthFlowManager = null;
    }
  }

  /**
   * Cancel ongoing device auth flow
   */
  cancelDeviceAuthFlow(): void {
    if (this.deviceAuthFlowManager) {
      this.deviceAuthFlowManager.cancel();
    }
  }

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
   * const { authUrl, sessionId, codeVerifier } = await authManager.initiateDeviceAuth();
   * console.log('Please visit:', authUrl);
   * // Or generate QR code from authUrl
   *
   * // Then poll for completion
   * const result = await authManager.pollDeviceAuth(sessionId, codeVerifier);
   * console.log('Access token:', result.access_token);
   * ```
   */
  async initiateDeviceAuth(scope: TokenScope = 'player:play'): Promise<DeviceAuthInitResult> {
    // If there's an existing manager, clean it up first (allows restarting flow)
    if (this.deviceAuthFlowManager) {
      this.logger.debug('Cleaning up existing device auth manager before initiating new flow');
      this.deviceAuthFlowManager.destroy();
    }
    this.deviceAuthFlowManager = new DeviceAuthFlowManager(this.baseURL, this.config.gameId);
    return this.deviceAuthFlowManager.initiateAuth(scope);
  }

  /**
   * Check if an authentication flow is currently in progress
   */
  isAuthFlowInProgress(): boolean {
    return !!(this.authFlowManager || this.deviceAuthFlowManager);
  }

  /**
   * Poll for authorization token after initiateDeviceAuth().
   * On success, automatically updates auth state and saves to storage.
   *
   * @param sessionId - Session ID from initiateDeviceAuth()
   * @param codeVerifier - Code verifier from initiateDeviceAuth()
   * @param options - Optional callbacks for status updates
   * @returns Promise resolving to DeviceAuthResult with tokens
   */
  async pollDeviceAuth(
    sessionId: string,
    codeVerifier: string,
    options: {
      onStatus?: (status: 'pending' | 'slow_down' | 'authorized' | 'denied' | 'expired') => void;
      timeoutMs?: number;
      pollIntervalMs?: number;
    } = {}
  ): Promise<DeviceAuthResult> {
    if (!this.deviceAuthFlowManager) {
      this.deviceAuthFlowManager = new DeviceAuthFlowManager(this.baseURL, this.config.gameId);
    }

    try {
      const result = await this.deviceAuthFlowManager.pollForToken(sessionId, codeVerifier, options);

      // Update auth state with the token and refresh token
      this.authState = {
        isAuthenticated: true,
        token: result.access_token,
        tokenType: result.scope === 'developer:full' ? 'developer' : 'player',
        expiresAt: Date.now() + result.expires_in * 1000,
        refreshToken: result.refresh_token,
        refreshExpiresAt: Date.now() + result.refresh_expires_in * 1000,
      };

      // Save to storage
      await this.storage.saveAuthState(this.config.gameId, this.authState);

      this.emit('authenticated', this.authState);

      return result;
    } finally {
      // Clean up
      this.deviceAuthFlowManager?.destroy();
      this.deviceAuthFlowManager = null;
    }
  }

  /**
   * Check if the current session can be refreshed
   * @returns true if a valid refresh token exists and has not expired
   */
  canRefresh(): boolean {
    if (!this.authState.refreshToken) return false;
    if (!this.authState.refreshExpiresAt) return true; // No expiry info, assume valid
    return Date.now() < this.authState.refreshExpiresAt;
  }

  /**
   * Refresh the access token using the stored refresh token
   *
   * @returns Promise resolving to TokenRefreshResult with new tokens
   * @throws PlayKitError if no refresh token is available or refresh fails
   *
   * @example
   * ```ts
   * if (sdk.isTokenExpired() && authManager.canRefresh()) {
   *   const result = await authManager.refreshToken();
   *   console.log('New token expires in:', result.expiresIn, 'seconds');
   * }
   * ```
   */
  async refreshToken(): Promise<TokenRefreshResult> {
    if (!this.authState.refreshToken) {
      throw new PlayKitError(
        'No refresh token available. Please re-authenticate.',
        'NO_REFRESH_TOKEN'
      );
    }

    if (this.authState.refreshExpiresAt && Date.now() >= this.authState.refreshExpiresAt) {
      throw new PlayKitError(
        'Refresh token has expired. Please re-authenticate.',
        'REFRESH_TOKEN_EXPIRED'
      );
    }

    try {
      this.logger.debug('Refreshing access token');

      const response = await fetch(`${this.baseURL}${TOKEN_REFRESH_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: this.authState.refreshToken,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error_description: 'Token refresh failed' }));

        // If refresh token is invalid, clear auth state
        if (response.status === 401) {
          this.logger.warn('Refresh token invalid, clearing auth state');
          await this.logout();
          throw new PlayKitError(
            error.error_description || 'Refresh token is invalid or expired',
            'REFRESH_TOKEN_INVALID',
            response.status
          );
        }

        throw new PlayKitError(
          error.error_description || 'Token refresh failed',
          error.error || 'REFRESH_FAILED',
          response.status
        );
      }

      const data = await response.json();

      // Update auth state with new tokens
      this.authState = {
        isAuthenticated: true,
        token: data.access_token,
        tokenType: data.scope === 'developer:full' ? 'developer' : 'player',
        expiresAt: Date.now() + data.expires_in * 1000,
        refreshToken: data.refresh_token,
        refreshExpiresAt: Date.now() + data.refresh_expires_in * 1000,
      };

      // Save to storage
      await this.storage.saveAuthState(this.config.gameId, this.authState);

      this.logger.info('Access token refreshed successfully');
      this.emit('authenticated', this.authState);
      this.emit('token_refreshed', this.authState);

      return {
        accessToken: data.access_token,
        tokenType: data.token_type,
        expiresIn: data.expires_in,
        refreshToken: data.refresh_token,
        refreshExpiresIn: data.refresh_expires_in,
        scope: data.scope,
      };
    } catch (error) {
      if (error instanceof PlayKitError) {
        throw error;
      }
      this.logger.error('Token refresh failed', error);
      throw new PlayKitError(
        'Token refresh failed due to network error',
        'REFRESH_NETWORK_ERROR'
      );
    }
  }
}

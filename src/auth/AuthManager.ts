/**
 * Authentication manager
 * Handles JWT exchange and token management
 */

import EventEmitter from 'eventemitter3';
import { AuthState, PlayKitError, SDKConfig } from '../types';
import { TokenStorage } from './TokenStorage';
import { AuthFlowManager } from './AuthFlowManager';
import { DeviceAuthFlowManager, DeviceAuthFlowOptions, DeviceAuthResult } from './DeviceAuthFlowManager';

// @ts-ignore - replaced at build time
const DEFAULT_BASE_URL = __PLAYKIT_BASE_URL__;
const JWT_EXCHANGE_ENDPOINT = '/api/external/exchange-jwt';

export class AuthManager extends EventEmitter {
  private storage: TokenStorage;
  private authState: AuthState;
  private config: SDKConfig;
  private baseURL: string;
  private authFlowManager: AuthFlowManager | null = null;
  private deviceAuthFlowManager: DeviceAuthFlowManager | null = null;

  constructor(config: SDKConfig) {
    super();
    this.config = config;
    this.storage = new TokenStorage();
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

    // Try to load saved auth state (game-specific)
    const savedState = await this.storage.loadAuthState(this.config.gameId);
    if (savedState && savedState.token) {
      // Check if token is still valid
      if (savedState.expiresAt && Date.now() < savedState.expiresAt) {
        this.authState = savedState;
        this.emit('authenticated', this.authState);
        return;
      }
    }

    // Check if player JWT was provided
    if (this.config.playerJWT) {
      await this.exchangeJWT(this.config.playerJWT);
      return;
    }

    // Not authenticated - trigger auto-login UI
    this.emit('unauthenticated');

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
        'No authentication token provided. Please provide developerToken, playerJWT, or call login() manually.',
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
    if (this.authFlowManager || this.deviceAuthFlowManager) {
      // Already in progress
      return;
    }

    // Deprecation warning for headless auth
    if (authMethod === 'headless') {
      console.warn(
        '[PlayKit] "headless" authentication is deprecated and will be removed in v2.0. ' +
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

        // Update auth state with the player token
        this.authState = {
          isAuthenticated: true,
          token: result.access_token,
          tokenType: 'player',
          expiresAt: Date.now() + result.expires_in * 1000,
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
   * Check if token is expired
   */
  isTokenExpired(): boolean {
    if (!this.authState.expiresAt) return false;
    return Date.now() >= this.authState.expiresAt;
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
    if (this.deviceAuthFlowManager) {
      throw new PlayKitError('Device auth flow already in progress', 'FLOW_IN_PROGRESS');
    }

    try {
      this.deviceAuthFlowManager = new DeviceAuthFlowManager(this.baseURL, this.config.gameId);

      const result = await this.deviceAuthFlowManager.startFlow(options);

      // Update auth state with the token
      this.authState = {
        isAuthenticated: true,
        token: result.access_token,
        tokenType: result.scope === 'developer:full' ? 'developer' : 'player',
        expiresAt: Date.now() + result.expires_in * 1000,
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
}

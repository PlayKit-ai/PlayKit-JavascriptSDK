/**
 * Authentication manager
 * Handles JWT exchange and token management
 */

import EventEmitter from 'eventemitter3';
import { AuthState, PlayKitError, SDKConfig } from '../types';
import { TokenStorage } from './TokenStorage';

const DEFAULT_BASE_URL = 'https://playkit.agentlandlab.com';
const JWT_EXCHANGE_ENDPOINT = '/api/external/exchange-jwt';

export class AuthManager extends EventEmitter {
  private storage: TokenStorage;
  private authState: AuthState;
  private config: SDKConfig;
  private baseURL: string;

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

    // Try to load saved auth state
    const savedState = await this.storage.loadAuthState(this.config.gameId);
    if (savedState && savedState.token) {
      // Check if token is still valid
      if (savedState.expiresAt && Date.now() < savedState.expiresAt) {
        this.authState = savedState;
        this.emit('authenticated', this.authState);
        return;
      }
    }

    // Try to load shared token
    const sharedToken = await this.storage.loadSharedToken();
    if (sharedToken) {
      this.authState = {
        isAuthenticated: true,
        token: sharedToken,
        tokenType: 'player',
      };
      await this.storage.saveAuthState(this.config.gameId, this.authState);
      this.emit('authenticated', this.authState);
      return;
    }

    // Check if player JWT was provided
    if (this.config.playerJWT) {
      await this.exchangeJWT(this.config.playerJWT);
      return;
    }

    // Not authenticated
    this.emit('unauthenticated');
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
      await this.storage.saveSharedToken(playerToken);

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
}

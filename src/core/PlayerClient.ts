/**
 * Player client for managing player information and credits
 */

import EventEmitter from 'eventemitter3';
import { PlayerInfo, PlayKitError, SDKConfig } from '../types';
import { AuthManager } from '../auth/AuthManager';

const DEFAULT_BASE_URL = 'https://playkit.agentlandlab.com';
const PLAYER_INFO_ENDPOINT = '/api/external/player-info';

export class PlayerClient extends EventEmitter {
  private authManager: AuthManager;
  private baseURL: string;
  private playerInfo: PlayerInfo | null = null;

  constructor(authManager: AuthManager, config: SDKConfig) {
    super();
    this.authManager = authManager;
    this.baseURL = config.baseURL || DEFAULT_BASE_URL;
  }

  /**
   * Get player information
   */
  async getPlayerInfo(): Promise<PlayerInfo> {
    const token = this.authManager.getToken();
    if (!token) {
      throw new PlayKitError('Not authenticated', 'NOT_AUTHENTICATED');
    }

    // If using developer token, return mock player info
    const authState = this.authManager.getAuthState();
    if (authState.tokenType === 'developer') {
      return {
        userId: 'developer',
        credits: 999999,
      };
    }

    try {
      const response = await fetch(`${this.baseURL}${PLAYER_INFO_ENDPOINT}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to get player info' }));
        throw new PlayKitError(
          error.message || 'Failed to get player info',
          error.code,
          response.status
        );
      }

      const data = await response.json();
      this.playerInfo = {
        userId: data.userId,
        credits: data.credits,
      };

      this.emit('player_info_updated', this.playerInfo);
      return this.playerInfo;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get cached player info (without API call)
   */
  getCachedPlayerInfo(): PlayerInfo | null {
    return this.playerInfo;
  }

  /**
   * Refresh player info
   */
  async refreshPlayerInfo(): Promise<PlayerInfo> {
    return this.getPlayerInfo();
  }
}

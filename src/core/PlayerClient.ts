/**
 * Player client for managing player information and credits
 */

import EventEmitter from 'eventemitter3';
import { PlayerInfo, PlayKitError, SDKConfig, SetNicknameResponse } from '../types';
import { AuthManager } from '../auth/AuthManager';
import { RechargeManager } from '../recharge/RechargeManager';
import { RechargeConfig } from '../types/recharge';

const DEFAULT_BASE_URL = 'https://playkit.agentlandlab.com';
const PLAYER_INFO_ENDPOINT = '/api/external/player-info';
const SET_NICKNAME_ENDPOINT = '/api/external/set-game-player-nickname';

export class PlayerClient extends EventEmitter {
  private authManager: AuthManager;
  private baseURL: string;
  private playerInfo: PlayerInfo | null = null;
  private rechargeManager: RechargeManager | null = null;
  private balanceCheckInterval: NodeJS.Timeout | null = null;
  private rechargeConfig: RechargeConfig;

  constructor(authManager: AuthManager, config: SDKConfig, rechargeConfig: RechargeConfig = {}) {
    super();
    this.authManager = authManager;
    this.baseURL = config.baseURL || DEFAULT_BASE_URL;
    this.rechargeConfig = {
      autoShowBalanceModal: rechargeConfig.autoShowBalanceModal ?? true,
      balanceCheckInterval: rechargeConfig.balanceCheckInterval ?? 30000,
      checkBalanceAfterApiCall: rechargeConfig.checkBalanceAfterApiCall ?? true,
      rechargePortalUrl: rechargeConfig.rechargePortalUrl || 'https://playkit.agentlandlab.com/playerPortal/recharge',
    };
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

        // Handle authentication errors (401/403) - token is invalid or expired
        if (response.status === 401 || response.status === 403) {
          // Logout and emit event to trigger re-authentication
          await this.authManager.logout();
          this.emit('auth_error', {
            message: 'Token validation failed. Please login again.',
            status: response.status,
          });
          throw new PlayKitError(
            'Authentication failed. Please login again.',
            'AUTH_FAILED',
            response.status
          );
        }

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
        nickname: data.nickname ?? null,
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

  /**
   * Get player's nickname
   * Returns the cached nickname from playerInfo, or null if not set
   */
  getNickname(): string | null {
    return this.playerInfo?.nickname ?? null;
  }

  /**
   * Set player's nickname for the current game
   * Requires a game-specific player token (not a global token or developer token)
   * @param nickname - Nickname to set (1-16 characters, letters/numbers/Chinese/underscores/spaces only)
   * @returns The set nickname response
   * @throws PlayKitError if nickname is invalid, moderation fails, or token type is wrong
   */
  async setNickname(nickname: string): Promise<SetNicknameResponse> {
    const token = this.authManager.getToken();
    if (!token) {
      throw new PlayKitError('Not authenticated', 'NOT_AUTHENTICATED');
    }

    // Developer tokens cannot set nicknames
    const authState = this.authManager.getAuthState();
    if (authState.tokenType === 'developer') {
      throw new PlayKitError(
        'Developer tokens cannot set nicknames. Use a player token.',
        'INVALID_TOKEN_TYPE'
      );
    }

    // Validate nickname locally first
    if (!nickname || typeof nickname !== 'string') {
      throw new PlayKitError('Nickname is required', 'NICKNAME_REQUIRED');
    }

    const trimmed = nickname.trim();
    if (trimmed.length === 0) {
      throw new PlayKitError('Nickname cannot be empty', 'INVALID_NICKNAME');
    }

    if (trimmed.length > 16) {
      throw new PlayKitError('Nickname must be 16 characters or less', 'INVALID_NICKNAME');
    }

    try {
      const response = await fetch(`${this.baseURL}${SET_NICKNAME_ENDPOINT}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nickname: trimmed }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Failed to set nickname' } }));
        const errorObj = error.error || error;

        throw new PlayKitError(
          errorObj.message || 'Failed to set nickname',
          errorObj.code,
          response.status
        );
      }

      const data: SetNicknameResponse = await response.json();

      // Update cached player info with new nickname
      if (this.playerInfo) {
        this.playerInfo.nickname = data.nickname;
        this.emit('player_info_updated', this.playerInfo);
      }

      this.emit('nickname_changed', data.nickname);
      return data;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Initialize recharge manager
   */
  private initializeRechargeManager(): void {
    const token = this.authManager.getToken();
    if (token && !this.rechargeManager) {
      this.rechargeManager = new RechargeManager(token, this.rechargeConfig.rechargePortalUrl);

      // Forward recharge events
      this.rechargeManager.on('recharge_opened', () => this.emit('recharge_opened'));
      this.rechargeManager.on('recharge_modal_shown', () => this.emit('recharge_modal_shown'));
      this.rechargeManager.on('recharge_modal_dismissed', () => this.emit('recharge_modal_dismissed'));
    }
  }

  /**
   * Show insufficient balance modal
   */
  async showInsufficientBalanceModal(customMessage?: string): Promise<void> {
    this.initializeRechargeManager();

    if (!this.rechargeManager) {
      console.warn('RechargeManager not initialized. Cannot show modal.');
      return;
    }

    const balance = this.playerInfo?.credits;
    await this.rechargeManager.showInsufficientBalanceModal({
      currentBalance: balance,
      message: customMessage,
    });
  }

  /**
   * Open recharge window in new tab
   */
  openRechargeWindow(): void {
    this.initializeRechargeManager();

    if (!this.rechargeManager) {
      console.warn('RechargeManager not initialized. Cannot open recharge window.');
      return;
    }

    this.rechargeManager.openRechargeWindow();
  }

  /**
   * Enable automatic periodic balance checking
   */
  enableAutoBalanceCheck(intervalMs?: number): void {
    const interval = intervalMs ?? this.rechargeConfig.balanceCheckInterval ?? 30000;

    // Don't enable if interval is 0 or negative
    if (interval <= 0) {
      return;
    }

    // Clear existing interval if any
    this.disableAutoBalanceCheck();

    // Start periodic balance check
    this.balanceCheckInterval = setInterval(async () => {
      try {
        const oldBalance = this.playerInfo?.credits;
        await this.refreshPlayerInfo();
        const newBalance = this.playerInfo?.credits;

        // Emit balance_updated event
        if (newBalance !== undefined) {
          this.emit('balance_updated', newBalance);

          // Check for low balance (less than 10 credits)
          if (newBalance < 10 && newBalance !== oldBalance) {
            this.emit('balance_low', newBalance);
          }
        }
      } catch (error) {
        // Silently fail periodic checks to avoid spamming errors
        console.debug('Failed to check balance:', error);
      }
    }, interval);
  }

  /**
   * Disable automatic balance checking
   */
  disableAutoBalanceCheck(): void {
    if (this.balanceCheckInterval) {
      clearInterval(this.balanceCheckInterval);
      this.balanceCheckInterval = null;
    }
  }

  /**
   * Check balance after API call (called internally by providers)
   */
  async checkBalanceAfterApiCall(): Promise<void> {
    if (!this.rechargeConfig.checkBalanceAfterApiCall) {
      return;
    }

    try {
      await this.refreshPlayerInfo();
    } catch (error) {
      // Silently fail to avoid disrupting the main flow
      console.debug('Failed to check balance after API call:', error);
    }
  }

  /**
   * Handle insufficient credits error (called by providers)
   */
  async handleInsufficientCredits(error: Error): Promise<void> {
    this.emit('insufficient_credits', error);

    // Auto-show modal if enabled
    if (this.rechargeConfig.autoShowBalanceModal) {
      await this.showInsufficientBalanceModal();
    }
  }

  /**
   * Get recharge manager instance
   */
  getRechargeManager(): RechargeManager | null {
    this.initializeRechargeManager();
    return this.rechargeManager;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.disableAutoBalanceCheck();
    if (this.rechargeManager) {
      this.rechargeManager.destroy();
      this.rechargeManager = null;
    }
    this.removeAllListeners();
  }
}

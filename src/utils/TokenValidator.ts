/**
 * Token validation utility for server-side usage
 * Validates PlayKit player tokens and retrieves user information
 */

import { PlayKitError } from '../types';
import { getSDKHeaders } from './sdkHeaders';

// @ts-ignore - replaced at build time
const DEFAULT_BASE_URL = __PLAYKIT_BASE_URL__;

/**
 * Player information returned from token validation
 */
export interface ValidatedPlayerInfo {
  userId: string;
  nickname: string | null;
  tokenType: 'player' | 'developer' | 'jwt';
  tokenId: string | null;
  balance: number;
  credits?: number;
  rechargeMethod?: 'browser' | 'steam' | 'ios' | 'android';
  channelType?: string;
  dailyRefresh?: {
    refreshed: boolean;
    message: string;
    balanceBefore?: number;
    balanceAfter?: number;
    amountAdded?: number;
  };
}

/**
 * Lightweight token verification result
 */
export interface TokenVerificationResult {
  valid: boolean;
  userId: string;
  tokenType: 'player' | 'developer' | 'jwt';
  gameId: string | null;
  expiresAt: string | null;
}

/**
 * Token validation options
 */
export interface TokenValidatorOptions {
  /** Base URL for PlayKit API (defaults to production) */
  baseURL?: string;
}

/**
 * TokenValidator - Utility class for validating PlayKit tokens
 *
 * Use this in your backend to validate player tokens received from clients.
 *
 * @example
 * ```typescript
 * import { TokenValidator } from 'playkit-sdk';
 *
 * const validator = new TokenValidator();
 *
 * // Express middleware
 * async function authMiddleware(req, res, next) {
 *   const token = req.headers.authorization?.substring(7);
 *   try {
 *     req.user = await validator.validateToken(token, 'your-game-id');
 *     next();
 *   } catch (error) {
 *     res.status(401).json({ error: error.message });
 *   }
 * }
 * ```
 */
export class TokenValidator {
  private baseURL: string;

  constructor(options?: TokenValidatorOptions) {
    this.baseURL = options?.baseURL || DEFAULT_BASE_URL;
  }

  /**
   * Validate a player token and get full user information
   *
   * This calls /api/external/player-info which also triggers daily credits refresh.
   * Use verifyToken() for lightweight validation without side effects.
   *
   * @param token - The player token to validate
   * @param gameId - Optional game ID (required for global tokens)
   * @returns Player information if valid
   * @throws PlayKitError if token is invalid
   */
  async validateToken(token: string, gameId?: string): Promise<ValidatedPlayerInfo> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      ...getSDKHeaders(),
    };

    if (gameId) {
      headers['X-Game-Id'] = gameId;
    }

    const response = await fetch(
      `${this.baseURL}/api/external/player-info`,
      {
        method: 'GET',
        headers,
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Token validation failed' } }));
      throw new PlayKitError(
        error.error?.message || 'Token validation failed',
        error.error?.code || 'AUTH_INVALID_TOKEN',
        response.status
      );
    }

    return await response.json();
  }

  /**
   * Lightweight token verification (requires server-side /api/external/verify-token endpoint)
   *
   * This is a faster alternative to validateToken() that only checks if the token
   * is valid without triggering side effects like daily credits refresh.
   *
   * Note: This endpoint may not be available on all PlayKit server versions.
   * Falls back to validateToken() if the endpoint is not available.
   *
   * @param token - The player token to verify
   * @param gameId - Optional game ID
   * @returns Verification result
   * @throws PlayKitError if token is invalid
   */
  async verifyToken(token: string, gameId?: string): Promise<TokenVerificationResult> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      ...getSDKHeaders(),
    };

    if (gameId) {
      headers['X-Game-Id'] = gameId;
    }

    try {
      const response = await fetch(
        `${this.baseURL}/api/external/verify-token`,
        {
          method: 'GET',
          headers,
        }
      );

      if (response.status === 404) {
        // Endpoint not available, fall back to validateToken
        const playerInfo = await this.validateToken(token, gameId);
        return {
          valid: true,
          userId: playerInfo.userId,
          tokenType: playerInfo.tokenType,
          gameId: gameId || null,
          expiresAt: null,
        };
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Token verification failed' } }));
        throw new PlayKitError(
          error.error?.message || 'Token verification failed',
          error.error?.code || 'AUTH_INVALID_TOKEN',
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof PlayKitError) {
        throw error;
      }
      // Network or other error, try fallback
      const playerInfo = await this.validateToken(token, gameId);
      return {
        valid: true,
        userId: playerInfo.userId,
        tokenType: playerInfo.tokenType,
        gameId: gameId || null,
        expiresAt: null,
      };
    }
  }

  /**
   * Check if a token has sufficient balance for an operation
   *
   * @param token - The player token
   * @param requiredBalance - Minimum balance required
   * @param gameId - Optional game ID
   * @returns Object with balance info and whether it's sufficient
   */
  async checkBalance(
    token: string,
    requiredBalance: number,
    gameId?: string
  ): Promise<{ balance: number; sufficient: boolean; userId: string }> {
    const playerInfo = await this.validateToken(token, gameId);
    return {
      balance: playerInfo.balance,
      sufficient: playerInfo.balance >= requiredBalance,
      userId: playerInfo.userId,
    };
  }
}

/**
 * Default TokenValidator instance
 */
export const defaultTokenValidator = new TokenValidator();

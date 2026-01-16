/**
 * Device Authorization Flow Manager
 * Manages Device Auth polling flow for desktop/CLI/Unity applications
 *
 * Flow:
 * 1. Call /api/device-auth/initiate to get session_id and auth_url
 * 2. Open browser to auth_url for user to authorize
 * 3. Poll /api/device-auth/poll until authorized or error
 * 4. Return access token and refresh token
 */

import EventEmitter from 'eventemitter3';
import { PlayKitError } from '../types';

export type TokenScope = 'player:play' | 'developer:full';

export interface DeviceAuthResult {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  scope: TokenScope;
}

export interface DeviceAuthFlowOptions {
  /** Requested scope (default: 'player:play') */
  scope?: TokenScope;
  /** Custom browser opener function (for non-browser environments) */
  openBrowser?: (url: string) => void | Promise<void>;
  /** Callback when auth URL is ready (useful for showing URL to user) */
  onAuthUrl?: (url: string) => void;
  /** Callback for poll status updates */
  onPollStatus?: (status: string) => void;
}

export class DeviceAuthFlowManager extends EventEmitter {
  private baseURL: string;
  private gameId: string;
  private pollInterval: number = 5000; // Default 5 seconds
  private pollTimeoutId: NodeJS.Timeout | null = null;
  private aborted: boolean = false;

  constructor(baseURL: string, gameId: string) {
    super();
    this.baseURL = baseURL;
    this.gameId = gameId;
  }

  /**
   * Generate a random string for PKCE code verifier
   * @private
   */
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64URLEncode(array);
  }

  /**
   * Generate PKCE code challenge from verifier
   * @private
   */
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return this.base64URLEncode(new Uint8Array(hash));
  }

  /**
   * Base64 URL encode
   * @private
   */
  private base64URLEncode(buffer: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...buffer));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Default browser opener (works in browser environment)
   * @private
   */
  private defaultOpenBrowser(url: string): void {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    } else {
      // In Node.js, we can't open browser by default
      console.log('Please open this URL in your browser:', url);
    }
  }

  /**
   * Start the Device Authorization flow
   *
   * @param options - Flow options
   * @returns Promise resolving to DeviceAuthResult with tokens
   */
  async startFlow(options: DeviceAuthFlowOptions = {}): Promise<DeviceAuthResult> {
    this.aborted = false;
    const scope = options.scope || 'player:play';
    const openBrowser = options.openBrowser || this.defaultOpenBrowser.bind(this);

    // Generate PKCE parameters
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Step 1: Initiate device auth session
    const initResponse = await fetch(`${this.baseURL}/api/device-auth/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        game_id: this.gameId,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        scope,
      }),
    });

    if (!initResponse.ok) {
      const error = await initResponse.json().catch(() => ({ error_description: 'Failed to initiate device auth' }));
      throw new PlayKitError(
        error.error_description || 'Failed to initiate device auth',
        error.error || 'INIT_FAILED',
        initResponse.status
      );
    }

    const initData = await initResponse.json();
    const { session_id, auth_url, poll_interval, expires_in } = initData;

    // Update poll interval from server
    if (poll_interval) {
      this.pollInterval = poll_interval * 1000;
    }

    // Notify auth URL is ready
    if (options.onAuthUrl) {
      options.onAuthUrl(auth_url);
    }
    this.emit('auth_url', auth_url);

    // Step 2: Open browser for user authorization
    await openBrowser(auth_url);

    // Step 3: Poll for authorization
    const expiresAt = Date.now() + (expires_in || 600) * 1000;

    return new Promise<DeviceAuthResult>((resolve, reject) => {
      const poll = async () => {
        if (this.aborted) {
          reject(new PlayKitError('Device auth flow was cancelled', 'CANCELLED'));
          return;
        }

        // Check if session expired
        if (Date.now() >= expiresAt) {
          reject(new PlayKitError('Device auth session expired', 'EXPIRED'));
          return;
        }

        try {
          const pollResponse = await fetch(
            `${this.baseURL}/api/device-auth/poll?session_id=${encodeURIComponent(session_id)}&code_verifier=${encodeURIComponent(codeVerifier)}`
          );

          const pollData = await pollResponse.json();

          if (pollResponse.ok) {
            if (pollData.status === 'pending') {
              // Still waiting, continue polling
              if (options.onPollStatus) {
                options.onPollStatus('pending');
              }
              this.emit('poll_status', 'pending');

              // Update poll interval if server provides new value
              if (pollData.poll_interval) {
                this.pollInterval = pollData.poll_interval * 1000;
              }

              this.pollTimeoutId = setTimeout(poll, this.pollInterval);
            } else if (pollData.status === 'authorized') {
              // Success!
              if (options.onPollStatus) {
                options.onPollStatus('authorized');
              }
              this.emit('poll_status', 'authorized');
              this.emit('authenticated', pollData);

              resolve({
                access_token: pollData.access_token,
                token_type: pollData.token_type,
                expires_in: pollData.expires_in,
                refresh_token: pollData.refresh_token,
                refresh_expires_in: pollData.refresh_expires_in,
                scope: pollData.scope,
              });
            }
          } else {
            // Handle error responses
            const error = pollData.error;

            if (error === 'slow_down') {
              // Server wants us to slow down
              if (options.onPollStatus) {
                options.onPollStatus('slow_down');
              }
              this.emit('poll_status', 'slow_down');
              this.pollInterval = Math.min(this.pollInterval * 2, 30000); // Double interval, max 30s
              this.pollTimeoutId = setTimeout(poll, this.pollInterval);
            } else if (error === 'access_denied') {
              if (options.onPollStatus) {
                options.onPollStatus('denied');
              }
              this.emit('poll_status', 'denied');
              reject(new PlayKitError(
                pollData.error_description || 'User denied authorization',
                'ACCESS_DENIED'
              ));
            } else if (error === 'expired_token') {
              if (options.onPollStatus) {
                options.onPollStatus('expired');
              }
              this.emit('poll_status', 'expired');
              reject(new PlayKitError(
                pollData.error_description || 'Session expired',
                'EXPIRED'
              ));
            } else {
              reject(new PlayKitError(
                pollData.error_description || 'Device auth failed',
                error || 'POLL_FAILED',
                pollResponse.status
              ));
            }
          }
        } catch (err) {
          // Network error, retry after interval
          console.warn('[DeviceAuth] Poll network error, retrying...', err);
          this.pollTimeoutId = setTimeout(poll, this.pollInterval);
        }
      };

      // Start polling
      poll();
    });
  }

  /**
   * Cancel the ongoing device auth flow
   */
  cancel(): void {
    this.aborted = true;
    if (this.pollTimeoutId) {
      clearTimeout(this.pollTimeoutId);
      this.pollTimeoutId = null;
    }
    this.emit('cancelled');
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.cancel();
    this.removeAllListeners();
  }
}

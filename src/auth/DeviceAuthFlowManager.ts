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
import { Logger } from '../utils/Logger';
import { getRandomBytes, sha256, base64URLEncode } from '../utils/CryptoUtils';

export type TokenScope = 'player:play' | 'developer:full';

/** Game info returned from initiate API */
export interface GameInfo {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
}

/** I18n translations for login modal */
interface I18nTranslations {
  loginToPlay: string;
  loginWithPlayKit: string;
  loginInNewWindow: string;
  cancel: string;
  close: string;
  loginDenied: string;
  loginDeniedDesc: string;
  sessionExpired: string;
  sessionExpiredDesc: string;
  loginFailed: string;
  loginFailedDesc: string;
}

const translations: Record<string, I18nTranslations> = {
  en: {
    loginToPlay: 'Login to Play',
    loginWithPlayKit: 'uses PlayKit for secure login',
    loginInNewWindow: 'Please complete login in the opened window',
    cancel: 'Cancel',
    close: 'Close',
    loginDenied: 'Login Denied',
    loginDeniedDesc: 'You have denied the authorization request',
    sessionExpired: 'Session Expired',
    sessionExpiredDesc: 'The login session has timed out. Please try again',
    loginFailed: 'Login Failed',
    loginFailedDesc: 'An error occurred during login. Please try again',
  },
  zh: {
    loginToPlay: '登录开始游玩',
    loginWithPlayKit: '使用 PlayKit 进行安全登录',
    loginInNewWindow: '请在打开的窗口中完成登录',
    cancel: '取消',
    close: '关闭',
    loginDenied: '登录被拒绝',
    loginDeniedDesc: '您拒绝了授权请求',
    sessionExpired: '会话已过期',
    sessionExpiredDesc: '登录会话已超时，请重试',
    loginFailed: '登录失败',
    loginFailedDesc: '登录时发生错误，请重试',
  },
  'zh-TW': {
    loginToPlay: '登入開始遊玩',
    loginWithPlayKit: '使用 PlayKit 進行安全登入',
    loginInNewWindow: '請在開啟的視窗中完成登入',
    cancel: '取消',
    close: '關閉',
    loginDenied: '登入被拒絕',
    loginDeniedDesc: '您拒絕了授權請求',
    sessionExpired: '會話已過期',
    sessionExpiredDesc: '登入會話已逾時，請重試',
    loginFailed: '登入失敗',
    loginFailedDesc: '登入時發生錯誤，請重試',
  },
  ja: {
    loginToPlay: 'ログインしてプレイ',
    loginWithPlayKit: 'PlayKit で安全にログイン',
    loginInNewWindow: '開いたウィンドウでログインを完了してください',
    cancel: 'キャンセル',
    close: '閉じる',
    loginDenied: 'ログインが拒否されました',
    loginDeniedDesc: '認証リクエストが拒否されました',
    sessionExpired: 'セッション期限切れ',
    sessionExpiredDesc: 'ログインセッションがタイムアウトしました。もう一度お試しください',
    loginFailed: 'ログイン失敗',
    loginFailedDesc: 'ログイン中にエラーが発生しました。もう一度お試しください',
  },
  ko: {
    loginToPlay: '로그인하여 플레이',
    loginWithPlayKit: 'PlayKit으로 안전하게 로그인',
    loginInNewWindow: '열린 창에서 로그인을 완료해 주세요',
    cancel: '취소',
    close: '닫기',
    loginDenied: '로그인 거부됨',
    loginDeniedDesc: '인증 요청을 거부하셨습니다',
    sessionExpired: '세션 만료',
    sessionExpiredDesc: '로그인 세션이 만료되었습니다. 다시 시도해 주세요',
    loginFailed: '로그인 실패',
    loginFailedDesc: '로그인 중 오류가 발생했습니다. 다시 시도해 주세요',
  },
};

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

/** Result from initiating device auth (for headless usage) */
export interface DeviceAuthInitResult {
  /** Session ID for polling */
  sessionId: string;
  /** URL for user to visit and authorize */
  authUrl: string;
  /** PKCE code verifier (needed for polling) */
  codeVerifier: string;
  /** Expiration time in seconds */
  expiresIn: number;
  /** Recommended poll interval in seconds */
  pollInterval: number;
  /** Game information */
  game?: GameInfo;
}

export class DeviceAuthFlowManager extends EventEmitter {
  private baseURL: string;
  private gameId: string;
  private pollInterval: number = 5000; // Default 5 seconds
  private pollTimeoutId: NodeJS.Timeout | null = null;
  private aborted: boolean = false;
  private currentLanguage: string = 'en';
  private currentModal: HTMLDivElement | null = null;
  private logger = Logger.getLogger('DeviceAuth');

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
    const array = getRandomBytes(32);
    return base64URLEncode(array);
  }

  /**
   * Generate PKCE code challenge from verifier
   * @private
   */
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const hash = await sha256(verifier);
    return base64URLEncode(hash);
  }

  /**
   * Detect browser language and return matching translation key
   * @private
   */
  private detectLanguage(): string {
    if (typeof navigator === 'undefined') return 'en';

    const lang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || 'en';

    // Check exact match first (e.g., 'zh-TW')
    if (translations[lang]) return lang;

    // Check base language (e.g., 'zh' from 'zh-CN')
    const baseLang = lang.split('-')[0];
    if (translations[baseLang]) return baseLang;

    return 'en';
  }

  /**
   * Get translation for a key
   * @private
   */
  private t(key: keyof I18nTranslations): string {
    return translations[this.currentLanguage]?.[key] || translations.en[key];
  }

  /**
   * Show login modal and return promises for user interaction
   * @private
   */
  private showLoginModal(_gameInfo: GameInfo): { clicked: Promise<void>; cancelled: Promise<void> } {
    let resolveClicked: () => void;
    let resolveCancelled: () => void;

    const clicked = new Promise<void>((resolve) => { resolveClicked = resolve; });
    const cancelled = new Promise<void>((resolve) => { resolveCancelled = resolve; });

    // Create modal overlay - dark bg-black/80 style
    const overlay = document.createElement('div');
    overlay.id = 'playkit-login-modal';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    `;

    // Create modal card - square corners, shadow-xl style
    const card = document.createElement('div');
    card.style.cssText = `
      background: #fff;
      border: 1px solid rgba(0, 0, 0, 0.1);
      padding: 24px;
      max-width: 320px;
      width: 90%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.05);
      text-align: center;
    `;

    // Subtitle / status text
    const subtitle = document.createElement('p');
    subtitle.id = 'playkit-modal-subtitle';
    subtitle.textContent = this.t('loginWithPlayKit');
    subtitle.style.cssText = `
      margin: 0 0 20px;
      font-size: 14px;
      color: #666;
    `;
    card.appendChild(subtitle);

    // Loading spinner (hidden initially)
    const spinner = document.createElement('div');
    spinner.id = 'playkit-modal-spinner';
    spinner.style.cssText = `
      display: none;
      width: 24px;
      height: 24px;
      margin: 0 auto 16px;
      border: 2px solid #e5e7eb;
      border-top-color: #171717;
      border-radius: 50%;
      animation: playkit-spin 1s linear infinite;
    `;
    card.appendChild(spinner);

    // Add keyframes for spinner
    const style = document.createElement('style');
    style.textContent = `
      @keyframes playkit-spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    // Login button - square corners, simple dark style
    const loginBtn = document.createElement('button');
    loginBtn.id = 'playkit-modal-login-btn';
    loginBtn.textContent = this.t('loginToPlay');
    loginBtn.style.cssText = `
      width: 100%;
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 500;
      color: white;
      background: #171717;
      border: none;
      cursor: pointer;
      transition: background 0.2s ease;
    `;
    loginBtn.onmouseenter = () => {
      loginBtn.style.background = '#404040';
    };
    loginBtn.onmouseleave = () => {
      loginBtn.style.background = '#171717';
    };
    loginBtn.onmousedown = () => {
      loginBtn.style.background = '#0a0a0a';
    };
    loginBtn.onmouseup = () => {
      loginBtn.style.background = '#404040';
    };
    loginBtn.onclick = () => {
      // Switch to waiting state
      loginBtn.style.display = 'none';
      spinner.style.display = 'block';
      subtitle.textContent = this.t('loginInNewWindow');
      cancelBtn.style.display = 'block';
      resolveClicked!();
    };
    card.appendChild(loginBtn);

    // Cancel button (hidden initially) - outline style
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'playkit-modal-cancel-btn';
    cancelBtn.textContent = this.t('cancel');
    cancelBtn.style.cssText = `
      display: none;
      width: 100%;
      margin-top: 8px;
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 500;
      color: #666;
      background: transparent;
      border: 1px solid #e5e7eb;
      cursor: pointer;
      transition: all 0.2s ease;
    `;
    cancelBtn.onmouseenter = () => {
      cancelBtn.style.background = '#f5f5f5';
      cancelBtn.style.borderColor = '#d4d4d4';
    };
    cancelBtn.onmouseleave = () => {
      cancelBtn.style.background = 'transparent';
      cancelBtn.style.borderColor = '#e5e7eb';
    };
    cancelBtn.onclick = () => {
      this.closeModal();
      resolveCancelled!();
    };
    card.appendChild(cancelBtn);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    this.currentModal = overlay;

    return { clicked, cancelled };
  }

  /**
   * Close the login modal
   * @private
   */
  private closeModal(): void {
    if (this.currentModal) {
      this.currentModal.remove();
      this.currentModal = null;
    }
  }

  /**
   * Show error state in the modal
   * @private
   */
  private showModalError(
    type: 'denied' | 'expired' | 'failed',
    onClose: () => void
  ): void {
    if (!this.currentModal) return;

    const subtitle = this.currentModal.querySelector('#playkit-modal-subtitle') as HTMLElement;
    const spinner = this.currentModal.querySelector('#playkit-modal-spinner') as HTMLElement;
    const cancelBtn = this.currentModal.querySelector('#playkit-modal-cancel-btn') as HTMLButtonElement;
    const card = this.currentModal.querySelector('div > div') as HTMLElement;

    if (!subtitle || !card) return;

    // Get error messages based on type
    let titleKey: keyof I18nTranslations;
    let descKey: keyof I18nTranslations;
    let iconColor: string;

    switch (type) {
      case 'denied':
        titleKey = 'loginDenied';
        descKey = 'loginDeniedDesc';
        iconColor = '#ef4444'; // red-500
        break;
      case 'expired':
        titleKey = 'sessionExpired';
        descKey = 'sessionExpiredDesc';
        iconColor = '#f59e0b'; // amber-500
        break;
      default:
        titleKey = 'loginFailed';
        descKey = 'loginFailedDesc';
        iconColor = '#ef4444'; // red-500
    }

    // Hide spinner
    if (spinner) spinner.style.display = 'none';

    // Create error title
    const errorTitle = document.createElement('h3');
    errorTitle.textContent = this.t(titleKey);
    errorTitle.style.cssText = `
      margin: 0 0 8px;
      font-size: 14px;
      font-weight: 600;
      color: ${iconColor};
    `;

    // Update subtitle with error description
    subtitle.textContent = this.t(descKey);
    subtitle.style.color = '#666';

    // Insert error title before subtitle
    subtitle.parentNode?.insertBefore(errorTitle, subtitle);

    // Update cancel button to close button
    if (cancelBtn) {
      cancelBtn.textContent = this.t('close');
      cancelBtn.style.display = 'block';
      cancelBtn.onclick = () => {
        this.closeModal();
        onClose();
      };
    }
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
      this.logger.info('Please open this URL in your browser:', url);
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
    this.currentLanguage = this.detectLanguage();
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
    const { session_id, auth_url, poll_interval, expires_in, game } = initData;

    // Update poll interval from server
    if (poll_interval) {
      this.pollInterval = poll_interval * 1000;
    }

    // Notify auth URL is ready
    if (options.onAuthUrl) {
      options.onAuthUrl(auth_url);
    }
    this.emit('auth_url', auth_url);

    // Step 2: Show login modal and open browser for user authorization
    // In browser environment, show modal first to ensure popup is opened from user click context
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const gameInfo: GameInfo = game || {
        id: this.gameId,
        name: 'Game',
        icon: null,
        description: null,
      };

      const modalResult = this.showLoginModal(gameInfo);

      // Wait for user to click login or cancel
      try {
        await Promise.race([
          modalResult.clicked,
          modalResult.cancelled.then(() => {
            throw new PlayKitError('User cancelled', 'CANCELLED');
          }),
        ]);
      } catch (err) {
        this.closeModal();
        throw err;
      }

      // User clicked login - open browser (in user click context, won't be blocked)
      await openBrowser(auth_url);
    } else {
      // Non-browser environment - open directly
      await openBrowser(auth_url);
    }

    // Step 3: Poll for authorization
    const expiresAt = Date.now() + (expires_in || 600) * 1000;

    return new Promise<DeviceAuthResult>((resolve, reject) => {
      const poll = async () => {
        if (this.aborted) {
          this.closeModal();
          reject(new PlayKitError('Device auth flow was cancelled', 'CANCELLED'));
          return;
        }

        // Check if session expired
        if (Date.now() >= expiresAt) {
          this.showModalError('expired', () => {});
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
              // Success! Close modal and return tokens
              this.closeModal();
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
              this.showModalError('denied', () => {});
              if (options.onPollStatus) {
                options.onPollStatus('denied');
              }
              this.emit('poll_status', 'denied');
              reject(new PlayKitError(
                pollData.error_description || 'User denied authorization',
                'ACCESS_DENIED'
              ));
            } else if (error === 'expired_token') {
              this.showModalError('expired', () => {});
              if (options.onPollStatus) {
                options.onPollStatus('expired');
              }
              this.emit('poll_status', 'expired');
              reject(new PlayKitError(
                pollData.error_description || 'Session expired',
                'EXPIRED'
              ));
            } else {
              this.showModalError('failed', () => {});
              reject(new PlayKitError(
                pollData.error_description || 'Device auth failed',
                error || 'POLL_FAILED',
                pollResponse.status
              ));
            }
          }
        } catch (err) {
          // Network error, retry after interval
          this.logger.warn('Poll network error, retrying...', err);
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
    this.closeModal();
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
    this.closeModal();
    this.cancel();
    this.removeAllListeners();
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
   * const { authUrl, sessionId, codeVerifier } = await manager.initiateAuth();
   * console.log('Please visit:', authUrl);
   * // Or generate QR code from authUrl
   *
   * // Then poll for completion
   * const result = await manager.pollForToken(sessionId, codeVerifier);
   * ```
   */
  async initiateAuth(scope: TokenScope = 'player:play'): Promise<DeviceAuthInitResult> {
    // Generate PKCE parameters
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Initiate device auth session
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
    const { session_id, auth_url, poll_interval, expires_in, game } = initData;

    return {
      sessionId: session_id,
      authUrl: auth_url,
      codeVerifier,
      expiresIn: expires_in || 600,
      pollInterval: poll_interval || 5,
      game,
    };
  }

  /**
   * Poll for authorization token.
   * Use this after calling initiateAuth() to wait for user authorization.
   *
   * @param sessionId - Session ID from initiateAuth()
   * @param codeVerifier - Code verifier from initiateAuth()
   * @param options - Optional callbacks for status updates
   * @returns Promise resolving to DeviceAuthResult with tokens
   *
   * @example
   * ```ts
   * const { authUrl, sessionId, codeVerifier, expiresIn } = await manager.initiateAuth();
   * console.log('Please visit:', authUrl);
   *
   * const result = await manager.pollForToken(sessionId, codeVerifier, {
   *   onStatus: (status) => console.log('Status:', status),
   *   timeoutMs: expiresIn * 1000,
   * });
   * console.log('Token:', result.access_token);
   * ```
   */
  async pollForToken(
    sessionId: string,
    codeVerifier: string,
    options: {
      /** Callback for status updates */
      onStatus?: (status: 'pending' | 'slow_down' | 'authorized' | 'denied' | 'expired') => void;
      /** Timeout in milliseconds (default: 600000 = 10 minutes) */
      timeoutMs?: number;
      /** Poll interval in milliseconds (default: 5000 = 5 seconds) */
      pollIntervalMs?: number;
    } = {}
  ): Promise<DeviceAuthResult> {
    this.aborted = false;
    const timeoutMs = options.timeoutMs || 600000;
    let pollIntervalMs = options.pollIntervalMs || this.pollInterval;
    const expiresAt = Date.now() + timeoutMs;

    return new Promise<DeviceAuthResult>((resolve, reject) => {
      const poll = async () => {
        if (this.aborted) {
          reject(new PlayKitError('Device auth flow was cancelled', 'CANCELLED'));
          return;
        }

        // Check if session expired
        if (Date.now() >= expiresAt) {
          options.onStatus?.('expired');
          reject(new PlayKitError('Device auth session expired', 'EXPIRED'));
          return;
        }

        try {
          const pollResponse = await fetch(
            `${this.baseURL}/api/device-auth/poll?session_id=${encodeURIComponent(sessionId)}&code_verifier=${encodeURIComponent(codeVerifier)}`
          );

          const pollData = await pollResponse.json();

          if (pollResponse.ok) {
            if (pollData.status === 'pending') {
              // Still waiting, continue polling
              options.onStatus?.('pending');

              // Update poll interval if server provides new value
              if (pollData.poll_interval) {
                pollIntervalMs = pollData.poll_interval * 1000;
              }

              this.pollTimeoutId = setTimeout(poll, pollIntervalMs);
            } else if (pollData.status === 'authorized') {
              // Success!
              options.onStatus?.('authorized');
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
              options.onStatus?.('slow_down');
              pollIntervalMs = Math.min(pollIntervalMs * 2, 30000); // Double interval, max 30s
              this.pollTimeoutId = setTimeout(poll, pollIntervalMs);
            } else if (error === 'access_denied') {
              options.onStatus?.('denied');
              reject(new PlayKitError(
                pollData.error_description || 'User denied authorization',
                'ACCESS_DENIED'
              ));
            } else if (error === 'expired_token') {
              options.onStatus?.('expired');
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
          this.logger.warn('Poll network error, retrying...', err);
          this.pollTimeoutId = setTimeout(poll, pollIntervalMs);
        }
      };

      // Start polling
      poll();
    });
  }
}

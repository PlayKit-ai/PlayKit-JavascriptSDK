/**
 * External Authentication Flow Manager
 * Manages OAuth-like popup authentication flow for external_auth channel
 */

import EventEmitter from 'eventemitter3';
import { PlayKitError } from '../types';
import { getRandomBytes, sha256, base64URLEncode } from '../utils/CryptoUtils';

interface I18nTranslations {
  loginToPlay: string;
  loginInNewWindow: string;
  cancel: string;
}

type SupportedLanguage = 'en' | 'zh' | 'zh-TW' | 'ja' | 'ko';

// i18n translations
const translations: Record<SupportedLanguage, I18nTranslations> = {
  en: {
    loginToPlay: 'Login to Play',
    loginInNewWindow: 'Please login in the opened window',
    cancel: 'Cancel',
  },
  zh: {
    loginToPlay: '登录开始游玩',
    loginInNewWindow: '请在打开的新窗口中登录',
    cancel: '取消',
  },
  'zh-TW': {
    loginToPlay: '登入開始遊玩',
    loginInNewWindow: '請在打開的新視窗中登入',
    cancel: '取消',
  },
  ja: {
    loginToPlay: 'ログインしてプレイ',
    loginInNewWindow: '開いたウィンドウでログインしてください',
    cancel: 'キャンセル',
  },
  ko: {
    loginToPlay: '로그인하여 플레이',
    loginInNewWindow: '열린 창에서 로그인하세요',
    cancel: '취소',
  },
};

export class ExternalAuthFlowManager extends EventEmitter {
  private baseURL: string;
  private gameId: string;
  private currentLanguage: SupportedLanguage = 'en';

  constructor(baseURL: string, gameId: string) {
    super();
    this.baseURL = baseURL;
    this.gameId = gameId;
    this.currentLanguage = this.detectLanguage();
  }

  /**
   * Detect browser language
   * @private
   */
  private detectLanguage(): SupportedLanguage {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return 'en';
    }

    try {
      const browserLang = navigator.language.toLowerCase();

      if (browserLang.startsWith('zh-tw') || browserLang.startsWith('zh-hk')) {
        return 'zh-TW';
      } else if (browserLang.startsWith('zh')) {
        return 'zh';
      } else if (browserLang.startsWith('ja')) {
        return 'ja';
      } else if (browserLang.startsWith('ko')) {
        return 'ko';
      } else {
        return 'en';
      }
    } catch (error) {
      return 'en';
    }
  }

  /**
   * Get translated text
   * @private
   */
  private t(key: keyof I18nTranslations): string {
    return translations[this.currentLanguage][key];
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
   * Generate a random state for CSRF protection
   * @private
   */
  private generateState(): string {
    const array = getRandomBytes(16);
    return base64URLEncode(array);
  }

  /**
   * Start the external authentication flow
   * Shows a login button modal, then opens popup for user to login and authorize
   *
   * @returns {Promise<string>} Player token
   */
  async startFlow(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      let modal: HTMLDivElement | null = null;
      let popup: Window | null = null;
      let messageHandler: ((event: MessageEvent) => void) | null = null;

      const cleanup = () => {
        if (modal && modal.parentElement) {
          modal.remove();
        }
        if (popup && !popup.closed) {
          popup.close();
        }
        if (messageHandler) {
          window.removeEventListener('message', messageHandler);
        }
      };

      try {
        // Fetch game information
        const gameInfo = await this.fetchGameInfo();

        // Show login button modal
        const modalResult = await this.showLoginModal(gameInfo);
        modal = modalResult.modal;

        // Wait for user to click login button
        await Promise.race([
          modalResult.clicked,
          modalResult.cancelled.then(() => {
            throw new PlayKitError('User cancelled login', 'USER_CANCELLED');
          }),
        ]);

        // Generate PKCE parameters
        const codeVerifier = this.generateCodeVerifier();
        const codeChallenge = await this.generateCodeChallenge(codeVerifier);
        const state = this.generateState();

        // Build authorization URL with postmessage redirect
        const redirectUri = 'postmessage';
        const params = new URLSearchParams({
          response_type: 'code',
          game_id: this.gameId,
          redirect_uri: redirectUri,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          state: state,
          origin: window.location.origin, // Pass origin for postMessage
        });

        const authUrl = `${this.baseURL}/external-auth/authorize?${params}`;

        // Open popup window
        popup = window.open(authUrl, 'playkit_auth', 'width=500,height=700,popup=1');

        if (!popup) {
          cleanup();
          reject(new PlayKitError('Popup blocked. Please allow popups for this site.', 'POPUP_BLOCKED'));
          return;
        }

        // Listen for messages from popup
        messageHandler = async (event: MessageEvent) => {
          console.log('[ExternalAuth] Received message:', event.origin, event.data);

          // Verify origin
          const allowedOrigin = new URL(this.baseURL).origin;
          if (event.origin !== allowedOrigin) {
            console.log('[ExternalAuth] Ignoring message from wrong origin. Expected:', allowedOrigin, 'Got:', event.origin);
            return;
          }

          // Check message type
          if (event.data.type !== 'external_auth_callback') {
            console.log('[ExternalAuth] Ignoring message with wrong type:', event.data.type);
            return;
          }

          console.log('[ExternalAuth] Processing auth callback');

          // Cleanup
          cleanup();

          try {
            // Extract data from message
            const { code, state: returnedState, error, error_description } = event.data;

            // Check for errors
            if (error) {
              console.error('[ExternalAuth] Auth error:', error, error_description);
              reject(new PlayKitError(error_description || error, 'AUTH_ERROR'));
              return;
            }

            // Verify state
            if (returnedState !== state) {
              console.error('[ExternalAuth] State mismatch. Expected:', state, 'Got:', returnedState);
              reject(new PlayKitError('State mismatch - possible CSRF attack', 'STATE_MISMATCH'));
              return;
            }

            if (!code) {
              console.error('[ExternalAuth] No authorization code received');
              reject(new PlayKitError('No authorization code received', 'NO_CODE'));
              return;
            }

            console.log('[ExternalAuth] Exchanging code for token...');
            // Exchange code for token
            const token = await this.exchangeCodeForToken(code, codeVerifier, redirectUri);
            console.log('[ExternalAuth] Token received successfully');
            resolve(token);
          } catch (err) {
            console.error('[ExternalAuth] Error in message handler:', err);
            reject(err);
          }
        };

        console.log('[ExternalAuth] Listening for postMessage from:', new URL(this.baseURL).origin);
        window.addEventListener('message', messageHandler);

        // Handle cancel button
        modalResult.cancelled.then(() => {
          cleanup();
          reject(new PlayKitError('User cancelled login', 'USER_CANCELLED'));
        });
      } catch (err) {
        console.error('[ExternalAuth] Error in startFlow:', err);
        cleanup();
        reject(err);
      }
    });
  }

  /**
   * Fetch game information
   * @private
   */
  private async fetchGameInfo(): Promise<{ id: string; name: string; description: string | null; icon: string | null }> {
    const response = await fetch(`${this.baseURL}/api/external-auth/game-info?game_id=${this.gameId}`);
    if (!response.ok) {
      throw new PlayKitError('Failed to fetch game information', 'GAME_INFO_ERROR');
    }
    return response.json();
  }

  /**
   * Show login button modal
   * @private
   */
  private showLoginModal(gameInfo: { name: string; description: string | null; icon: string | null }): Promise<{ modal: HTMLDivElement; clicked: Promise<void>; cancelled: Promise<void> }> {
    return new Promise((resolve) => {
      // Create modal container
      const modal = document.createElement('div');
      modal.id = 'playkit-login-modal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 999999;
        display: flex;
        justify-content: center;
        align-items: center;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
      `;

      // Create content card
      const card = document.createElement('div');
      card.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 32px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        text-align: center;
      `;

      // Game icon
      if (gameInfo.icon) {
        const icon = document.createElement('img');
        icon.src = gameInfo.icon;
        icon.alt = gameInfo.name;
        icon.style.cssText = `
          width: 80px;
          height: 80px;
          border-radius: 12px;
          margin: 0 auto 16px;
        `;
        card.appendChild(icon);
      }

      // Game name
      const title = document.createElement('h2');
      title.textContent = gameInfo.name;
      title.style.cssText = `
        font-size: 24px;
        font-weight: bold;
        margin: 0 0 8px;
        color: #1a1a1a;
      `;
      card.appendChild(title);

      // Game description
      if (gameInfo.description) {
        const desc = document.createElement('p');
        desc.textContent = gameInfo.description;
        desc.style.cssText = `
          font-size: 14px;
          color: #666;
          margin: 0 0 24px;
          line-height: 1.5;
        `;
        card.appendChild(desc);
      }

      // Login button
      const loginBtn = document.createElement('button');
      loginBtn.textContent = this.t('loginToPlay');
      loginBtn.style.cssText = `
        width: 100%;
        padding: 12px 16px;
        background: #276EF1;
        color: #FFFFFF;
        border: none;
        border-radius: 2px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.15s ease;
      `;
      loginBtn.onmouseover = () => {
        loginBtn.style.background = '#174EB6';
      };
      loginBtn.onmouseout = () => {
        loginBtn.style.background = '#276EF1';
      };
      loginBtn.onmousedown = () => {
        loginBtn.style.background = '#0F3A8A';
      };
      loginBtn.onmouseup = () => {
        loginBtn.style.background = '#174EB6';
      };

      let clickResolve: () => void;
      let cancelResolve: () => void;
      const clickedPromise = new Promise<void>((res) => { clickResolve = res; });
      const cancelledPromise = new Promise<void>((res) => { cancelResolve = res; });

      loginBtn.onclick = () => {
        // Change to "waiting" state
        card.innerHTML = '';

        // Show waiting message
        const waitingTitle = document.createElement('h2');
        waitingTitle.textContent = gameInfo.name;
        waitingTitle.style.cssText = `
          font-size: 24px;
          font-weight: bold;
          margin: 0 0 16px;
          color: #1a1a1a;
        `;
        card.appendChild(waitingTitle);

        const waitingMessage = document.createElement('p');
        waitingMessage.textContent = this.t('loginInNewWindow');
        waitingMessage.style.cssText = `
          font-size: 16px;
          color: #666;
          margin: 0 0 24px;
          line-height: 1.5;
        `;
        card.appendChild(waitingMessage);

        // Cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = this.t('cancel');
        cancelBtn.style.cssText = `
          width: 100%;
          padding: 12px 16px;
          background: #E5E7EB;
          color: #374151;
          border: none;
          border-radius: 2px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.15s ease;
        `;
        cancelBtn.onmouseover = () => {
          cancelBtn.style.background = '#D1D5DB';
        };
        cancelBtn.onmouseout = () => {
          cancelBtn.style.background = '#E5E7EB';
        };
        cancelBtn.onclick = () => {
          modal.remove();
          cancelResolve();
        };
        card.appendChild(cancelBtn);

        clickResolve();
      };

      card.appendChild(loginBtn);
      modal.appendChild(card);
      document.body.appendChild(modal);

      resolve({ modal, clicked: clickedPromise, cancelled: cancelledPromise });
    });
  }


  /**
   * Exchange authorization code for access token
   * @private
   */
  private async exchangeCodeForToken(code: string, codeVerifier: string, redirectUri: string): Promise<string> {
    const response = await fetch(`${this.baseURL}/api/external-auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error_description: 'Token exchange failed' }));
      throw new PlayKitError(error.error_description || 'Token exchange failed', 'TOKEN_EXCHANGE_FAILED', response.status);
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.removeAllListeners();
  }
}

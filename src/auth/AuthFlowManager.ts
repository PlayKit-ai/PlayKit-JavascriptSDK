/**
 * Authentication Flow Manager
 * Manages the headless authentication flow with automatic UI
 */

import EventEmitter from 'eventemitter3';
import { PlayKitError } from '../types';

interface SendCodeRequest {
  identifier: string;
  type: 'email' | 'phone';
}

interface SendCodeResponse {
  success: boolean;
  sessionId: string;
}

interface VerifyCodeRequest {
  sessionId: string;
  code: string;
}

interface VerifyCodeResponse {
  success: boolean;
  userId: string;
  globalToken: string;
}

interface Reachability {
  country: string;
  region: string;
  city: string;
}

export class AuthFlowManager extends EventEmitter {
  private baseURL: string;
  private currentSessionId: string | null = null;
  private uiContainer: HTMLElement | null = null;
  private isSuccess: boolean = false;

  // UI Elements
  private modal: HTMLElement | null = null;
  private identifierPanel: HTMLElement | null = null;
  private verificationPanel: HTMLElement | null = null;
  private loadingOverlay: HTMLElement | null = null;

  constructor(baseURL: string = 'https://playkit.agentlandlab.com') {
    super();
    this.baseURL = baseURL;
  }

  /**
   * Start the authentication flow
   * Returns a promise that resolves with the JWT token
   */
  async startFlow(): Promise<string> {
    return new Promise((resolve, reject) => {
      // Create and show UI
      this.createUI();
      this.showModal();

      // Listen for success/failure
      this.once('success', (token: string) => {
        this.hideModal();
        resolve(token);
      });

      this.once('error', (error: Error) => {
        this.hideModal();
        reject(error);
      });

      // Set default auth type based on region
      this.setDefaultAuthTypeByRegion().catch((err) => {
        console.error('[PlayKit Auth] Failed to detect region:', err);
      });
    });
  }

  /**
   * Create the authentication UI
   */
  private createUI(): void {
    // Create modal container
    this.modal = document.createElement('div');
    this.modal.className = 'playkit-auth-modal';
    this.modal.innerHTML = `
      <div class="playkit-auth-overlay"></div>
      <div class="playkit-auth-container">
        <!-- Identifier Panel -->
        <div class="playkit-auth-panel" id="playkit-identifier-panel">
          <div class="playkit-auth-header">
            <h2>Sign In</h2>
            <p>Continue to use AI features</p>
          </div>

          <div class="playkit-auth-toggle">
            <label class="playkit-toggle-option">
              <input type="radio" name="auth-type" value="email" checked>
              <span>Email</span>
            </label>
            <label class="playkit-toggle-option">
              <input type="radio" name="auth-type" value="phone">
              <span>Phone</span>
            </label>
          </div>

          <div class="playkit-auth-input-group">
            <div class="playkit-input-wrapper">
              <svg class="playkit-input-icon" id="playkit-identifier-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              <input
                type="text"
                id="playkit-identifier-input"
                placeholder="Enter your email address"
                autocomplete="off"
              >
            </div>
          </div>

          <button class="playkit-auth-button" id="playkit-send-code-btn">
            Send Code
          </button>

          <div class="playkit-auth-error" id="playkit-error-text"></div>
        </div>

        <!-- Verification Panel -->
        <div class="playkit-auth-panel" id="playkit-verification-panel" style="display: none;">
          <div class="playkit-auth-header">
            <button class="playkit-back-button" id="playkit-back-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <h2>Enter Code</h2>
            <p>We've sent a 6-digit code to your <span id="playkit-identifier-display"></span></p>
          </div>

          <div class="playkit-auth-input-group">
            <div class="playkit-code-inputs">
              <input type="text" maxlength="1" class="playkit-code-input" data-index="0">
              <input type="text" maxlength="1" class="playkit-code-input" data-index="1">
              <input type="text" maxlength="1" class="playkit-code-input" data-index="2">
              <input type="text" maxlength="1" class="playkit-code-input" data-index="3">
              <input type="text" maxlength="1" class="playkit-code-input" data-index="4">
              <input type="text" maxlength="1" class="playkit-code-input" data-index="5">
            </div>
          </div>

          <button class="playkit-auth-button" id="playkit-verify-btn">
            Verify
          </button>

          <div class="playkit-auth-error" id="playkit-verify-error-text"></div>
        </div>

        <!-- Loading Overlay -->
        <div class="playkit-loading-overlay" id="playkit-loading-overlay" style="display: none;">
          <div class="playkit-spinner"></div>
        </div>
      </div>
    `;

    // Add styles
    this.addStyles();

    // Append to body
    document.body.appendChild(this.modal);

    // Get references
    this.identifierPanel = document.getElementById('playkit-identifier-panel');
    this.verificationPanel = document.getElementById('playkit-verification-panel');
    this.loadingOverlay = document.getElementById('playkit-loading-overlay');

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Add CSS styles to the page
   */
  private addStyles(): void {
    const styleId = 'playkit-auth-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .playkit-auth-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 999999;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }

      .playkit-auth-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
      }

      .playkit-auth-container {
        position: relative;
        background: white;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        width: 90%;
        max-width: 420px;
        overflow: hidden;
      }

      .playkit-auth-panel {
        padding: 32px;
      }

      .playkit-auth-header {
        text-align: center;
        margin-bottom: 32px;
        position: relative;
      }

      .playkit-auth-header h2 {
        margin: 0 0 8px 0;
        font-size: 24px;
        font-weight: 600;
        color: #1a1a1a;
      }

      .playkit-auth-header p {
        margin: 0;
        font-size: 14px;
        color: #666;
      }

      .playkit-back-button {
        position: absolute;
        left: 0;
        top: 0;
        background: none;
        border: none;
        cursor: pointer;
        padding: 8px;
        border-radius: 8px;
        color: #666;
        transition: all 0.2s;
      }

      .playkit-back-button:hover {
        background: #f0f0f0;
        color: #333;
      }

      .playkit-auth-toggle {
        display: flex;
        background: #f5f5f5;
        border-radius: 12px;
        padding: 4px;
        margin-bottom: 24px;
      }

      .playkit-toggle-option {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 10px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .playkit-toggle-option input {
        display: none;
      }

      .playkit-toggle-option span {
        font-size: 14px;
        font-weight: 500;
        color: #666;
      }

      .playkit-toggle-option input:checked + span {
        color: #667eea;
      }

      .playkit-toggle-option:has(input:checked) {
        background: white;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .playkit-auth-input-group {
        margin-bottom: 24px;
      }

      .playkit-input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }

      .playkit-input-icon {
        position: absolute;
        left: 16px;
        color: #999;
        pointer-events: none;
      }

      .playkit-input-wrapper input {
        width: 100%;
        padding: 14px 16px 14px 48px;
        border: 2px solid #e0e0e0;
        border-radius: 12px;
        font-size: 16px;
        transition: border-color 0.2s;
        box-sizing: border-box;
      }

      .playkit-input-wrapper input:focus {
        outline: none;
        border-color: #667eea;
      }

      .playkit-code-inputs {
        display: flex;
        gap: 12px;
        justify-content: center;
      }

      .playkit-code-input {
        width: 48px !important;
        height: 56px;
        text-align: center;
        font-size: 24px;
        font-weight: 600;
        border: 2px solid #e0e0e0 !important;
        border-radius: 12px;
        padding: 0 !important;
        transition: all 0.2s;
      }

      .playkit-code-input:focus {
        border-color: #667eea !important;
        transform: scale(1.05);
      }

      .playkit-auth-button {
        width: 100%;
        padding: 14px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .playkit-auth-button:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }

      .playkit-auth-button:disabled {
        background: #ccc;
        cursor: not-allowed;
        transform: none;
      }

      .playkit-auth-error {
        margin-top: 16px;
        padding: 12px;
        background: #fee;
        border: 1px solid #fcc;
        border-radius: 8px;
        color: #c33;
        font-size: 14px;
        text-align: center;
        display: none;
      }

      .playkit-auth-error.show {
        display: block;
      }

      .playkit-loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.95);
        display: flex;
        justify-content: center;
        align-items: center;
        border-radius: 16px;
      }

      .playkit-spinner {
        width: 48px;
        height: 48px;
        border: 4px solid #f0f0f0;
        border-top: 4px solid #667eea;
        border-radius: 50%;
        animation: playkit-spin 1s linear infinite;
      }

      @keyframes playkit-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      @media (max-width: 480px) {
        .playkit-auth-container {
          width: 95%;
          max-width: none;
        }

        .playkit-auth-panel {
          padding: 24px;
        }

        .playkit-code-input {
          width: 40px !important;
          height: 48px;
          font-size: 20px;
        }

        .playkit-code-inputs {
          gap: 8px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Auth type toggle
    const emailRadio = this.modal?.querySelector('input[value="email"]') as HTMLInputElement;
    const phoneRadio = this.modal?.querySelector('input[value="phone"]') as HTMLInputElement;
    const identifierInput = document.getElementById('playkit-identifier-input') as HTMLInputElement;
    const identifierIcon = document.getElementById('playkit-identifier-icon') as SVGElement;

    const updateIcon = () => {
      const isEmail = emailRadio?.checked;
      identifierInput.placeholder = isEmail
        ? 'Enter your email address'
        : 'Enter your phone number (+86 Only)';

      // Update icon
      if (isEmail) {
        identifierIcon.innerHTML = `
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        `;
      } else {
        identifierIcon.innerHTML = `
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
        `;
      }
    };

    emailRadio?.addEventListener('change', updateIcon);
    phoneRadio?.addEventListener('change', updateIcon);

    // Send code button
    const sendCodeBtn = document.getElementById('playkit-send-code-btn');
    sendCodeBtn?.addEventListener('click', () => this.onSendCodeClicked());

    // Enter key in identifier input
    identifierInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.onSendCodeClicked();
      }
    });

    // Code inputs
    const codeInputs = this.modal?.querySelectorAll('.playkit-code-input') as NodeListOf<HTMLInputElement>;
    codeInputs?.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.value.length === 1 && index < codeInputs.length - 1) {
          codeInputs[index + 1].focus();
        }

        // Auto-submit when all 6 digits entered
        if (index === 5 && target.value.length === 1) {
          this.onVerifyClicked();
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && index > 0) {
          codeInputs[index - 1].focus();
        }
      });

      // Paste support
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData?.getData('text') || '';
        const digits = pastedData.replace(/\D/g, '').slice(0, 6);

        digits.split('').forEach((digit, i) => {
          if (codeInputs[i]) {
            codeInputs[i].value = digit;
          }
        });

        if (digits.length === 6) {
          this.onVerifyClicked();
        }
      });
    });

    // Verify button
    const verifyBtn = document.getElementById('playkit-verify-btn');
    verifyBtn?.addEventListener('click', () => this.onVerifyClicked());

    // Back button
    const backBtn = document.getElementById('playkit-back-btn');
    backBtn?.addEventListener('click', () => {
      this.showIdentifierPanel();
    });
  }

  /**
   * Handle send code button click
   */
  private async onSendCodeClicked(): Promise<void> {
    this.clearError();

    const identifierInput = document.getElementById('playkit-identifier-input') as HTMLInputElement;
    const identifier = identifierInput.value.trim();

    const emailRadio = this.modal?.querySelector('input[value="email"]') as HTMLInputElement;
    const type = emailRadio.checked ? 'email' : 'phone';

    if (!identifier) {
      this.showError('Please enter your ' + (type === 'email' ? 'email address' : 'phone number'));
      return;
    }

    const sendCodeBtn = document.getElementById('playkit-send-code-btn') as HTMLButtonElement;
    sendCodeBtn.disabled = true;

    this.showLoading();

    try {
      const success = await this.sendVerificationCode(identifier, type);

      if (success) {
        // Store identifier for display
        const displaySpan = document.getElementById('playkit-identifier-display');
        if (displaySpan) {
          displaySpan.textContent = type === 'email' ? identifier : identifier;
        }

        // Switch to verification panel
        this.showVerificationPanel();
      }
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Failed to send code');
    } finally {
      this.hideLoading();
      sendCodeBtn.disabled = false;
    }
  }

  /**
   * Handle verify button click
   */
  private async onVerifyClicked(): Promise<void> {
    this.clearError('verify');

    const codeInputs = this.modal?.querySelectorAll('.playkit-code-input') as NodeListOf<HTMLInputElement>;
    const code = Array.from(codeInputs).map((input) => input.value).join('');

    if (code.length !== 6) {
      this.showError('Please enter all 6 digits', 'verify');
      return;
    }

    this.showLoading();

    try {
      const globalToken = await this.verifyCode(code);
      this.emit('success', globalToken);
    } catch (error) {
      this.showError(
        error instanceof Error ? error.message : 'Verification failed',
        'verify'
      );
      this.hideLoading();
    }
  }

  /**
   * Send verification code to backend
   */
  private async sendVerificationCode(identifier: string, type: 'email' | 'phone'): Promise<boolean> {
    const response = await fetch(`${this.baseURL}/api/auth/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, type } as SendCodeRequest),
    });

    if (!response.ok) {
      throw new PlayKitError('Failed to send verification code', 'SEND_CODE_ERROR', response.status);
    }

    const data: SendCodeResponse = await response.json();

    if (!data.success || !data.sessionId) {
      throw new PlayKitError('Invalid response from server', 'INVALID_RESPONSE');
    }

    this.currentSessionId = data.sessionId;
    return true;
  }

  /**
   * Verify the code and get global token
   */
  private async verifyCode(code: string): Promise<string> {
    if (!this.currentSessionId) {
      throw new PlayKitError('No session ID available', 'NO_SESSION');
    }

    const response = await fetch(`${this.baseURL}/api/auth/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.currentSessionId,
        code,
      } as VerifyCodeRequest),
    });

    if (!response.ok) {
      throw new PlayKitError('Invalid verification code', 'INVALID_CODE', response.status);
    }

    const data: VerifyCodeResponse = await response.json();

    if (!data.success || !data.globalToken) {
      throw new PlayKitError('Verification failed', 'VERIFICATION_FAILED');
    }

    return data.globalToken;
  }

  /**
   * Set default auth type based on user region
   */
  private async setDefaultAuthTypeByRegion(): Promise<void> {
    try {
      const response = await fetch(`${this.baseURL}/api/reachability`);

      if (response.ok) {
        const data: Reachability = await response.json();

        if (data.region === 'CN') {
          const phoneRadio = this.modal?.querySelector('input[value="phone"]') as HTMLInputElement;
          if (phoneRadio) {
            phoneRadio.checked = true;
            phoneRadio.dispatchEvent(new Event('change'));
          }
        }
      }
    } catch (error) {
      console.error('[PlayKit Auth] Failed to detect region:', error);
    }
  }

  /**
   * Show/hide panels
   */
  private showIdentifierPanel(): void {
    if (this.identifierPanel) this.identifierPanel.style.display = 'block';
    if (this.verificationPanel) this.verificationPanel.style.display = 'none';

    // Clear code inputs
    const codeInputs = this.modal?.querySelectorAll('.playkit-code-input') as NodeListOf<HTMLInputElement>;
    codeInputs?.forEach((input) => (input.value = ''));
  }

  private showVerificationPanel(): void {
    if (this.identifierPanel) this.identifierPanel.style.display = 'none';
    if (this.verificationPanel) this.verificationPanel.style.display = 'block';

    // Focus first code input
    const firstInput = this.modal?.querySelector('.playkit-code-input') as HTMLInputElement;
    firstInput?.focus();
  }

  /**
   * Show/hide loading
   */
  private showLoading(): void {
    if (this.loadingOverlay) this.loadingOverlay.style.display = 'flex';
  }

  private hideLoading(): void {
    if (this.loadingOverlay) this.loadingOverlay.style.display = 'none';
  }

  /**
   * Show/hide error messages
   */
  private showError(message: string, panel: 'identifier' | 'verify' = 'identifier'): void {
    const errorEl =
      panel === 'identifier'
        ? document.getElementById('playkit-error-text')
        : document.getElementById('playkit-verify-error-text');

    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('show');
    }
  }

  private clearError(panel: 'identifier' | 'verify' | 'both' = 'both'): void {
    if (panel === 'identifier' || panel === 'both') {
      const errorEl = document.getElementById('playkit-error-text');
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.remove('show');
      }
    }

    if (panel === 'verify' || panel === 'both') {
      const errorEl = document.getElementById('playkit-verify-error-text');
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.remove('show');
      }
    }
  }

  /**
   * Show/hide modal
   */
  private showModal(): void {
    if (this.modal) this.modal.style.display = 'flex';
  }

  private hideModal(): void {
    if (this.modal) {
      this.modal.style.display = 'none';
      // Remove from DOM after animation
      setTimeout(() => {
        this.modal?.remove();
      }, 300);
    }
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.modal?.remove();
    this.removeAllListeners();
  }
}

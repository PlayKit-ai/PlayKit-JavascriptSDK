/**
 * Authentication Flow Manager
 * Manages the headless authentication flow with automatic UI
 *
 * @deprecated This class is deprecated. Use DeviceAuthFlowManager instead.
 * Will be removed in v2.0
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

interface I18nTranslations {
  signIn: string;
  signInSubtitle: string;
  email: string;
  phone: string;
  emailPlaceholder: string;
  phonePlaceholder: string;
  sendCode: string;
  enterCode: string;
  enterCodeSubtitle: string;
  verify: string;
  pleaseEnterEmail: string;
  pleaseEnterPhone: string;
  enterAllDigits: string;
  verificationFailed: string;
  failedToSendCode: string;
  invalidCode: string;
}

type SupportedLanguage = 'en' | 'zh' | 'zh-TW' | 'ja' | 'ko';

// i18n translations
const translations: Record<SupportedLanguage, I18nTranslations> = {
  en: {
    signIn: 'Sign In / Register',
    signInSubtitle: 'This game uses PlayKit for cost management.\nIf you don\'t have an account, we\'ll automatically register you. Sign up and get free AI game credits!',
    email: 'Email',
    phone: 'Phone',
    emailPlaceholder: 'Enter your email address',
    phonePlaceholder: 'Enter your phone number (+86 Only)',
    sendCode: 'Send Code',
    enterCode: 'Enter Code',
    enterCodeSubtitle: "We've sent a 6-digit code to your",
    verify: 'Verify',
    pleaseEnterEmail: 'Please enter your email address',
    pleaseEnterPhone: 'Please enter your phone number',
    enterAllDigits: 'Please enter all 6 digits',
    verificationFailed: 'Verification failed',
    failedToSendCode: 'Failed to send code',
    invalidCode: 'Invalid verification code',
  },
  zh: {
    signIn: '登录/注册',
    signInSubtitle: '本游戏使用PlayKit进行成本管理。\n如果您没有帐户，我们会为您自动注册。注册即送AI游戏积分！',
    email: '邮箱',
    phone: '手机',
    emailPlaceholder: '请输入邮箱地址',
    phonePlaceholder: '请输入手机号（仅限 +86）',
    sendCode: '发送验证码',
    enterCode: '输入验证码',
    enterCodeSubtitle: '我们已向您发送了 6 位验证码：',
    verify: '验证',
    pleaseEnterEmail: '请输入邮箱地址',
    pleaseEnterPhone: '请输入手机号',
    enterAllDigits: '请输入完整的 6 位验证码',
    verificationFailed: '验证失败',
    failedToSendCode: '发送验证码失败',
    invalidCode: '验证码无效',
  },
  'zh-TW': {
    signIn: '登入/註冊',
    signInSubtitle: '本遊戲使用PlayKit進行成本管理。\n如果您沒有帳戶，我們會為您自動註冊。註冊即送AI遊戲積分！',
    email: '電子郵件',
    phone: '手機',
    emailPlaceholder: '請輸入電子郵件地址',
    phonePlaceholder: '請輸入手機號碼（僅限 +86）',
    sendCode: '發送驗證碼',
    enterCode: '輸入驗證碼',
    enterCodeSubtitle: '我們已向您發送了 6 位驗證碼：',
    verify: '驗證',
    pleaseEnterEmail: '請輸入電子郵件地址',
    pleaseEnterPhone: '請輸入手機號碼',
    enterAllDigits: '請輸入完整的 6 位驗證碼',
    verificationFailed: '驗證失敗',
    failedToSendCode: '發送驗證碼失敗',
    invalidCode: '驗證碼無效',
  },
  ja: {
    signIn: 'サインイン/登録',
    signInSubtitle: 'このゲームはPlayKitでコスト管理を行っています。\nアカウントをお持ちでない場合は、自動的に登録します。登録するとAIゲームクレジットがもらえます！',
    email: 'メール',
    phone: '電話',
    emailPlaceholder: 'メールアドレスを入力してください',
    phonePlaceholder: '電話番号を入力してください（+86のみ）',
    sendCode: '認証コードを送信',
    enterCode: '認証コードを入力',
    enterCodeSubtitle: '6桁の認証コードを送信しました：',
    verify: '検証',
    pleaseEnterEmail: 'メールアドレスを入力してください',
    pleaseEnterPhone: '電話番号を入力してください',
    enterAllDigits: '6桁すべて入力してください',
    verificationFailed: '検証に失敗しました',
    failedToSendCode: '認証コードの送信に失敗しました',
    invalidCode: '認証コードが無効です',
  },
  ko: {
    signIn: '로그인/가입',
    signInSubtitle: '이 게임은 PlayKit으로 비용 관리를 합니다.\n계정이 없으시면 자동으로 등록해 드립니다. 가입하면 AI 게임 크레딧을 받으세요！',
    email: '이메일',
    phone: '전화',
    emailPlaceholder: '이메일 주소를 입력하세요',
    phonePlaceholder: '전화번호를 입력하세요（+86만 지원）',
    sendCode: '인증 코드 전송',
    enterCode: '인증 코드 입력',
    enterCodeSubtitle: '6자리 인증 코드를 보냈습니다：',
    verify: '확인',
    pleaseEnterEmail: '이메일 주소를 입력하세요',
    pleaseEnterPhone: '전화번호를 입력하세요',
    enterAllDigits: '6자리를 모두 입력하세요',
    verificationFailed: '인증 실패',
    failedToSendCode: '인증 코드 전송 실패',
    invalidCode: '인증 코드가 잘못되었습니다',
  },
};

export class AuthFlowManager extends EventEmitter {
  private baseURL: string;
  private currentSessionId: string | null = null;
  private _uiContainer: HTMLElement | null = null;
  private _isSuccess: boolean = false;
  private currentLanguage: SupportedLanguage = 'en';

  // UI Elements
  private modal: HTMLElement | null = null;
  private identifierPanel: HTMLElement | null = null;
  private verificationPanel: HTMLElement | null = null;
  private loadingOverlay: HTMLElement | null = null;
  private otpInstance: any = null;

  constructor(baseURL?: string) {
    super();
    // @ts-ignore - replaced at build time
    this.baseURL = baseURL || __PLAYKIT_BASE_URL__;
    this.currentLanguage = this.detectLanguage();
  }

  /**
   * Detect browser language (safe for Node.js environment)
   */
  private detectLanguage(): SupportedLanguage {
    // Check if running in browser environment
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return 'en'; // Default to English in Node.js environment
    }

    try {
      const browserLang = navigator.language.toLowerCase();

      // Match language codes
      if (browserLang.startsWith('zh-tw') || browserLang.startsWith('zh-hk')) {
        return 'zh-TW'; // Traditional Chinese
      } else if (browserLang.startsWith('zh')) {
        return 'zh'; // Simplified Chinese
      } else if (browserLang.startsWith('ja')) {
        return 'ja'; // Japanese
      } else if (browserLang.startsWith('ko')) {
        return 'ko'; // Korean
      } else {
        return 'en'; // Default to English
      }
    } catch (error) {
      // Fallback to English if detection fails
      return 'en';
    }
  }

  /**
   * Get translated text
   */
  private t(key: keyof I18nTranslations): string {
    return translations[this.currentLanguage][key];
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
            <h2>${this.t('signIn')}</h2>
            <p>${this.t('signInSubtitle')}</p>
          </div>

          <div class="playkit-auth-toggle">
            <label class="playkit-toggle-option">
              <input type="radio" name="auth-type" value="email" checked>
              <span>${this.t('email')}</span>
            </label>
            <label class="playkit-toggle-option">
              <input type="radio" name="auth-type" value="phone">
              <span>${this.t('phone')}</span>
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
                placeholder="${this.t('emailPlaceholder')}"
                autocomplete="off"
              >
            </div>
          </div>

          <button class="playkit-auth-button" id="playkit-send-code-btn">
            ${this.t('sendCode')}
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
            <h2>${this.t('enterCode')}</h2>
            <p>${this.t('enterCodeSubtitle')} <span id="playkit-identifier-display"></span></p>
          </div>

          <div class="playkit-auth-input-group">
            <div class="playkit-code-inputs">
              <input type="number" maxlength="1" class="playkit-code-input" data-index="0">
              <input type="number" maxlength="1" class="playkit-code-input" data-index="1">
              <input type="number" maxlength="1" class="playkit-code-input" data-index="2">
              <input type="number" maxlength="1" class="playkit-code-input" data-index="3">
              <input type="number" maxlength="1" class="playkit-code-input" data-index="4">
              <input type="number" maxlength="1" class="playkit-code-input" data-index="5">
            </div>
          </div>

          <button class="playkit-auth-button" id="playkit-verify-btn">
            ${this.t('verify')}
          </button>

          <div class="playkit-auth-error" id="playkit-verify-error-text"></div>
        </div>

        <!-- Loading Overlay -->
        <div class="playkit-loading-overlay" id="playkit-loading-overlay" style="display: none;">
          <div class="playkit-spinner"></div>
        </div>
      </div>
    `;

    // Add styles and load VanillaOTP
    this.addStyles();
    this.loadVanillaOTP();

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
   * Load VanillaOTP library
   */
  private loadVanillaOTP(): void {
    // Check if VanillaOTP is already loaded
    if ((window as any).VanillaOTP) return;

    // Inject VanillaOTP script
    const script = document.createElement('script');
    script.textContent = `"use strict";var VanillaOTP=function(t,e=null){if(this.emptyChar=" ","string"==typeof t)this.container=document.querySelector(t);else{if(!(t instanceof Element))return;this.container=t}e&&("string"==typeof e?this.updateTo=document.querySelector(e)||null:e instanceof Element?this.updateTo=e:this.updateTo=null),this.inputs=Array.from(this.container.querySelectorAll("input[type=text], input[type=number], input[type=password]"));let n=this,u=n.inputs.length;for(let i=0;i<u;i++){let l=n.inputs[i];l.addEventListener("input",function(){if(isNaN(l.value))return l.value=l.dataset.otpInputRestore||"",n._updateValue();if(0==l.value.length)return n._saveInputValue(i);if(1==l.value.length){n._saveInputValue(i),n._updateValue(),i+1<u&&n.inputs[i+1].focus();return}if(i==u-1)return n._setInputValue(i,l.value);let t=l.value.split("");for(let e=0;e<t.length&&!(e+i>=u);e++)n._setInputValue(e+i,t[e]);let a=Math.min(u-1,i+t.length);n.inputs[a].focus()}),l.addEventListener("keydown",function(t){if(8==t.keyCode&&""==l.value&&0!=i){n._setInputValue(i-1,""),n.inputs[i-1].focus();return}if(46==t.keyCode&&i!=u-1){let e=l.selectionStart||0;for(let a=i+e;a<u-1;a++)n._setInputValue(a,n.inputs[a+1].value);n._setInputValue(u-1,""),l.selectionStart&&(l.selectionStart=e),t.preventDefault();return}if(37==t.keyCode&&(null==l.selectionStart||0==l.selectionStart)){i>0&&(t.preventDefault(),n.inputs[i-1].focus(),n.inputs[i-1].select());return}if(39==t.keyCode&&(null==l.selectionStart||l.selectionEnd==l.value.length)){i+1<u&&(t.preventDefault(),n.inputs[i+1].focus(),n.inputs[i+1].select());return}})}};VanillaOTP.prototype.setEmptyChar=function(t){this.emptyChar=t},VanillaOTP.prototype.getValue=function(){let t="",e=this;return this.inputs.forEach(function(n){t+=""==n.value?e.emptyChar:n.value}),t},VanillaOTP.prototype.setValue=function(t){if(isNaN(t)){console.error("Please enter an integer value.");return}let e=(t=""+t).split("");for(let n=0;n<this.inputs.length;n++)this._setInputValue(n,e[n]||"")},VanillaOTP.prototype._setInputValue=function(t,e){return isNaN(e)?console.error("Please enter an integer value."):this.inputs[t]?void(this.inputs[t].value=String(e).substring(0,1),this._saveInputValue(t),this._updateValue()):console.error("Index not found.")},VanillaOTP.prototype._saveInputValue=function(t,e){if(!this.inputs[t])return console.error("Index not found.");this.inputs[t].dataset.otpInputRestore=e||this.inputs[t].value},VanillaOTP.prototype._updateValue=function(){this.updateTo&&(this.updateTo.value=this.getValue())};`;
    document.head.appendChild(script);
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
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      .playkit-auth-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.48);
        backdrop-filter: blur(8px);
      }

      .playkit-auth-container {
        position: relative;
        background: #FFFFFF;
        border-radius: 4px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        width: 90%;
        max-width: 420px;
        overflow: hidden;
      }

      .playkit-auth-panel {
        padding: 40px 32px;
      }

      .playkit-auth-header {
        text-align: center;
        margin-bottom: 32px;
        position: relative;
      }

      .playkit-auth-header h2 {
        margin: 0 0 8px 0;
        font-size: 28px;
        font-weight: 600;
        color: #000000;
      }

      .playkit-auth-header p {
        margin: 0;
        font-size: 14px;
        color: #666666;
        line-height: 1.5;
      }

      .playkit-back-button {
        position: absolute;
        left: 0;
        top: 0;
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 4px;
        border-radius: 2px;
        color: #666666;
        transition: background-color 0.15s ease, color 0.15s ease;
      }

      .playkit-back-button:hover {
        background: #F6F6F6;
        color: #000000;
      }

      .playkit-auth-toggle {
        display: flex;
        background: #F6F6F6;
        border-radius: 2px;
        padding: 2px;
        margin-bottom: 24px;
        gap: 2px;
      }

      .playkit-toggle-option {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 10px 16px;
        border-radius: 2px;
        cursor: pointer;
        transition: background-color 0.15s ease;
      }

      .playkit-toggle-option input {
        display: none;
      }

      .playkit-toggle-option span {
        font-size: 14px;
        font-weight: 500;
        color: #666666;
        transition: color 0.15s ease;
      }

      .playkit-toggle-option input:checked + span {
        color: #FFFFFF;
      }

      .playkit-toggle-option:has(input:checked) {
        background: #276EF1;
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
        left: 12px;
        color: #999999;
        pointer-events: none;
      }

      .playkit-input-wrapper input {
        width: 100%;
        padding: 12px 12px 12px 44px;
        border: 1px solid #CCCCCC;
        border-radius: 2px;
        font-size: 14px;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
        box-sizing: border-box;
        background: #FFFFFF;
      }

      .playkit-input-wrapper input:hover {
        border-color: #999999;
      }

      .playkit-input-wrapper input:focus {
        outline: none;
        border-color: #276EF1;
        box-shadow: 0 0 0 3px rgba(39, 110, 241, 0.1);
      }

      .playkit-code-inputs {
        display: flex;
        gap: 8px;
        justify-content: center;
      }

      .playkit-code-input {
        width: 48px !important;
        height: 56px;
        text-align: center;
        font-size: 24px;
        font-weight: 600;
        border: 1px solid #CCCCCC !important;
        border-radius: 2px;
        padding: 0 !important;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
        background: #FFFFFF;
        -moz-appearance: textfield;
      }

      .playkit-code-input::-webkit-outer-spin-button,
      .playkit-code-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      .playkit-code-input:hover {
        border-color: #999999 !important;
      }

      .playkit-code-input:focus {
        outline: none;
        border-color: #276EF1 !important;
        box-shadow: 0 0 0 3px rgba(39, 110, 241, 0.1);
      }

      .playkit-auth-button {
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
      }

      .playkit-auth-button:hover:not(:disabled) {
        background: #174EB6;
      }

      .playkit-auth-button:active:not(:disabled) {
        background: #0F3A8A;
      }

      .playkit-auth-button:disabled {
        background: #CCCCCC;
        cursor: not-allowed;
      }

      .playkit-auth-error {
        margin-top: 16px;
        padding: 12px 16px;
        background: #FEF0F0;
        border: 1px solid #FDD;
        border-radius: 2px;
        color: #CC3333;
        font-size: 13px;
        text-align: left;
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
        background: rgba(255, 255, 255, 0.96);
        display: flex;
        justify-content: center;
        align-items: center;
        border-radius: 4px;
      }

      .playkit-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid #F0F0F0;
        border-top: 3px solid #276EF1;
        border-radius: 50%;
        animation: playkit-spin 0.8s linear infinite;
      }

      @keyframes playkit-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      @media (max-width: 480px) {
        .playkit-auth-container {
          width: 95%;
          max-width: none;
          border-radius: 2px;
        }

        .playkit-auth-panel {
          padding: 32px 24px;
        }

        .playkit-code-input {
          width: 40px !important;
          height: 48px;
          font-size: 20px;
        }

        .playkit-code-inputs {
          gap: 6px;
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
    const identifierIcon = document.getElementById('playkit-identifier-icon') as unknown as SVGElement;

    const updateIcon = () => {
      const isEmail = emailRadio?.checked;
      identifierInput.placeholder = isEmail
        ? this.t('emailPlaceholder')
        : this.t('phonePlaceholder');

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

    // Initialize VanillaOTP for code inputs
    const codeInputsContainer = this.modal?.querySelector('.playkit-code-inputs');
    if (codeInputsContainer && (window as any).VanillaOTP) {
      this.otpInstance = new (window as any).VanillaOTP(codeInputsContainer);

      // Auto-submit when all 6 digits entered
      const codeInputs = this.modal?.querySelectorAll('.playkit-code-input') as NodeListOf<HTMLInputElement>;
      codeInputs?.forEach((input, _index) => {
        input.addEventListener('input', () => {
          // Check if all inputs are filled
          const allFilled = Array.from(codeInputs).every(inp => inp.value.length === 1);
          if (allFilled) {
            // Small delay to ensure the last input is processed
            setTimeout(() => this.onVerifyClicked(), 100);
          }
        });
      });
    }

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
      this.showError(type === 'email' ? this.t('pleaseEnterEmail') : this.t('pleaseEnterPhone'));
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
      this.showError(error instanceof Error ? error.message : this.t('failedToSendCode'));
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

    // Get code from VanillaOTP instance or fallback to manual collection
    let code = '';
    if (this.otpInstance) {
      code = this.otpInstance.getValue().replace(/\s/g, ''); // Remove spaces
    } else {
      const codeInputs = this.modal?.querySelectorAll('.playkit-code-input') as NodeListOf<HTMLInputElement>;
      code = Array.from(codeInputs).map((input) => input.value).join('');
    }

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      this.showError(this.t('enterAllDigits'), 'verify');
      return;
    }

    this.showLoading();

    try {
      const globalToken = await this.verifyCode(code);
      this.emit('success', globalToken);
    } catch (error) {
      this.showError(
        error instanceof Error ? error.message : this.t('verificationFailed'),
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
      throw new PlayKitError(this.t('failedToSendCode'), 'SEND_CODE_ERROR', response.status);
    }

    const data: SendCodeResponse = await response.json();

    if (!data.success || !data.sessionId) {
      throw new PlayKitError(this.t('failedToSendCode'), 'INVALID_RESPONSE');
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
      throw new PlayKitError(this.t('invalidCode'), 'INVALID_CODE', response.status);
    }

    const data: VerifyCodeResponse = await response.json();

    if (!data.success || !data.globalToken) {
      throw new PlayKitError(this.t('verificationFailed'), 'VERIFICATION_FAILED');
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
    if (this.otpInstance) {
      this.otpInstance.setValue(''); // Clear all inputs using VanillaOTP
    } else {
      const codeInputs = this.modal?.querySelectorAll('.playkit-code-input') as NodeListOf<HTMLInputElement>;
      codeInputs?.forEach((input) => (input.value = ''));
    }
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

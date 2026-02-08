import EventEmitter from 'eventemitter3';
import { RechargeModalOptions } from '../types/recharge';

/**
 * Translations for the recharge modal
 */
const translations = {
  en: {
    title: 'Insufficient Balance',
    message: 'Your balance is insufficient. Please recharge to continue.',
    currentBalance: 'Current Balance',
    credits: '',  // No longer using "Spark", display USD amount directly
    rechargeButton: 'Recharge Now',
    cancelButton: 'Cancel',
    dailyRefreshMessage: 'Your daily free {amount} credits have arrived!',
  },
  zh: {
    title: '余额不足',
    message: '您的余额不足，请充值后继续使用。',
    currentBalance: '当前余额',
    credits: '',  // 不再使用"Spark"，直接显示美元金额
    rechargeButton: '立即充值',
    cancelButton: '取消',
    dailyRefreshMessage: '你的每日免费积分 {amount} 已到账！',
  },
  'zh-TW': {
    title: '餘額不足',
    message: '您的餘額不足，請充值後繼續使用。',
    currentBalance: '當前餘額',
    credits: '',  // 不再使用"Spark"，直接顯示美元金額
    rechargeButton: '立即充值',
    cancelButton: '取消',
    dailyRefreshMessage: '你的每日免費積分 {amount} 已到帳！',
  },
  ja: {
    title: '残高不足',
    message: '残高が不足しています。チャージしてください。',
    currentBalance: '現在の残高',
    credits: '',  // "Spark"は使用しません、USD金額を直接表示
    rechargeButton: '今すぐチャージ',
    cancelButton: 'キャンセル',
    dailyRefreshMessage: '本日の無料クレジット {amount} が届きました！',
  },
  ko: {
    title: '잔액 부족',
    message: '잔액이 부족합니다. 충전 후 이용해 주세요.',
    currentBalance: '현재 잔액',
    credits: '',  // "Spark" 사용 안 함, USD 금액 직접 표시
    rechargeButton: '지금 충전',
    cancelButton: '취소',
    dailyRefreshMessage: '오늘의 무료 크레딧 {amount}이 도착했습니다!',
  },
};

type SupportedLanguage = keyof typeof translations;

/**
 * RechargeManager handles the recharge modal UI and recharge window opening
 */
export class RechargeManager extends EventEmitter {
  private playerToken: string;
  private rechargePortalUrl: string;
  private gameId?: string;
  private language: SupportedLanguage;
  private modalContainer: HTMLDivElement | null = null;
  private styleElement: HTMLStyleElement | null = null;
  private toastElement: HTMLDivElement | null = null;
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    playerToken: string,
    rechargePortalUrl: string = 'https://playkit.ai/recharge',
    gameId?: string
  ) {
    super();
    this.playerToken = playerToken;
    this.rechargePortalUrl = rechargePortalUrl;
    this.gameId = gameId;
    this.language = this.detectLanguage();
  }

  /**
   * Detect user's preferred language
   */
  private detectLanguage(): SupportedLanguage {
    // Return default language if navigator is not available (server environment)
    if (typeof navigator === 'undefined') {
      return 'en';
    }

    const browserLang = navigator.language.toLowerCase();

    if (browserLang.startsWith('zh-tw') || browserLang.startsWith('zh-hk')) {
      return 'zh-TW';
    } else if (browserLang.startsWith('zh')) {
      return 'zh';
    } else if (browserLang.startsWith('ja')) {
      return 'ja';
    } else if (browserLang.startsWith('ko')) {
      return 'ko';
    }

    return 'en';
  }

  /**
   * Get translation text for current language
   */
  private t(key: keyof typeof translations.en): string {
    return translations[this.language][key];
  }

  /**
   * Build recharge URL with player token and gameId
   */
  public buildRechargeUrl(): string {
    let url = `${this.rechargePortalUrl}?playerToken=${encodeURIComponent(this.playerToken)}`;
    // Add gameId to URL so recharge page can fetch correct owner's wallet
    if (this.gameId) {
      url += `&gameId=${encodeURIComponent(this.gameId)}`;
    }
    return url;
  }

  /**
   * Open recharge window in a new tab
   */
  public openRechargeWindow(): void {
    const url = this.buildRechargeUrl();
    window.open(url, '_blank');
    this.emit('recharge_opened');
  }

  /**
   * Show insufficient balance modal
   */
  public showInsufficientBalanceModal(options: RechargeModalOptions = {}): Promise<void> {
    return new Promise((resolve) => {
      // If modal is already shown, don't show another
      if (this.modalContainer) {
        resolve();
        return;
      }

      this.injectStyles();
      this.createModal(options);
      this.emit('recharge_modal_shown');

      // Resolve when modal is dismissed
      const cleanup = () => {
        this.destroy();
        this.emit('recharge_modal_dismissed');
        resolve();
      };

      // Add event listeners for dismiss
      // Cast to HTMLDivElement since createModal() sets this.modalContainer
      const container = this.modalContainer as unknown as HTMLDivElement;
      const cancelButton = container.querySelector('.playkit-recharge-cancel');
      if (cancelButton) {
        cancelButton.addEventListener('click', cleanup);
      }

      const overlay = container.querySelector('.playkit-recharge-overlay');
      if (overlay) {
        overlay.addEventListener('click', (e: Event) => {
          if (e.target === overlay) {
            cleanup();
          }
        });
      }
    });
  }

  /**
   * Inject CSS styles for the modal
   */
  private injectStyles(): void {
    if (this.styleElement) {
      return;
    }

    this.styleElement = document.createElement('style');
    this.styleElement.textContent = `
      .playkit-recharge-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 999999;
        animation: playkit-recharge-fadeIn 0.2s ease-out;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      @keyframes playkit-recharge-fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      .playkit-recharge-modal {
        background: #fff;
        border: 1px solid rgba(0, 0, 0, 0.1);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.05);
        padding: 24px;
        max-width: 320px;
        width: 90%;
        position: relative;
        text-align: center;
      }

      .playkit-recharge-title {
        font-size: 14px;
        font-weight: 600;
        color: #171717;
        margin: 0 0 8px 0;
        text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      .playkit-recharge-message {
        font-size: 14px;
        color: #666;
        margin: 0 0 20px 0;
        text-align: center;
        line-height: 1.5;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      .playkit-recharge-balance {
        background: #f5f5f5;
        border: 1px solid #e5e7eb;
        padding: 16px;
        margin: 0 0 20px 0;
        text-align: center;
      }

      .playkit-recharge-balance-label {
        font-size: 12px;
        color: #666;
        margin: 0 0 8px 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      .playkit-recharge-balance-value {
        font-size: 24px;
        font-weight: bold;
        color: #171717;
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      .playkit-recharge-balance-unit {
        font-size: 14px;
        color: #666;
        margin-left: 4px;
      }

      .playkit-recharge-buttons {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .playkit-recharge-button {
        width: 100%;
        padding: 10px 16px;
        border: none;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      .playkit-recharge-button-primary {
        background: #171717;
        color: white;
      }

      .playkit-recharge-button-primary:hover {
        background: #404040;
      }

      .playkit-recharge-button-primary:active {
        background: #0a0a0a;
      }

      .playkit-recharge-button-secondary {
        background: transparent;
        color: #666;
        border: 1px solid #e5e7eb;
      }

      .playkit-recharge-button-secondary:hover {
        background: #f5f5f5;
        border-color: #d4d4d4;
      }

      .playkit-recharge-button-secondary:active {
        background: #e5e5e5;
      }

      @media (max-width: 480px) {
        .playkit-recharge-modal {
          padding: 20px;
        }
      }

      /* Daily Refresh Toast Styles */
      .playkit-daily-refresh-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #fff;
        border: 1px solid rgba(0, 0, 0, 0.1);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
        padding: 16px 20px;
        min-width: 240px;
        max-width: 320px;
        z-index: 999998;
        animation: playkit-toast-slideIn 0.3s ease-out;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      .playkit-daily-refresh-toast.hiding {
        animation: playkit-toast-fadeOut 0.3s ease-out forwards;
      }

      @keyframes playkit-toast-slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes playkit-toast-fadeOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }

      .playkit-toast-icon {
        width: 24px;
        height: 24px;
        background: #171717;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .playkit-toast-icon svg {
        width: 14px;
        height: 14px;
        color: #ffffff;
      }

      .playkit-toast-message {
        flex: 1;
        font-size: 14px;
        font-weight: 500;
        color: #171717;
        line-height: 1.4;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      @media (max-width: 480px) {
        .playkit-daily-refresh-toast {
          top: 10px;
          right: 10px;
          left: 10px;
          min-width: auto;
          max-width: none;
        }
      }
    `;

    document.head.appendChild(this.styleElement);
  }

  /**
   * Create the modal DOM structure
   */
  private createModal(options: RechargeModalOptions): void {
    this.modalContainer = document.createElement('div');
    this.modalContainer.className = 'playkit-recharge-overlay';

    const modal = document.createElement('div');
    modal.className = 'playkit-recharge-modal';

    // Title
    const title = document.createElement('h2');
    title.className = 'playkit-recharge-title';
    title.textContent = this.t('title');
    modal.appendChild(title);

    // Message
    const message = document.createElement('p');
    message.className = 'playkit-recharge-message';
    message.textContent = options.message || this.t('message');
    modal.appendChild(message);

    // Balance display (if provided)
    if (options.currentBalance !== undefined) {
      const balanceContainer = document.createElement('div');
      balanceContainer.className = 'playkit-recharge-balance';

      const balanceLabel = document.createElement('div');
      balanceLabel.className = 'playkit-recharge-balance-label';
      balanceLabel.textContent = this.t('currentBalance');
      balanceContainer.appendChild(balanceLabel);

      const balanceValue = document.createElement('div');
      balanceValue.className = 'playkit-recharge-balance-value';
      balanceValue.innerHTML = `${options.currentBalance}<span class="playkit-recharge-balance-unit">${this.t('credits')}</span>`;
      balanceContainer.appendChild(balanceValue);

      modal.appendChild(balanceContainer);
    }

    // Buttons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'playkit-recharge-buttons';

    const rechargeButton = document.createElement('button');
    rechargeButton.className = 'playkit-recharge-button playkit-recharge-button-primary';
    rechargeButton.textContent = this.t('rechargeButton');
    rechargeButton.addEventListener('click', () => {
      this.openRechargeWindow();
      this.destroy();
      this.emit('recharge_modal_dismissed');
    });
    buttonsContainer.appendChild(rechargeButton);

    const cancelButton = document.createElement('button');
    cancelButton.className = 'playkit-recharge-button playkit-recharge-button-secondary playkit-recharge-cancel';
    cancelButton.textContent = this.t('cancelButton');
    buttonsContainer.appendChild(cancelButton);

    modal.appendChild(buttonsContainer);
    this.modalContainer.appendChild(modal);
    document.body.appendChild(this.modalContainer);
  }

  /**
   * Update player token (if it changes)
   */
  public updateToken(newToken: string): void {
    this.playerToken = newToken;
  }

  /**
   * Show daily refresh toast notification
   */
  public showDailyRefreshToast(result: { amountAdded: number }): void {
    // Don't show if already showing
    if (this.toastElement) {
      return;
    }

    this.injectStyles();

    // Create toast element
    this.toastElement = document.createElement('div');
    this.toastElement.className = 'playkit-daily-refresh-toast';

    // Icon
    const icon = document.createElement('div');
    icon.className = 'playkit-toast-icon';
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    this.toastElement.appendChild(icon);

    // Message
    const message = document.createElement('div');
    message.className = 'playkit-toast-message';
    message.textContent = this.t('dailyRefreshMessage').replace('{amount}', String(result.amountAdded));
    this.toastElement.appendChild(message);
    document.body.appendChild(this.toastElement);

    // Auto-hide after 3 seconds
    this.toastTimeout = setTimeout(() => {
      this.hideToast();
    }, 3000);
  }

  /**
   * Hide the toast with fade-out animation
   */
  private hideToast(): void {
    if (!this.toastElement) {
      return;
    }

    // Add hiding class for animation
    this.toastElement.classList.add('hiding');

    // Remove after animation completes
    setTimeout(() => {
      if (this.toastElement) {
        this.toastElement.remove();
        this.toastElement = null;
      }
    }, 300);

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = null;
    }
  }

  /**
   * Destroy the modal and clean up
   */
  public destroy(): void {
    if (this.modalContainer) {
      this.modalContainer.remove();
      this.modalContainer = null;
    }

    if (this.toastElement) {
      this.toastElement.remove();
      this.toastElement = null;
    }

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = null;
    }

    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
  }
}

import EventEmitter from 'eventemitter3';
import { RechargeModalOptions } from '../types/recharge';

/**
 * Translations for the recharge modal
 */
const translations = {
  en: {
    title: 'Insufficient Balance',
    message: 'You don\'t have enough Spark! Come back tomorrow to receive new Spark, or you can recharge now.',
    currentBalance: 'Current Balance',
    credits: 'Spark',
    rechargeButton: 'Recharge Now',
    cancelButton: 'Cancel',
  },
  zh: {
    title: '余额不足',
    message: '您的Spark不够啦！明天再来就能领到新的Spark，或者也可以现在充值。',
    currentBalance: '当前余额',
    credits: 'Spark',
    rechargeButton: '立即充值',
    cancelButton: '取消',
  },
  'zh-TW': {
    title: '餘額不足',
    message: '您的Spark不夠啦！明天再來就能領到新的Spark，或者也可以現在充值。',
    currentBalance: '當前餘額',
    credits: 'Spark',
    rechargeButton: '立即充值',
    cancelButton: '取消',
  },
  ja: {
    title: '残高不足',
    message: 'Sparkが足りません！明日また来れば新しいSparkがもらえます。今すぐチャージすることもできます。',
    currentBalance: '現在の残高',
    credits: 'Spark',
    rechargeButton: '今すぐチャージ',
    cancelButton: 'キャンセル',
  },
  ko: {
    title: '잔액 부족',
    message: 'Spark가 부족합니다! 내일 다시 오시면 새로운 Spark를 받을 수 있으며, 지금 충전하실 수도 있습니다.',
    currentBalance: '현재 잔액',
    credits: 'Spark',
    rechargeButton: '지금 충전',
    cancelButton: '취소',
  },
};

type SupportedLanguage = keyof typeof translations;

/**
 * RechargeManager handles the recharge modal UI and recharge window opening
 */
export class RechargeManager extends EventEmitter {
  private playerToken: string;
  private rechargePortalUrl: string;
  private language: SupportedLanguage;
  private modalContainer: HTMLDivElement | null = null;
  private styleElement: HTMLStyleElement | null = null;

  constructor(
    playerToken: string,
    rechargePortalUrl: string = 'https://playkit.ai/playerPortal/recharge'
  ) {
    super();
    this.playerToken = playerToken;
    this.rechargePortalUrl = rechargePortalUrl;
    this.language = this.detectLanguage();
  }

  /**
   * Detect user's preferred language
   */
  private detectLanguage(): SupportedLanguage {
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
   * Build recharge URL with player token
   */
  public buildRechargeUrl(): string {
    return `${this.rechargePortalUrl}?playerToken=${encodeURIComponent(this.playerToken)}`;
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
      const cancelButton = this.modalContainer?.querySelector('.playkit-recharge-cancel');
      if (cancelButton) {
        cancelButton.addEventListener('click', cleanup);
      }

      const overlay = this.modalContainer?.querySelector('.playkit-recharge-overlay');
      if (overlay) {
        overlay.addEventListener('click', (e) => {
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
        background-color: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 999999;
        animation: playkit-recharge-fadeIn 0.2s ease-out;
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
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        padding: 32px;
        max-width: 400px;
        width: 90%;
        position: relative;
        animation: playkit-recharge-slideUp 0.3s ease-out;
      }

      @keyframes playkit-recharge-slideUp {
        from {
          transform: translateY(20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      .playkit-recharge-title {
        font-size: 24px;
        font-weight: bold;
        color: #ffffff;
        margin: 0 0 16px 0;
        text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      .playkit-recharge-message {
        font-size: 16px;
        color: rgba(255, 255, 255, 0.9);
        margin: 0 0 24px 0;
        text-align: center;
        line-height: 1.5;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      .playkit-recharge-balance {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 12px;
        padding: 16px;
        margin: 0 0 24px 0;
        text-align: center;
        backdrop-filter: blur(10px);
      }

      .playkit-recharge-balance-label {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.8);
        margin: 0 0 8px 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      .playkit-recharge-balance-value {
        font-size: 32px;
        font-weight: bold;
        color: #ffffff;
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      .playkit-recharge-balance-unit {
        font-size: 16px;
        color: rgba(255, 255, 255, 0.8);
        margin-left: 8px;
      }

      .playkit-recharge-buttons {
        display: flex;
        gap: 12px;
        justify-content: center;
      }

      .playkit-recharge-button {
        flex: 1;
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      .playkit-recharge-button-primary {
        background: #ffffff;
        color: #667eea;
      }

      .playkit-recharge-button-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 16px rgba(255, 255, 255, 0.2);
      }

      .playkit-recharge-button-primary:active {
        transform: translateY(0);
      }

      .playkit-recharge-button-secondary {
        background: rgba(255, 255, 255, 0.15);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.3);
      }

      .playkit-recharge-button-secondary:hover {
        background: rgba(255, 255, 255, 0.25);
      }

      .playkit-recharge-button-secondary:active {
        background: rgba(255, 255, 255, 0.15);
      }

      @media (max-width: 480px) {
        .playkit-recharge-modal {
          padding: 24px;
        }

        .playkit-recharge-title {
          font-size: 20px;
        }

        .playkit-recharge-message {
          font-size: 14px;
        }

        .playkit-recharge-balance-value {
          font-size: 28px;
        }

        .playkit-recharge-buttons {
          flex-direction: column;
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
   * Destroy the modal and clean up
   */
  public destroy(): void {
    if (this.modalContainer) {
      this.modalContainer.remove();
      this.modalContainer = null;
    }

    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
  }
}

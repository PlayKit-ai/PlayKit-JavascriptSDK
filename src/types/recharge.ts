/**
 * Recharge and balance checking related types
 */

/**
 * Configuration for recharge functionality
 */
export interface RechargeConfig {
  /**
   * Automatically show insufficient balance modal when API calls fail due to low credits
   * @default true
   */
  autoShowBalanceModal?: boolean;

  /**
   * Interval for periodic balance checks in milliseconds
   * Set to 0 to disable periodic checks
   * @default 30000 (30 seconds)
   */
  balanceCheckInterval?: number;

  /**
   * Check balance after each API call that consumes credits
   * @default true
   */
  checkBalanceAfterApiCall?: boolean;

  /**
   * Base URL for the recharge portal
   * @default 'https://playkit.ai/playerPortal/recharge'
   */
  rechargePortalUrl?: string;
}

/**
 * Recharge modal display options
 */
export interface RechargeModalOptions {
  /**
   * Current balance to display in the modal
   */
  currentBalance?: number;

  /**
   * Optional custom message to display
   */
  message?: string;
}

/**
 * Recharge-related events
 */
export interface RechargeEvents {
  /**
   * Emitted when balance is detected to be low
   */
  balance_low: (credits: number) => void;

  /**
   * Emitted when an API call fails due to insufficient credits
   */
  insufficient_credits: (error: Error) => void;

  /**
   * Emitted when user opens recharge window
   */
  recharge_opened: () => void;

  /**
   * Emitted when insufficient balance modal is shown
   */
  recharge_modal_shown: () => void;

  /**
   * Emitted when insufficient balance modal is dismissed
   */
  recharge_modal_dismissed: () => void;
}

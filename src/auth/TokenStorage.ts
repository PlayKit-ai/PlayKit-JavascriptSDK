/**
 * Token storage with encryption using Web Crypto API
 * Stores tokens with AES-128-GCM encryption when available
 * Works in both browser (localStorage) and server (memory) environments
 */

import { AuthState } from '../types';
import { Logger } from '../utils/Logger';
import { IStorage, createStorage } from '../utils/Storage';
import {
  base64Encode,
  base64Decode,
  getRandomBytes,
  textEncode,
  textDecode,
  isWebCryptoAvailable,
} from '../utils/CryptoUtils';

const STORAGE_KEY_PREFIX = 'playkit_';
const ENCRYPTION_KEY_NAME = 'playkit_encryption_key';

export interface TokenStorageOptions {
  /** Custom storage implementation */
  storage?: IStorage;
  /** SDK mode - determines default storage type */
  mode?: 'browser' | 'server';
}

export class TokenStorage {
  private encryptionKey: CryptoKey | null = null;
  private logger = Logger.getLogger('TokenStorage');
  private storage: IStorage;

  constructor(options: TokenStorageOptions = {}) {
    this.storage = options.storage || createStorage(options.mode || 'browser');
  }

  /**
   * Initialize the encryption key
   */
  async initialize(): Promise<void> {
    // Skip encryption if Web Crypto API is not available
    if (!isWebCryptoAvailable()) {
      this.logger.warn('Web Crypto API not available, encryption disabled');
      return;
    }

    // Try to load existing key or generate new one
    const storedKey = this.storage.getItem(ENCRYPTION_KEY_NAME);
    if (storedKey) {
      try {
        const keyData = this.base64ToArrayBuffer(storedKey);
        this.encryptionKey = await crypto.subtle.importKey(
          'raw',
          keyData,
          { name: 'AES-GCM' },
          true,
          ['encrypt', 'decrypt']
        );
      } catch (error) {
        this.logger.warn('Failed to import encryption key, generating new one', error);
        await this.generateNewKey();
      }
    } else {
      await this.generateNewKey();
    }
  }

  /**
   * Generate a new encryption key
   */
  private async generateNewKey(): Promise<void> {
    if (!isWebCryptoAvailable()) return;

    this.encryptionKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 128 },
      true,
      ['encrypt', 'decrypt']
    );

    // Store the key
    const exported = await crypto.subtle.exportKey('raw', this.encryptionKey);
    this.storage.setItem(ENCRYPTION_KEY_NAME, this.arrayBufferToBase64(exported));
  }

  /**
   * Encrypt data
   */
  private async encrypt(data: string): Promise<string> {
    if (!this.encryptionKey || !isWebCryptoAvailable()) {
      // Fallback to plain storage if encryption unavailable
      return data;
    }

    const iv = getRandomBytes(12);
    const encoded = textEncode(data);

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as Uint8Array<ArrayBuffer> },
      this.encryptionKey,
      encoded as Uint8Array<ArrayBuffer>
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    return this.arrayBufferToBase64(combined.buffer);
  }

  /**
   * Decrypt data
   */
  private async decrypt(encryptedData: string): Promise<string> {
    if (!this.encryptionKey || !isWebCryptoAvailable()) {
      // Data not encrypted
      return encryptedData;
    }

    try {
      const combined = this.base64ToArrayBuffer(encryptedData);
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey,
        encrypted
      );

      return textDecode(decrypted);
    } catch (error) {
      this.logger.error('Decryption failed', error);
      return encryptedData; // Return original if decryption fails
    }
  }

  /**
   * Save auth state
   */
  async saveAuthState(gameId: string, authState: AuthState): Promise<void> {
    const key = `${STORAGE_KEY_PREFIX}${gameId}_auth`;
    const data = JSON.stringify(authState);
    const encrypted = await this.encrypt(data);
    this.storage.setItem(key, encrypted);
  }

  /**
   * Load auth state
   */
  async loadAuthState(gameId: string): Promise<AuthState | null> {
    const key = `${STORAGE_KEY_PREFIX}${gameId}_auth`;
    const encrypted = this.storage.getItem(key);
    if (!encrypted) return null;

    try {
      const decrypted = await this.decrypt(encrypted);
      return JSON.parse(decrypted) as AuthState;
    } catch (error) {
      this.logger.error('Failed to load auth state', error);
      return null;
    }
  }

  /**
   * Clear auth state for a game
   */
  clearAuthState(gameId: string): void {
    const key = `${STORAGE_KEY_PREFIX}${gameId}_auth`;
    this.storage.removeItem(key);
  }

  /**
   * Clear all PlayKit data
   */
  clearAll(): void {
    const keys = this.storage.keys();
    keys.forEach((key) => {
      if (key.startsWith(STORAGE_KEY_PREFIX)) {
        this.storage.removeItem(key);
      }
    });
  }

  /**
   * Get the underlying storage instance
   */
  getStorage(): IStorage {
    return this.storage;
  }

  /**
   * Utility: ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    return base64Encode(new Uint8Array(buffer));
  }

  /**
   * Utility: Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const decoded = base64Decode(base64);
    // Copy to a new ArrayBuffer to ensure proper type
    return decoded.buffer.slice(decoded.byteOffset, decoded.byteOffset + decoded.byteLength) as ArrayBuffer;
  }
}

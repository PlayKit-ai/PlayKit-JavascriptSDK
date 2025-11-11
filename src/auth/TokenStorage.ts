/**
 * Token storage with encryption using Web Crypto API
 * Stores tokens in localStorage with AES-128-GCM encryption
 */

import { AuthState } from '../types';

const STORAGE_KEY_PREFIX = 'playkit_';
const SHARED_TOKEN_KEY = 'playkit_shared_token';
const ENCRYPTION_KEY_NAME = 'playkit_encryption_key';

export class TokenStorage {
  private encryptionKey: CryptoKey | null = null;

  /**
   * Initialize the encryption key
   */
  async initialize(): Promise<void> {
    if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
      console.warn('Web Crypto API not available, encryption disabled');
      return;
    }

    // Try to load existing key or generate new one
    const storedKey = localStorage.getItem(ENCRYPTION_KEY_NAME);
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
        console.warn('Failed to import encryption key, generating new one', error);
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
    if (!crypto.subtle) return;

    this.encryptionKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 128 },
      true,
      ['encrypt', 'decrypt']
    );

    // Store the key
    const exported = await crypto.subtle.exportKey('raw', this.encryptionKey);
    localStorage.setItem(ENCRYPTION_KEY_NAME, this.arrayBufferToBase64(exported));
  }

  /**
   * Encrypt data
   */
  private async encrypt(data: string): Promise<string> {
    if (!this.encryptionKey || !crypto.subtle) {
      // Fallback to plain storage if encryption unavailable
      return data;
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(data);

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      encoded
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    return this.arrayBufferToBase64(combined);
  }

  /**
   * Decrypt data
   */
  private async decrypt(encryptedData: string): Promise<string> {
    if (!this.encryptionKey || !crypto.subtle) {
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

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Decryption failed', error);
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
    localStorage.setItem(key, encrypted);
  }

  /**
   * Load auth state
   */
  async loadAuthState(gameId: string): Promise<AuthState | null> {
    const key = `${STORAGE_KEY_PREFIX}${gameId}_auth`;
    const encrypted = localStorage.getItem(key);
    if (!encrypted) return null;

    try {
      const decrypted = await this.decrypt(encrypted);
      return JSON.parse(decrypted) as AuthState;
    } catch (error) {
      console.error('Failed to load auth state', error);
      return null;
    }
  }

  /**
   * Save shared token (accessible by all DeveloperWorks games)
   */
  async saveSharedToken(token: string): Promise<void> {
    const encrypted = await this.encrypt(token);
    localStorage.setItem(SHARED_TOKEN_KEY, encrypted);
  }

  /**
   * Load shared token
   */
  async loadSharedToken(): Promise<string | null> {
    const encrypted = localStorage.getItem(SHARED_TOKEN_KEY);
    if (!encrypted) return null;

    try {
      return await this.decrypt(encrypted);
    } catch (error) {
      console.error('Failed to load shared token', error);
      return null;
    }
  }

  /**
   * Clear auth state for a game
   */
  clearAuthState(gameId: string): void {
    const key = `${STORAGE_KEY_PREFIX}${gameId}_auth`;
    localStorage.removeItem(key);
  }

  /**
   * Clear shared token
   */
  clearSharedToken(): void {
    localStorage.removeItem(SHARED_TOKEN_KEY);
  }

  /**
   * Clear all PlayKit data
   */
  clearAll(): void {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(STORAGE_KEY_PREFIX) || key === SHARED_TOKEN_KEY) {
        localStorage.removeItem(key);
      }
    });
  }

  /**
   * Utility: ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Utility: Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

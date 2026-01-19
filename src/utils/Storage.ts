/**
 * Cross-platform storage abstraction layer
 * Provides a unified interface for storage operations that works in both
 * browser and Node.js environments.
 */

/**
 * Storage interface for cross-platform compatibility
 */
export interface IStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

/**
 * Browser storage implementation using localStorage
 */
export class BrowserStorage implements IStorage {
  getItem(key: string): string | null {
    return localStorage.getItem(key);
  }

  setItem(key: string, value: string): void {
    localStorage.setItem(key, value);
  }

  removeItem(key: string): void {
    localStorage.removeItem(key);
  }

  keys(): string[] {
    return Object.keys(localStorage);
  }
}

/**
 * In-memory storage implementation for server/Node.js environments
 */
export class MemoryStorage implements IStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Clear all items from memory storage
   */
  clear(): void {
    this.store.clear();
  }
}

/**
 * Check if localStorage is available in the current environment
 */
export function isLocalStorageAvailable(): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  try {
    const testKey = '__playkit_storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a storage instance based on the environment or mode
 * @param mode - SDK mode ('browser' | 'server')
 * @param customStorage - Optional custom storage implementation
 */
export function createStorage(
  mode: 'browser' | 'server' = 'browser',
  customStorage?: IStorage
): IStorage {
  // Use custom storage if provided
  if (customStorage) {
    return customStorage;
  }

  // Server mode always uses memory storage
  if (mode === 'server') {
    return new MemoryStorage();
  }

  // Browser mode - use localStorage if available, otherwise memory
  if (isLocalStorageAvailable()) {
    return new BrowserStorage();
  }

  return new MemoryStorage();
}

/**
 * Cross-platform cryptographic utilities
 * Provides unified crypto operations that work in both browser and Node.js environments.
 */

/**
 * Check if we're running in a Node.js environment
 */
function isNodeEnvironment(): boolean {
  return typeof process !== 'undefined' &&
         process.versions != null &&
         process.versions.node != null;
}

/**
 * Get random bytes - works in both browser and Node.js
 * @param length - Number of random bytes to generate
 * @returns Uint8Array of random bytes
 */
export function getRandomBytes(length: number): Uint8Array {
  if (isNodeEnvironment()) {
    // Node.js environment
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto');
    return new Uint8Array(nodeCrypto.randomBytes(length));
  } else if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    // Browser environment
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return array;
  } else {
    throw new Error('No secure random number generator available');
  }
}

/**
 * Compute SHA-256 hash - works in both browser and Node.js
 * @param data - Data to hash (Uint8Array or string)
 * @returns Promise resolving to hash as Uint8Array
 */
export async function sha256(data: Uint8Array | string): Promise<Uint8Array> {
  const inputData = typeof data === 'string' ? textEncode(data) : data;

  if (isNodeEnvironment()) {
    // Node.js environment
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto');
    const hash = nodeCrypto.createHash('sha256').update(Buffer.from(inputData)).digest();
    return new Uint8Array(hash);
  } else if (typeof crypto !== 'undefined' && crypto.subtle) {
    // Browser environment
    const hashBuffer = await crypto.subtle.digest('SHA-256', inputData as Uint8Array<ArrayBuffer>);
    return new Uint8Array(hashBuffer);
  } else {
    throw new Error('No SHA-256 implementation available');
  }
}

/**
 * Base64 encode binary data - works in both browser and Node.js
 * @param data - Data to encode (Uint8Array or ArrayBuffer)
 * @returns Base64 encoded string
 */
export function base64Encode(data: Uint8Array | ArrayBuffer): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;

  if (isNodeEnvironment()) {
    // Node.js environment
    return Buffer.from(bytes).toString('base64');
  } else if (typeof btoa !== 'undefined') {
    // Browser environment
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } else {
    throw new Error('No Base64 encoder available');
  }
}

/**
 * Base64 decode string - works in both browser and Node.js
 * @param base64 - Base64 encoded string
 * @returns Decoded data as Uint8Array
 */
export function base64Decode(base64: string): Uint8Array {
  if (isNodeEnvironment()) {
    // Node.js environment
    return new Uint8Array(Buffer.from(base64, 'base64'));
  } else if (typeof atob !== 'undefined') {
    // Browser environment
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } else {
    throw new Error('No Base64 decoder available');
  }
}

/**
 * Base64 URL encode - safe for URLs (no +, /, or = characters)
 * @param data - Data to encode (Uint8Array)
 * @returns URL-safe Base64 encoded string
 */
export function base64URLEncode(data: Uint8Array): string {
  const base64 = base64Encode(data);
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64 URL decode - decode URL-safe Base64
 * @param base64url - URL-safe Base64 encoded string
 * @returns Decoded data as Uint8Array
 */
export function base64URLDecode(base64url: string): Uint8Array {
  // Restore standard Base64 format
  let base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  // Add padding if necessary
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }

  return base64Decode(base64);
}

/**
 * Encode text to UTF-8 bytes - works in both browser and Node.js
 * @param text - Text to encode
 * @returns UTF-8 encoded bytes as Uint8Array
 */
export function textEncode(text: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    // Browser or modern Node.js
    return new TextEncoder().encode(text);
  } else if (isNodeEnvironment()) {
    // Older Node.js
    return new Uint8Array(Buffer.from(text, 'utf-8'));
  } else {
    throw new Error('No text encoder available');
  }
}

/**
 * Decode UTF-8 bytes to text - works in both browser and Node.js
 * @param data - UTF-8 encoded bytes (Uint8Array or ArrayBuffer)
 * @returns Decoded text string
 */
export function textDecode(data: Uint8Array | ArrayBuffer): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;

  if (typeof TextDecoder !== 'undefined') {
    // Browser or modern Node.js
    return new TextDecoder().decode(bytes);
  } else if (isNodeEnvironment()) {
    // Older Node.js
    return Buffer.from(bytes).toString('utf-8');
  } else {
    throw new Error('No text decoder available');
  }
}

/**
 * Check if Web Crypto API is available
 * @returns true if Web Crypto subtle API is available
 */
export function isWebCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' &&
         crypto.subtle != null;
}

/**
 * Check if any crypto implementation is available
 * @returns true if either Web Crypto or Node.js crypto is available
 */
export function isCryptoAvailable(): boolean {
  if (isNodeEnvironment()) {
    try {
      require('crypto');
      return true;
    } catch {
      return false;
    }
  }
  return isWebCryptoAvailable();
}

// Crypto polyfill for browser compatibility
// Provides Node.js crypto module using Web Crypto API
// This is needed for Trezor, Torus, and other wallet adapters that import from Node's crypto module

// Use Web Crypto API's getRandomValues
export function getRandomValues<T extends ArrayBufferView | null>(array: T): T {
  if (array === null) {
    return array;
  }
  
  // Use Web Crypto API (available in all modern browsers)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return crypto.getRandomValues(array);
  }
  
  // Fallback for older browsers (shouldn't be needed in modern browsers)
  throw new Error('crypto.getRandomValues is not available');
}

// Named export for compatibility with: import { getRandomValues as cryptoGetRandomValues } from 'crypto'
export { getRandomValues as cryptoGetRandomValues };

// Default export for compatibility with: import nodeCrypto from 'crypto'
// This is needed for @toruslabs/eccrypto and other packages
const cryptoPolyfill = {
  getRandomValues,
  // Add other crypto methods as needed
  randomBytes: (size: number): Uint8Array => {
    const array = new Uint8Array(size);
    getRandomValues(array);
    return array;
  },
};

export default cryptoPolyfill;

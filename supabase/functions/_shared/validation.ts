// Shared validation utilities for Edge Functions

// Solana wallet address validation
// Base58 encoded, 32-44 characters
const WALLET_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isValidWalletAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  return WALLET_ADDRESS_REGEX.test(address);
}

// Transaction signature validation
// Base58 encoded, typically 87-88 characters
const TX_SIGNATURE_REGEX = /^[1-9A-HJ-NP-Za-km-z]{80,90}$/;

export function isValidTxSignature(signature: string): boolean {
  if (!signature || typeof signature !== 'string') return false;
  return TX_SIGNATURE_REGEX.test(signature);
}

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return UUID_REGEX.test(id);
}

// Sanitize string input (prevent SQL injection in raw queries)
export function sanitizeString(input: string, maxLength = 255): string {
  if (!input || typeof input !== 'string') return '';
  return input.slice(0, maxLength).replace(/[<>"'&]/g, '');
}

// Validate numeric range
export function isValidIndex(index: number, min = 0, max = 3): boolean {
  return typeof index === 'number' && Number.isInteger(index) && index >= min && index <= max;
}

// Rate limiting helper (simple in-memory, resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

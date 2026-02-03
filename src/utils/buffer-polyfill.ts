/**
 * ESM shim for the CJS "buffer" package so that both
 * "import Buffer from 'buffer'" and "import { Buffer } from 'buffer'" work in Vite.
 * Also sets globalThis.Buffer for code (e.g. Solana) that expects it.
 * Uses alias "buffer-cjs" -> node_modules/buffer so we don't resolve back to this file.
 */
// @ts-expect-error - CJS module interop
import buf from 'buffer-cjs';

const B = buf as { Buffer?: unknown; default?: { Buffer?: unknown } | unknown };
const BufferConstructor = (B?.Buffer ?? (B?.default && typeof B.default === 'object' && (B.default as { Buffer?: unknown }).Buffer) ?? B?.default ?? B) as typeof globalThis.Buffer;

export const Buffer = BufferConstructor;
export default BufferConstructor;

if (typeof globalThis !== 'undefined') {
  (globalThis as { Buffer: typeof globalThis.Buffer }).Buffer = BufferConstructor;
}
if (typeof window !== 'undefined') {
  (window as unknown as { Buffer: typeof globalThis.Buffer }).Buffer = BufferConstructor;
}

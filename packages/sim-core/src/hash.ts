import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { canonicalBytes } from './canonical';

/** Matches exactly 64 lowercase hex characters. */
export const HASH_PATTERN = /^[0-9a-f]{64}$/;
export const isHash = (value: unknown): value is string =>
  typeof value === 'string' && HASH_PATTERN.test(value);

export const Hash32 = {
  /** SHA-256 over raw bytes, returned as 64 lowercase hex characters. */
  sha256(bytes: Uint8Array): string {
    return bytesToHex(sha256(bytes));
  },
} as const;

/** SHA-256 over the canonical bytes of a value. */
export const hashCanonical = (value: unknown): string => Hash32.sha256(canonicalBytes(value));

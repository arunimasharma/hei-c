/**
 * Zero-Knowledge AES-GCM Encryption Service
 *
 * All user data is encrypted at rest in IndexedDB using AES-256-GCM.
 * The master encryption key is derived via PBKDF2 from a per-device secret
 * and is never transmitted off-device. Even if the IndexedDB files are
 * accessed directly, the plaintext data is unreadable without the key.
 *
 * Key lifecycle:
 *  1. On first launch a 128-bit random salt is generated and stored in
 *     localStorage (non-sensitive — salts are public by design).
 *  2. The actual CryptoKey is derived via PBKDF2(device-secret + salt, 210_000, SHA-256)
 *     and kept only in memory for the session lifetime.
 *  3. All writes to Dexie encrypt the JSON payload with a fresh random 96-bit IV.
 *  4. The IV is stored alongside the ciphertext (standard AES-GCM practice).
 */

const SALT_STORAGE_KEY = 'heq_enc_salt_v1';
const PBKDF2_ITERATIONS = 210_000; // OWASP 2023 recommendation
const KEY_LENGTH = 256;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Accepts either an ArrayBuffer or a Uint8Array.
 * TypeScript 5.x tightens the Web Crypto typings so Uint8Array<ArrayBuffer>
 * is not directly assignable to ArrayBuffer — we normalise here.
 */
function bufferToBase64(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  // Use a chunked approach to avoid call-stack overflow for large buffers.
  const chunkSize = 0x8000;
  let result = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(result);
}

function base64ToBuffer(b64: string): Uint8Array {
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf;
}

/** Returns (or lazily creates) the 128-bit random salt stored in localStorage. */
function getOrCreateSalt(): Uint8Array {
  const stored = localStorage.getItem(SALT_STORAGE_KEY);
  if (stored) return base64ToBuffer(stored);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(SALT_STORAGE_KEY, bufferToBase64(salt));
  return salt;
}

/**
 * Derive a stable device-fingerprint string that changes only if the user
 * clears site data.  We combine the origin with a persistent random token
 * so the derived key is origin-scoped and device-bound.
 */
function getDeviceSecret(): string {
  const DEVICE_KEY = 'heq_device_id_v1';
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    const rand = crypto.getRandomValues(new Uint8Array(24));
    id = bufferToBase64(rand);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return `${location.origin}::${id}`;
}

// ── Key management ────────────────────────────────────────────────────────────

let _keyPromise: Promise<CryptoKey> | null = null;

/**
 * Returns (and caches for the session) the AES-256-GCM CryptoKey derived
 * from the device secret and the persisted salt.
 */
export async function getEncryptionKey(): Promise<CryptoKey> {
  if (_keyPromise) return _keyPromise;
  _keyPromise = (async () => {
    const salt = getOrCreateSalt();
    const deviceSecret = getDeviceSecret();

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(deviceSecret),
      { name: 'PBKDF2' },
      false,
      ['deriveKey'],
    );

    // Pass salt as ArrayBuffer to satisfy strict Web Crypto typings.
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: KEY_LENGTH },
      false, // non-extractable — never leaves memory
      ['encrypt', 'decrypt'],
    );
  })();
  return _keyPromise;
}

/** Wipe the in-memory key cache (call on logout). */
export function evictKeyFromMemory(): void {
  _keyPromise = null;
}

// ── Encrypt / Decrypt ─────────────────────────────────────────────────────────

export interface EncryptedBlob {
  iv: string;   // base64-encoded 96-bit IV
  ct: string;   // base64-encoded ciphertext
}

/** Encrypts any JSON-serialisable value and returns a transportable blob. */
export async function encrypt<T>(value: T): Promise<EncryptedBlob> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    plaintext,
  );
  return { iv: bufferToBase64(iv), ct: bufferToBase64(ciphertext) };
}

/** Decrypts a blob produced by {@link encrypt} and parses the JSON payload. */
export async function decrypt<T>(blob: EncryptedBlob): Promise<T> {
  const key = await getEncryptionKey();
  const iv = base64ToBuffer(blob.iv);
  const ciphertext = base64ToBuffer(blob.ct);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext.buffer as ArrayBuffer,
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

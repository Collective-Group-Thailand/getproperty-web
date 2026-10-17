/**
 * The staff device PIN (00-master-plan.md §4: optional re-lock after inactivity). It guards the open
 * session on a shared phone — it is not a credential: the API never sees it, and five wrong tries sign
 * the device out. Stored per browser as a salted PBKDF2-SHA-256 hash (never the PIN).
 */
const STORAGE_KEY = "gp_device_pin";
const ACTIVITY_KEY = "gp_device_activity";
const ITERATIONS = 150_000;
export const PIN_PATTERN = /^\d{4,6}$/;
export const MAX_PIN_ATTEMPTS = 5;
/** Minutes without use before the app locks. */
export const LOCK_AFTER_MINUTES = 5;

interface StoredPin {
  salt: string;
  hash: string;
  iterations: number;
}

const toBase64 = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))));
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return toBase64(bits);
}

function read(): StoredPin | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredPin) : null;
  } catch {
    return null;
  }
}

export function hasPin(): boolean {
  return read() !== null;
}

export async function setPin(pin: string): Promise<void> {
  if (!PIN_PATTERN.test(pin)) throw new Error("invalid pin");
  const salt = new Uint8Array(new ArrayBuffer(16));
  crypto.getRandomValues(salt);
  const stored: StoredPin = { salt: toBase64(salt), hash: await derive(pin, salt, ITERATIONS), iterations: ITERATIONS };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export function clearPin(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = read();
  if (!stored || !PIN_PATTERN.test(pin)) return false;
  const salt = fromBase64(stored.salt);
  const candidate = await derive(pin, new Uint8Array(salt.buffer as ArrayBuffer), stored.iterations);
  // Constant-time comparison of the two base64 strings.
  if (candidate.length !== stored.hash.length) return false;
  let difference = 0;
  for (let i = 0; i < candidate.length; i += 1) difference |= candidate.charCodeAt(i) ^ stored.hash.charCodeAt(i);
  return difference === 0;
}

export function recordActivity(at = Date.now()): void {
  try {
    window.localStorage.setItem(ACTIVITY_KEY, String(at));
  } catch {
    // ignore
  }
}

export function lastActivity(): number | null {
  try {
    const value = Number(window.localStorage.getItem(ACTIVITY_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

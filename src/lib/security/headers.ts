import type { Zone } from "@/lib/zones";

/**
 * Per-zone security headers (F1 1.1, ADR-0004). One origin per zone means one policy per zone:
 *
 * - **owner** — the console plus the public marketing pages.
 * - **staff** — the PWA: camera (`Permissions-Policy: camera=(self)`), `blob:` photos, its service
 *   worker, and the signed object-storage URL it uploads meter photos to.
 * - **admin** — the strictest: no camera, no service worker, no `blob:` media.
 *
 * No zone allows a LINE or LIFF domain: the resident LINE Mini App is `getproperty-liff` (D-154).
 * Scripts are nonce-based with `'strict-dynamic'` (Next stamps the nonce on its own scripts when it
 * finds it in the request's CSP header). Styles allow `'unsafe-inline'`: Radix positions popovers
 * with inline `style` and sonner injects its stylesheet at runtime; style injection cannot run script,
 * and the script policy is what stops XSS.
 */

export interface CspOptions {
  zone: Zone;
  nonce: string;
  /** `next dev` needs `'unsafe-eval'` (React's dev overlay) and a websocket for HMR. */
  dev: boolean;
  /** Object storage / CDN origin of signed file URLs (`NEXT_PUBLIC_ASSET_BASE_URL`). */
  assetOrigin?: string;
  /** Sentry ingest origin derived from `NEXT_PUBLIC_SENTRY_DSN`, when error reporting is on. */
  sentryOrigin?: string;
}

function origin(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

export function sentryOriginFromDsn(dsn: string | undefined): string | undefined {
  return origin(dsn);
}

export function buildCsp({ zone, nonce, dev, assetOrigin, sentryOrigin }: CspOptions): string {
  const asset = origin(assetOrigin);
  const sentry = origin(sentryOrigin);
  const list = (...values: (string | false | undefined)[]) => values.filter(Boolean).join(" ");

  const directives: Record<string, string> = {
    "default-src": "'self'",
    "script-src": list("'self'", `'nonce-${nonce}'`, "'strict-dynamic'", dev && "'unsafe-eval'"),
    "style-src": "'self' 'unsafe-inline'",
    "img-src": list("'self'", "data:", zone !== "admin" && "blob:", asset),
    "font-src": "'self'",
    "connect-src": list("'self'", asset, sentry, dev && "ws:"),
    "media-src": list("'self'", zone === "staff" && "blob:", zone === "staff" && "mediastream:"),
    "worker-src": zone === "staff" ? "'self'" : "'none'",
    "manifest-src": "'self'",
    "frame-src": "'none'",
    "frame-ancestors": "'none'",
    "object-src": "'none'",
    "base-uri": "'none'",
    "form-action": "'self'",
  };
  const policy = Object.entries(directives).map(([name, value]) => `${name} ${value}`);
  if (!dev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/** `Permissions-Policy`: the camera only on the staff host; nothing else any zone needs. */
export function permissionsPolicy(zone: Zone): string {
  const camera = zone === "staff" ? "camera=(self)" : "camera=()";
  return [
    camera,
    "microphone=()",
    "geolocation=()",
    "payment=()",
    "usb=()",
    "serial=()",
    "bluetooth=()",
    "midi=()",
    "magnetometer=()",
    "gyroscope=()",
    "accelerometer=()",
    "display-capture=()",
    "browsing-topics=()",
    "interest-cohort=()",
  ].join(", ");
}

export interface SecurityHeaderOptions extends CspOptions {
  /** Marketing pages on the owner host are the only indexable responses (F1 1.3 §7). */
  indexable: boolean;
  /** HSTS only where TLS terminates for real (production). */
  hsts: boolean;
}

export function securityHeaders(options: SecurityHeaderOptions): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": buildCsp(options),
    "Permissions-Policy": permissionsPolicy(options.zone),
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
  if (!options.indexable) headers["X-Robots-Tag"] = "noindex, nofollow";
  if (options.hsts) headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
  return headers;
}

/** 128 bits of randomness, base64 — Web Crypto, so it runs wherever the proxy runs. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

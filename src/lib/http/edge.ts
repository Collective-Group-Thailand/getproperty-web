/**
 * What this app may believe about a request from its own edge (review H1, L1), shared by the zone BFFs, the proxy,
 * the Server Actions and the Server Components' API client. Framework-free (the proxy runs on the edge runtime, the
 * unit tests in Node). The rule is the one getproperty-liff applies and getproperty-api RUNBOOK §11 / D-229 assume:
 * the BFFs forward the end-user address *their own edge* saw, never the client's `X-Forwarded-For` as is.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IPV4_PART = "(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4 = new RegExp(`^${IPV4_PART}(\\.${IPV4_PART}){3}$`);
const IPV6 = new RegExp(`^[0-9a-f:]+(:${IPV4_PART}(\\.${IPV4_PART}){3})?$`, "i");

/** The header the API reads the end-user address from (Express `trust proxy`, counted from the right). */
export const FORWARDED_FOR_HEADER = "x-forwarded-for";

/**
 * The request id for logs and the API: the inbound `x-request-id` only when it is a UUID (our edge or this app made
 * it), else a new one — a client must not choose the correlation id or inject text into log fields (review L1).
 */
export function requestIdFrom(headers: Pick<Headers, "get">): string {
  const inbound = headers.get("x-request-id")?.trim();
  return inbound && UUID.test(inbound) ? inbound.toLowerCase() : crypto.randomUUID();
}

function isIpAddress(value: string): boolean {
  return IPV4.test(value) || (value.includes(":") && value.length <= 45 && IPV6.test(value));
}

/**
 * The end user's address as **our** edge saw it (review H1). On the Collective platform (D-230) Caddy is the one
 * proxy in front of this container: for an internet client it *replaces* `X-Forwarded-For` with the address it
 * received the request from, and for a client inside its `trusted_proxies` it appends that address — either way the
 * right-most entry is the one Caddy vouches for, and anything left of it is whatever the client sent. With
 * `trustedHops` such proxies in front of this app (Caddy: 1), the client is the entry `trustedHops` from the right. 0 (no trusted proxy, local dev), a header with fewer entries or
 * a value that is not an IP address → unknown: nothing is forwarded. `X-Real-IP` is never read (any client can send
 * it).
 */
export function clientIpFrom(headers: Pick<Headers, "get">, trustedHops: number): string | undefined {
  if (!Number.isInteger(trustedHops) || trustedHops <= 0) return undefined;
  const entries = (headers.get(FORWARDED_FOR_HEADER) ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const candidate = entries[entries.length - trustedHops];
  return candidate && isIpAddress(candidate) ? candidate : undefined;
}

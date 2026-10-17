/** Header names the clients, the BFF and the mocks agree on (contract §3, §8; ADR-0004). */
export const CSRF_HEADER = "x-getproperty-csrf";
export const REQUEST_ID_HEADER = "x-request-id";
export const TENANT_HEADER = "x-tenant-id";
export const IDEMPOTENCY_HEADER = "idempotency-key";
export const IF_MATCH_HEADER = "if-match";

/** A fresh `Idempotency-Key` header for an irreversible POST (contract §3). */
export function idempotencyKey(): { "Idempotency-Key": string } {
  return { "Idempotency-Key": crypto.randomUUID() };
}

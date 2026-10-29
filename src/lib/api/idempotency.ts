import { IDEMPOTENT_OPERATIONS } from "./generated/idempotent";

/** `"POST /v1/owner/leases/{leaseId}/actions/end"` → a pattern for the concrete path, one segment per parameter. */
function pattern(template: string): RegExp {
  const escaped = template.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{[^}]+\\?\}/g, "[^/]+");
  return new RegExp(`^${escaped}$`);
}

let patterns: RegExp[] | undefined;

/**
 * Whether the contract wants an `Idempotency-Key` on this call, for a concrete path (`/v1/owner/leases/3b24…/
 * actions/end`) rather than the template the typed client knows — what the BFF sees of a browser request.
 */
export function requiresIdempotencyKey(method: string, path: string): boolean {
  patterns ??= [...IDEMPOTENT_OPERATIONS].map(pattern);
  const operation = `${method.toUpperCase()} ${path}`;
  return patterns.some((p) => p.test(operation));
}

import { TENANTS, type OperatorPersona, type TenantKey } from "../fixtures";

/**
 * Tenant context of an operator request (contract §8): `X-Tenant-Id` must be a uuid in the operator's
 * memberships; without it a single-tenant operator is in their tenant and an operator of several is
 * in none (`/me` answers `currentTenant: null`; other operations `tenant.context_required`).
 */
export type TenantContext =
  | { ok: true; tenant: TenantKey | null; role: OperatorPersona["memberships"][number]["role"] | null }
  | { ok: false; code: "tenant.context_invalid" | "tenant.not_in_scope" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function tenantContext(request: Request, persona: OperatorPersona): TenantContext {
  const header = request.headers.get("x-tenant-id");
  if (header) {
    if (!UUID.test(header)) return { ok: false, code: "tenant.context_invalid" };
    const membership = persona.memberships.find((m) => TENANTS[m.tenant].profile.id === header.toLowerCase());
    return membership
      ? { ok: true, tenant: membership.tenant, role: membership.role }
      : { ok: false, code: "tenant.not_in_scope" };
  }
  if (persona.memberships.length === 1) {
    const only = persona.memberships[0]!;
    return { ok: true, tenant: only.tenant, role: only.role };
  }
  return { ok: true, tenant: null, role: null };
}

import { createHash } from "node:crypto";

import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { state } from "../state";
import { merchantRefHash } from "./world";
import { audit, idempotent, json, notFound, platform, problem, query, validation } from "./support";

type Schemas = components["schemas"];

/**
 * Per-merchant provider credentials (D-240, F11-4) on the admin surface, as getproperty-api's
 * `ProviderCredentialsService` answers: metadata only (key names, a fingerprint, the last 4 characters of a
 * payment merchant reference), values write-only — this mock keeps nothing of them but their fingerprint.
 * Setting replaces the live credential of the same tenant, kind, provider (and merchant reference for
 * payments), revoking the previous one ("replaced: <reason>"); revoking a revoked credential is refused.
 */

const w = () => state.platform;
const MANAGE = "admin.provider_credential.manage";

/** Providers per kind (getproperty-api `CREDENTIAL_PROVIDERS`). */
const PROVIDERS: Record<Schemas["ProviderCredentialKind"], readonly string[]> = {
  payment: ["kbank", "scb", "opn"],
  lock: ["ttlock", "tuya"],
  etax: ["inet"],
};
const KEY_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

/** The API's write-only document checks (`credentialProblems`): 1–20 plain key names, non-empty strings ≤ 4 KB. */
function credentialProblems(values: unknown): string[] {
  if (!values || typeof values !== "object" || Array.isArray(values)) return ["values must be an object"];
  const entries = Object.entries(values as Record<string, unknown>);
  const problems: string[] = [];
  if (entries.length < 1 || entries.length > 20) problems.push("values must have 1–20 keys");
  for (const [key, value] of entries) {
    if (!KEY_NAME.test(key)) problems.push(`invalid key name ${key.slice(0, 64)}`);
    if (typeof value !== "string" || value.length < 1 || value.length > 4096)
      problems.push(`${key.slice(0, 64)}: a non-empty string of at most 4096 characters`);
  }
  return problems;
}

function fingerprint(values: Record<string, string>): string {
  const sorted = Object.fromEntries(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)));
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex").slice(0, 12);
}

const refHash = (merchantRef: string | undefined) => (merchantRef ? merchantRefHash(merchantRef) : null);

export const credentialHandlers: HttpHandler[] = [
  http.get("*/v1/admin/provider-credentials", ({ request }) => {
    const op = "admin.providerCredentials.list";
    const ok = platform(request, op, MANAGE);
    if (ok instanceof Response) return ok;
    const params = query(request);
    const tenantParam = params.get("tenantId");
    if (tenantParam && tenantParam !== "platform" && !/^[0-9a-f-]{36}$/i.test(tenantParam))
      return validation(op, "tenantId", "tenantId must be a UUID");
    const kind = params.get("kind");
    if (kind && !(kind in PROVIDERS)) return validation(op, "kind", "kind must be one of the following values");
    const includeRevoked = params.get("includeRevoked") === "true";
    const rows = w()
      .providerCredentials.filter(
        ({ row }) =>
          (tenantParam === null || row.tenantId === (tenantParam === "platform" ? null : tenantParam)) &&
          (!kind || row.kind === kind) &&
          (includeRevoked || row.revokedAt === null),
      )
      .map(({ row }) => row)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return json(rows);
  }),
  http.post("*/v1/admin/provider-credentials", ({ request }) => {
    const op = "admin.providerCredentials.set";
    const ok = platform(request, op, MANAGE);
    if (ok instanceof Response) return ok;
    return idempotent(request, op, (input) => {
      const payload = input as unknown as Schemas["ProviderCredentialSetDto"];
      const tenantId = payload.tenantId ?? null;
      if (!(payload.kind in PROVIDERS)) return validation(op, "kind", "kind must be one of the following values");
      if (typeof payload.provider !== "string" || payload.provider.length < 2 || payload.provider.length > 32)
        return validation(op, "provider", "provider must be longer than or equal to 2 characters");
      const reason = typeof payload.reason === "string" ? payload.reason : "";
      if (reason.length < 3 || reason.length > 500)
        return validation(op, "reason", "reason must be longer than or equal to 3 characters");
      if (payload.kind === "payment" && !payload.merchantRef?.trim())
        return validation(op, "merchantRef", "payments need the merchant reference", "required");
      if (!PROVIDERS[payload.kind].includes(payload.provider))
        return validation(op, "provider", `unknown ${payload.kind} provider ${payload.provider}`, "enum");
      if (tenantId === null && payload.kind !== "payment")
        return validation(op, "tenantId", "only payment credentials exist for the platform", "required");
      const problems = credentialProblems(payload.values);
      if (problems.length)
        return problem(op, "validation.failed", {
          errors: problems.map((message) => ({ path: "values", code: "credential", message })),
        });
      if (tenantId && !w().tenants.some((t) => t.id === tenantId)) return notFound(op);
      const now = new Date().toISOString();
      const hash = payload.kind === "payment" ? refHash(payload.merchantRef) : null;
      const previous = w().providerCredentials.find(
        ({ row, accountRefHash }) =>
          row.revokedAt === null &&
          row.tenantId === tenantId &&
          row.kind === payload.kind &&
          row.provider === payload.provider &&
          accountRefHash === hash,
      );
      if (previous) {
        previous.row.revokedAt = now;
        previous.row.revokeReason = `replaced: ${reason}`.slice(0, 500);
      }
      const row: Schemas["ProviderCredentialDto"] = {
        id: crypto.randomUUID(),
        tenantId,
        kind: payload.kind,
        provider: payload.provider,
        accountRefHint: payload.kind === "payment" && payload.merchantRef ? payload.merchantRef.trim().slice(-4) : null,
        keyNames: Object.keys(payload.values).sort(),
        fingerprint: fingerprint(payload.values),
        source: "admin",
        createdAt: now,
        revokedAt: null,
        revokeReason: null,
      };
      w().providerCredentials.push({ row, accountRefHash: hash });
      // Audited with key names and fingerprint, never values (D-240).
      audit(
        ok,
        "provider_credential.set",
        { type: "platform.provider_credential", id: row.id },
        {
          tenantId,
          after: {
            kind: row.kind,
            provider: row.provider,
            keyNames: row.keyNames,
            fingerprint: row.fingerprint,
            replaced: previous?.row.id ?? null,
          },
        },
      );
      return { status: 201, body: row };
    });
  }),
  http.post("*/v1/admin/provider-credentials/:credentialId/actions/revoke", ({ request, params }) => {
    const op = "admin.providerCredentials.revoke";
    const ok = platform(request, op, MANAGE);
    if (ok instanceof Response) return ok;
    return idempotent(request, op, (input) => {
      const payload = input as unknown as Schemas["DeviceReasonDto"];
      const reason = typeof payload.reason === "string" ? payload.reason : "";
      if (reason.length < 3 || reason.length > 500)
        return validation(op, "reason", "reason must be longer than or equal to 3 characters");
      const found = w().providerCredentials.find(({ row }) => row.id === params.credentialId);
      if (!found) return notFound(op);
      if (found.row.revokedAt) return validation(op, "credentialId", "the credential is already revoked", "state");
      found.row.revokedAt = new Date().toISOString();
      found.row.revokeReason = (payload.incidentRef ? `${reason} [${payload.incidentRef}]` : reason).slice(0, 500);
      audit(
        ok,
        "provider_credential.revoked",
        { type: "platform.provider_credential", id: found.row.id },
        { tenantId: found.row.tenantId, after: { kind: found.row.kind, provider: found.row.provider, reason } },
      );
      return { status: 200, body: found.row };
    });
  }),
];

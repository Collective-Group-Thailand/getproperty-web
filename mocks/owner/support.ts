import { HttpResponse } from "msw";

import { OPERATION_PROBLEMS } from "../generated/problems";
import { TENANTS, tenantPermissions, type OperatorPersona } from "../fixtures";
import { tenantContext } from "../handlers/context";
import { authenticate, json, problem } from "../handlers/support";
import { state } from "../state";
import { TENANT_ID } from "./world";

/**
 * Plumbing of the owner surface's stateful handlers (F2): the bearer and tenant context of every
 * operator call, the read-only rule of a suspended tenant (D-082), idempotent replays of irreversible
 * POSTs (contract §3), pagination (`meta`), `ETag`s, and D-021a warnings that need an acknowledgement.
 */

export type Ok = { persona: OperatorPersona; tenantId: string; readOnly: boolean; own: boolean };

export function owner(request: Request, op: string): Ok | Response {
  const auth = authenticate(request, "operator");
  if (!auth.ok) return problem(op, auth.code);
  if (auth.audience !== "operator") return problem(op, "auth.wrong_audience");
  const context = tenantContext(request, auth.persona);
  if (!context.ok) return problem(op, context.code);
  if (!context.tenant) return problem(op, "tenant.context_required");
  const tenant = TENANTS[context.tenant];
  return {
    persona: auth.persona,
    tenantId: tenant.profile.id,
    readOnly: tenant.subscription.readOnly,
    // Only the sample tenant owns the owner world; every other tenant sees an empty one (cross-tenant → 404).
    own: tenant.profile.id === TENANT_ID,
  };
}

export function mutating(request: Request, op: string): Ok | Response {
  const ok = owner(request, op);
  if (ok instanceof Response) return ok;
  if (ok.readOnly && OPERATION_PROBLEMS[op]?.["tenant.read_only"]) return problem(op, "tenant.read_only");
  return ok;
}

export const notFound = (op: string) => problem(op, "http.not_found");

/** The persona's role in the request's tenant. */
export function roleOf(ok: Ok): OperatorPersona["memberships"][number]["role"] | null {
  const membership = ok.persona.memberships.find((m) => TENANTS[m.tenant].profile.id === ok.tenantId);
  return membership?.role ?? null;
}

/** `403 auth.forbidden` unless the role holds the permission (the API's `x-required-permissions`). */
export function allowed(ok: Ok, op: string, permission: string): Response | null {
  const role = roleOf(ok);
  return role && tenantPermissions(role).includes(permission) ? null : problem(op, "auth.forbidden");
}

export function validation(op: string, path: string, message: string, code = "invalid") {
  return problem(op, "validation.failed", { errors: [{ path, code, message }] });
}

export async function body<T>(request: Request): Promise<T> {
  return (await request.json().catch(() => ({}))) as T;
}

/** `?page=&perPage=` over a list → `{ data, meta }` (contract §3, perPage ≤ 100). */
export function paged<T>(items: T[], request: Request) {
  const params = new URL(request.url).searchParams;
  const perPage = Math.min(100, Math.max(1, Number(params.get("perPage")) || 25));
  const page = Math.max(1, Number(params.get("page")) || 1);
  return { data: items.slice((page - 1) * perPage, page * perPage), meta: { page, perPage, total: items.length } };
}

export const query = (request: Request) => new URL(request.url).searchParams;

export function etagged(body: unknown & { id: string; version: number }, status = 200) {
  return json(body, status, { etag: `"v${body.version}-${body.id.slice(-6)}"` });
}

/** `If-Match` must name the current version (`412 concurrency.stale` otherwise). */
export function stale(request: Request, entity: { id: string; version: number }): boolean {
  const ifMatch = request.headers.get("if-match");
  return ifMatch !== null && ifMatch !== `"v${entity.version}-${entity.id.slice(-6)}"`;
}

export function record(op: string, request: Request, payload: unknown) {
  state.owner.received.push({ op, idempotencyKey: request.headers.get("idempotency-key"), body: payload });
  if (state.owner.received.length > 500) state.owner.received.splice(0, state.owner.received.length - 500);
}

/**
 * Idempotency (contract §3): the first answer for a key is replayed verbatim with
 * `Idempotent-Replayed: true`; the same key with another body is `idempotency.key_reused`.
 */
export async function idempotent(
  request: Request,
  op: string,
  handle: (
    payload: Record<string, unknown>,
  ) => Promise<{ status: number; body: unknown } | Response> | { status: number; body: unknown } | Response,
): Promise<Response> {
  const key = request.headers.get("idempotency-key");
  const raw = await request.text();
  if (!key) return problem(op, "idempotency.key_required");
  const scoped = `${op}:${key}`;
  const previous = state.owner.replies.get(scoped);
  if (previous) {
    if (previous.fingerprint !== raw) return problem(op, "idempotency.key_reused");
    return json(previous.body, previous.status, { "idempotent-replayed": "true" });
  }
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw || "{}") as Record<string, unknown>;
  } catch {
    return problem(op, "validation.failed");
  }
  state.owner.received.push({ op, idempotencyKey: key, body: payload });
  const answer = await handle(payload);
  if (answer instanceof Response) return answer;
  state.owner.replies.set(scoped, { ...answer, fingerprint: raw });
  return json(answer.body, answer.status);
}

/**
 * A D-021a warning: unless one of `ackIds` acknowledges an evaluation of `ruleId`, answer
 * `409 compliance.acknowledgement_required` with a fresh evaluation id and the values shown.
 */
export function needsAcknowledgement(
  op: string,
  ruleId: string,
  shown: Record<string, unknown>,
  ackIds: readonly string[] | undefined,
  legalRef: string,
): Response | null {
  const acknowledged = state.owner.acknowledgements.some((ack) => ack.ruleId === ruleId && ackIds?.includes(ack.id));
  if (acknowledged) return null;
  const evaluationId = crypto.randomUUID();
  state.owner.evaluations.set(evaluationId, { ruleId, shown });
  return problem(op, "compliance.acknowledgement_required", {
    evaluationId,
    ruleId,
    shown,
    legalRef,
    legalTextKey: `${ruleId}.warning`,
    legalTextVersion: 1,
  });
}

export const LEGAL_REF = {
  tariffCap: "ประกาศคณะกรรมการว่าด้วยสัญญา พ.ศ. 2568 ข้อ 4 (6) — ค่าไฟฟ้าและค่าน้ำประปา",
  depositCap: "ประกาศคณะกรรมการว่าด้วยสัญญา พ.ศ. 2568 ข้อ 4 (3) — เงินประกันและค่าเช่าล่วงหน้า",
  noticePeriod: "ประกาศคณะกรรมการว่าด้วยสัญญา พ.ศ. 2568 ข้อ 4 (11) — การบอกเลิกสัญญาโดยผู้เช่า",
  termination: "ประกาศคณะกรรมการว่าด้วยสัญญา พ.ศ. 2568 ข้อ 4 (12) — การบอกเลิกสัญญาโดยผู้ให้เช่า",
  depositEvidence: "ประกาศคณะกรรมการว่าด้วยสัญญา พ.ศ. 2568 ข้อ 4 (4) — การคืนเงินประกัน",
  forfeiture: "ประกาศคณะกรรมการว่าด้วยสัญญา พ.ศ. 2568 ข้อ 4 (4) — การคืนเงินประกัน",
} as const;

/** A short-lived "signed" document URL served by this mock (`/__files/pdf-<id>` answers a PDF). */
export function documentDownload(request: Request, documentId: string, number: string) {
  const origin = new URL(request.url).origin;
  return {
    documentId,
    number,
    url: `${origin}/__files/pdf-${documentId}`,
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  };
}

export const noContent = () => new HttpResponse(null, { status: 204 });
export { json, problem };

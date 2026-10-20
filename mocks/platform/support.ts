import { HttpResponse } from "msw";

import { platformPermissions, type PlatformPersona } from "../fixtures";
import { authenticate, json, problem } from "../handlers/support";
import { state } from "../state";
import { PLATFORM_USER_IDS } from "./world";

/**
 * Plumbing of the admin surface's stateful handlers (F5): the platform bearer of every call and the
 * permission the operation needs (docs/rbac.md; `auth.forbidden` otherwise), idempotent replays of
 * irreversible POSTs (contract §3), pagination and the audit rows the console reads back.
 */

export type Ok = { persona: PlatformPersona; userId: string; permissions: Set<string> };

export function platform(request: Request, op: string, permission?: string | string[]): Ok | Response {
  const auth = authenticate(request, "platform");
  if (!auth.ok) return problem(op, auth.code);
  if (auth.audience !== "platform") return problem(op, "auth.wrong_audience");
  const permissions = new Set(platformPermissions(auth.persona.roles));
  const needed = permission === undefined ? [] : Array.isArray(permission) ? permission : [permission];
  if (needed.length > 0 && !needed.some((p) => permissions.has(p))) return problem(op, "auth.forbidden");
  const userId =
    (PLATFORM_USER_IDS as Record<string, string>)[auth.persona.key] ?? auth.persona.user.id ?? crypto.randomUUID();
  return { persona: auth.persona, userId, permissions };
}

export const notFound = (op: string) => problem(op, "http.not_found");

export function validation(op: string, path: string, message: string, code = "invalid") {
  return problem(op, "validation.failed", { errors: [{ path, code, message }] });
}

export async function body<T>(request: Request): Promise<T> {
  return (await request.json().catch(() => ({}))) as T;
}

export const query = (request: Request) => new URL(request.url).searchParams;

/** `?page=&perPage=` over a list → `{ data, meta }` (contract §3, perPage ≤ 100). */
export function paged<T>(items: T[], request: Request) {
  const params = query(request);
  const perPage = Math.min(100, Math.max(1, Number(params.get("perPage")) || 25));
  const page = Math.max(1, Number(params.get("page")) || 1);
  return { data: items.slice((page - 1) * perPage, page * perPage), meta: { page, perPage, total: items.length } };
}

/** Free-text `q` over the given fields (case-insensitive). */
export function matches(q: string | null, ...fields: (string | null | undefined)[]): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some((field) => field?.toLowerCase().includes(needle));
}

export function record(op: string, request: Request, payload: unknown) {
  const world = state.platform;
  world.received.push({ op, idempotencyKey: request.headers.get("idempotency-key"), body: payload });
  if (world.received.length > 500) world.received.splice(0, world.received.length - 500);
}

/** Appends an audit row like the API's `AuditService` (newest first in the list). */
export function audit(
  ok: Ok,
  action: string,
  subject: { type: string; id: string } | null,
  extra: {
    tenantId?: string | null;
    before?: unknown;
    after?: unknown;
    outcome?: "success" | "denied" | "failure";
  } = {},
) {
  state.platform.audit.unshift({
    id: crypto.randomUUID(),
    action,
    actor: { type: "user", audience: "platform", id: ok.userId },
    outcome: extra.outcome ?? "success",
    occurredAt: new Date().toISOString(),
    subjectType: subject?.type ?? null,
    subjectId: subject?.id ?? null,
    buildingId: null,
    ip: "127.0.0.1",
    before: (extra.before ?? null) as Record<string, never> | null,
    after: (extra.after ?? null) as Record<string, never> | null,
    metadata: extra.tenantId ? { tenantId: extra.tenantId } : {},
    supportGrantId: null,
  });
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
  const previous = state.platform.replies.get(scoped);
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
  record(op, request, payload);
  const answer = await handle(payload);
  if (answer instanceof Response) return answer;
  state.platform.replies.set(scoped, { ...answer, fingerprint: raw });
  return json(answer.body, answer.status);
}

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

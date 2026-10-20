import { json, problem } from "../handlers/support";
import { mutating as ownerMutating, owner, type Ok } from "../owner/support";
import { state } from "../state";

/**
 * Plumbing of the R2 handlers (owner and staff surfaces share one world): the operator's bearer and tenant
 * context, read-only tenants (D-082), the Staff building limit (D-090: the staff persona works in
 * building A only) and idempotent replays (contract §3; optional on the creates the API marks optional).
 */
export type Surface = "owner" | "staff";
export type R2Ok = Ok & { surface: Surface; buildingIds: string[] | null; userId: string };

const STAFF_BUILDINGS: Record<string, string[]> = {
  // The staff persona's membership is limited to building A (platform world members).
  staff: ["5c8e2a1f-6b3d-4e7a-9f0c-1d2e3f4a5b6c"],
};

export const r2 = () => state.r2;
export const surfaceOf = (request: Request): Surface =>
  new URL(request.url).pathname.includes("/v1/staff/") ? "staff" : "owner";

function scoped(ok: Ok, request: Request): R2Ok {
  return {
    ...ok,
    surface: surfaceOf(request),
    buildingIds: STAFF_BUILDINGS[ok.persona.key] ?? null,
    userId: ok.persona.user.id,
  };
}

export function reader(request: Request, op: string): R2Ok | Response {
  const ok = owner(request, op);
  if (ok instanceof Response) return ok;
  return scoped(ok, request);
}

export function writer(request: Request, op: string): R2Ok | Response {
  const ok = ownerMutating(request, op);
  if (ok instanceof Response) return ok;
  return scoped(ok, request);
}

/** Whether a record of `buildingId` is visible to the caller (sample tenant, Staff limit). */
export function visible(ok: R2Ok, buildingId: string | null | undefined): boolean {
  if (!ok.own) return false;
  if (!buildingId || !ok.buildingIds) return true;
  return ok.buildingIds.includes(buildingId);
}

export function record(op: string, request: Request, body: unknown) {
  r2().received.push({ op, idempotencyKey: request.headers.get("idempotency-key"), body });
  if (r2().received.length > 300) r2().received.splice(0, r2().received.length - 300);
}

/**
 * Idempotency (contract §3): the first answer for a key is replayed with `Idempotent-Replayed: true`, the same
 * key with another body is `idempotency.key_reused`. `optional`: a request without a key is simply handled.
 */
export async function idempotent(
  request: Request,
  op: string,
  handle: (payload: Record<string, unknown>) => { status: number; body: unknown } | Response,
  optional = false,
): Promise<Response> {
  const key = request.headers.get("idempotency-key");
  const raw = await request.text();
  if (!key && !optional) return problem(op, "idempotency.key_required");
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw || "{}") as Record<string, unknown>;
  } catch {
    return problem(op, "validation.failed");
  }
  if (key) {
    const previous = r2().replies.get(`${op}:${key}`);
    if (previous) {
      if (previous.fingerprint !== raw) return problem(op, "idempotency.key_reused");
      return json(previous.body, previous.status, { "idempotent-replayed": "true" });
    }
  }
  r2().received.push({ op, idempotencyKey: key, body: payload });
  const answer = handle(payload);
  if (answer instanceof Response) return answer;
  if (key) r2().replies.set(`${op}:${key}`, { ...answer, fingerprint: raw });
  return json(answer.body, answer.status);
}

export async function read<T>(request: Request): Promise<T> {
  return (await request.json().catch(() => ({}))) as T;
}

export function validation(op: string, path: string, message: string, code = "invalid") {
  return problem(op, "validation.failed", { errors: [{ path, code, message }] });
}

export const notFound = (op: string) => problem(op, "http.not_found");

/** `?page=&perPage=` over a list → `{ data, meta }`. */
export function paged<T>(items: T[], request: Request) {
  const params = new URL(request.url).searchParams;
  const perPage = Math.min(100, Math.max(1, Number(params.get("perPage")) || 25));
  const page = Math.max(1, Number(params.get("page")) || 1);
  return { data: items.slice((page - 1) * perPage, page * perPage), meta: { page, perPage, total: items.length } };
}

/** A copy of `value` without `keys` (internal fields of the mock world that are not on the wire). */
export function omit<T extends object, K extends keyof T>(value: T, ...keys: K[]): Omit<T, K> {
  const copy = { ...value };
  for (const key of keys) delete copy[key];
  return copy;
}

export const query = (request: Request) => new URL(request.url).searchParams;
export const MONEY = /^\d{1,9}(\.\d{1,2})?$/;
export const QTY = /^\d{1,6}(\.\d{1,3})?$/;
export { json, problem };

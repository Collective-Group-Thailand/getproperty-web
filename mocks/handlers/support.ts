import { HttpResponse } from "msw";

import { OPERATION_PROBLEMS, PROBLEM_EXAMPLES } from "../generated/problems";
import { OPERATORS, PLATFORM_USERS, type OperatorPersona, type PlatformPersona } from "../fixtures";
import { state, type Audience } from "../state";

/**
 * A documented problem of an operation, from the contract's own example (`mocks/generated`). Asking
 * for a code the operation does not document throws — the mocks cannot invent an error path the API
 * does not have.
 */
export function problem(
  operationId: string,
  code: string,
  overrides: Record<string, unknown> = {},
): HttpResponse<string> {
  const status = OPERATION_PROBLEMS[operationId]?.[code];
  const example = PROBLEM_EXAMPLES[code];
  if (status === undefined || !example) {
    throw new Error(`${operationId} does not document problem ${code}`);
  }
  return new HttpResponse(JSON.stringify({ ...example, status, requestId: crypto.randomUUID(), ...overrides }), {
    status,
    headers: { "content-type": "application/problem+json" },
  });
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): HttpResponse<string> {
  return new HttpResponse(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-request-id": crypto.randomUUID(), ...headers },
  });
}

export function issueTokens(audience: Audience, userKey: string, family = crypto.randomUUID()) {
  const now = Date.now();
  const accessToken = `mock-at.${audience}.${userKey}.${crypto.randomUUID()}`;
  const refreshToken = `mock-rt.${audience}.${userKey}.${crypto.randomUUID()}`;
  state.access.set(accessToken, { audience, userKey, expiresAt: now + state.accessTtlMs });
  state.refresh.set(refreshToken, { audience, userKey, family, used: false, revoked: false });
  return {
    accessToken,
    accessTokenExpiresAt: new Date(now + state.accessTtlMs).toISOString(),
    refreshToken,
    refreshTokenExpiresAt: new Date(now + (audience === "platform" ? 12 * 3600_000 : 30 * 86400_000)).toISOString(),
  };
}

export type Authenticated =
  | { ok: true; audience: "operator"; persona: OperatorPersona }
  | { ok: true; audience: "platform"; persona: PlatformPersona }
  | { ok: false; code: "auth.unauthenticated" | "auth.wrong_audience" };

/** Bearer check with the contract's audience rule: a token works on its own surface only (contract §2). */
export function authenticate(request: Request, audience: Audience): Authenticated {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const grant = state.access.get(token);
  if (!grant || grant.expiresAt < Date.now()) return { ok: false, code: "auth.unauthenticated" };
  if (grant.audience !== audience) return { ok: false, code: "auth.wrong_audience" };
  if (audience === "operator") {
    const persona = OPERATORS.find((candidate) => candidate.key === grant.userKey);
    return persona ? { ok: true, audience, persona } : { ok: false, code: "auth.unauthenticated" };
  }
  const persona = PLATFORM_USERS.find((candidate) => candidate.key === grant.userKey);
  return persona ? { ok: true, audience, persona } : { ok: false, code: "auth.unauthenticated" };
}

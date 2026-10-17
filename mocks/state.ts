import { PLATFORM_USERS } from "./fixtures";

/**
 * The mock API's memory: sessions, OTP challenges, TOTP enrolments, a request log the e2e suite reads
 * (`GET /__mock/requests`) and the realtime streams. Reset with `POST /__mock/reset`.
 */

export type Audience = "operator" | "platform";

export interface AccessGrant {
  audience: Audience;
  userKey: string;
  expiresAt: number;
}

export interface RefreshGrant {
  audience: Audience;
  userKey: string;
  family: string;
  used: boolean;
  revoked: boolean;
}

export interface LoggedRequest {
  at: string;
  method: string;
  path: string;
  search: string;
  authorization: boolean;
  tenantId: string | null;
  idempotencyKey: string | null;
  requestId: string | null;
  acceptLanguage: string | null;
}

export interface StreamClient {
  surface: string;
  channels: string[];
  send: (event: string, data: unknown) => void;
}

export interface MockState {
  access: Map<string, AccessGrant>;
  refresh: Map<string, RefreshGrant>;
  challenges: Map<string, { phone: string; attempts: number; expiresAt: number }>;
  enrolment: Map<string, { userKey: string; activated: boolean }>;
  enrolled: Set<string>;
  streamTokens: Map<string, { surface: string; channels: string[]; expiresAt: number }>;
  streams: Set<StreamClient>;
  readNotifications: Set<string>;
  log: LoggedRequest[];
  /** Access token lifetime; the suite shortens it to exercise refresh. */
  accessTtlMs: number;
}

function initial(): MockState {
  return {
    access: new Map(),
    refresh: new Map(),
    challenges: new Map(),
    enrolment: new Map(),
    enrolled: new Set(PLATFORM_USERS.filter((user) => user.enrolled).map((user) => user.key)),
    streamTokens: new Map(),
    streams: new Set(),
    readNotifications: new Set(),
    log: [],
    accessTtlMs: 15 * 60_000,
  };
}

export const state: MockState = initial();

export function resetState(): void {
  const fresh = initial();
  for (const client of state.streams) client.send("close", {});
  Object.assign(state, fresh);
}

/** Access tokens stop working (as if 15 minutes had passed) — refresh tokens stay valid. */
export function expireAccessTokens(userKey?: string): void {
  for (const [token, grant] of state.access) if (!userKey || grant.userKey === userKey) state.access.delete(token);
}

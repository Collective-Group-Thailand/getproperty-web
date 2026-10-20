import type { components } from "../src/lib/api/schema";
import { PLATFORM_USERS } from "./fixtures";
import { initialOwnerWorld, type OwnerWorld } from "./owner/world";
import { initialPlatformWorld, type PlatformWorld } from "./platform/world";
import {
  initialChannels,
  initialDevices,
  initialInspections,
  initialMeters,
  type MockChannel,
  type MockMeter,
} from "./staff-world";

type Schemas = components["schemas"];

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

export interface InboxItem {
  id: string;
  userKey: string;
  eventType: string | null;
  title: string | null;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface QueuedReading {
  idempotencyKey: string;
  body: unknown;
  at: string;
}

export interface MockFile {
  file: Schemas["FileDto"];
  bytes: Uint8Array | null;
}

/** The staff PWA's world (F4): readings, files, inspections, devices — see staff-world.ts. */
export interface StaffWorld {
  meters: MockMeter[];
  readings: (Schemas["MeterReadingDto"] & { idempotencyKey: string })[];
  /** Idempotency-Key → the first answer (replayed verbatim, contract §3). */
  replies: Map<string, { status: number; body: unknown; fingerprint: string }>;
  files: Map<string, MockFile>;
  inspections: Schemas["InspectionDto"][];
  devices: Schemas["FleetDeviceDto"][];
  channels: MockChannel[];
  commands: Schemas["DeviceCommandDto"][];
  provisioning: Map<string, { code: string; expiresAt: string }>;
  swaps: unknown[];
  /** The fake OCR: reads the typed value (or previous + 42.125), or nothing at all. */
  ocr: "ok" | "unreadable";
  /** `readings.require_photo` (D-035, default on). */
  requirePhoto: boolean;
}

export function initialStaffWorld(): StaffWorld {
  return {
    meters: initialMeters(),
    readings: [],
    replies: new Map(),
    files: new Map(),
    inspections: initialInspections(),
    devices: initialDevices(),
    channels: initialChannels(),
    commands: [],
    provisioning: new Map(),
    swaps: [],
    ocr: "ok",
    requirePhoto: true,
  };
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
  inbox: InboxItem[];
  readings: Map<string, QueuedReading>;
  staff: StaffWorld;
  /** The owner console's world (F2): see owner/world.ts. */
  owner: OwnerWorld;
  /** The platform admin's world (F5): see platform/world.ts. */
  platform: PlatformWorld;
  webVitals: unknown[];
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
    inbox: [],
    readings: new Map(),
    staff: initialStaffWorld(),
    owner: initialOwnerWorld(),
    platform: initialPlatformWorld(),
    webVitals: [],
    log: [],
    // 15 minutes like the API; a long Lighthouse run sets MOCK_ACCESS_TTL_MS so its fixed session cookie lasts.
    accessTtlMs: Number(process.env.MOCK_ACCESS_TTL_MS) || 15 * 60_000,
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

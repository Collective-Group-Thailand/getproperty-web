import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { state } from "../state";
import { type MockLock } from "./world";
import {
  idempotent,
  json,
  omit,
  notFound,
  problem,
  query,
  r2,
  read,
  reader,
  record,
  validation,
  visible,
  writer,
} from "./support";

type Schemas = components["schemas"];

/**
 * Locks, credentials and unlock events (B5.2, D-070, D-071, D-211). Resident codes follow the lease and are
 * revoked only by the lease's end or by an owner with a reason; nothing here looks at invoices or balances
 * (D-024). Visitor and staff codes are time-boxed (≤ 31 days) and their PIN is answered once, to the issuer.
 */

const MAX_BOX_MS = 31 * 86_400_000;

function lockDto(lock: MockLock): Schemas["LockDto"] {
  return omit(lock, "credentials", "events");
}

function findLock(ok: Parameters<typeof visible>[0], lockId: unknown): MockLock | null {
  return r2().locks.find((lock) => lock.id === lockId && visible(ok, lock.buildingId)) ?? null;
}

function timeBox(op: string, from: string | undefined, to: string | undefined): Response | null {
  const start = Date.parse(from ?? "");
  const end = Date.parse(to ?? "");
  if (Number.isNaN(start)) return validation(op, "validFrom", "a start time");
  if (Number.isNaN(end) || end <= start) return validation(op, "validTo", "an end after the start");
  if (end - start > MAX_BOX_MS) return validation(op, "validTo", "at most 31 days after the start");
  if (end <= Date.now()) return validation(op, "validTo", "an end in the future");
  return null;
}

function issued(lock: MockLock, partial: Partial<Schemas["CredentialDto"]>): Schemas["IssuedCredentialDto"] {
  const credential: Schemas["CredentialDto"] = {
    id: crypto.randomUUID(),
    lockId: lock.id,
    lockName: lock.name,
    holderKind: "visitor",
    holderName: "",
    holderPartyId: null,
    holderUserId: null,
    leaseId: null,
    workOrderId: null,
    unitId: lock.unitId,
    unitNo: lock.unitNo,
    status: lock.online === false ? "pending" : "active",
    type: "pin",
    createdAt: new Date().toISOString(),
    validFrom: new Date().toISOString(),
    validTo: null,
    revokedAt: null,
    revokeReason: null,
    vendorError: null,
    ...partial,
  };
  lock.credentials.unshift(credential);
  return { ...credential, pin: String(100000 + Math.floor(Math.random() * 899999)) };
}

export const accessR2Handlers: HttpHandler[] = [
  http.get("*/v1/owner/locks", ({ request }) => {
    const op = "owner.access.locks";
    const ok = reader(request, op);
    if (ok instanceof Response) return ok;
    const params = query(request);
    const data = r2()
      .locks.filter((lock) => visible(ok, lock.buildingId))
      .filter((lock) => !params.get("buildingId") || lock.buildingId === params.get("buildingId"))
      .filter((lock) => !params.get("unitId") || lock.unitId === params.get("unitId"))
      .map(lockDto);
    return json({ data } satisfies Schemas["LocksDto"]);
  }),
  http.post("*/v1/owner/locks", async ({ request }) => {
    const op = "owner.access.registerLock";
    const ok = writer(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own) return notFound(op);
    const input = await read<Schemas["LockRegisterDto"]>(request);
    if (!input.name?.trim()) return validation(op, "name", "a name");
    if (!input.serial?.trim()) return validation(op, "serial", "the lock's serial");
    if (!input.vendorLockId?.trim()) return validation(op, "vendorLockId", "the vendor's lock id");
    if (r2().locks.some((lock) => lock.serial === input.serial.trim())) return problem(op, "lock.exists");
    const unit = input.unitId ? state.owner.units.find((candidate) => candidate.id === input.unitId) : null;
    if (input.scope === "unit" && !unit) return validation(op, "unitId", "the unit of a unit lock");
    const buildingId = unit?.buildingId ?? input.buildingId;
    if (!buildingId || !state.owner.buildings.some((building) => building.id === buildingId))
      return validation(op, "buildingId", "a building");
    const lock: MockLock = {
      id: crypto.randomUUID(),
      assetItemId: crypto.randomUUID(),
      deviceId: crypto.randomUUID(),
      name: input.name.trim(),
      scope: input.scope,
      vendor: input.vendor,
      vendorLockId: input.vendorLockId.trim(),
      serial: input.serial.trim(),
      buildingId,
      unitId: unit?.id ?? null,
      unitNo: unit?.unitNo ?? null,
      isActive: true,
      online: null,
      batteryPct: null,
      batteryLow: false,
      batteryCheckedAt: null,
      lastLogSyncAt: null,
      version: 1,
      credentials: [],
      events: [],
    };
    r2().locks.push(lock);
    record(op, request, input);
    return json(lockDto(lock), 201);
  }),
  http.get("*/v1/owner/locks/:lockId", ({ request, params }) => {
    const op = "owner.access.lock";
    const ok = reader(request, op);
    if (ok instanceof Response) return ok;
    const lock = findLock(ok, params.lockId);
    return lock ? json(lockDto(lock)) : notFound(op);
  }),
  http.patch("*/v1/owner/locks/:lockId", async ({ request, params }) => {
    const op = "owner.access.setLockActive";
    const ok = writer(request, op);
    if (ok instanceof Response) return ok;
    const lock = findLock(ok, params.lockId);
    if (!lock) return notFound(op);
    const input = await read<Schemas["LockActiveDto"]>(request);
    if (typeof input.isActive !== "boolean") return validation(op, "isActive", "true or false");
    lock.isActive = input.isActive;
    lock.version += 1;
    record(op, request, input);
    return json(lockDto(lock));
  }),
  http.post("*/v1/owner/locks/:lockId/actions/refresh", ({ request, params }) => {
    const op = "owner.access.refreshLock";
    const ok = writer(request, op);
    if (ok instanceof Response) return ok;
    const lock = findLock(ok, params.lockId);
    if (!lock) return notFound(op);
    lock.batteryCheckedAt = new Date().toISOString();
    lock.lastLogSyncAt = new Date().toISOString();
    lock.version += 1;
    return json(lockDto(lock));
  }),
  http.get("*/v1/owner/locks/:lockId/credentials", ({ request, params }) => {
    const op = "owner.access.credentials";
    const ok = reader(request, op);
    if (ok instanceof Response) return ok;
    const lock = findLock(ok, params.lockId);
    if (!lock) return notFound(op);
    const live = query(request).get("live") === "true";
    return json({
      data: lock.credentials.filter((credential) => !live || ["pending", "active"].includes(credential.status)),
    } satisfies Schemas["CredentialsDto"]);
  }),
  http.get("*/v1/owner/locks/:lockId/events", ({ request, params }) => {
    const op = "owner.access.events";
    const ok = reader(request, op);
    if (ok instanceof Response) return ok;
    const lock = findLock(ok, params.lockId);
    if (!lock) return notFound(op);
    const limit = Number(query(request).get("limit")) || 50;
    return json({ data: lock.events.slice(0, limit) } satisfies Schemas["AccessEventsDto"]);
  }),
  http.post("*/v1/owner/locks/:lockId/visitor-codes", async ({ request, params }) => {
    const op = "owner.access.visitorCode";
    const ok = writer(request, op);
    if (ok instanceof Response) return ok;
    const lock = findLock(ok, params.lockId);
    if (!lock) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["VisitorCodeCreateDto"];
      if (!lock.isActive) return problem(op, "access.invalid_state");
      if (!input.visitorName?.trim()) return validation(op, "visitorName", "the visitor's name");
      const refused = timeBox(op, input.validFrom, input.validTo);
      if (refused) return refused;
      const body = issued(lock, {
        holderKind: "visitor",
        holderName: input.visitorName.trim(),
        validFrom: input.validFrom,
        validTo: input.validTo,
      });
      return { status: 201, body };
    });
  }),
  http.post("*/v1/owner/locks/:lockId/staff-codes", async ({ request, params }) => {
    const op = "owner.access.staffCode";
    const ok = writer(request, op);
    if (ok instanceof Response) return ok;
    const lock = findLock(ok, params.lockId);
    if (!lock) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["StaffCodeCreateDto"];
      if (!lock.isActive) return problem(op, "access.invalid_state");
      const member = (state.platform.members[ok.tenantId] ?? []).find(
        (candidate) => candidate.userId === input.userId && candidate.status === "active",
      );
      if (!member) return validation(op, "userId", "an active member of the team");
      const refused = timeBox(op, input.validFrom, input.validTo);
      if (refused) return refused;
      const body = issued(lock, {
        holderKind: "staff",
        holderName: member.displayName,
        holderUserId: member.userId,
        validFrom: input.validFrom,
        validTo: input.validTo,
      });
      return { status: 201, body };
    });
  }),
  http.post("*/v1/owner/access-credentials/:credentialId/actions/revoke", async ({ request, params }) => {
    const op = "owner.access.revoke";
    const ok = writer(request, op);
    if (ok instanceof Response) return ok;
    const lock = r2().locks.find(
      (candidate) =>
        visible(ok, candidate.buildingId) &&
        candidate.credentials.some((credential) => credential.id === params.credentialId),
    );
    const credential = lock?.credentials.find((candidate) => candidate.id === params.credentialId);
    if (!lock || !credential) return notFound(op);
    const input = await read<Schemas["ReasonDto"]>(request);
    if (!input.reason?.trim()) return validation(op, "reason", "why the access ends (the resident is told)");
    if (!["pending", "active", "failed"].includes(credential.status)) return problem(op, "access.invalid_state");
    credential.status = "revoked";
    credential.revokedAt = new Date().toISOString();
    credential.revokeReason = input.reason.trim();
    record(op, request, input);
    return json(credential);
  }),
];

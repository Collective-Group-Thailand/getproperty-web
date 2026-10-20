import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { emit } from "../handlers/realtime";
import { state } from "../state";
import { deviceNextActions } from "./world";
import {
  audit,
  body,
  idempotent,
  json,
  matches,
  notFound,
  paged,
  platform,
  problem,
  query,
  record,
  validation,
} from "./support";

type Schemas = components["schemas"];

/**
 * B3.1 on the admin surface (F5 5.3): the device fleet (summary per tenant/building and status,
 * inventory), gateway detail with its config versions, commands and events, inventory import (CSV),
 * assignment to a tenant's building, OTA rings, certificate revoke and retire, provisioning codes;
 * signed OTA releases and ring rollouts (canary → pilot → all, D-183) whose progress the mock moves
 * on request (`POST /__mock/platform/ota/advance`) with an `ota.rollout_changed` realtime event —
 * ids only, as the API sends; ingest dead letters with replay.
 */

const w = () => state.platform;
const now = () => new Date().toISOString();
const MANAGE = "admin.device.manage";

const KINDS: Schemas["DeviceKind"][] = [
  "gateway",
  "electric_meter",
  "water_meter",
  "lock",
  "breaker",
  "sensor",
  "door_controller",
  "camera",
];

function fleetSummary(): Schemas["FleetSummaryDto"] {
  const byBuilding = new Map<string, Schemas["FleetBuildingRowDto"]>();
  const inventory = new Map<Schemas["DeviceKind"], number>();
  for (const device of w().devices) {
    if (device.status === "inventory") {
      inventory.set(device.kind, (inventory.get(device.kind) ?? 0) + 1);
      continue;
    }
    if (!device.buildingId || device.status === "retired") continue;
    const key = `${device.buildingId}:${device.kind}:${device.status}`;
    const tenant = w().tenants.find((t) => t.id === device.tenantId);
    const row = byBuilding.get(key) ?? {
      buildingId: device.buildingId,
      buildingName: device.buildingId.endsWith("6c")
        ? "อาคาร A"
        : device.buildingId.endsWith("7d")
          ? "อาคาร B"
          : "อาคารบ้านสวน",
      tenantId: device.tenantId,
      tenantName: tenant?.displayName ?? null,
      kind: device.kind,
      status: device.status,
      count: 0,
    };
    row.count += 1;
    byBuilding.set(key, row);
  }
  return {
    byBuilding: [...byBuilding.values()],
    inventory: [...inventory.entries()].map(([kind, count]) => ({ kind, count })),
  };
}

function rolloutActions(rollout: Schemas["OtaRolloutDto"]): string[] {
  switch (rollout.status) {
    case "planned":
      return ["start", "abort"];
    case "running":
      return ["pause", "abort"];
    case "paused":
      return ["resume", "abort"];
    default:
      return [];
  }
}

function countRollout(rollout: Schemas["OtaRolloutDto"]) {
  const counts: Record<string, number> = {};
  for (const device of rollout.devices) counts[device.status] = (counts[device.status] ?? 0) + 1;
  rollout.counts = counts as Record<string, never>;
  if (
    rollout.status === "running" &&
    rollout.devices.every((d) => d.status === "applied" || d.status === "failed" || d.status === "rolled_back")
  ) {
    rollout.status = "completed";
    rollout.finishedAt = now();
  }
  rollout.nextActions = rolloutActions(rollout);
}

/** One step of a running rollout: the next device moves queued → commanded → started → applied. */
export function advanceRollout(
  rolloutId: string,
  outcome: "applied" | "failed" = "applied",
): Schemas["OtaRolloutDto"] | null {
  const rollout = w().rollouts.find((r) => r.id === rolloutId);
  if (!rollout || rollout.status !== "running") return null;
  const order: Schemas["OtaDeviceStatus"][] = ["queued", "commanded", "started"];
  const device = rollout.devices.find((d) => order.includes(d.status));
  if (!device) return rollout;
  const next = order.indexOf(device.status) + 1;
  device.status = next < order.length ? order[next]! : outcome;
  if (device.status === "failed") device.error = "agent health check failed after restart; rolled back by the agent";
  device.updatedAt = now();
  if (device.status === "applied") {
    const gateway = w().devices.find((d) => d.id === device.deviceId);
    if (gateway) {
      gateway.firmwareVersion = rollout.release.version;
      if (gateway.health) gateway.health.agentVersion = rollout.release.version;
    }
  }
  const failures = rollout.devices.filter((d) => d.status === "failed").length;
  if (failures / rollout.devices.length > Number(rollout.maxFailuresPct) / 100) rollout.status = "paused";
  countRollout(rollout);
  emit("ota.rollout_changed", { rolloutId: rollout.id }, "admin");
  return rollout;
}

const deviceHandlers: HttpHandler[] = [
  http.get("*/v1/admin/devices/fleet", ({ request }) => {
    const ok = platform(request, "admin.devices.fleet", MANAGE);
    if (ok instanceof Response) return ok;
    return json(fleetSummary());
  }),
  http.get("*/v1/admin/devices", ({ request }) => {
    const ok = platform(request, "admin.devices.list", [MANAGE, "admin.tenant.read"]);
    if (ok instanceof Response) return ok;
    const params = query(request);
    const rows = w().devices.filter(
      (d) =>
        (!params.get("tenantId") || d.tenantId === params.get("tenantId")) &&
        (!params.get("buildingId") || d.buildingId === params.get("buildingId")) &&
        (!params.get("kind") || d.kind === params.get("kind")) &&
        (!params.get("status") || d.status === params.get("status")) &&
        (params.get("inventory") !== "true" || d.status === "inventory") &&
        matches(params.get("q"), d.serial, d.model, d.vendor),
    );
    return json(paged(rows, request));
  }),
  http.post("*/v1/admin/devices", ({ request }) => {
    const op = "admin.devices.create";
    const ok = platform(request, op, MANAGE);
    if (ok instanceof Response) return ok;
    return idempotent(request, op, (input) => {
      const payload = input as unknown as Schemas["DeviceCreateDto"];
      if (!payload.serial?.trim()) return validation(op, "serial", "required");
      if (w().devices.some((d) => d.serial === payload.serial)) return problem(op, "http.conflict");
      const device: Schemas["FleetDeviceDto"] = {
        id: crypto.randomUUID(),
        serial: payload.serial,
        kind: payload.kind,
        model: payload.model,
        vendor: payload.vendor,
        arch: payload.kind === "gateway" ? "arm64" : null,
        status: payload.tenantId ? "assigned" : "inventory",
        ownership: payload.ownership,
        tenantId: payload.tenantId ?? null,
        buildingId: payload.buildingId ?? null,
        assetItemId: null,
        gatewayDeviceId: null,
        driver: null,
        firmwareVersion: null,
        configAppliedVersion: null,
        lastSeenAt: null,
        meters: 0,
        otaRing: "all",
        health: null,
        nextActions: [],
        version: 1,
      };
      device.nextActions = deviceNextActions(device);
      w().devices.push(device);
      return { status: 201, body: device };
    });
  }),
  http.post("*/v1/admin/devices/actions/import", ({ request }) => {
    const op = "admin.devices.import";
    const ok = platform(request, op, MANAGE);
    if (ok instanceof Response) return ok;
    return idempotent(request, op, (input) => {
      const csv = String((input as unknown as Schemas["DeviceImportDto"]).csv ?? "");
      const lines = csv.split(/\r?\n/).filter((line) => line.trim() !== "");
      const errors: Schemas["ImportErrorDto"][] = [];
      const skipped: Schemas["ImportSkippedDto"][] = [];
      const header = lines[0]?.split(",").map((cell) => cell.trim());
      if (!header || header.slice(0, 4).join(",") !== "serial,kind,model,vendor")
        return {
          status: 200,
          body: {
            created: 0,
            errors: [{ line: 1, message: "header must start with serial,kind,model,vendor" }],
            skipped,
          },
        };
      const rows: Schemas["FleetDeviceDto"][] = [];
      lines.slice(1).forEach((line, index) => {
        const [serial, kind, model, vendor, driver, ownership, arch] = line.split(",").map((cell) => cell.trim());
        const lineNo = index + 2;
        if (!serial || !kind || !model || !vendor)
          return errors.push({ line: lineNo, message: "serial, kind, model and vendor are required" });
        if (!KINDS.includes(kind as Schemas["DeviceKind"]))
          return errors.push({ line: lineNo, message: `unknown kind ${kind}` });
        if (ownership && ownership !== "platform_haas" && ownership !== "tenant_owned")
          return errors.push({ line: lineNo, message: `unknown ownership ${ownership}` });
        if (w().devices.some((d) => d.serial === serial) || rows.some((d) => d.serial === serial))
          return skipped.push({ line: lineNo, serial, reason: "serial already registered" });
        const device: Schemas["FleetDeviceDto"] = {
          id: crypto.randomUUID(),
          serial,
          kind: kind as Schemas["DeviceKind"],
          model,
          vendor,
          arch: arch || (kind === "gateway" ? "arm64" : null),
          status: "inventory",
          ownership: (ownership || "platform_haas") as Schemas["DeviceOwnership"],
          tenantId: null,
          buildingId: null,
          assetItemId: null,
          gatewayDeviceId: null,
          driver: driver || null,
          firmwareVersion: null,
          configAppliedVersion: null,
          lastSeenAt: null,
          meters: 0,
          otaRing: "all",
          health: null,
          nextActions: [],
          version: 1,
        };
        device.nextActions = deviceNextActions(device);
        rows.push(device);
      });
      // Any error refuses the whole file (DeviceImportResultDto).
      if (errors.length === 0) w().devices.push(...rows);
      return {
        status: 200,
        body: {
          created: errors.length === 0 ? rows.length : 0,
          errors,
          skipped,
        } satisfies Schemas["DeviceImportResultDto"],
      };
    });
  }),
  http.get("*/v1/admin/devices/:deviceId", ({ request, params }) => {
    const ok = platform(request, "admin.devices.get", [MANAGE, "admin.tenant.read"]);
    if (ok instanceof Response) return ok;
    const device = w().devices.find((d) => d.id === params.deviceId);
    if (!device) return notFound("admin.devices.get");
    return json({
      device,
      configs: w().configs[device.id] ?? [],
      events: w().deviceEvents[device.id] ?? [],
      channels: [],
    } satisfies Schemas["DeviceDetailDto"]);
  }),
  http.get("*/v1/admin/devices/:deviceId/commands", ({ request, params }) => {
    const ok = platform(request, "admin.devices.listCommands", MANAGE);
    if (ok instanceof Response) return ok;
    const device = w().devices.find((d) => d.id === params.deviceId);
    if (!device) return notFound("admin.devices.listCommands");
    return json(
      w()
        .commands.filter((c) => c.gatewayDeviceId === device.id)
        .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
    );
  }),
  http.post("*/v1/admin/devices/:deviceId/commands", async ({ request, params }) => {
    const op = "admin.devices.sendCommand";
    const ok = platform(request, op, MANAGE);
    if (ok instanceof Response) return ok;
    const device = w().devices.find((d) => d.id === params.deviceId);
    if (!device) return notFound(op);
    const input = await body<Schemas["AdminCommandCreateDto"]>(request);
    record(op, request, input);
    if (device.kind !== "gateway") return problem(op, "device.not_gateway");
    if (device.status === "inventory" || device.status === "retired") return problem(op, "device.invalid_state");
    const command: Schemas["DeviceCommandDto"] = {
      id: crypto.randomUUID(),
      gatewayDeviceId: device.id,
      type: input.type,
      args: (input.args ?? {}) as Record<string, never>,
      status: device.status === "offline" ? "queued" : "sent",
      attempts: device.status === "offline" ? 0 : 1,
      issuedAt: now(),
      finishedAt: null,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      error: null,
      result: null,
    };
    w().commands.push(command);
    emit("device.command_issued", { deviceId: device.id, commandId: command.id }, "admin");
    return json(command, 202);
  }),
  http.post("*/v1/admin/devices/:deviceId/provisioning-codes", ({ request, params }) => {
    const op = "admin.devices.issueProvisioningCode";
    const ok = platform(request, op, MANAGE);
    if (ok instanceof Response) return ok;
    const device = w().devices.find((d) => d.id === params.deviceId);
    if (!device) return notFound(op);
    if (device.kind !== "gateway" || device.status === "retired" || device.status === "inventory")
      return problem(op, "device.invalid_state");
    return json(
      {
        deviceId: device.id,
        code: `GP-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        expiresAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
      } satisfies Schemas["ProvisioningCodeDto"],
      201,
    );
  }),
  http.post("*/v1/admin/devices/:deviceId/actions/:action", async ({ request, params }) => {
    const action = String(params.action);
    const ops: Record<string, string> = {
      assign: "admin.devices.assign",
      retire: "admin.devices.retire",
      "revoke-certificates": "admin.devices.revokeCertificates",
      "set-ring": "admin.devices.setRing",
    };
    const op = ops[action];
    if (!op) return notFound("admin.devices.get");
    const ok = platform(request, op, MANAGE);
    if (ok instanceof Response) return ok;
    const device = w().devices.find((d) => d.id === params.deviceId);
    if (!device) return notFound(op);
    const apply = (input: Record<string, unknown>): { status: number; body: unknown } | Response => {
      switch (action) {
        case "assign": {
          if (device.status === "retired") return problem(op, "device.invalid_state");
          const tenant = w().tenants.find((t) => t.id === input.tenantId);
          if (!tenant || !input.buildingId) return notFound(op);
          if (device.status === "inventory") device.status = "assigned";
          device.tenantId = tenant.id;
          device.buildingId = String(input.buildingId);
          if (input.otaRing) device.otaRing = input.otaRing as Schemas["OtaRing"];
          break;
        }
        case "set-ring":
          if (device.kind !== "gateway") return problem(op, "device.not_gateway");
          device.otaRing = input.otaRing as Schemas["OtaRing"];
          break;
        case "revoke-certificates":
          if (device.kind !== "gateway") return problem(op, "device.not_gateway");
          if (!String(input.reason ?? "").trim()) return validation(op, "reason", "required");
          device.status = "offline";
          device.lastSeenAt = device.lastSeenAt ?? null;
          break;
        case "retire":
          if (device.status === "retired") return problem(op, "device.invalid_state");
          if (device.kind === "gateway" && device.meters > 0 && device.status !== "offline")
            return problem(op, "device.in_use");
          if (!String(input.reason ?? "").trim()) return validation(op, "reason", "required");
          device.status = "retired";
          break;
      }
      device.version += 1;
      device.nextActions = deviceNextActions(device);
      audit(
        ok,
        `device.${action.replace("-", "_")}`,
        { type: "smart.device", id: device.id },
        { tenantId: device.tenantId, after: input },
      );
      emit(
        `device.${action === "assign" ? "assigned" : action === "retire" ? "retired" : action === "revoke-certificates" ? "certificate_revoked" : "ring_changed"}`,
        { deviceId: device.id },
        "admin",
      );
      return { status: 200, body: device };
    };
    if (action === "retire" || action === "revoke-certificates") return idempotent(request, op, apply);
    const input = await body<Record<string, unknown>>(request);
    record(op, request, input);
    const answer = apply(input);
    return answer instanceof Response ? answer : json(answer.body, answer.status);
  }),
];

const otaHandlers: HttpHandler[] = [
  http.get("*/v1/admin/ota/releases", ({ request }) => {
    const ok = platform(request, "admin.ota.listReleases", MANAGE);
    if (ok instanceof Response) return ok;
    return json([...w().releases].sort((a, b) => b.releasedAt.localeCompare(a.releasedAt)));
  }),
  http.post("*/v1/admin/ota/releases", ({ request }) => {
    const op = "admin.ota.createRelease";
    const ok = platform(request, op, MANAGE);
    if (ok instanceof Response) return ok;
    return idempotent(request, op, (input) => {
      const payload = input as unknown as Schemas["OtaReleaseCreateDto"];
      const manifest = payload.manifest;
      if (!manifest?.version || !manifest.artifact?.url || !manifest.artifact.sha256)
        return validation(op, "manifest", "version and artifact are required");
      if (!manifest.signature?.value || manifest.signature.alg !== "ed25519")
        return problem(op, "ota.signature_invalid");
      if (w().releases.some((r) => r.version === manifest.version && r.arch === manifest.arch))
        return problem(op, "ota.release_exists");
      const release: Schemas["OtaReleaseDto"] = {
        id: crypto.randomUUID(),
        version: manifest.version,
        arch: manifest.arch,
        channel: manifest.channel,
        sha256: manifest.artifact.sha256,
        keyId: manifest.signature.keyId,
        artifactUrl: manifest.artifact.url,
        notes: payload.notes ?? null,
        releasedAt: manifest.releasedAt ?? now(),
        deprecatedAt: null,
      };
      w().releases.push(release);
      audit(ok, "ota.release_created", { type: "smart.ota_release", id: release.id });
      return { status: 201, body: release };
    });
  }),
  http.post("*/v1/admin/ota/releases/:releaseId/rollouts", ({ request, params }) => {
    const op = "admin.ota.createRollout";
    const ok = platform(request, op, MANAGE);
    if (ok instanceof Response) return ok;
    const release = w().releases.find((r) => r.id === params.releaseId);
    if (!release) return notFound(op);
    return idempotent(request, op, (input) => {
      const payload = input as unknown as Schemas["OtaRolloutCreateDto"];
      const order: Schemas["OtaRing"][] = ["canary", "pilot", "all"];
      const ringIndex = order.indexOf(payload.ring);
      // D-183: canary → pilot → all; a ring waits for the previous ring of the same release.
      if (ringIndex > 0) {
        const previous = w().rollouts.find(
          (r) => r.release.id === release.id && r.ring === order[ringIndex - 1] && r.status === "completed",
        );
        if (!previous) return problem(op, "ota.ring_order");
      }
      if (
        w().rollouts.some(
          (r) =>
            r.release.id === release.id && r.ring === payload.ring && !["aborted", "rolled_back"].includes(r.status),
        )
      )
        return problem(op, "ota.invalid_transition");
      const targets = w().devices.filter(
        (d) =>
          d.kind === "gateway" &&
          d.arch === release.arch &&
          (payload.ring === "all" || d.otaRing === payload.ring) &&
          d.status !== "inventory" &&
          d.status !== "retired",
      );
      const rollout: Schemas["OtaRolloutDto"] = {
        id: crypto.randomUUID(),
        release,
        ring: payload.ring,
        status: "planned",
        maxFailuresPct: payload.maxFailuresPct ?? "10.00",
        startedAt: null,
        finishedAt: null,
        counts: {},
        devices: targets.map((d) => ({
          deviceId: d.id,
          status: "queued",
          fromVersion: d.firmwareVersion,
          error: null,
          updatedAt: now(),
        })),
        nextActions: ["start", "abort"],
      };
      countRollout(rollout);
      w().rollouts.push(rollout);
      return { status: 201, body: rollout };
    });
  }),
  http.get("*/v1/admin/ota/rollouts", ({ request }) => {
    const ok = platform(request, "admin.ota.listRollouts", MANAGE);
    if (ok instanceof Response) return ok;
    return json([...w().rollouts].reverse());
  }),
  http.get("*/v1/admin/ota/rollouts/:rolloutId", ({ request, params }) => {
    const ok = platform(request, "admin.ota.getRollout", MANAGE);
    if (ok instanceof Response) return ok;
    const rollout = w().rollouts.find((r) => r.id === params.rolloutId);
    return rollout ? json(rollout) : notFound("admin.ota.getRollout");
  }),
  http.post("*/v1/admin/ota/rollouts/:rolloutId/actions/:action", async ({ request, params }) => {
    const action = String(params.action);
    const op = `admin.ota.${action}Rollout`;
    if (!["start", "pause", "resume", "abort"].includes(action)) return notFound("admin.ota.getRollout");
    const ok = platform(request, op, MANAGE);
    if (ok instanceof Response) return ok;
    const rollout = w().rollouts.find((r) => r.id === params.rolloutId);
    if (!rollout) return notFound(op);
    const apply = (): { status: number; body: unknown } | Response => {
      if (!rollout.nextActions.includes(action)) return problem(op, "ota.invalid_transition");
      if (action === "start" || action === "resume") {
        rollout.status = "running";
        rollout.startedAt = rollout.startedAt ?? now();
      } else if (action === "pause") rollout.status = "paused";
      else {
        rollout.status = "aborted";
        rollout.finishedAt = now();
      }
      countRollout(rollout);
      audit(ok, `ota.rollout_${action}`, { type: "smart.ota_rollout", id: rollout.id });
      emit("ota.rollout_changed", { rolloutId: rollout.id }, "admin");
      return { status: 200, body: rollout };
    };
    if (action === "start" || action === "abort") return idempotent(request, op, apply);
    record(op, request, {});
    const answer = apply();
    return answer instanceof Response ? answer : json(answer.body, answer.status);
  }),
];

const ingestHandlers: HttpHandler[] = [
  http.get("*/v1/admin/ingest/dead-letters", ({ request }) => {
    const ok = platform(request, "admin.ingest.listDeadLetters", MANAGE);
    if (ok instanceof Response) return ok;
    const params = query(request);
    const rows = w().ingestDeadLetters.filter(
      (row) =>
        (!params.get("reason") || row.reason === params.get("reason")) &&
        (!params.get("gatewayDeviceId") || row.gatewayDeviceId === params.get("gatewayDeviceId")) &&
        (params.get("replayed") === null || (params.get("replayed") === "true") === (row.replayedAt !== null)),
    );
    return json(paged(rows, request));
  }),
  http.post("*/v1/admin/ingest/dead-letters/:deadLetterId/actions/replay", ({ request, params }) => {
    const op = "admin.ingest.replay";
    const ok = platform(request, op, MANAGE);
    if (ok instanceof Response) return ok;
    const row = w().ingestDeadLetters.find((r) => r.id === params.deadLetterId);
    if (!row) return notFound(op);
    return idempotent(request, op, () => {
      if (row.replayedAt && row.replayOutcome !== "dead_letter") return problem(op, "ingest.not_replayable");
      row.replayedAt = now();
      row.replayOutcome = row.reason === "unknown_gateway" ? "dead_letter" : "telemetry";
      audit(ok, "ingest.dead_letter_replayed", { type: "smart.ingest_dead_letter", id: row.id });
      return {
        status: 200,
        body: { deadLetter: row, outcome: row.replayOutcome } satisfies Schemas["DeadLetterReplayDto"],
      };
    });
  }),
];

export const fleetHandlers: HttpHandler[] = [...deviceHandlers, ...otaHandlers, ...ingestHandlers];

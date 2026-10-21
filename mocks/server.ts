/**
 * The mock API (`pnpm dev:mock`, the e2e suite): getproperty-api's contract served over real HTTP from
 * MSW handlers, so the app is exercised exactly as against the backend — the BFF's streaming, cookies
 * and headers included — without reaching into Next's fetch. It never runs in a deployment.
 *
 *   tsx mocks/server.ts             listens on MOCK_API_PORT (default 4010)
 *
 * Test control (not part of the contract, reachable only on this server):
 *   POST /__mock/reset              forget sessions, challenges, enrolments, the request log
 *   POST /__mock/expire-access?user=…  access tokens (of one persona) stop working; refresh tokens stay valid
 *   GET  /__mock/requests?path=…    the request log (method, path, whether a bearer was sent,
 *                                   X-Tenant-Id, Idempotency-Key, X-Request-Id)
 *   POST /__mock/notify?user=…      a new inbox item for a persona + a realtime `notification.created`
 *   POST /__mock/realtime/emit      {type, ids, surface?} to every open stream (of a surface)
 *   GET  /__mock/readings           readings received by POST /v1/staff/meter-readings (by idempotency key)
 *   GET  /__mock/staff/readings     the meter readings the staff world holds (incl. install/final readings)
 *   GET  /__mock/staff/files        uploaded files: id, kind, mime type, declared and stored size
 *   GET  /__mock/staff/inspections  the inspections as the staff world holds them
 *   GET  /__mock/staff/devices      devices, channels, commands and swaps of the staff world
 *   POST /__mock/staff/reset?part=  reset the staff world's readings (building A) | inspections |
 *                                   devices (building B + the devices), or all of it
 *   POST /__mock/r2/reset           reset the R2 world (service requests, work orders, locks, community)
 *   GET  /__mock/r2/state           requests, work orders, parcels (+ PINs), locks, announcements, bookings, received
 *   POST /__mock/staff/ocr?mode=    the fake OCR reads (`ok`) or reads nothing (`unreadable`)
 *   POST /__mock/staff/devices/online?serial=  a gateway bootstraps and comes online (realtime events)
 *   POST /__mock/owner/reset?part=  reset the owner world (assets | leases | money | metering | settings |
 *                                   release), or all of it
 *   POST /__mock/owner/leases/<id>/resident-sign      the resident signs in getproperty-liff
 *   POST /__mock/owner/deposits/<id>/resident-response?answer=accepted|disputed
 *   POST /__mock/owner/payments/webhook?invoice=<number>  the payment provider pays an invoice's QR
 *   POST /__mock/owner/slips/qr-duplicate  a slip of the same amount as a QR payment already booked (D-220)
 *   POST /__mock/owner/link-requests?party=<id>  a phone sign-in matched the party: a pending link request (D-226)
 *   GET  /__mock/owner/received?op=  requests the owner world received (body, Idempotency-Key)
 *   GET  /__mock/owner/state         leases, deposits, invoices, slips, cycles, units (A/B) as held
 *   POST /__mock/platform/reset      reset the platform admin's world (tenants, billing, tariffs, fleet…)
 *   POST /__mock/platform/ota/advance?rollout=<id>[&outcome=failed]  the next gateway of a running
 *                                   rollout moves one step (realtime `ota.rollout_changed`)
 *   GET  /__mock/platform/received?op=  requests the platform world received (body, Idempotency-Key)
 *   GET  /__mock/platform/state      subscriptions, invoices, tariffs, grants, flags, test sends as held
 *
 * Object storage stand-in (what presigned URLs point at; CORS like a bucket):
 *   PUT  /__upload/<fileId>         the presigned upload
 *   GET  /__files/<fileId>          the signed download (uploaded bytes, or a placeholder picture)
 *   GET  /__mock/web-vitals         Web Vitals received through the BFFs
 *   GET  /__mock/health             liveness for the e2e web server
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { getResponse } from "msw";

import { OPERATORS, PLATFORM_USERS } from "./fixtures";
import { handlers } from "./handlers";
import { providerPays, resetOwnerWorld, residentAnswers, residentSigns } from "./owner";
import { phoneSignIn, qrDuplicateSlip } from "./owner/release";
import { advanceRollout, resetPlatformWorld } from "./platform";
import { resetR2World } from "./r2";
import { emit } from "./handlers/realtime";
import { gatewayComesOnline, readUpload, storeUpload, UPLOAD_CORS } from "./handlers/staff";
import { BUILDING_A, BUILDING_B, buildingOf } from "./staff-world";
import { expireAccessTokens, initialStaffWorld, resetState, state } from "./state";

const port = Number(process.env.MOCK_API_PORT ?? 4010);
const all = handlers();

async function readBody(req: IncomingMessage): Promise<Buffer | undefined> {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function control(url: URL, req: IncomingMessage, res: ServerResponse) {
  const owner = ownerControl(url, req);
  if (owner) return sendJson(res, owner.status, owner.body);
  const platform = platformControl(url, req);
  if (platform) return sendJson(res, platform.status, platform.body);
  switch (`${req.method} ${url.pathname}`) {
    case "GET /__mock/health":
      return sendJson(res, 200, { ok: true });
    case "POST /__mock/reset":
      resetState();
      return sendJson(res, 200, { ok: true });
    case "POST /__mock/expire-access":
      expireAccessTokens(url.searchParams.get("user") ?? undefined);
      return sendJson(res, 200, { ok: true });
    case "POST /__mock/notify": {
      const user = url.searchParams.get("user") ?? "owner";
      const persona = [...OPERATORS, ...PLATFORM_USERS].find((candidate) => candidate.key === user);
      if (!persona) return sendJson(res, 404, { error: "unknown persona" });
      const item = {
        id: crypto.randomUUID(),
        userKey: user,
        eventType: "support_grant.requested",
        title: url.searchParams.get("title") ?? "ขอสิทธิ์เข้าถึงจากทีมซัพพอร์ต",
        body: url.searchParams.get("body") ?? "ทีมซัพพอร์ตขอสิทธิ์เข้าถึงข้อมูลชั่วคราว",
        createdAt: new Date().toISOString(),
        readAt: null,
      };
      state.inbox.push(item);
      const delivered = emit("notification.created", { notificationId: item.id }, undefined, persona.user.id);
      return sendJson(res, 200, { id: item.id, delivered });
    }
    case "POST /__mock/realtime/emit": {
      const body = JSON.parse((await readBody(req))?.toString() || "{}") as {
        type: string;
        ids?: Record<string, string>;
        surface?: string;
      };
      return sendJson(res, 200, { delivered: emit(body.type, body.ids ?? {}, body.surface) });
    }
    case "GET /__mock/readings":
      return sendJson(res, 200, [...state.readings.values()]);
    case "GET /__mock/staff/readings":
      return sendJson(res, 200, state.staff.readings);
    case "GET /__mock/staff/devices":
      return sendJson(res, 200, {
        devices: state.staff.devices,
        channels: state.staff.channels,
        commands: state.staff.commands,
        swaps: state.staff.swaps,
      });
    case "GET /__mock/staff/inspections":
      return sendJson(res, 200, state.staff.inspections);
    case "GET /__mock/staff/files":
      return sendJson(
        res,
        200,
        [...state.staff.files.values()].map(({ file, bytes }) => ({
          id: file.id,
          kind: file.kind,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          storedBytes: bytes?.byteLength ?? null,
          uploadState: file.uploadState,
        })),
      );
    case "POST /__mock/staff/reset": {
      // One part of the staff world at a time, so parallel spec files do not reset each other: the
      // readings specs own building A's meters, the devices specs building B's meters and the devices.
      const fresh = initialStaffWorld();
      const part = url.searchParams.get("part");
      const resetMeters = (building: string) => {
        const ids = new Set(state.staff.meters.filter((m) => buildingOf(m) === building).map((m) => m.assetItemId));
        state.staff.meters = [
          ...state.staff.meters.filter((m) => buildingOf(m) !== building),
          ...fresh.meters.filter((m) => buildingOf(m) === building),
        ];
        for (const meter of fresh.meters) if (buildingOf(meter) === building) ids.add(meter.assetItemId);
        state.staff.readings = state.staff.readings.filter((reading) => !ids.has(reading.assetItemId));
      };
      if (part === "readings" || !part) {
        resetMeters(BUILDING_A);
        Object.assign(state.staff, { ocr: "ok", requirePhoto: true });
        state.readings.clear();
      }
      if (part === "inspections" || !part) state.staff.inspections = fresh.inspections;
      if (part === "devices" || !part) {
        resetMeters(BUILDING_B);
        Object.assign(state.staff, {
          devices: fresh.devices,
          channels: fresh.channels,
          commands: [],
          provisioning: new Map(),
          swaps: [],
        });
      }
      return sendJson(res, 200, { ok: true });
    }
    case "POST /__mock/r2/reset":
      resetR2World();
      return sendJson(res, 200, { ok: true });
    case "GET /__mock/r2/state":
      return sendJson(res, 200, {
        requests: state.r2.requests,
        workOrders: state.r2.workOrders,
        parcels: state.r2.parcels,
        pins: state.r2.pins,
        locks: state.r2.locks,
        announcements: state.r2.announcements,
        bookings: state.r2.bookings,
        received: state.r2.received,
      });
    case "POST /__mock/staff/ocr":
      state.staff.ocr = url.searchParams.get("mode") === "unreadable" ? "unreadable" : "ok";
      return sendJson(res, 200, { ocr: state.staff.ocr });
    case "POST /__mock/staff/devices/online": {
      const found = gatewayComesOnline(url.searchParams.get("serial") ?? "");
      return sendJson(res, found ? 200 : 404, { ok: found });
    }
    case "GET /__mock/web-vitals":
      return sendJson(res, 200, state.webVitals);
    case "GET /__mock/requests": {
      const path = url.searchParams.get("path");
      return sendJson(res, 200, path ? state.log.filter((entry) => entry.path === path) : state.log);
    }
    default:
      return sendJson(res, 404, { error: "unknown control endpoint" });
  }
}

/** The owner world's controls (F2): resets per part, and what a resident or a payment provider would do. */
function ownerControl(url: URL, req: IncomingMessage): { status: number; body: unknown } | null {
  if (!url.pathname.startsWith("/__mock/owner/")) return null;
  const parts = url.pathname.split("/").slice(3);
  if (req.method === "POST" && parts[0] === "reset") {
    return resetOwnerWorld(url.searchParams.get("part"))
      ? { status: 200, body: { ok: true } }
      : { status: 400, body: { error: "unknown part" } };
  }
  if (req.method === "POST" && parts[0] === "leases" && parts[2] === "resident-sign") {
    return residentSigns(parts[1] ?? "")
      ? { status: 200, body: { ok: true } }
      : { status: 409, body: { error: "not awaiting a signature" } };
  }
  if (req.method === "POST" && parts[0] === "deposits" && parts[2] === "resident-response") {
    const answer = url.searchParams.get("answer") === "disputed" ? "disputed" : "accepted";
    return residentAnswers(parts[1] ?? "", answer)
      ? { status: 200, body: { ok: true } }
      : { status: 409, body: { error: "no proposal to answer" } };
  }
  if (req.method === "POST" && parts[0] === "payments" && parts[1] === "webhook") {
    const payment = providerPays(url.searchParams.get("invoice") ?? "");
    return payment
      ? { status: 200, body: payment }
      : { status: 404, body: { error: "no open invoice with that number" } };
  }
  if (req.method === "POST" && parts[0] === "slips" && parts[1] === "qr-duplicate") {
    const slip = qrDuplicateSlip();
    return slip ? { status: 200, body: slip } : { status: 409, body: { error: "no paid A-201 invoice" } };
  }
  if (req.method === "POST" && parts[0] === "link-requests") {
    const request = phoneSignIn(url.searchParams.get("party") ?? "");
    return request ? { status: 200, body: request } : { status: 404, body: { error: "no such party" } };
  }
  if (req.method === "GET" && parts[0] === "received") {
    const op = url.searchParams.get("op");
    return { status: 200, body: state.owner.received.filter((entry) => !op || entry.op === op) };
  }
  if (req.method === "GET" && parts[0] === "state") {
    return {
      status: 200,
      body: {
        leases: state.owner.leases,
        deposits: state.owner.deposits,
        invoices: state.owner.invoices,
        slips: state.owner.slips,
        cycles: state.owner.cycles,
        units: state.owner.units.filter((unit) => !unit.unitNo.startsWith("C-")),
      },
    };
  }
  return { status: 404, body: { error: "unknown owner control" } };
}

/** The platform world's controls (F5): reset, OTA progress, what the admin surface received. */
function platformControl(url: URL, req: IncomingMessage): { status: number; body: unknown } | null {
  if (!url.pathname.startsWith("/__mock/platform/")) return null;
  const parts = url.pathname.split("/").slice(3);
  if (req.method === "POST" && parts[0] === "reset") {
    resetPlatformWorld();
    return { status: 200, body: { ok: true } };
  }
  if (req.method === "POST" && parts[0] === "ota" && parts[1] === "advance") {
    const outcome = url.searchParams.get("outcome") === "failed" ? "failed" : "applied";
    const rollout = advanceRollout(url.searchParams.get("rollout") ?? "", outcome);
    return rollout ? { status: 200, body: rollout } : { status: 409, body: { error: "rollout not running" } };
  }
  if (req.method === "POST" && parts[0] === "slips" && parts[1] === "qr-duplicate") {
    const slip = qrDuplicateSlip();
    return slip ? { status: 200, body: slip } : { status: 409, body: { error: "no paid A-201 invoice" } };
  }
  if (req.method === "POST" && parts[0] === "link-requests") {
    const request = phoneSignIn(url.searchParams.get("party") ?? "");
    return request ? { status: 200, body: request } : { status: 404, body: { error: "no such party" } };
  }
  if (req.method === "GET" && parts[0] === "received") {
    const op = url.searchParams.get("op");
    return { status: 200, body: state.platform.received.filter((entry) => !op || entry.op === op) };
  }
  if (req.method === "GET" && parts[0] === "state") {
    const world = state.platform;
    return {
      status: 200,
      body: {
        subscriptions: world.subscriptions,
        invoices: world.invoices,
        tariffs: world.tariffs,
        grants: world.grants,
        flags: world.flags,
        testSends: world.testSends,
        rollouts: world.rollouts,
        devices: world.devices,
      },
    };
  }
  return { status: 404, body: { error: "unknown platform control" } };
}

/** The object-storage stand-in: presigned PUTs and signed GETs from the browser (cross-origin). */
async function storage(url: URL, req: IncomingMessage, res: ServerResponse) {
  const fileId = decodeURIComponent(url.pathname.split("/")[2] ?? "");
  if (req.method === "OPTIONS") {
    res.writeHead(204, UPLOAD_CORS);
    return res.end();
  }
  if (req.method === "PUT" && url.pathname.startsWith("/__upload/")) {
    const body = (await readBody(req)) ?? Buffer.alloc(0);
    const status = storeUpload(fileId, new Uint8Array(body), req.headers["content-type"] ?? null);
    res.writeHead(status, { ...UPLOAD_CORS, etag: `"${fileId.slice(0, 8)}"` });
    return res.end();
  }
  if (req.method === "GET" && url.pathname.startsWith("/__files/")) {
    const { body, contentType } = readUpload(fileId);
    res.writeHead(200, { ...UPLOAD_CORS, "content-type": contentType, "cache-control": "private, max-age=300" });
    return res.end(body);
  }
  res.writeHead(405, UPLOAD_CORS);
  return res.end();
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `127.0.0.1:${port}`}`);
  try {
    if (url.pathname.startsWith("/__mock/")) return await control(url, req, res);
    if (url.pathname.startsWith("/__upload/") || url.pathname.startsWith("/__files/")) {
      return await storage(url, req, res);
    }

    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers.set(name, value);
      else if (Array.isArray(value)) headers.set(name, value.join(", "));
    }
    state.log.push({
      at: new Date().toISOString(),
      method: req.method ?? "GET",
      path: url.pathname,
      search: url.search,
      authorization: headers.has("authorization"),
      tenantId: headers.get("x-tenant-id"),
      idempotencyKey: headers.get("idempotency-key"),
      requestId: headers.get("x-request-id"),
      acceptLanguage: headers.get("accept-language"),
    });
    if (state.log.length > 2000) state.log.splice(0, state.log.length - 2000);

    const body = await readBody(req);
    const controller = new AbortController();
    res.on("close", () => controller.abort());
    const request = new Request(url, {
      method: req.method,
      headers,
      body: body ? new Uint8Array(body) : undefined,
      signal: controller.signal,
    });
    const response =
      (await getResponse(all, request)) ??
      new Response(
        JSON.stringify({
          type: "https://errors.getproperty.co/http.not_found",
          title: "Not Found",
          status: 404,
          code: "http.not_found",
          detail: `No mock for ${req.method} ${url.pathname}`,
          requestId: crypto.randomUUID(),
        }),
        { status: 404, headers: { "content-type": "application/problem+json" } },
      );

    const outHeaders: Record<string, string> = {};
    response.headers.forEach((value, name) => (outHeaders[name] = value));
    res.writeHead(response.status, outHeaders);
    if (!response.body) return res.end();
    // A client that goes away mid-stream (an SSE tab closing) is normal: end quietly, never crash.
    await pipeline(Readable.fromWeb(response.body as import("node:stream/web").ReadableStream), res).catch(
      () => undefined,
    );
  } catch (error) {
    if (controller_aborted(error)) return;
    console.error("[mock-api]", error);
    if (!res.headersSent) sendJson(res, 500, { code: "internal.unexpected" });
    else res.end();
  }
});

function controller_aborted(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

process.on("uncaughtException", (error) => console.error("[mock-api] uncaught", error));
process.on("unhandledRejection", (error) => console.error("[mock-api] unhandled", error));

server.listen(port, "127.0.0.1", () => {
  console.info(`[mock-api] getproperty-api mock on http://127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

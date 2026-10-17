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
 *   GET  /__mock/readings           readings received by POST /v1/staff/readings (by idempotency key)
 *   GET  /__mock/web-vitals         Web Vitals received through the BFFs
 *   GET  /__mock/health             liveness for the e2e web server
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { getResponse } from "msw";

import { OPERATORS, PLATFORM_USERS } from "./fixtures";
import { handlers } from "./handlers";
import { emit } from "./handlers/realtime";
import { expireAccessTokens, resetState, state } from "./state";

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

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `127.0.0.1:${port}`}`);
  try {
    if (url.pathname.startsWith("/__mock/")) return await control(url, req, res);

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

import { http, type HttpHandler } from "msw";

import { state } from "../state";
import { authenticate, json, problem } from "./support";

/**
 * Realtime (contract §6) for the mocks: `realtime/auth` hands out a 60-second single-use stream token;
 * the stream sends `ready`, a heartbeat every 25 s, and whatever `/__mock/realtime/emit` or
 * `/__mock/notify` pushes. Payloads are ids + type only, like the API's.
 */
type Surface = "owner" | "staff" | "admin";

function authHandler(surface: Surface) {
  return http.post(`*/v1/${surface}/realtime/auth`, ({ request }) => {
    const operationId = `${surface}.realtime.auth`;
    const auth = authenticate(request, surface === "admin" ? "platform" : "operator");
    if (!auth.ok) return problem(operationId, auth.code);
    const token = `mock-stream.${crypto.randomUUID()}`;
    const channels = [`user:${auth.persona.user.id}`];
    state.streamTokens.set(token, { surface, channels, expiresAt: Date.now() + 60_000 });
    return json({
      streamToken: token,
      streamUrl: `/v1/${surface}/realtime/stream?token=${encodeURIComponent(token)}`,
      channels,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
  });
}

function streamHandler(surface: Surface) {
  return http.get(`*/v1/${surface}/realtime/stream`, ({ request }) => {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    const grant = state.streamTokens.get(token);
    state.streamTokens.delete(token);
    if (!grant || grant.expiresAt < Date.now() || grant.surface !== surface) {
      return problem(`${surface}.realtime.stream`, "realtime.token_invalid");
    }
    const encoder = new TextEncoder();
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let client: (typeof state.streams extends Set<infer T> ? T : never) | undefined;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: string, data: unknown) => {
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch {
            // the client went away
          }
        };
        client = { surface, channels: grant.channels, send };
        state.streams.add(client);
        send("ready", { channels: grant.channels });
        heartbeat = setInterval(() => send("heartbeat", {}), 25_000);
        request.signal.addEventListener("abort", () => {
          clearInterval(heartbeat);
          if (client) state.streams.delete(client);
          try {
            controller.close();
          } catch {
            // already closed
          }
        });
      },
      cancel() {
        clearInterval(heartbeat);
        if (client) state.streams.delete(client);
      },
    });
    return new Response(body, {
      headers: { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" },
    });
  });
}

export const realtimeHandlers: HttpHandler[] = (["owner", "staff", "admin"] as const).flatMap((surface) => [
  authHandler(surface),
  streamHandler(surface),
]);

/** Pushes an event to every open stream of a surface (or all), as the API's realtime hub would. */
export function emit(type: string, ids: Record<string, string>, surface?: string, userId?: string): number {
  let delivered = 0;
  for (const client of state.streams) {
    if (surface && client.surface !== surface) continue;
    if (userId && !client.channels.includes(`user:${userId}`)) continue;
    client.send(type, { type, ids });
    delivered += 1;
  }
  return delivered;
}

import { http, type HttpHandler } from "msw";

import { state } from "../state";
import { authenticate, json, problem } from "./support";

/** The in-app inbox per signed-in user (contract: `{surface}.notifications.list|markRead`), stateful. */
type Surface = "owner" | "staff" | "admin";

function list(surface: Surface) {
  return http.get(`*/v1/${surface}/notifications`, ({ request }) => {
    const operationId = `${surface}.notifications.list`;
    const auth = authenticate(request, surface === "admin" ? "platform" : "operator");
    if (!auth.ok) return problem(operationId, auth.code);
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 100);
    const cursor = Number(url.searchParams.get("cursor") ?? 0) || 0;
    const mine = state.inbox
      .filter((item) => item.userKey === auth.persona.key)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const page = mine.slice(cursor, cursor + limit);
    return json({
      data: page.map((item) => ({
        id: item.id,
        eventType: item.eventType,
        title: item.title,
        body: item.body,
        state: item.readAt ? "read" : "delivered",
        createdAt: item.createdAt,
        readAt: item.readAt,
      })),
      meta: { nextCursor: cursor + limit < mine.length ? String(cursor + limit) : null },
    });
  });
}

function markRead(surface: Surface) {
  return http.post(`*/v1/${surface}/notifications/:notificationId/actions/read`, ({ request, params }) => {
    const operationId = `${surface}.notifications.markRead`;
    const auth = authenticate(request, surface === "admin" ? "platform" : "operator");
    if (!auth.ok) return problem(operationId, auth.code);
    const item = state.inbox.find((entry) => entry.id === params.notificationId && entry.userKey === auth.persona.key);
    if (!item) return problem(operationId, "http.not_found");
    item.readAt ??= new Date().toISOString();
    return new Response(null, { status: 204 });
  });
}

export const notificationHandlers: HttpHandler[] = (["owner", "staff", "admin"] as const).flatMap((surface) => [
  list(surface),
  markRead(surface),
]);

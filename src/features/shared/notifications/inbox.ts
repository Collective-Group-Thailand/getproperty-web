import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import type { Zone } from "@/lib/zones";

export type InboxPage = { data: Schemas["InboxItemDto"][]; meta: Schemas["CursorMeta"] };

/** The zone's own inbox endpoints (contract: `{owner,staff,admin}.notifications.list|markRead`). */
export function listInbox(zone: Zone, cursor: string | undefined): Promise<InboxPage> {
  const query = { query: { cursor, limit: 20 } };
  const api = browserApi();
  if (zone === "owner") return unwrap(api.GET("/v1/owner/notifications", { params: query }));
  if (zone === "staff") return unwrap(api.GET("/v1/staff/notifications", { params: query }));
  return unwrap(api.GET("/v1/admin/notifications", { params: query }));
}

export function markRead(zone: Zone, notificationId: string): Promise<unknown> {
  const params = { params: { path: { notificationId } } };
  const api = browserApi();
  if (zone === "owner") return unwrap(api.POST("/v1/owner/notifications/{notificationId}/actions/read", params));
  if (zone === "staff") return unwrap(api.POST("/v1/staff/notifications/{notificationId}/actions/read", params));
  return unwrap(api.POST("/v1/admin/notifications/{notificationId}/actions/read", params));
}

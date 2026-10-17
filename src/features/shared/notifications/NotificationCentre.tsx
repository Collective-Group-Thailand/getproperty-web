"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query";
import type { Schemas } from "@/lib/api/types";
import type { Zone } from "@/lib/zones";
import { Button } from "@/ui/components/Button";
import { CountBadge } from "@/ui/components/CountBadge";
import { IconButton } from "@/ui/components/IconButton";
import { Popover } from "@/ui/components/Popover";
import { Spinner } from "@/ui/components/Spinner";
import { cn } from "@/ui/lib/cn";

import { useRealtimeStatus } from "../realtime/RealtimeProvider";

type InboxPage = { data: Schemas["InboxItemDto"][]; meta: Schemas["CursorMeta"] };

/** The zone's own inbox endpoints (contract: `{owner,staff,admin}.notifications.list|markRead`). */
function listInbox(zone: Zone, cursor: string | undefined): Promise<InboxPage> {
  const query = { query: { cursor, limit: 20 } };
  const api = browserApi();
  if (zone === "owner") return unwrap(api.GET("/v1/owner/notifications", { params: query }));
  if (zone === "staff") return unwrap(api.GET("/v1/staff/notifications", { params: query }));
  return unwrap(api.GET("/v1/admin/notifications", { params: query }));
}

function markRead(zone: Zone, notificationId: string): Promise<unknown> {
  const params = { params: { path: { notificationId } } };
  const api = browserApi();
  if (zone === "owner") return unwrap(api.POST("/v1/owner/notifications/{notificationId}/actions/read", params));
  if (zone === "staff") return unwrap(api.POST("/v1/staff/notifications/{notificationId}/actions/read", params));
  return unwrap(api.POST("/v1/admin/notifications/{notificationId}/actions/read", params));
}

/**
 * In-app notification centre of every zone (F1 1.3 §6): the user's inbox across tenants, newest first,
 * kept fresh by realtime `notification.*` events. Other channels (LINE, SMS, email, web push) are in
 * the delivery log, not here.
 */
export function NotificationCentre({ zone }: { zone: Zone }) {
  const t = useTranslations("notifications");
  const common = useTranslations("common");
  const loadingLabel = common("loading");
  const format = useFormatter();
  const client = useQueryClient();
  const realtime = useRealtimeStatus();
  const [open, setOpen] = useState(false);

  const inbox = useInfiniteQuery({
    queryKey: queryKeys.notifications(zone),
    queryFn: ({ pageParam }) => listInbox(zone, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });
  const read = useMutation({
    mutationFn: (id: string) => markRead(zone, id),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.notifications(zone) }),
  });

  const items = inbox.data?.pages.flatMap((page) => page.data) ?? [];
  const unread = items.filter((item) => item.readAt === null).length;

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      className="w-80 p-0"
      trigger={
        <IconButton
          name="bell"
          label={t("open", { count: unread })}
          data-testid="notification-centre"
          badge={<CountBadge count={unread} />}
        />
      }
    >
      <div className="border-border flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <span
          className="text-muted flex items-center gap-1 text-xs"
          data-testid="realtime-status"
          data-status={realtime}
        >
          <span
            aria-hidden="true"
            className={cn("size-2 rounded-full", realtime === "open" ? "bg-success" : "bg-border-strong")}
          />
          {realtime === "open" ? t("live") : t("offline")}
        </span>
      </div>
      <div className="max-h-96 overflow-y-auto" aria-live="polite">
        {inbox.isPending ? (
          <div className="flex justify-center p-6">
            <Spinner label={loadingLabel} />
          </div>
        ) : inbox.isError ? (
          <p className="text-muted p-4 text-sm">{t("error")}</p>
        ) : items.length === 0 ? (
          <p className="text-muted p-4 text-sm">{t("empty")}</p>
        ) : (
          <ul className="divide-border divide-y" data-testid="notification-list">
            {items.map((item) => (
              <li key={item.id} className={cn("px-4 py-3", item.readAt === null && "bg-primary-subtle/40")}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    {item.title ? <p className="text-sm font-semibold">{item.title}</p> : null}
                    <p className="text-sm">{item.body}</p>
                    <p className="text-muted mt-1 text-xs">{format.relativeTime(new Date(item.createdAt))}</p>
                  </div>
                  {item.readAt === null ? (
                    <IconButton
                      name="check"
                      size="sm"
                      label={t("markRead")}
                      onClick={() => read.mutate(item.id)}
                      disabled={read.isPending}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {inbox.hasNextPage ? (
          <div className="p-2">
            <Button
              variant="ghost"
              size="sm"
              block
              loading={inbox.isFetchingNextPage}
              onClick={() => inbox.fetchNextPage()}
            >
              {t("loadMore")}
            </Button>
          </div>
        ) : null}
      </div>
    </Popover>
  );
}

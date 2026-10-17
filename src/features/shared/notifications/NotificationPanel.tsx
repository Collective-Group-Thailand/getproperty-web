"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";

import { QueryProvider } from "@/features/shared/providers/QueryProvider";
import { queryKeys } from "@/lib/api/query";
import type { Zone } from "@/lib/zones";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { Spinner } from "@/ui/components/Spinner";
import { cn } from "@/ui/lib/cn";
import { IconCheck } from "@/ui/icons/glyphs/check";

import { useRealtimeStatus } from "../realtime/RealtimeProvider";
import { listInbox, markRead } from "./inbox";

export interface NotificationPanelProps {
  zone: Zone;
  /** After a mark-as-read, so the badge recounts. */
  onChanged: () => void;
}

/**
 * The open notification centre: the inbox, newest first, paged, with mark-as-read. Loaded the first
 * time the centre opens (D-179), together with TanStack Query.
 */
export function NotificationPanel(props: NotificationPanelProps) {
  return (
    <QueryProvider>
      <Inbox {...props} />
    </QueryProvider>
  );
}

function Inbox({ zone, onChanged }: NotificationPanelProps) {
  const t = useTranslations("notifications");
  const common = useTranslations("common");
  const loadingLabel = common("loading");
  const format = useFormatter();
  const client = useQueryClient();
  const realtime = useRealtimeStatus();

  const inbox = useInfiniteQuery({
    queryKey: queryKeys.notifications(zone),
    queryFn: ({ pageParam }) => listInbox(zone, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });
  const read = useMutation({
    mutationFn: (id: string) => markRead(zone, id),
    onSettled: () => {
      onChanged();
      return client.invalidateQueries({ queryKey: queryKeys.notifications(zone) });
    },
  });

  const items = inbox.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <>
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
                      icon={IconCheck}
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
    </>
  );
}

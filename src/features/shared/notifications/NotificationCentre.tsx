"use client";

import { useTranslations } from "next-intl";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import type { Zone } from "@/lib/zones";
import { CountBadge } from "@/ui/components/CountBadge";
import { IconButton } from "@/ui/components/IconButton";
import { LazyPopover } from "@/ui/components/overlays";
import { Spinner } from "@/ui/components/Spinner";
import { lazyWarm } from "@/ui/lib/lazy";
import { IconBell } from "@/ui/icons/glyphs/bell";

import { useRealtimeEvents } from "../realtime/RealtimeProvider";
import { listInbox } from "./inbox";
import type { NotificationPanelProps } from "./NotificationPanel";

const NotificationPanel = lazyWarm<NotificationPanelProps>(() =>
  import("./NotificationPanel").then((module) => module.NotificationPanel),
);

/**
 * In-app notification centre of every zone (F1 1.3 §6): the user's inbox across tenants, newest first,
 * kept fresh by realtime events. Other channels (LINE, SMS, email, web push) are in the delivery log,
 * not here.
 *
 * The bell and its unread count are all a page loads (D-179): the count comes from the first inbox
 * page, fetched directly and refreshed on realtime events (any event may have produced a notification,
 * as `invalidationKeys` assumes); the panel — and TanStack Query — loads when the centre first opens.
 */
export function NotificationCentre({ zone }: { zone: Zone }) {
  const t = useTranslations("notifications");
  const common = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  const recount = useCallback(() => {
    listInbox(zone, undefined)
      .then((page) => setUnread(page.data.filter((item) => item.readAt === null).length))
      .catch(() => undefined);
  }, [zone]);

  useEffect(() => {
    recount();
    return () => window.clearTimeout(timer.current);
  }, [recount]);

  useRealtimeEvents(() => {
    // A burst of events → one request.
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(recount, 300);
  });

  return (
    <LazyPopover
      open={open}
      onOpenChange={setOpen}
      align="end"
      className="w-80 p-0"
      trigger={
        <IconButton
          icon={IconBell}
          label={t("open", { count: unread })}
          data-testid="notification-centre"
          badge={<CountBadge count={unread} />}
        />
      }
    >
      <Suspense
        fallback={
          <div className="flex justify-center p-6">
            <Spinner label={common("loading")} />
          </div>
        }
      >
        <NotificationPanel zone={zone} onChanged={recount} />
      </Suspense>
    </LazyPopover>
  );
}

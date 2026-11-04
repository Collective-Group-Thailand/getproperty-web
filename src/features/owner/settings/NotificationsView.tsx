import { getTranslations } from "next-intl/server";

import { SectionError } from "@/features/shared/console/SectionError";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconBell } from "@/ui/icons/glyphs/bell";

import { ownerPath } from "../shared/links";
import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { NotificationMatrix, type MatrixRow } from "./NotificationMatrix";
import { SettingsCard, SettingsFrame } from "./SettingsNav";

const CHANNEL_ORDER: Schemas["NotificationChannel"][] = ["line", "sms", "email", "web_push", "in_app"];

/**
 * Settings › Notifications (F2 2.6, D-063; redesign G6): which channels each resident message goes out on — the
 * message in words with one line of what it is (never its event code), urgent ones marked (they ignore quiet hours),
 * a checkbox per channel, saved together from the sticky bar. Quiet hours live on the general page.
 */
export async function NotificationsView({
  context,
}: {
  context: OwnerContext;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.settings.notifications");
  const { api, locale, me } = context;
  const routes = await section(unwrap(api.GET("/v1/owner/notification-routes")));
  const editable = ownerCan(me, "notification.route.manage") && !readOnly(me);
  const resident = (routes.data ?? []).filter((route) => route.audience === "resident");
  const channels = CHANNEL_ORDER.filter((channel) => resident.some((route) => route.channel === channel));
  // A message this page has no name for is left out rather than shown as its event code.
  const events = [...new Set(resident.map((route) => route.eventType))].filter((eventType) =>
    t.has(`event.${eventType.replaceAll(".", "_")}`),
  );
  const rows: MatrixRow[] = events.map((eventType) => {
    const id = eventType.replaceAll(".", "_");
    const own = resident.filter((route) => route.eventType === eventType);
    return {
      eventType,
      label: t(`event.${id}` as never),
      description: t.has(`eventHint.${id}`) ? t(`eventHint.${id}` as never) : undefined,
      urgent: own.some((route) => route.urgent),
      overridden: own.some((route) => route.overridden),
      routes: Object.fromEntries(own.map((route) => [route.channel, route])),
    };
  });
  const general = ownerPath(locale, "/settings?section=general#settings-notifications-title");
  return (
    <SettingsFrame
      me={me}
      locale={locale}
      current="/settings/notifications"
      title={t("title")}
      description={t("description")}
      testId="notification-routes"
    >
      {!routes.data ? (
        <SectionError error={routes.error} />
      ) : rows.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconBell}
          title={t("empty")}
          action={
            <Button asChild variant="secondary">
              <a href={general}>{t("quietHoursLink")}</a>
            </Button>
          }
        />
      ) : (
        <SettingsCard
          id="notifications-matrix"
          title={t("matrixTitle")}
          description={t("matrixHint")}
          flush
          className="overflow-visible"
        >
          <NotificationMatrix
            rows={rows}
            channels={channels}
            editable={editable}
            channelLabels={Object.fromEntries(
              channels.map((channel) => [
                channel,
                { label: t(`channel.${channel}`), note: channel === "sms" ? t("smsNote") : undefined },
              ]),
            )}
          />
        </SettingsCard>
      )}
      <p className="text-muted text-sm">
        {t.rich("quietHoursHint", {
          link: (chunks) => (
            <a className="text-primary font-medium underline-offset-4 hover:underline" href={general}>
              {chunks}
            </a>
          ),
        })}
      </p>
    </SettingsFrame>
  );
}

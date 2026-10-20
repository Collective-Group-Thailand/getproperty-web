import { getTranslations } from "next-intl/server";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { RouteSwitch } from "./RouteSwitch";
import { SettingsNav } from "./SettingsNav";

const CHANNEL_ORDER: Schemas["NotificationChannel"][] = ["line", "sms", "email", "web_push", "in_app"];

/**
 * Notification routing (F2 2.6, D-063): the resident-facing events × channels matrix — which channels
 * each event goes out on for this tenant (platform default or the tenant's override), urgent events
 * marked (they ignore quiet hours). Each switch saves at once.
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
  const events = [...new Set(resident.map((route) => route.eventType))];
  const cell = (eventType: string, channel: Schemas["NotificationChannel"]) =>
    resident.find((route) => route.eventType === eventType && route.channel === channel);
  const eventLabel = (eventType: string) => {
    const id = `event.${eventType.replaceAll(".", "_")}`;
    return t.has(id) ? t(id) : eventType;
  };
  return (
    <OwnerPage testId="notification-routes">
      <PageHeader title={t("title")} description={t("description")} />
      <SettingsNav me={me} current="/settings/notifications" locale={locale} />
      {!routes.data ? (
        <SectionError error={routes.error} />
      ) : events.length === 0 ? (
        <Card>
          <EmptyState title={t("empty")} />
        </Card>
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="route-matrix"
          minWidth="44rem"
          columns={[
            { key: "event", header: t("col.event") },
            ...channels.map((channel) => ({ key: channel, header: t(`channel.${channel}`), align: "center" as const })),
          ]}
          rows={events.map((eventType) => {
            const urgent = resident.some((route) => route.eventType === eventType && route.urgent);
            const overridden = resident.some((route) => route.eventType === eventType && route.overridden);
            return {
              key: eventType,
              testId: "route-row",
              data: { event: eventType },
              cells: {
                event: (
                  <span className="flex flex-col gap-1">
                    <span className="font-medium">{eventLabel(eventType)}</span>
                    <span className="text-muted font-mono text-xs">{eventType}</span>
                    <span className="flex flex-wrap gap-1">
                      {urgent ? (
                        <Badge size="sm" tone="warning">
                          {t("urgent")}
                        </Badge>
                      ) : null}
                      {overridden ? <Badge size="sm">{t("overridden")}</Badge> : null}
                    </span>
                  </span>
                ),
                ...Object.fromEntries(
                  channels.map((channel) => {
                    const route = cell(eventType, channel);
                    return [
                      channel,
                      route ? (
                        <RouteSwitch
                          route={route}
                          disabled={!editable}
                          label={t("switchLabel", { event: eventLabel(eventType), channel: t(`channel.${channel}`) })}
                        />
                      ) : (
                        <span className="text-muted">
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">{t("notAvailable")}</span>
                        </span>
                      ),
                    ];
                  }),
                ),
              },
            };
          })}
        />
      )}
      <p className="text-muted text-sm">{t("quietHoursHint")}</p>
    </OwnerPage>
  );
}

import { getLocale, getTranslations } from "next-intl/server";
import { DEVICE_STATUS } from "@/domain/status/device";

import { DeviceEventName } from "@/features/shared/devices/DeviceEventName";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatRelativeTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";

import { StaffList } from "../shell/StaffList";
import { CommandButton, IdentifyButton } from "./IdentifyButton";
import { StatusPageLink } from "./StatusPageLink";

/**
 * One device (F4 4.3): status and health, its meter channels (open first, then history), the last
 * events, and on a gateway the field actions — blink the LED, read now — and its LAN status page.
 */
export async function DeviceDetail({ detail }: { detail: Schemas["DeviceDetailDto"] }) {
  const t = await getTranslations("staff.devices.detail");
  const locale = (await getLocale()) as Locale;
  const { device } = detail;
  const gateway = device.kind === "gateway";
  const live = device.status === "online" || device.status === "degraded";

  const openChannels = detail.channels.filter((channel) => !channel.validTo).length;
  return (
    <div className="flex flex-col gap-5 py-6" data-testid="device-detail">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-mono text-2xl font-semibold">{device.serial}</h1>
          <StatusBadgeOf map={DEVICE_STATUS} value={device.status} />
        </div>
        <p className="text-muted">
          {t(`kind.${device.kind}`)} · {device.vendor} {device.model}
        </p>
      </header>

      <Card as="section" aria-label={t("facts")}>
        <DescriptionList
          className="grid-cols-2 gap-y-4"
          items={[
            {
              id: "seen",
              term: t("lastSeen"),
              description: device.lastSeenAt ? formatRelativeTime(device.lastSeenAt, locale) : t("never"),
            },
            { id: "firmware", term: t("firmware"), description: device.firmwareVersion },
            ...(device.health
              ? [
                  {
                    id: "link",
                    term: t("link"),
                    description: device.health.link
                      ? `${device.health.link}${device.health.rssi !== null ? ` · ${device.health.rssi} dBm` : ""}`
                      : null,
                  },
                  {
                    id: "buffered",
                    term: t("buffered"),
                    description:
                      device.health.bufferedReadings !== null ? (
                        <span className="tabular-nums">{device.health.bufferedReadings}</span>
                      ) : null,
                  },
                  {
                    id: "config",
                    term: t("config"),
                    description:
                      device.health.configVersion !== null ? (
                        <span className="tabular-nums">{device.health.configVersion}</span>
                      ) : null,
                  },
                ]
              : []),
            ...(gateway
              ? [
                  {
                    id: "meters",
                    term: t("meterCount"),
                    description: <span className="tabular-nums">{openChannels}</span>,
                  },
                ]
              : []),
          ]}
        />
      </Card>

      {gateway && live && (device.nextActions.includes("identify") || device.nextActions.includes("read-now")) ? (
        <section aria-labelledby="device-actions" className="flex flex-col gap-3">
          <h2 id="device-actions" className="text-lg font-semibold">
            {t("actions")}
          </h2>
          <Card padding="none" className="divide-border divide-y overflow-hidden">
            {device.nextActions.includes("identify") ? <IdentifyButton gatewayId={device.id} /> : null}
            {device.nextActions.includes("read-now") ? (
              <CommandButton
                gatewayId={device.id}
                type="read_now"
                label={t("readNow")}
                hint={t("readNowHint")}
                icon={IconRefresh}
                testId="read-now"
              />
            ) : null}
          </Card>
        </section>
      ) : null}

      {gateway ? (
        <Card as="section" aria-labelledby="device-lan" className="flex flex-col gap-3">
          <h2 id="device-lan" className="text-lg font-semibold">
            {t("statusPage")}
          </h2>
          <StatusPageLink />
        </Card>
      ) : null}

      <section aria-labelledby="device-channels" className="flex flex-col gap-3">
        <h2 id="device-channels" className="text-lg font-semibold">
          {t("channels")}
        </h2>
        {detail.channels.length === 0 ? (
          <Card>
            <p className="text-muted">{t("noChannels")}</p>
          </Card>
        ) : (
          <div data-testid="device-channels">
            <StaffList
              label={t("channels")}
              groups={[
                {
                  key: "channels",
                  rows: detail.channels.map((channel) => ({
                    key: channel.id,
                    title: channel.meterName,
                    meta: `${channel.busId} · ${
                      channel.address !== null
                        ? t("address", { address: channel.address })
                        : t("pin", { pin: channel.pin ?? "—" })
                    } · ${channel.driver}`,
                    aside: (
                      <span className="text-muted text-xs">
                        {channel.validTo
                          ? t("closed", {
                              from: formatDateTime(channel.validFrom, locale),
                              to: formatDateTime(channel.validTo, locale),
                            })
                          : t("since", { from: formatDateTime(channel.validFrom, locale) })}
                      </span>
                    ),
                  })),
                },
              ]}
            />
          </div>
        )}
      </section>

      {detail.events.length > 0 ? (
        <section aria-labelledby="device-events" className="flex flex-col gap-3">
          <h2 id="device-events" className="text-lg font-semibold">
            {t("events")}
          </h2>
          <Card padding="none">
            <ul className="divide-border divide-y text-sm">
              {detail.events.slice(0, 10).map((event) => (
                <li key={event.id} className="flex flex-col gap-0.5 px-4 py-3" data-testid="event-row">
                  <span>
                    <DeviceEventName type={event.type} />
                    <span className="text-muted"> · {formatRelativeTime(event.occurredAt, locale)}</span>
                  </span>
                  {event.message ? <span className="text-muted">{event.message}</span> : null}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

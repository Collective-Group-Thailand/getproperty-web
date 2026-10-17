import { getLocale, getTranslations } from "next-intl/server";
import { DEVICE_STATUS } from "@/domain/status/device";
import Link from "next/link";

import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatRelativeTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { IconBack } from "@/ui/icons/glyphs/back";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";

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

  return (
    <div className="flex flex-col gap-5 py-6" data-testid="device-detail">
      <Button asChild variant="ghost" size="lg" iconStart={IconBack} className="self-start">
        <Link href="/devices">{t("back")}</Link>
      </Button>
      <header className="flex flex-col gap-2">
        <h1 className="font-mono text-2xl font-semibold">{device.serial}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadgeOf map={DEVICE_STATUS} value={device.status} />
          <span className="text-muted text-sm">
            {t(`kind.${device.kind}`)} · {device.vendor} {device.model}
          </span>
        </div>
      </header>

      <dl className="rounded-card border-border bg-surface grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border p-4">
        <dt className="text-muted">{t("lastSeen")}</dt>
        <dd>{device.lastSeenAt ? formatRelativeTime(device.lastSeenAt, locale) : t("never")}</dd>
        <dt className="text-muted">{t("firmware")}</dt>
        <dd>{device.firmwareVersion ?? "—"}</dd>
        {device.health ? (
          <>
            <dt className="text-muted">{t("link")}</dt>
            <dd>
              {device.health.link ?? "—"}
              {device.health.rssi !== null ? ` · ${device.health.rssi} dBm` : null}
            </dd>
            <dt className="text-muted">{t("buffered")}</dt>
            <dd className="tabular-nums">{device.health.bufferedReadings ?? "—"}</dd>
            <dt className="text-muted">{t("config")}</dt>
            <dd className="tabular-nums">{device.health.configVersion ?? "—"}</dd>
          </>
        ) : null}
      </dl>

      {gateway && live ? (
        <section aria-labelledby="device-actions" className="flex flex-col gap-3">
          <h2 id="device-actions" className="text-lg font-semibold">
            {t("actions")}
          </h2>
          {device.nextActions.includes("identify") ? <IdentifyButton gatewayId={device.id} /> : null}
          {device.nextActions.includes("read-now") ? (
            <CommandButton
              gatewayId={device.id}
              type="read_now"
              label={t("readNow")}
              icon={IconRefresh}
              testId="read-now"
            />
          ) : null}
        </section>
      ) : null}

      {gateway ? (
        <section aria-labelledby="device-lan" className="flex flex-col gap-3">
          <h2 id="device-lan" className="text-lg font-semibold">
            {t("statusPage")}
          </h2>
          <StatusPageLink />
        </section>
      ) : null}

      <section aria-labelledby="device-channels" className="flex flex-col gap-3">
        <h2 id="device-channels" className="text-lg font-semibold">
          {t("channels")}
        </h2>
        {detail.channels.length === 0 ? (
          <p className="text-muted">{t("noChannels")}</p>
        ) : (
          <ul
            className="divide-border rounded-card border-border bg-surface divide-y border"
            data-testid="device-channels"
          >
            {detail.channels.map((channel) => (
              <li key={channel.id} className="flex flex-col gap-0.5 p-3">
                <span className="font-semibold">{channel.meterName}</span>
                <span className="text-muted text-sm">
                  {channel.busId} ·{" "}
                  {channel.address !== null
                    ? t("address", { address: channel.address })
                    : t("pin", { pin: channel.pin ?? "—" })}{" "}
                  · {channel.driver}
                </span>
                <span className="text-muted text-sm">
                  {channel.validTo
                    ? t("closed", {
                        from: formatDateTime(channel.validFrom, locale),
                        to: formatDateTime(channel.validTo, locale),
                      })
                    : t("since", { from: formatDateTime(channel.validFrom, locale) })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {detail.events.length > 0 ? (
        <section aria-labelledby="device-events" className="flex flex-col gap-3">
          <h2 id="device-events" className="text-lg font-semibold">
            {t("events")}
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            {detail.events.slice(0, 10).map((event) => (
              <li key={event.id}>
                <span className="font-mono">{event.type}</span> · {formatRelativeTime(event.occurredAt, locale)}
                {event.message ? <span className="text-muted block">{event.message}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

import { getLocale, getTranslations } from "next-intl/server";

import { DEVICE_STATUS } from "@/domain/status/device";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatRelativeTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { StaffMeterPoint } from "@/lib/api/pending";
import { BigActionButton } from "@/ui/components/BigActionButton";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Icon } from "@/ui/icons";
import { IconElectric } from "@/ui/icons/glyphs/electric";
import { IconGateway } from "@/ui/icons/glyphs/gateway";
import { IconMeter } from "@/ui/icons/glyphs/meter";
import { IconQr } from "@/ui/icons/glyphs/qr";
import { IconSwap } from "@/ui/icons/glyphs/swap";
import { IconWater } from "@/ui/icons/glyphs/water";

import { BuildingSelect } from "../shared/BuildingSelect";
import type { StaffScope } from "../shared/server";
import { isGateway, type BuildingDevices } from "./server";

/**
 * Devices of the focused building (F4 4.3): what to install now (gateways to provision, meter devices
 * from the inventory), the gateways with their health, and the per-unit list of meter points with
 * their binding (IoT through a gateway, or read by hand) and the actions on each.
 */
export async function DevicesView({ scope, data }: { scope: StaffScope; data: BuildingDevices }) {
  const t = await getTranslations("staff.devices");
  const locale = (await getLocale()) as Locale;
  const gateways = data.devices.filter(isGateway);
  const toProvision = gateways.filter((device) => device.status === "assigned" || device.status === "inventory");
  const toInstall = data.devices.filter(
    (device) => !isGateway(device) && (device.status === "assigned" || device.status === "inventory"),
  );
  const byUnit = new Map<string, StaffMeterPoint[]>();
  for (const point of data.points ?? []) {
    const key = point.unitNo ?? point.commonAreaLabel ?? point.code;
    byUnit.set(key, [...(byUnit.get(key) ?? []), point]);
  }
  const serialOf = (id: string) => data.devices.find((device) => device.id === id)?.serial ?? id.slice(0, 8);

  return (
    <div className="flex flex-col gap-6 py-6" data-testid="devices">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <BuildingSelect buildings={scope.buildings} buildingId={scope.buildingId} />
      </header>

      <section aria-labelledby="devices-work" className="flex flex-col gap-3">
        <h2 id="devices-work" className="text-lg font-semibold">
          {t("work")}
        </h2>
        <BigActionButton
          href="/devices/provision"
          tone={toProvision.length > 0 ? "primary" : "default"}
          icon={IconQr}
          title={t("provisionTile")}
          description={t("provisionHint", { count: toProvision.length })}
          count={toProvision.length}
          data-testid="devices-provision"
        />
        <BigActionButton
          href="/devices/install"
          icon={IconMeter}
          title={t("installTile")}
          description={t("installHint", { count: toInstall.length })}
          count={toInstall.length}
          data-testid="devices-install"
        />
      </section>

      <section aria-labelledby="devices-gateways" className="flex flex-col gap-3">
        <h2 id="devices-gateways" className="text-lg font-semibold">
          {t("gateways")}
        </h2>
        {gateways.length === 0 ? (
          <p className="text-muted">{t("noGateways")}</p>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="gateway-list">
            {gateways.map((gateway) => (
              <li key={gateway.id}>
                <a
                  href={`/devices/${gateway.id}`}
                  className="rounded-card border-border bg-surface shadow-card hover:bg-bg-subtle flex min-h-18 items-center gap-3 border p-3"
                  data-testid="gateway-card"
                >
                  <span className="rounded-control bg-primary-subtle text-primary-subtle-fg flex size-12 items-center justify-center">
                    <Icon icon={IconGateway} size={26} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-mono text-lg font-semibold">{gateway.serial}</span>
                    <span className="text-muted text-sm">
                      {gateway.lastSeenAt
                        ? t("lastSeen", { time: formatRelativeTime(gateway.lastSeenAt, locale) })
                        : t("neverSeen")}
                      {" · "}
                      {t("meters", { count: gateway.meters })}
                    </span>
                  </span>
                  <StatusBadgeOf map={DEVICE_STATUS} value={gateway.status} size="sm" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="devices-units" className="flex flex-col gap-3">
        <h2 id="devices-units" className="text-lg font-semibold">
          {t("units")}
        </h2>
        {data.points === null ? (
          <Callout tone="info">{t("pointsUnavailable")}</Callout>
        ) : byUnit.size === 0 ? (
          <p className="text-muted">{t("noPoints")}</p>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="unit-devices">
            {[...byUnit.entries()].map(([unit, points]) => (
              <li key={unit} className="rounded-card border-border bg-surface flex flex-col gap-2 border p-3">
                <h3 className="text-lg font-semibold">{unit}</h3>
                <ul className="flex flex-col gap-3">
                  {points.map((point) => (
                    <li
                      key={point.assetItemId}
                      className="flex flex-col gap-2"
                      data-testid="meter-point"
                      data-asset={point.assetItemId}
                    >
                      <p className="flex items-center gap-2">
                        <Icon icon={point.utility === "electric" ? IconElectric : IconWater} className="text-muted" />
                        <span className="font-semibold">{point.code}</span>
                        <span className="text-muted text-sm">
                          {point.channel
                            ? t("bound", {
                                device: point.channel.meterDeviceSerial ?? "—",
                                gateway: serialOf(point.channel.gatewayDeviceId),
                                where:
                                  point.channel.address !== null
                                    ? t("address", { bus: point.channel.busId, address: point.channel.address })
                                    : t("pin", { bus: point.channel.busId, pin: point.channel.pin ?? "—" }),
                              })
                            : t("manual")}
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {point.channel ? null : (
                          <Button asChild variant="secondary" size="lg" iconStart={IconMeter}>
                            <a href={`/devices/install?meter=${point.assetItemId}`}>{t("installHere")}</a>
                          </Button>
                        )}
                        <Button asChild variant="secondary" size="lg" iconStart={IconSwap}>
                          <a href={`/devices/swap?meter=${point.assetItemId}`}>{t("swapHere")}</a>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { DEVICE_STATUS } from "@/domain/status/device";
import { INSTALL_ORDER_STATUS } from "@/domain/status/installOrder";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatRelativeTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";
import { IconElectric } from "@/ui/icons/glyphs/electric";
import { IconGateway } from "@/ui/icons/glyphs/gateway";
import { IconMeter } from "@/ui/icons/glyphs/meter";
import { IconQr } from "@/ui/icons/glyphs/qr";
import { IconSwap } from "@/ui/icons/glyphs/swap";
import { IconWater } from "@/ui/icons/glyphs/water";

import { StaffList, StaffSection } from "../shell/StaffList";
import { MeterActions } from "./MeterActions";
import { isGateway, type BuildingDevices, type StaffMeterPoint } from "./server";

/**
 * Devices of the focused building (F4 4.3): what to install now (gateways to provision, meter devices
 * from the inventory), the gateways with their health, and the per-unit list of meter points with
 * their binding (IoT through a gateway, or read by hand) and the actions on each.
 */
export async function DevicesView({ data }: { data: BuildingDevices }) {
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

  const count = (value: number) => (
    <span
      className={value > 0 ? "text-primary text-xl font-semibold" : "text-muted text-xl"}
      data-testid="big-action-count"
    >
      {value}
    </span>
  );
  const pointLine = (point: StaffMeterPoint) =>
    point.channel
      ? t("bound", {
          device: point.channel.meterDeviceSerial ?? "—",
          gateway: serialOf(point.channel.gatewayDeviceId),
          where:
            point.channel.address !== null
              ? t("address", { bus: point.channel.busId, address: point.channel.address })
              : t("pin", { bus: point.channel.busId, pin: point.channel.pin ?? "—" }),
        })
      : t("manual");

  return (
    <div className="flex flex-col gap-8 py-6" data-testid="devices">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted">{t("lede")}</p>
      </header>

      <StaffSection id="devices-work" title={t("work")}>
        <StaffList
          label={t("work")}
          groups={[
            {
              key: "work",
              rows: [
                {
                  key: "provision",
                  href: "/devices/provision",
                  icon: IconQr,
                  title: t("provisionTile"),
                  meta: t("provisionHint", { count: toProvision.length }),
                  aside: count(toProvision.length),
                  testId: "devices-provision",
                },
                {
                  key: "install",
                  href: "/devices/install",
                  icon: IconMeter,
                  title: t("installTile"),
                  meta: t("installHint", { count: toInstall.length }),
                  aside: count(toInstall.length),
                  testId: "devices-install",
                },
                {
                  key: "swap",
                  href: "/devices/swap",
                  icon: IconSwap,
                  title: t("swapTile"),
                  meta: t("swapHint"),
                  testId: "devices-swap",
                },
              ],
            },
          ]}
        />
      </StaffSection>

      {data.installOrders.length > 0 ? (
        <StaffSection
          id="devices-orders"
          title={t("orders.title")}
          count={data.installOrders.length}
          testId="install-orders"
        >
          <ul className="flex flex-col gap-3">
            {data.installOrders.map((order) => {
              const items = order.units.flatMap((unit) => unit.items.map((item) => ({ ...item, unitNo: unit.unitNo })));
              const open = items.filter((item) => item.state === "open");
              return (
                <li
                  key={order.id}
                  className="rounded-card border-border bg-surface shadow-card flex flex-col gap-3 border p-4"
                  data-testid="install-order"
                  data-state={order.state}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-semibold">{t(`orders.kind.${order.kind}`)}</span>
                      <span className="text-muted text-sm">
                        {[
                          order.dueAt ? t("orders.due", { date: formatDate(order.dueAt, locale) }) : null,
                          t("orders.progress", { open: open.length, total: items.length }),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                    <StatusBadgeOf map={INSTALL_ORDER_STATUS} value={order.state} size="sm" />
                  </div>
                  {open.length > 0 ? (
                    <ul className="divide-border border-border divide-y border-t text-sm">
                      {open.map((item, index) => (
                        <li
                          key={`${item.deviceId ?? item.assetItemId ?? "item"}-${index}`}
                          className="flex min-h-11 items-center gap-3"
                        >
                          <Icon icon={item.kind === "gateway" ? IconGateway : IconMeter} className="text-subtle" />
                          <span>
                            {item.unitNo ? `${item.unitNo} · ` : ""}
                            {t(`orders.item.${item.kind}`)}
                            {item.deviceId ? (
                              <span className="text-muted font-mono"> · {serialOf(item.deviceId)}</span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </StaffSection>
      ) : null}

      <StaffSection id="devices-gateways" title={t("gateways")} count={gateways.length}>
        {gateways.length === 0 ? (
          <EmptyState
            variant="card"
            icon={IconGateway}
            title={t("noGateways")}
            description={t("noGatewaysHint")}
            action={
              <Button asChild variant="secondary" size="lg">
                <Link href="/devices/provision">{t("provisionTile")}</Link>
              </Button>
            }
          />
        ) : (
          <StaffList
            label={t("gateways")}
            testId="gateway-list"
            groups={[
              {
                key: "gateways",
                rows: gateways.map((gateway) => ({
                  key: gateway.id,
                  href: `/devices/${gateway.id}`,
                  icon: IconGateway,
                  title: <span className="font-mono">{gateway.serial}</span>,
                  meta: `${
                    gateway.lastSeenAt
                      ? t("lastSeen", { time: formatRelativeTime(gateway.lastSeenAt, locale) })
                      : t("neverSeen")
                  } · ${t("meters", { count: gateway.meters })}`,
                  status: <StatusBadgeOf map={DEVICE_STATUS} value={gateway.status} size="sm" />,
                  actionTestId: "gateway-card",
                })),
              },
            ]}
          />
        )}
      </StaffSection>

      <StaffSection id="devices-units" title={t("units")}>
        {data.points === null ? (
          <Callout tone="warning">{t("pointsUnavailable")}</Callout>
        ) : byUnit.size === 0 ? (
          <EmptyState
            variant="card"
            icon={IconMeter}
            title={t("noPoints")}
            description={t("noPointsHint")}
            action={
              <Button asChild variant="secondary" size="lg">
                <Link href="/">{t("backToday")}</Link>
              </Button>
            }
          />
        ) : (
          <StaffList
            label={t("units")}
            testId="unit-devices"
            groups={[...byUnit.entries()].map(([unit, points]) => ({
              key: unit,
              label: unit,
              rows: points.map((point) => ({
                key: point.assetItemId,
                icon: point.utility === "electric" ? IconElectric : IconWater,
                title: (
                  <>
                    <span className="font-mono">{point.code}</span>{" "}
                    <span className="text-muted font-normal">· {t(`utility.${point.utility}`)}</span>
                  </>
                ),
                meta: pointLine(point),
                menu: (
                  <MeterActions
                    title={point.code}
                    actions={[
                      ...(point.channel
                        ? []
                        : [
                            {
                              href: `/devices/install?meter=${point.assetItemId}`,
                              label: t("installHere"),
                              icon: IconMeter,
                            },
                          ]),
                      { href: `/devices/swap?meter=${point.assetItemId}`, label: t("swapHere"), icon: IconSwap },
                    ]}
                  />
                ),
                testId: "meter-point",
                data: { asset: point.assetItemId },
              })),
            }))}
          />
        )}
      </StaffSection>
    </div>
  );
}

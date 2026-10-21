import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { DEVICE_STATUS, DEVICE_VALUES } from "@/domain/status/device";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { MqttTransportBadge } from "@/features/shared/devices/MqttTransportBadge";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatNumber, formatRelativeTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { Stat } from "@/ui/components/Stat";
import { IconGateway } from "@/ui/icons/glyphs/gateway";
import { IconOffline } from "@/ui/icons/glyphs/offline";
import { IconOnline } from "@/ui/icons/glyphs/online";
import { IconWarning } from "@/ui/icons/glyphs/warning";

import { enumParam, pageParam, param, section, tenantLabel, tenantNames, type AdminContext } from "../shared/server";
import { DEVICE_KINDS } from "./constants";
import { ImportDevices, RegisterDevice } from "./DeviceActions";

type SearchParams = Record<string, string | string[] | undefined>;

/** Fleet connectivity per building from the API's counts: gateways online / degraded / offline. */
function connectivity(rows: Schemas["FleetBuildingRowDto"][]) {
  const buildings = new Map<
    string,
    {
      id: string;
      name: string;
      tenantId: string | null;
      tenantName: string | null;
      online: number;
      degraded: number;
      offline: number;
      other: number;
    }
  >();
  for (const row of rows) {
    const entry = buildings.get(row.buildingId) ?? {
      id: row.buildingId,
      name: row.buildingName,
      tenantId: row.tenantId,
      tenantName: row.tenantName,
      online: 0,
      degraded: 0,
      offline: 0,
      other: 0,
    };
    if (row.kind === "gateway") {
      if (row.status === "online") entry.online += row.count;
      else if (row.status === "degraded") entry.degraded += row.count;
      else if (row.status === "offline") entry.offline += row.count;
      else entry.other += row.count;
    }
    buildings.set(row.buildingId, entry);
  }
  return [...buildings.values()].sort(
    (a, b) => b.offline - a.offline || b.degraded - a.degraded || a.name.localeCompare(b.name),
  );
}

/**
 * Device fleet (F5 5.3, D-033, D-131): gateway connectivity per tenant and building (online / degraded /
 * offline from the API's counts), stock in the inventory, and every device with its status, ring,
 * firmware and last heartbeat; CSV import and single registration.
 */
export async function FleetView({ context, searchParams }: { context: AdminContext; searchParams: SearchParams }) {
  const t = await getTranslations("admin.fleet");
  const kinds = await getTranslations("admin.fleet.kind");
  const { api, locale } = context;
  const kind = enumParam(searchParams.kind, DEVICE_KINDS);
  const status = enumParam(searchParams.status, DEVICE_VALUES);
  const buildingId = /^[0-9a-f-]{36}$/i.test(param(searchParams.buildingId) ?? "")
    ? param(searchParams.buildingId)
    : undefined;
  const [summary, devices, names] = await Promise.all([
    section(unwrap(api.GET("/v1/admin/devices/fleet"))),
    section(
      unwrap(
        api.GET("/v1/admin/devices", {
          params: {
            query: {
              page: pageParam(searchParams.page),
              perPage: 25,
              q: param(searchParams.q),
              kind,
              status,
              buildingId,
            },
          },
        }),
      ),
    ),
    tenantNames(),
  ]);
  const buildings = summary.data ? connectivity(summary.data.byBuilding) : [];
  const totals = buildings.reduce(
    (sum, building) => ({
      online: sum.online + building.online,
      degraded: sum.degraded + building.degraded,
      offline: sum.offline + building.offline,
    }),
    { online: 0, degraded: 0, offline: 0 },
  );
  const stock = summary.data?.inventory.reduce((sum, row) => sum + row.count, 0) ?? 0;

  return (
    <ConsolePage testId="fleet">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <ImportDevices />
            <RegisterDevice />
          </>
        }
      />
      {!summary.data ? (
        <SectionError error={summary.error} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="fleet-stats">
            <Stat
              icon={IconOnline}
              label={t("online")}
              value={<span data-testid="fleet-online">{formatNumber(totals.online, locale)}</span>}
            />
            <Stat
              icon={IconWarning}
              label={t("degraded")}
              value={<span data-testid="fleet-degraded">{formatNumber(totals.degraded, locale)}</span>}
            />
            <Stat
              icon={IconOffline}
              label={t("offline")}
              value={<span data-testid="fleet-offline">{formatNumber(totals.offline, locale)}</span>}
            />
            <Stat
              icon={IconGateway}
              label={t("inventory")}
              value={formatNumber(stock, locale)}
              hint={
                summary.data.inventory
                  .map((row) => `${kinds(row.kind)} ${formatNumber(row.count, locale)}`)
                  .join(" · ") || undefined
              }
            />
          </div>
          <Card as="section" aria-labelledby="fleet-buildings">
            <CardHeader title={<span id="fleet-buildings">{t("byBuilding")}</span>} description={t("byBuildingHint")} />
            {buildings.length === 0 ? (
              <EmptyState title={t("noBuildings")} />
            ) : (
              <SimpleTable
                caption={t("byBuilding")}
                testId="fleet-buildings"
                minWidth="48rem"
                columns={[
                  { key: "building", header: t("col.building") },
                  { key: "tenant", header: t("col.tenant") },
                  { key: "online", header: t("online"), align: "end" },
                  { key: "degraded", header: t("degraded"), align: "end" },
                  { key: "offline", header: t("offline"), align: "end" },
                ]}
                rows={buildings.map((building) => ({
                  key: building.id,
                  testId: "fleet-building",
                  data: { offline: building.offline, degraded: building.degraded },
                  tone: building.offline > 0 ? "danger" : building.degraded > 0 ? "warning" : "default",
                  cells: {
                    building: (
                      <a href={`/devices?buildingId=${building.id}`} className="font-semibold hover:underline">
                        {building.name}
                      </a>
                    ),
                    tenant: building.tenantName ?? tenantLabel(names, building.tenantId, "—"),
                    online: formatNumber(building.online, locale),
                    degraded: formatNumber(building.degraded, locale),
                    offline: formatNumber(building.offline, locale),
                  },
                }))}
              />
            )}
          </Card>
        </>
      )}
      <section aria-labelledby="fleet-devices" className="flex flex-col gap-3">
        <h2 id="fleet-devices" className="text-lg font-semibold">
          {t("devices")}
        </h2>
        {buildingId ? (
          <p className="text-sm" data-testid="fleet-building-filter">
            {t("buildingFilter", { name: buildings.find((b) => b.id === buildingId)?.name ?? buildingId.slice(0, 8) })}{" "}
            <Link href="/devices" className="text-primary hover:underline">
              {t("clearBuilding")}
            </Link>
          </p>
        ) : null}
        <FilterBar
          fields={[
            { name: "q", label: t("search"), type: "search", placeholder: t("searchPlaceholder") },
            {
              name: "kind",
              label: t("col.kind"),
              type: "select",
              placeholder: t("allKinds"),
              options: DEVICE_KINDS.map((value) => ({ value, label: kinds(value) })),
            },
            {
              name: "status",
              label: t("col.status"),
              type: "select",
              placeholder: t("allStatuses"),
              options: DEVICE_VALUES.map((value) => ({ value, label: t(`statusName.${value}`) })),
            },
          ]}
        />
        {!devices.data ? (
          <SectionError error={devices.error} />
        ) : devices.data.data.length === 0 ? (
          <Card>
            <EmptyState title={t("noDevices")} />
          </Card>
        ) : (
          <SimpleTable
            caption={t("devices")}
            testId="device-table"
            minWidth="64rem"
            columns={[
              { key: "serial", header: t("col.serial") },
              { key: "kind", header: t("col.kind") },
              { key: "tenant", header: t("col.tenant") },
              { key: "ring", header: t("col.ring") },
              { key: "firmware", header: t("col.firmware") },
              { key: "seen", header: t("col.seen") },
              { key: "status", header: t("col.status") },
            ]}
            rows={devices.data.data.map((device) => ({
              key: device.id,
              testId: "device-row",
              data: { serial: device.serial, status: device.status, "ws-fallback": String(device.mqttWsFallback) },
              cells: {
                serial: (
                  <a href={`/devices/${device.id}`} className="flex flex-col hover:underline">
                    <span className="font-mono font-semibold">{device.serial}</span>
                    <span className="text-muted text-xs">
                      {device.vendor} {device.model}
                    </span>
                    {device.kind === "gateway" && device.mqttWsFallback ? (
                      <span className="mt-1">
                        <MqttTransportBadge enabled size="sm" />
                      </span>
                    ) : null}
                  </a>
                ),
                kind: (
                  <span className="flex flex-col gap-1">
                    <span>{kinds(device.kind)}</span>
                    <Badge size="sm" tone={device.ownership === "platform_haas" ? "info" : "neutral"}>
                      {t(`ownership.${device.ownership}`)}
                    </Badge>
                  </span>
                ),
                tenant: tenantLabel(names, device.tenantId, t("stock")),
                ring: device.kind === "gateway" ? t(`ring.${device.otaRing}`) : "—",
                firmware: device.firmwareVersion ?? "—",
                seen: device.lastSeenAt ? (
                  <time dateTime={device.lastSeenAt} title={formatDateTime(device.lastSeenAt, locale)}>
                    {formatRelativeTime(device.lastSeenAt, locale)}
                  </time>
                ) : (
                  "—"
                ),
                status: <StatusBadgeOf map={DEVICE_STATUS} value={device.status} size="sm" />,
              },
            }))}
          />
        )}
        {devices.data ? (
          <ListPagination meta={devices.data.meta} path="/devices" searchParams={searchParams} locale={locale} />
        ) : null}
      </section>
    </ConsolePage>
  );
}

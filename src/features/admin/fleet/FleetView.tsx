import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { DEVICE_STATUS, DEVICE_VALUES } from "@/domain/status/device";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { viewCounts } from "@/features/shared/console/views";
import { SectionError } from "@/features/shared/console/SectionError";
import { MqttTransportBadge } from "@/features/shared/devices/MqttTransportBadge";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatNumber, formatRelativeTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatsRow } from "@/ui/components/StatsRow";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconGateway } from "@/ui/icons/glyphs/gateway";
import { IconOffline } from "@/ui/icons/glyphs/offline";

import {
  can,
  enumParam,
  pageParam,
  param,
  section,
  tenantLabel,
  tenantNames,
  withQuery,
  type AdminContext,
} from "../shared/server";
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
  const { api, locale, me } = context;
  const manage = can(me, "admin.device.manage");
  const kind = enumParam(searchParams.kind, DEVICE_KINDS);
  const status = enumParam(searchParams.status, DEVICE_VALUES);
  const buildingId = /^[0-9a-f-]{36}$/i.test(param(searchParams.buildingId) ?? "")
    ? param(searchParams.buildingId)
    : undefined;
  const [summary, devices, names, counts] = await Promise.all([
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
    viewCounts(["online", "degraded", "offline", "inventory"] as const, (key) =>
      unwrap(api.GET("/v1/admin/devices", { params: { query: { status: key, perPage: 1 } } })),
    ),
  ]);
  const buildings = summary.data ? connectivity(summary.data.byBuilding) : [];
  const q = param(searchParams.q);
  const filtered = Boolean(q || kind || status || buildingId);

  return (
    <ConsolePage testId="fleet">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          manage ? (
            <>
              <ImportDevices />
              <RegisterDevice />
            </>
          ) : null
        }
      />
      <StatsRow
        label={t("statsLabel")}
        highlight={(counts.offline ?? 0) > 0 ? "offline" : undefined}
        figures={(["online", "degraded", "offline", "inventory"] as const)
          .filter((key) => counts[key] !== undefined)
          .map((key) => ({
            key,
            label: key === "inventory" ? t("inventory") : t(key),
            value: <span data-testid={`fleet-${key}`}>{formatNumber(counts[key]!, locale)}</span>,
            hint:
              key === "inventory" && summary.data
                ? summary.data.inventory
                    .map((row) => `${kinds(row.kind)} ${formatNumber(row.count, locale)}`)
                    .join(" · ") || undefined
                : undefined,
            href: withQuery("/devices", { status: key }),
          }))}
      />
      <section aria-labelledby="fleet-devices" className="flex flex-col gap-4">
        <h2 id="fleet-devices" className="sr-only">
          {t("devices")}
        </h2>
        {buildingId ? (
          <p className="text-sm" data-testid="fleet-building-filter">
            {t("buildingFilter", { name: buildings.find((b) => b.id === buildingId)?.name ?? t("aBuilding") })}{" "}
            <Link href="/devices" className="text-primary hover:underline">
              {t("clearBuilding")}
            </Link>
          </p>
        ) : null}
        <ListToolbar
          filters={
            <FilterBar
              variant="toolbar"
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
          }
        />
        {!devices.data ? (
          <SectionError error={devices.error} />
        ) : devices.data.data.length === 0 ? (
          <EmptyState
            variant="card"
            icon={IconGateway}
            title={filtered ? t("noDevicesFiltered") : t("noDevices")}
            action={
              filtered ? (
                <Button asChild variant="secondary">
                  <Link href="/devices">{t("clearFilters")}</Link>
                </Button>
              ) : manage ? (
                <RegisterDevice />
              ) : (
                <Button asChild variant="secondary">
                  <Link href="/">{t("backHome")}</Link>
                </Button>
              )
            }
          />
        ) : (
          <SimpleTable
            caption={t("devices")}
            testId="device-table"
            stackOnPhones
            minWidth="64rem"
            columns={[
              { key: "serial", header: t("col.serial"), phone: "title" },
              { key: "kind", header: t("col.kind"), phone: "meta" },
              { key: "tenant", header: t("col.tenant"), phone: "meta" },
              { key: "ring", header: t("col.ring"), phone: "hidden" },
              { key: "firmware", header: t("col.firmware"), phone: "hidden" },
              { key: "seen", header: t("col.seen"), phone: "meta" },
              { key: "status", header: t("col.status"), phone: "status" },
            ]}
            rows={devices.data.data.map((device) => ({
              key: device.id,
              href: `/devices/${device.id}`,
              testId: "device-row",
              data: { serial: device.serial, status: device.status, "ws-fallback": String(device.mqttWsFallback) },
              cells: {
                serial: (
                  <span className="flex flex-col">
                    <span className="font-mono font-semibold">{device.serial}</span>
                    <span className="text-muted text-sm font-normal">
                      {device.vendor} {device.model}
                    </span>
                    {device.kind === "gateway" && device.mqttWsFallback ? (
                      <span className="mt-1">
                        <MqttTransportBadge enabled size="sm" />
                      </span>
                    ) : null}
                  </span>
                ),
                kind: (
                  <span className="flex flex-col">
                    <span>{kinds(device.kind)}</span>
                    <span className="text-muted text-sm">{t(`ownership.${device.ownership}`)}</span>
                  </span>
                ),
                tenant: tenantLabel(names, device.tenantId, t("stock")),
                ring: device.kind === "gateway" ? t(`ring.${device.otaRing}`) : "—",
                firmware: <span className="font-mono text-sm">{device.firmwareVersion ?? "—"}</span>,
                seen: device.lastSeenAt ? (
                  <time
                    dateTime={device.lastSeenAt}
                    title={formatDateTime(device.lastSeenAt, locale)}
                    className="whitespace-nowrap"
                  >
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
      {!summary.data ? (
        <SectionError error={summary.error} />
      ) : (
        <section aria-labelledby="fleet-buildings" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="fleet-buildings" className="text-lg font-semibold">
              {t("byBuilding")}
            </h2>
            <p className="text-muted text-sm">{t("byBuildingHint")}</p>
          </div>
          {buildings.length === 0 ? (
            <EmptyState
              variant="card"
              icon={IconBuilding}
              title={t("noBuildings")}
              action={
                <Button asChild variant="secondary">
                  <Link href="/tenants">{t("openTenants")}</Link>
                </Button>
              }
            />
          ) : (
            <SimpleTable
              caption={t("byBuilding")}
              testId="fleet-buildings"
              stackOnPhones
              minWidth="48rem"
              columns={[
                { key: "building", header: t("col.building"), phone: "title" },
                { key: "tenant", header: t("col.tenant"), phone: "meta" },
                { key: "online", header: t("online"), align: "end", phone: "meta", phoneLabel: true },
                { key: "degraded", header: t("degraded"), align: "end", phone: "meta", phoneLabel: true },
                { key: "offline", header: t("offline"), align: "end", phone: "status", phoneLabel: true },
              ]}
              rows={buildings.map((building) => ({
                key: building.id,
                href: `/devices?buildingId=${building.id}`,
                testId: "fleet-building",
                data: { offline: building.offline, degraded: building.degraded },
                cells: {
                  building: <span className="font-semibold">{building.name}</span>,
                  tenant: building.tenantName ?? tenantLabel(names, building.tenantId, "—"),
                  online: formatNumber(building.online, locale),
                  degraded: formatNumber(building.degraded, locale),
                  offline:
                    building.offline > 0 ? (
                      <Badge tone="danger" size="sm" icon={IconOffline}>
                        {formatNumber(building.offline, locale)}
                      </Badge>
                    ) : (
                      formatNumber(building.offline, locale)
                    ),
                },
              }))}
            />
          )}
        </section>
      )}
    </ConsolePage>
  );
}

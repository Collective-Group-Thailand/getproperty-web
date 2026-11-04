import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { COMMAND_STATUS } from "@/domain/status/command";
import { DEVICE_STATUS, DEVICE_VALUES } from "@/domain/status/device";
import { DeviceEventName } from "@/features/shared/devices/DeviceEventName";
import { MqttTransportBadge } from "@/features/shared/devices/MqttTransportBadge";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatNumber } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatsRow } from "@/ui/components/StatsRow";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconGateway } from "@/ui/icons/glyphs/gateway";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ownerPath, withQuery } from "../shared/links";
import { viewCounts } from "../shared/views";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { focusedBuilding, pageParam, param, section, type OwnerContext } from "../shared/server";
import { DeviceCommands } from "./DeviceCommands";

type SearchParams = Record<string, string | string[] | undefined>;
const KINDS: Schemas["DeviceKind"][] = [
  "gateway",
  "electric_meter",
  "water_meter",
  "sensor",
  "breaker",
  "lock",
  "door_controller",
  "camera",
];

/** Rented from the platform (hardware as a service) or owned by the tenant (D-183). */
async function Ownership({ ownership }: { ownership: Schemas["DeviceOwnership"] }) {
  const t = await getTranslations("owner.devices.ownership");
  return (
    <span data-testid="device-ownership" data-ownership={ownership}>
      <Badge tone={ownership === "platform_haas" ? "info" : "neutral"} size="sm">
        {t(ownership)}
      </Badge>
    </span>
  );
}

/** Devices of the tenant's buildings (F2 2.5, read-mostly): kind, status, rented / owned, last seen, config. */
export async function DevicesView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.devices");
  const status = await getTranslations("status.device");
  const { api, locale } = context;
  const building = focusedBuilding(context);
  const kind = param(searchParams.kind);
  const statusParam = param(searchParams.status);
  const count = (query: { status?: Schemas["DeviceStatus"] }) =>
    unwrap(api.GET("/v1/owner/devices", { params: { query: { buildingId: building?.id, ...query, perPage: 1 } } }));
  const [list, counts] = await Promise.all([
    unwrap(
      api.GET("/v1/owner/devices", {
        params: {
          query: {
            page: pageParam(searchParams.page),
            perPage: 25,
            q: param(searchParams.q),
            buildingId: building?.id,
            kind: KINDS.includes(kind as Schemas["DeviceKind"]) ? (kind as Schemas["DeviceKind"]) : undefined,
            status: DEVICE_VALUES.includes(statusParam as Schemas["DeviceStatus"])
              ? (statusParam as Schemas["DeviceStatus"])
              : undefined,
          },
        },
      }),
    ),
    viewCounts(["all", "offline"] as const, (key) => count(key === "offline" ? { status: "offline" } : {})),
  ]);
  const path = (query: Record<string, string | undefined>) => ownerPath(locale, withQuery("/devices", query));
  const filtered = Boolean(param(searchParams.q) || kind || statusParam);
  return (
    <OwnerPage testId="devices">
      <PageHeader title={t("title")} description={t("description")} />
      <ListToolbar
        tabs={
          <ViewTabs
            label={t("filter.status")}
            current={statusParam === "offline" ? "offline" : statusParam ? "" : "all"}
            tabs={[
              { key: "all", href: path({}), label: t("filter.allDevices"), count: counts.all },
              { key: "offline", href: path({ status: "offline" }), label: status("offline"), count: counts.offline },
            ]}
          />
        }
        filters={
          <FilterBar
            variant="toolbar"
            fields={[
              { name: "q", label: t("filter.search"), type: "search", placeholder: t("filter.searchPlaceholder") },
              {
                name: "kind",
                label: t("filter.kind"),
                type: "select",
                placeholder: t("filter.allKinds"),
                options: KINDS.map((value) => ({ value, label: t(`kind.${value}`) })),
              },
              {
                name: "status",
                label: t("filter.status"),
                type: "select",
                placeholder: t("filter.allStatuses"),
                options: DEVICE_VALUES.map((value) => ({ value, label: status(value) })),
              },
            ]}
          />
        }
      />
      {list.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconGateway}
          title={filtered ? t("empty.filteredTitle") : t("empty.title")}
          description={filtered ? t("empty.filteredBody") : t("empty.body")}
          action={
            <Button asChild variant="secondary">
              <a href={filtered ? path({}) : ownerPath(locale, "/meters")}>
                {filtered ? t("empty.clear") : t("empty.meters")}
              </a>
            </Button>
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="device-list"
          stackOnPhones
          minWidth="52rem"
          columns={[
            { key: "device", header: t("col.device"), phone: "title" },
            { key: "kind", header: t("col.kind"), phone: "meta", className: "md:w-44" },
            { key: "lastSeen", header: t("col.lastSeen"), phone: "meta", className: "md:w-48" },
            { key: "ownership", header: t("col.ownership"), phone: "hidden", className: "md:w-40" },
            { key: "status", header: t("col.status"), phone: "status", className: "md:w-36" },
          ]}
          rows={list.data.map((device) => ({
            key: device.id,
            href: ownerPath(locale, `/devices/${device.id}`),
            testId: "device-row",
            data: { kind: device.kind },
            cells: {
              device: (
                <span className="flex flex-col gap-0.5">
                  <span className="font-mono">{device.serial}</span>
                  <span className="text-muted text-sm font-normal">
                    {device.vendor} {device.model}
                  </span>
                </span>
              ),
              kind: (
                <span className="flex flex-col">
                  <span>{t(`kind.${device.kind}`)}</span>
                  {device.kind === "gateway" ? (
                    <span className="text-muted text-sm">{t("meters", { count: device.meters })}</span>
                  ) : null}
                </span>
              ),
              lastSeen: (
                <span className="text-muted text-sm whitespace-nowrap tabular-nums">
                  {device.lastSeenAt ? formatDateTime(device.lastSeenAt, locale) : t("neverSeen")}
                </span>
              ),
              ownership: <Ownership ownership={device.ownership} />,
              status: <StatusBadgeOf map={DEVICE_STATUS} value={device.status} size="sm" />,
            },
          }))}
        />
      )}
      <ListPagination
        meta={list.meta}
        path={ownerPath(locale, "/devices")}
        searchParams={searchParams}
        locale={locale}
      />
    </OwnerPage>
  );
}

/**
 * One device (F2 2.5): status and health, rented (platform HaaS) or owned, firmware and config version,
 * the meters bound to it now and before (swap history), config versions, events, and the operator
 * commands (identify, read now) with their results.
 */
export async function DeviceDetail({ context, deviceId }: { context: OwnerContext; deviceId: string }) {
  const t = await getTranslations("owner.devices.detail");
  const devicesT = await getTranslations("owner.devices");
  const commandT = await getTranslations("owner.devices.command");
  const { api, locale } = context;
  let detail: Schemas["DeviceDetailDto"];
  try {
    detail = await unwrap(api.GET("/v1/owner/devices/{deviceId}", { params: { path: { deviceId } } }));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const { device } = detail;
  const transportT = await getTranslations("glossary.mqttTransport");
  const commands =
    device.kind === "gateway"
      ? await section(unwrap(api.GET("/v1/owner/devices/{deviceId}/commands", { params: { path: { deviceId } } })))
      : { data: null };
  const health = device.health;
  return (
    <OwnerPage testId="device-detail">
      <PageHeader
        title={device.serial}
        testId="device-title"
        back={{ label: devicesT("title"), href: ownerPath(locale, "/devices") }}
        description={`${devicesT(`kind.${device.kind}`)} · ${device.vendor} ${device.model}`}
        status={
          <span className="flex items-center gap-2">
            <StatusBadgeOf map={DEVICE_STATUS} value={device.status} />
            <Ownership ownership={device.ownership} />
          </span>
        }
      />
      <DetailLayout
        panel={
          <ActionPanel
            testId="device-panel"
            title={t("facts")}
            facts={[
              {
                key: "lastSeen",
                label: t("lastSeen"),
                value: device.lastSeenAt ? formatDateTime(device.lastSeenAt, locale) : devicesT("neverSeen"),
              },
              ...(device.firmwareVersion
                ? [{ key: "firmware", label: t("firmware"), value: device.firmwareVersion }]
                : []),
              ...(device.configAppliedVersion !== null
                ? [{ key: "config", label: t("config"), value: String(device.configAppliedVersion) }]
                : []),
              ...(device.driver ? [{ key: "driver", label: t("driver"), value: device.driver }] : []),
              ...(device.kind === "gateway"
                ? [
                    { key: "meters", label: t("meters"), value: formatNumber(device.meters, locale) },
                    {
                      key: "transport",
                      label: transportT("term"),
                      value: <MqttTransportBadge enabled={device.mqttWsFallback} />,
                    },
                  ]
                : []),
            ]}
            primary={<DeviceCommands device={device} />}
            footer={
              commands.data ? (
                <section aria-labelledby="device-command-log" data-testid="device-command-log">
                  <h3 id="device-command-log" className="text-fg mb-2 text-sm font-semibold">
                    {t("commands")}
                  </h3>
                  {commands.data.length ? (
                    <ul className="flex flex-col gap-2">
                      {commands.data.map((command) => (
                        <li key={command.id} className="flex flex-col gap-1" data-testid="command-row">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-fg font-medium">
                              {commandT.has(command.type as never)
                                ? commandT(command.type as never)
                                : commandT("other")}
                            </span>
                            <StatusBadgeOf map={COMMAND_STATUS} value={command.status} size="sm" />
                          </span>
                          <span className="tabular-nums">{formatDateTime(command.issuedAt, locale)}</span>
                          {command.error ? <span>{command.error}</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>{t("noCommands")}</p>
                  )}
                </section>
              ) : undefined
            }
          />
        }
      >
        {health ? (
          <section aria-labelledby="device-health" className="flex flex-col gap-3">
            <h2 id="device-health" className="text-lg font-semibold">
              {t("health")}
            </h2>
            <StatsRow
              label={t("health")}
              highlight={health.missedHeartbeats > 0 ? "missed" : undefined}
              figures={[
                {
                  key: "heartbeat",
                  label: t("heartbeat"),
                  value: health.lastHeartbeatAt ? formatDateTime(health.lastHeartbeatAt, locale) : "—",
                },
                { key: "missed", label: t("missed"), value: formatNumber(health.missedHeartbeats, locale) },
                {
                  key: "link",
                  label: t("link"),
                  value: health.link
                    ? t.has(`linkValue.${health.link}`)
                      ? t(`linkValue.${health.link}`)
                      : t("linkValue.other")
                    : "—",
                  hint: health.rssi !== null ? t("rssiValue", { rssi: health.rssi }) : undefined,
                },
                {
                  key: "buffered",
                  label: t("buffered"),
                  value: health.bufferedReadings !== null ? formatNumber(health.bufferedReadings, locale) : "—",
                },
              ]}
            />
          </section>
        ) : null}
        <Card as="section" aria-labelledby="device-channels" data-testid="device-channels">
          <CardHeader title={<span id="device-channels">{t("channels")}</span>} description={t("channelsHint")} />
          {detail.channels.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {detail.channels.map((channel) => (
                <li
                  key={channel.id}
                  className="flex flex-wrap items-center justify-between gap-2"
                  data-testid="channel-row"
                  data-current={channel.validTo ? "false" : "true"}
                >
                  <a
                    className="underline-offset-4 hover:underline"
                    href={ownerPath(locale, `/meters/${channel.meterAssetItemId}`)}
                  >
                    {channel.meterName}
                  </a>
                  <span className="text-muted">
                    {channel.validTo
                      ? t("boundUntil", {
                          from: formatDate(channel.validFrom, locale),
                          to: formatDate(channel.validTo, locale),
                        })
                      : t("boundSince", { from: formatDate(channel.validFrom, locale) })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted text-sm">{t("noChannels")}</p>
          )}
        </Card>
        <Card as="section" aria-labelledby="device-events">
          <CardHeader title={<span id="device-events">{t("events")}</span>} />
          {detail.events.length || detail.configs.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {detail.configs.map((config) => (
                <li key={config.id} className="flex flex-wrap gap-2">
                  <span className="font-medium">
                    {t("configVersion", { version: config.version, meters: config.meters })}
                  </span>
                  <span className="text-muted">
                    {config.appliedAt
                      ? t("appliedAt", { at: formatDateTime(config.appliedAt, locale) })
                      : t("notApplied")}
                  </span>
                </li>
              ))}
              {detail.events.map((event) => (
                <li key={event.id} className="flex flex-wrap gap-2" data-testid="event-row">
                  <DeviceEventName type={event.type} />
                  {event.message ? <span>{event.message}</span> : null}
                  <span className="text-muted">{formatDateTime(event.occurredAt, locale)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted text-sm">{t("noEvents")}</p>
          )}
        </Card>
      </DetailLayout>
    </OwnerPage>
  );
}

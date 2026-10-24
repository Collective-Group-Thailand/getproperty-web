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
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";
import { IconGateway } from "@/ui/icons/glyphs/gateway";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ownerPath } from "../shared/links";
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
  const list = await unwrap(
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
  );
  return (
    <OwnerPage testId="devices">
      <PageHeader title={t("title")} description={t("description")} />
      <FilterBar
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
      {list.data.length === 0 ? (
        <Card>
          <EmptyState icon={IconGateway} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <ul className="divide-border border-border bg-surface rounded-card divide-y border" data-testid="device-list">
          {list.data.map((device) => (
            <li key={device.id}>
              <a
                href={ownerPath(locale, `/devices/${device.id}`)}
                className="hover:bg-bg-subtle flex flex-wrap items-center gap-3 px-4 py-3"
                data-testid="device-row"
                data-kind={device.kind}
              >
                <span className="flex w-48 flex-col">
                  <span className="font-mono font-semibold">{device.serial}</span>
                  <span className="text-muted text-xs">
                    {t(`kind.${device.kind}`)} · {device.vendor} {device.model}
                  </span>
                </span>
                <span className="text-muted min-w-48 flex-1 text-sm">
                  {device.lastSeenAt
                    ? t("lastSeen", { at: formatDateTime(device.lastSeenAt, locale) })
                    : t("neverSeen")}
                  {device.kind === "gateway" ? ` · ${t("meters", { count: device.meters })}` : ""}
                </span>
                <Ownership ownership={device.ownership} />
                <StatusBadgeOf map={DEVICE_STATUS} value={device.status} size="sm" />
                <Icon icon={IconChevronRight} className="text-muted ms-auto" />
              </a>
            </li>
          ))}
        </ul>
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
        description={`${devicesT(`kind.${device.kind}`)} · ${device.vendor} ${device.model}`}
        crumbs={[{ label: device.serial }]}
        status={
          <span className="flex items-center gap-2">
            <StatusBadgeOf map={DEVICE_STATUS} value={device.status} />
            <Ownership ownership={device.ownership} />
          </span>
        }
        actions={<DeviceCommands device={device} />}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card as="section" aria-labelledby="device-facts">
          <CardHeader title={<span id="device-facts">{t("facts")}</span>} />
          <DescriptionList
            items={[
              {
                id: "lastSeen",
                term: t("lastSeen"),
                description: device.lastSeenAt ? formatDateTime(device.lastSeenAt, locale) : null,
              },
              { id: "firmware", term: t("firmware"), description: device.firmwareVersion },
              {
                id: "config",
                term: t("config"),
                description: device.configAppliedVersion !== null ? String(device.configAppliedVersion) : null,
              },
              { id: "driver", term: t("driver"), description: device.driver },
              {
                id: "meters",
                term: t("meters"),
                description: device.kind === "gateway" ? formatNumber(device.meters, locale) : null,
              },
              {
                id: "transport",
                term: transportT("term"),
                description: device.kind === "gateway" ? <MqttTransportBadge enabled={device.mqttWsFallback} /> : null,
              },
              ...(health
                ? [
                    {
                      id: "heartbeat",
                      term: t("heartbeat"),
                      description: health.lastHeartbeatAt ? formatDateTime(health.lastHeartbeatAt, locale) : null,
                    },
                    { id: "missed", term: t("missed"), description: formatNumber(health.missedHeartbeats, locale) },
                    { id: "link", term: t("link"), description: health.link },
                    {
                      id: "rssi",
                      term: t("rssi"),
                      description: health.rssi !== null ? t("rssiValue", { rssi: health.rssi }) : null,
                    },
                    {
                      id: "buffered",
                      term: t("buffered"),
                      description:
                        health.bufferedReadings !== null ? formatNumber(health.bufferedReadings, locale) : null,
                    },
                  ]
                : []),
            ]}
          />
        </Card>
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
        {commands.data ? (
          <Card as="section" aria-labelledby="device-command-log" data-testid="device-command-log">
            <CardHeader title={<span id="device-command-log">{t("commands")}</span>} />
            {commands.data.length ? (
              <ul className="flex flex-col gap-2 text-sm">
                {commands.data.map((command) => (
                  <li key={command.id} className="flex flex-wrap items-center gap-2" data-testid="command-row">
                    <span className="font-medium">
                      {commandT.has(command.type as never) ? commandT(command.type as never) : command.type}
                    </span>
                    <StatusBadgeOf map={COMMAND_STATUS} value={command.status} size="sm" />
                    <span className="text-muted">{formatDateTime(command.issuedAt, locale)}</span>
                    {command.error ? <span className="text-muted">{command.error}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted text-sm">{t("noCommands")}</p>
            )}
          </Card>
        ) : null}
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
      </div>
    </OwnerPage>
  );
}

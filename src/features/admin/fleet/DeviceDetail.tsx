import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { COMMAND_STATUS } from "@/domain/status/command";
import { DEVICE_STATUS } from "@/domain/status/device";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatNumber, formatRelativeTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { section, tenantLabel, tenantNames, type AdminContext } from "../shared/server";
import { DeviceActions } from "./DeviceActions";
import { knownBuildings } from "./server";

/** The newest config version the platform published for the gateway — "current" — against the one it applied. */
export function configState(device: Schemas["FleetDeviceDto"], configs: Schemas["GatewayConfigVersionDto"][]) {
  const published = configs.filter((config) => config.publishedAt).sort((a, b) => b.version - a.version);
  const current = published[0] ?? null;
  const applied = device.configAppliedVersion;
  const rejected = current?.rejectedAt ? current : null;
  return {
    current,
    applied,
    inSync: current !== null && applied === current.version,
    drift: current?.driftFlaggedAt ? current : null,
    rejected,
  };
}

/** A command's result as the gateway reported it: a log upload names its file, the rest is shown as JSON. */
function CommandResult({ command, label }: { command: Schemas["DeviceCommandDto"]; label: string }) {
  if (command.error) return <span className="font-mono text-xs break-all">{command.error}</span>;
  if (!command.result) return <span>—</span>;
  const result = command.result as Record<string, unknown>;
  const url =
    typeof result.url === "string" ? result.url : typeof result.downloadUrl === "string" ? result.downloadUrl : null;
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary text-sm underline-offset-4 hover:underline"
      >
        {label}
      </a>
    );
  }
  return <code className="bg-bg-subtle rounded px-1 text-xs break-all">{JSON.stringify(result)}</code>;
}

/**
 * One device (F5 5.3, D-131): facts, health, the config version the platform published against the
 * one the gateway applied (drift and rejections called out), its meter channels, events, the command
 * log with results (log uploads link to their file) and the actions the API offers.
 */
export async function DeviceDetail({ context, deviceId }: { context: AdminContext; deviceId: string }) {
  const t = await getTranslations("admin.fleet");
  const kinds = await getTranslations("admin.fleet.kind");
  const commandNames = await getTranslations("admin.fleet.command");
  const { api, locale } = context;
  let detail: Schemas["DeviceDetailDto"];
  try {
    detail = await unwrap(api.GET("/v1/admin/devices/{deviceId}", { params: { path: { deviceId } } }));
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 422)) notFound();
    throw error;
  }
  const { device, configs, events, channels } = detail;
  const gateway = device.kind === "gateway";
  const [commands, names, buildings] = await Promise.all([
    gateway
      ? section(unwrap(api.GET("/v1/admin/devices/{deviceId}/commands", { params: { path: { deviceId } } })))
      : Promise.resolve(null),
    tenantNames(),
    knownBuildings(context),
  ]);
  const config = configState(device, configs);
  const building = buildings.find((candidate) => candidate.id === device.buildingId);
  const health = device.health;

  return (
    <ConsolePage testId="device-detail">
      <PageHeader
        title={<span className="font-mono">{device.serial}</span>}
        testId="device-title"
        crumbs={[{ label: device.serial }]}
        description={`${kinds(device.kind)} · ${device.vendor} ${device.model}`}
        status={<StatusBadgeOf map={DEVICE_STATUS} value={device.status} />}
      />
      <DeviceActions
        device={device}
        tenants={[...names.entries()].map(([id, name]) => ({ id, name }))}
        buildings={buildings}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card as="section" aria-labelledby="device-facts">
          <CardHeader title={<span id="device-facts">{t("facts")}</span>} />
          <DescriptionList
            items={[
              { id: "ownership", term: t("col.ownership"), description: t(`ownership.${device.ownership}`) },
              { id: "tenant", term: t("col.tenant"), description: tenantLabel(names, device.tenantId, t("stock")) },
              {
                id: "building",
                term: t("col.building"),
                description: building?.label ?? device.buildingId?.slice(0, 8) ?? null,
              },
              { id: "ring", term: t("col.ring"), description: gateway ? t(`ring.${device.otaRing}`) : null },
              { id: "firmware", term: t("col.firmware"), description: device.firmwareVersion },
              { id: "arch", term: t("arch"), description: device.arch },
              { id: "driver", term: t("driver"), description: device.driver },
              { id: "meters", term: t("meters"), description: gateway ? formatNumber(device.meters, locale) : null },
              {
                id: "seen",
                term: t("col.seen"),
                description: device.lastSeenAt
                  ? `${formatDateTime(device.lastSeenAt, locale)} (${formatRelativeTime(device.lastSeenAt, locale)})`
                  : null,
              },
            ]}
          />
        </Card>
        {gateway ? (
          <Card as="section" aria-labelledby="device-health" data-testid="device-health">
            <CardHeader title={<span id="device-health">{t("health")}</span>} />
            {health ? (
              <DescriptionList
                items={[
                  { id: "agent", term: t("agent"), description: health.agentVersion },
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
                    description: health.rssi === null ? null : t("dbm", { value: health.rssi }),
                  },
                  {
                    id: "buffered",
                    term: t("buffered"),
                    description:
                      health.bufferedReadings === null ? null : formatNumber(health.bufferedReadings, locale),
                  },
                  {
                    id: "lag",
                    term: t("lag"),
                    description: health.ingestLagMs === null ? null : t("ms", { value: health.ingestLagMs }),
                  },
                ]}
              />
            ) : (
              <p className="text-muted">{t("noHealth")}</p>
            )}
          </Card>
        ) : null}
      </div>

      {gateway ? (
        <Card as="section" aria-labelledby="device-config" data-testid="device-config" data-in-sync={config.inSync}>
          <CardHeader
            title={<span id="device-config">{t("config")}</span>}
            description={
              <span data-testid="config-versions">
                {t("configVersions", {
                  current: config.current ? `v${config.current.version}` : "—",
                  applied: config.applied === null ? "—" : `v${config.applied}`,
                })}
              </span>
            }
            action={
              config.inSync ? (
                <Badge tone="success">{t("inSync")}</Badge>
              ) : (
                <Badge tone="warning">{t("notApplied")}</Badge>
              )
            }
          />
          {config.drift ? (
            <Callout tone="warning" className="mb-4" title={t("driftTitle")}>
              {t("driftBody", { date: formatDateTime(config.drift.driftFlaggedAt!, locale) })}
            </Callout>
          ) : null}
          {config.rejected ? (
            <Callout tone="danger" className="mb-4" title={t("rejectedTitle", { version: config.rejected.version })}>
              <span className="font-mono text-xs">{config.rejected.rejectError ?? "—"}</span>
            </Callout>
          ) : null}
          {configs.length === 0 ? (
            <p className="text-muted">{t("noConfigs")}</p>
          ) : (
            <SimpleTable
              caption={t("config")}
              testId="config-table"
              minWidth="48rem"
              columns={[
                { key: "version", header: t("col.version") },
                { key: "meters", header: t("meters"), align: "end" },
                { key: "published", header: t("col.published") },
                { key: "applied", header: t("col.applied") },
              ]}
              rows={[...configs]
                .sort((a, b) => b.version - a.version)
                .map((row) => ({
                  key: row.id,
                  testId: "config-row",
                  data: { version: row.version },
                  tone: row.rejectedAt ? "danger" : "default",
                  cells: {
                    version: `v${row.version}`,
                    meters: formatNumber(row.meters, locale),
                    published: row.publishedAt ? formatDateTime(row.publishedAt, locale) : t("notPublished"),
                    applied: row.appliedAt
                      ? formatDateTime(row.appliedAt, locale)
                      : row.rejectedAt
                        ? t("rejectedAt", { date: formatDateTime(row.rejectedAt, locale) })
                        : t("waiting"),
                  },
                }))}
            />
          )}
        </Card>
      ) : null}

      {channels.length > 0 ? (
        <Card as="section" aria-labelledby="device-channels">
          <CardHeader title={<span id="device-channels">{t("channels")}</span>} />
          <SimpleTable
            caption={t("channels")}
            minWidth="44rem"
            columns={[
              { key: "meter", header: t("col.meter") },
              { key: "bus", header: t("col.bus") },
              { key: "driver", header: t("driver") },
              { key: "since", header: t("col.since") },
            ]}
            rows={channels.map((channel) => ({
              key: channel.id,
              cells: {
                meter: channel.meterName,
                bus: `${channel.busType} ${channel.busId}${channel.address === null ? "" : ` #${channel.address}`}`,
                driver: channel.driver,
                since: `${formatDateTime(channel.validFrom, locale)}${channel.validTo ? ` – ${formatDateTime(channel.validTo, locale)}` : ""}`,
              },
            }))}
          />
        </Card>
      ) : null}

      {commands ? (
        <Card as="section" aria-labelledby="device-commands">
          <CardHeader title={<span id="device-commands">{t("commands")}</span>} description={t("commandsHint")} />
          {!commands.data ? (
            <SectionError error={commands.error} />
          ) : commands.data.length === 0 ? (
            <p className="text-muted">{t("noCommands")}</p>
          ) : (
            <SimpleTable
              caption={t("commands")}
              testId="command-table"
              minWidth="52rem"
              columns={[
                { key: "type", header: t("col.command") },
                { key: "issued", header: t("col.issued") },
                { key: "attempts", header: t("col.attempts"), align: "end" },
                { key: "result", header: t("col.result") },
                { key: "status", header: t("col.status") },
              ]}
              rows={commands.data.map((command) => ({
                key: command.id,
                testId: "command-row",
                data: { type: command.type, status: command.status },
                cells: {
                  type: commandNames(command.type),
                  issued: formatDateTime(command.issuedAt, locale),
                  attempts: formatNumber(command.attempts, locale),
                  result: <CommandResult command={command} label={t("logsLink")} />,
                  status: <StatusBadgeOf map={COMMAND_STATUS} value={command.status} size="sm" />,
                },
              }))}
            />
          )}
        </Card>
      ) : null}

      <Card as="section" aria-labelledby="device-events">
        <CardHeader title={<span id="device-events">{t("events")}</span>} />
        {events.length === 0 ? (
          <p className="text-muted">{t("noEvents")}</p>
        ) : (
          <SimpleTable
            caption={t("events")}
            testId="event-table"
            minWidth="44rem"
            columns={[
              { key: "at", header: t("col.at") },
              { key: "type", header: t("col.event") },
              { key: "message", header: t("col.message") },
            ]}
            rows={events.map((event) => ({
              key: event.id,
              tone:
                event.severity === "error" || event.severity === "critical"
                  ? "danger"
                  : event.severity === "warning"
                    ? "warning"
                    : "default",
              cells: {
                at: formatDateTime(event.occurredAt, locale),
                type: <span className="font-mono text-xs">{event.type}</span>,
                message: event.message ?? "—",
              },
            }))}
          />
        )}
      </Card>
    </ConsolePage>
  );
}

import { getTranslations } from "next-intl/server";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatDateTime, formatNumber } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { enumParam, pageParam, param, section, type AdminContext } from "../shared/server";
import { ReplayIngest } from "./IngestActions";

const REASONS: Schemas["IngestFailure"][] = [
  "unknown_topic",
  "malformed_json",
  "invalid_payload",
  "gateway_mismatch",
  "batch_too_large",
  "unknown_gateway",
  "processing_error",
];

/**
 * Ingest dead letters (F5 5.3, D-131): telemetry the platform refused (MQTT or the HTTPS batch) with
 * the reason, the gateway, a preview of the payload, and a replay once the cause is fixed.
 */
export async function IngestView({
  context,
  searchParams,
}: {
  context: AdminContext;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("admin.fleet.ingest");
  const { api, locale } = context;
  const reason = enumParam(searchParams.reason, REASONS);
  const replayed = enumParam(searchParams.replayed, ["true", "false"] as const);
  const rows = await section(
    unwrap(
      api.GET("/v1/admin/ingest/dead-letters", {
        params: {
          query: {
            page: pageParam(searchParams.page),
            perPage: 25,
            reason,
            replayed: replayed === undefined ? undefined : replayed === "true",
            q: param(searchParams.q),
          },
        },
      }),
    ),
  );
  return (
    <ConsolePage testId="ingest">
      <PageHeader title={t("title")} description={t("description")} />
      <FilterBar
        fields={[
          {
            name: "reason",
            label: t("reason"),
            type: "select",
            placeholder: t("allReasons"),
            options: REASONS.map((value) => ({ value, label: t(`reasonName.${value}`) })),
          },
          {
            name: "replayed",
            label: t("replayedFilter"),
            type: "select",
            placeholder: t("any"),
            options: [
              { value: "false", label: t("notReplayed") },
              { value: "true", label: t("replayedOnly") },
            ],
          },
        ]}
      />
      {!rows.data ? (
        <SectionError error={rows.error} />
      ) : rows.data.data.length === 0 ? (
        <Card>
          <EmptyState title={t("empty")} />
        </Card>
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="ingest-table"
          minWidth="64rem"
          columns={[
            { key: "received", header: t("col.received") },
            { key: "topic", header: t("col.topic") },
            { key: "reason", header: t("col.reason") },
            { key: "payload", header: t("col.payload") },
            { key: "replay", header: t("col.replay") },
          ]}
          rows={rows.data.data.map((row) => ({
            key: row.id,
            testId: "ingest-row",
            data: { reason: row.reason, replayed: row.replayedAt !== null },
            cells: {
              received: (
                <span className="flex flex-col">
                  <span>{formatDateTime(row.receivedAt, locale)}</span>
                  <span className="text-muted text-xs">{row.channel === "mqtt" ? "MQTT" : "HTTPS"}</span>
                </span>
              ),
              topic: (
                <span className="flex flex-col">
                  <span className="font-mono text-xs break-all">{row.topic}</span>
                  {row.gatewayDeviceId ? (
                    <a href={`/devices/${row.gatewayDeviceId}`} className="text-primary text-xs hover:underline">
                      {t("gateway")}
                    </a>
                  ) : null}
                </span>
              ),
              reason: (
                <span className="flex flex-col gap-1">
                  <Badge size="sm" tone="warning">
                    {t(`reasonName.${row.reason}`)}
                  </Badge>
                  {row.detail ? <span className="text-xs">{row.detail}</span> : null}
                </span>
              ),
              payload: (
                <span className="flex max-w-sm flex-col">
                  <code className="bg-bg-subtle rounded px-1 text-xs break-all">{row.payloadPreview ?? "—"}</code>
                  <span className="text-muted text-xs">
                    {t("bytes", { count: formatNumber(row.payloadBytes, locale) })}
                  </span>
                </span>
              ),
              replay: row.replayedAt ? (
                <span className="flex flex-col gap-1 text-xs">
                  <span>{t("replayedAt", { date: formatDateTime(row.replayedAt, locale) })}</span>
                  <span className="font-mono">{row.replayOutcome ?? "—"}</span>
                  {row.replayOutcome === "dead_letter" ? <ReplayIngest row={row} /> : null}
                </span>
              ) : (
                <ReplayIngest row={row} />
              ),
            },
          }))}
        />
      )}
      {rows.data ? (
        <ListPagination meta={rows.data.meta} path="/ingest-dead-letters" searchParams={searchParams} locale={locale} />
      ) : null}
    </ConsolePage>
  );
}

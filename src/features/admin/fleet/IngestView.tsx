import { getTranslations } from "next-intl/server";

import { ActionMenu } from "@/features/shared/console/ActionMenu";
import { CopyValue, DetailDrawer } from "@/features/shared/console/DetailDrawer";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatDateTime, formatNumber } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar } from "@/ui/components/ListToolbar";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
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
  const filtered = Boolean(reason || replayed || param(searchParams.q));
  return (
    <ConsolePage testId="ingest">
      <PageHeader title={t("title")} description={t("description")} />
      <ListToolbar
        filters={
          <FilterBar
            variant="toolbar"
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
        }
      />
      {!rows.data ? (
        <SectionError error={rows.error} />
      ) : rows.data.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconCheckCircle}
          title={filtered ? t("emptyFiltered") : t("empty")}
          description={filtered ? undefined : t("emptyHint")}
          action={
            <Button asChild variant="secondary">
              <a href={filtered ? "/ingest-dead-letters" : "/devices"}>{filtered ? t("clear") : t("openDevices")}</a>
            </Button>
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="ingest-table"
          stackOnPhones
          minWidth="64rem"
          columns={[
            { key: "reason", header: t("col.reason"), phone: "title" },
            { key: "topic", header: t("col.topic"), phone: "meta" },
            { key: "received", header: t("col.received"), phone: "meta" },
            { key: "replay", header: t("col.replay"), phone: "status" },
            { key: "actions", header: <span className="sr-only">{t("details")}</span>, phone: "meta", align: "end" },
          ]}
          rows={rows.data.data.map((row) => ({
            key: row.id,
            testId: "ingest-row",
            data: { reason: row.reason, replayed: row.replayedAt !== null },
            cells: {
              reason: (
                <span className="flex flex-col gap-1">
                  <span className="font-medium">{t(`reasonName.${row.reason}`)}</span>
                  {row.detail ? <span className="text-muted text-sm">{row.detail}</span> : null}
                </span>
              ),
              topic: (
                <span className="flex flex-col">
                  <span className="font-mono text-xs break-all">{row.topic}</span>
                  <span className="text-muted text-sm">
                    {row.channel === "mqtt" ? "MQTT" : "HTTPS"} ·{" "}
                    {t("bytes", { count: formatNumber(row.payloadBytes, locale) })}
                  </span>
                </span>
              ),
              received: <span className="whitespace-nowrap">{formatDateTime(row.receivedAt, locale)}</span>,
              replay: row.replayedAt ? (
                <span className="flex flex-col gap-0.5 text-sm">
                  <Badge size="sm" tone={row.replayOutcome === "dead_letter" ? "warning" : "success"}>
                    {t("replayedAt", { date: formatDateTime(row.replayedAt, locale) })}
                  </Badge>
                </span>
              ) : (
                <Badge size="sm" tone="warning">
                  {t("notReplayed")}
                </Badge>
              ),
              actions: (
                <span className="flex items-center justify-end gap-1">
                  <DetailDrawer
                    label={t("details")}
                    title={t(`reasonName.${row.reason}`)}
                    description={formatDateTime(row.receivedAt, locale)}
                  >
                    <section className="flex flex-col gap-1.5">
                      <h3 className="text-sm font-semibold">{t("col.payload")}</h3>
                      <pre className="bg-bg-subtle rounded-control relative m-0 max-h-80 overflow-auto p-3 font-mono text-xs whitespace-pre-wrap">
                        {prettyPayload(row.payloadPreview)}
                      </pre>
                      <p className="text-muted m-0 text-sm">
                        {t("bytes", { count: formatNumber(row.payloadBytes, locale) })}
                      </p>
                    </section>
                    <dl className="flex flex-col gap-2 text-sm">
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-muted">{t("col.topic")}</dt>
                        <dd className="font-mono break-all">{row.topic}</dd>
                      </div>
                      {row.replayOutcome ? (
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-muted">{t("outcome")}</dt>
                          <dd className="font-mono">{row.replayOutcome}</dd>
                        </div>
                      ) : null}
                      {row.gatewayDeviceId ? (
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-muted">{t("gateway")}</dt>
                          <dd>
                            <a href={`/devices/${row.gatewayDeviceId}`} className="text-primary hover:underline">
                              {t("openGateway")}
                            </a>
                          </dd>
                        </div>
                      ) : null}
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-muted">{t("id")}</dt>
                        <dd>
                          <CopyValue value={row.id} label={t("id")} />
                        </dd>
                      </div>
                    </dl>
                  </DetailDrawer>
                  {!row.replayedAt || row.replayOutcome === "dead_letter" ? (
                    <ActionMenu>
                      <ReplayIngest row={row} />
                    </ActionMenu>
                  ) : null}
                </span>
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

/** The payload preview as stored; formatted when it is JSON (the one place raw JSON is shown, in the drawer). */
function prettyPayload(preview: string | null): string {
  if (!preview) return "—";
  try {
    return JSON.stringify(JSON.parse(preview), null, 2);
  } catch {
    return preview;
  }
}

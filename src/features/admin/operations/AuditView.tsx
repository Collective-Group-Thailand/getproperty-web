import { getTranslations } from "next-intl/server";

import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { param, section, withQuery, type AdminContext } from "../shared/server";
import { actorLabel } from "../support/ViewAsTenant";
import { GetFilters } from "./GetFilters";

type SearchParams = Record<string, string | string[] | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A day typed in the filter as the start (or end) of that day in Bangkok, as the API's ISO instant. */
export function bangkokDay(value: string | undefined, end = false): string | undefined {
  if (!value || !DAY.test(value)) return undefined;
  return new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}+07:00`).toISOString();
}

/** The before/after of an audit row, as the API stored them (pretty JSON, nothing reinterpreted). */
function Change({ entry, label }: { entry: Schemas["AuditEntryDto"]; label: string }) {
  if (!entry.before && !entry.after && Object.keys(entry.metadata).length === 0) return <span>—</span>;
  return (
    <details className="max-w-md">
      <summary className="text-primary cursor-pointer text-xs">{label}</summary>
      <pre className="bg-bg-subtle rounded-control mt-1 max-h-64 overflow-auto p-2 text-xs whitespace-pre-wrap">
        {JSON.stringify({ before: entry.before, after: entry.after, metadata: entry.metadata }, null, 2)}
      </pre>
    </details>
  );
}

/**
 * Audit search (F5 5.2, D-090): the platform audit log by action (`support_grant.*` prefixes work), actor,
 * subject, tenant and Bangkok day range; newest first, cursor pages ("older entries"), every row with
 * its outcome, the support grant it was read under and its before/after.
 */
export async function AuditView({ context, searchParams }: { context: AdminContext; searchParams: SearchParams }) {
  const t = await getTranslations("admin.operations.audit");
  const { api, locale } = context;
  const filters = {
    action: param(searchParams.action)?.trim() || undefined,
    actorId: UUID.test(param(searchParams.actorId) ?? "") ? param(searchParams.actorId) : undefined,
    subjectId: UUID.test(param(searchParams.subjectId) ?? "") ? param(searchParams.subjectId) : undefined,
    tenantId: UUID.test(param(searchParams.tenantId) ?? "") ? param(searchParams.tenantId) : undefined,
    from: bangkokDay(param(searchParams.from)),
    to: bangkokDay(param(searchParams.to), true),
  };
  const cursor = param(searchParams.cursor);
  const rows = await section(
    unwrap(api.GET("/v1/admin/audit-log", { params: { query: { ...filters, cursor, limit: 50 } } })),
  );
  const keep = Object.fromEntries(
    ["action", "actorId", "subjectId", "tenantId", "from", "to"].map((name) => [name, param(searchParams[name])]),
  );
  return (
    <ConsolePage testId="audit">
      <PageHeader title={t("title")} description={t("description")} />
      <GetFilters
        label={t("search")}
        submitLabel={t("apply")}
        testId="audit-filters"
        fields={[
          {
            name: "action",
            label: t("action"),
            type: "text",
            value: keep.action,
            placeholder: t("actionPlaceholder"),
            width: "w-56",
          },
          {
            name: "actorId",
            label: t("actor"),
            type: "text",
            value: keep.actorId,
            placeholder: t("idPlaceholder"),
            width: "w-72",
          },
          {
            name: "subjectId",
            label: t("subject"),
            type: "text",
            value: keep.subjectId,
            placeholder: t("idPlaceholder"),
            width: "w-72",
          },
          {
            name: "tenantId",
            label: t("tenant"),
            type: "text",
            value: keep.tenantId,
            placeholder: t("idPlaceholder"),
            width: "w-72",
          },
          { name: "from", label: t("from"), type: "date", value: keep.from, width: "w-40" },
          { name: "to", label: t("to"), type: "date", value: keep.to, width: "w-40" },
        ]}
      />
      {!rows.data ? (
        <SectionError error={rows.error} />
      ) : rows.data.data.length === 0 ? (
        <Card>
          <EmptyState title={t("empty")} description={t("emptyHint")} />
        </Card>
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="audit-table"
          minWidth="64rem"
          columns={[
            { key: "at", header: t("col.at") },
            { key: "action", header: t("col.action") },
            { key: "actor", header: t("col.actor") },
            { key: "subject", header: t("col.subject") },
            { key: "outcome", header: t("col.outcome") },
            { key: "change", header: t("col.change") },
          ]}
          rows={rows.data.data.map((entry) => ({
            key: entry.id,
            testId: "audit-row",
            data: { action: entry.action, outcome: entry.outcome },
            tone: entry.outcome === "denied" ? "warning" : entry.outcome === "failure" ? "danger" : "default",
            cells: {
              at: <span className="whitespace-nowrap">{formatDateTime(entry.occurredAt, locale)}</span>,
              action: (
                <span className="flex flex-col gap-1">
                  <span className="font-mono text-xs">{entry.action}</span>
                  {entry.supportGrantId ? (
                    <Badge size="sm" tone="info">
                      {t("underGrant")}
                    </Badge>
                  ) : null}
                </span>
              ),
              actor: <span className="font-mono text-xs">{actorLabel(entry.actor)}</span>,
              subject: entry.subjectType ? (
                <span className="flex flex-col">
                  <span className="text-xs">{entry.subjectType}</span>
                  <span className="text-muted font-mono text-xs">{entry.subjectId?.slice(0, 8) ?? ""}</span>
                </span>
              ) : (
                "—"
              ),
              outcome: t(`outcome.${entry.outcome}`),
              change: <Change entry={entry} label={t("details")} />,
            },
          }))}
        />
      )}
      <nav aria-label={t("pages")} className="flex justify-between gap-2">
        {cursor ? (
          <a
            href={withQuery("/audit", keep)}
            className="text-primary text-sm hover:underline"
            data-testid="audit-newest"
          >
            {t("newest")}
          </a>
        ) : (
          <span />
        )}
        {rows.data?.meta.nextCursor ? (
          <a
            href={withQuery("/audit", { ...keep, cursor: rows.data.meta.nextCursor })}
            className="text-primary text-sm hover:underline"
            data-testid="audit-older"
          >
            {t("older")}
          </a>
        ) : null}
      </nav>
    </ConsolePage>
  );
}

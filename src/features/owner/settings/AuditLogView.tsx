import { getTranslations } from "next-intl/server";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Input } from "@/ui/components/Input";
import { Button } from "@/ui/components/Button";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { ownerPath } from "../shared/links";
import { param, section, type OwnerContext } from "../shared/server";
import { withQuery } from "@/features/shared/console/params";
import { SettingsNav } from "./SettingsNav";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const bangkok = (value: string | undefined, end = false) =>
  value && DAY.test(value)
    ? new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}+07:00`).toISOString()
    : undefined;

/** The actor of an audit row as a short label — a member's id, a support grant, the system. */
function actorText(actor: Record<string, unknown>): string {
  const kind =
    typeof actor.audience === "string" ? actor.audience : typeof actor.type === "string" ? actor.type : "system";
  const name =
    typeof actor.displayName === "string"
      ? actor.displayName
      : typeof actor.id === "string"
        ? actor.id.slice(0, 8)
        : "";
  return name ? `${kind} · ${name}` : kind;
}

/**
 * The tenant's audit log (F2 2.6, D-090): who did what and when — money, leases, settings, exports and
 * every read made under a support grant — filtered by action (a trailing * matches a prefix) and day.
 */
export async function AuditLogView({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.settings.audit");
  const { api, locale, me } = context;
  const keep = { action: param(searchParams.action), from: param(searchParams.from), to: param(searchParams.to) };
  const cursor = param(searchParams.cursor);
  const rows = await section(
    unwrap(
      api.GET("/v1/owner/audit-log", {
        params: {
          query: {
            action: keep.action?.trim() || undefined,
            from: bangkok(keep.from),
            to: bangkok(keep.to, true),
            cursor,
            limit: 50,
          },
        },
      }),
    ),
  );
  const path = ownerPath(locale, "/settings/audit-log");
  return (
    <OwnerPage testId="audit-log">
      <PageHeader title={t("title")} description={t("description")} />
      <SettingsNav me={me} current="/settings/audit-log" locale={locale} />
      <form method="get" role="search" aria-label={t("search")} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {t("action")}
          <Input
            name="action"
            inputSize="sm"
            defaultValue={keep.action ?? ""}
            placeholder={t("actionPlaceholder")}
            className="w-56"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("from")}
          <Input name="from" type="date" inputSize="sm" defaultValue={keep.from ?? ""} className="w-40" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("to")}
          <Input name="to" type="date" inputSize="sm" defaultValue={keep.to ?? ""} className="w-40" />
        </label>
        <Button type="submit" size="sm" variant="secondary">
          {t("apply")}
        </Button>
      </form>
      {!rows.data ? (
        <SectionError error={rows.error} />
      ) : rows.data.data.length === 0 ? (
        <Card>
          <EmptyState title={t("empty")} />
        </Card>
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="audit-table"
          minWidth="52rem"
          columns={[
            { key: "at", header: t("col.at") },
            { key: "action", header: t("col.action") },
            { key: "actor", header: t("col.actor") },
            { key: "subject", header: t("col.subject") },
            { key: "outcome", header: t("col.outcome") },
          ]}
          rows={rows.data.data.map((entry) => ({
            key: entry.id,
            testId: "audit-row",
            data: { action: entry.action },
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
              actor: <span className="text-xs">{actorText(entry.actor)}</span>,
              subject: entry.subjectType ? <span className="text-xs">{entry.subjectType}</span> : "—",
              outcome: t(`outcome.${entry.outcome}`),
            },
          }))}
        />
      )}
      <nav aria-label={t("pages")} className="flex justify-between gap-2">
        {cursor ? (
          <a className="text-primary text-sm hover:underline" href={withQuery(path, keep)}>
            {t("newest")}
          </a>
        ) : (
          <span />
        )}
        {rows.data?.meta.nextCursor ? (
          <a
            className="text-primary text-sm hover:underline"
            href={withQuery(path, { ...keep, cursor: rows.data.meta.nextCursor })}
            data-testid="audit-older"
          >
            {t("older")}
          </a>
        ) : null}
      </nav>
    </OwnerPage>
  );
}

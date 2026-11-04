import { getTranslations } from "next-intl/server";

import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconHistory } from "@/ui/icons/glyphs/history";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { CopyValue, DetailDrawer } from "@/features/shared/console/DetailDrawer";

import { param, section, tenantNames, withQuery, type AdminContext } from "../shared/server";
import { auditActionLabel, auditActorLabel, auditSubjectLabel, platformUserNames } from "./auditLabels";
import { GetFilters } from "./GetFilters";

type SearchParams = Record<string, string | string[] | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A day typed in the filter as the start (or end) of that day in Bangkok, as the API's ISO instant. */
export function bangkokDay(value: string | undefined, end = false): string | undefined {
  if (!value || !DAY.test(value)) return undefined;
  return new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}+07:00`).toISOString();
}

/** The action filter: each area ("support_grant.*") and every action the message files name, in words. */
const ACTION_FILTERS = [
  "support_grant.*",
  "support_grant.used",
  "support_grant.requested",
  "support_grant.bypassed",
  "utility_tariff.*",
  "subscription.*",
  "tenant.*",
  "provider_credential.*",
  "platform_user.*",
  "setting.*",
  "feature_flag.*",
  "notification_template.*",
  "outbox.*",
  "ota.*",
  "pii.decrypted",
] as const;

/**
 * Audit search (F5 5.2, D-090, redesign G8): the platform audit log by action, customer and Bangkok day range — one
 * toolbar; a dense table with each action in words (and its context: under a support grant), who did it, what it was
 * about and the outcome; "before / after" opens a side drawer with the stored change and the reference ids. Newest
 * first, cursor pages ("older entries").
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
  const [rows, names, users] = await Promise.all([
    section(unwrap(api.GET("/v1/admin/audit-log", { params: { query: { ...filters, cursor, limit: 50 } } }))),
    tenantNames(),
    platformUserNames(context),
  ]);
  const keep = Object.fromEntries(
    ["action", "actorId", "subjectId", "tenantId", "from", "to"].map((name) => [name, param(searchParams[name])]),
  );
  const filtered = Object.values(keep).some(Boolean);
  const actionOption = (code: string) => {
    if (code.endsWith(".*")) {
      const domain = `domainName.${code.slice(0, -2)}`;
      return t("actionArea", { area: t.has(domain) ? t(domain as Parameters<typeof t>[0]) : code });
    }
    return auditActionLabel(t, code) ?? code;
  };
  const subject = (entry: Schemas["AuditEntryDto"]) => {
    const kind = auditSubjectLabel(t, entry.subjectType);
    const tenantId =
      entry.subjectType === "core.tenant"
        ? entry.subjectId
        : ((entry.metadata as { tenantId?: string }).tenantId ?? null);
    const tenant = tenantId ? names.get(tenantId) : undefined;
    return { kind, tenant };
  };
  return (
    <ConsolePage testId="audit">
      <PageHeader title={t("title")} description={t("description")} />
      <GetFilters
        label={t("search")}
        submitLabel={t("apply")}
        testId="audit-filters"
        clear={filtered ? { label: t("clear"), href: "/audit" } : null}
        fields={[
          { name: "from", label: t("from"), type: "date", value: keep.from },
          { name: "to", label: t("to"), type: "date", value: keep.to },
          {
            name: "action",
            label: t("action"),
            type: "select",
            value: keep.action,
            options: [
              { value: "", label: t("anyAction") },
              ...(keep.action && !(ACTION_FILTERS as readonly string[]).includes(keep.action)
                ? [{ value: keep.action, label: actionOption(keep.action) }]
                : []),
              ...ACTION_FILTERS.map((code) => ({ value: code, label: actionOption(code) })),
            ],
          },
          {
            name: "tenantId",
            label: t("tenant"),
            type: "select",
            value: keep.tenantId,
            options: [
              { value: "", label: t("anyTenant") },
              ...[...names.entries()].map(([value, label]) => ({ value, label })),
            ],
          },
        ]}
      />
      {keep.actorId || keep.subjectId ? (
        <p className="text-muted text-sm" data-testid="audit-id-filter">
          {t("idFilter")}{" "}
          <a
            href={withQuery("/audit", { ...keep, actorId: undefined, subjectId: undefined })}
            className="text-primary hover:underline"
          >
            {t("clearIds")}
          </a>
        </p>
      ) : null}
      {!rows.data ? (
        <SectionError error={rows.error} />
      ) : rows.data.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconHistory}
          title={t("empty")}
          description={filtered ? t("emptyHint") : t("emptyAll")}
          action={
            <Button asChild variant="secondary">
              <a href={filtered ? "/audit" : "/"}>{filtered ? t("clear") : t("home")}</a>
            </Button>
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="audit-table"
          stackOnPhones
          minWidth="64rem"
          columns={[
            { key: "at", header: t("col.at"), phone: "meta", className: "w-44" },
            { key: "action", header: t("col.action"), phone: "title" },
            { key: "actor", header: t("col.actor"), phone: "meta" },
            { key: "subject", header: t("col.subject"), phone: "meta" },
            { key: "outcome", header: t("col.outcome"), phone: "status" },
            { key: "change", header: <span className="sr-only">{t("col.change")}</span>, phone: "meta", align: "end" },
          ]}
          rows={rows.data.data.map((entry) => {
            const about = subject(entry);
            const label = auditActionLabel(t, entry.action);
            const actor = auditActorLabel(t, entry.actor, users);
            return {
              key: entry.id,
              testId: "audit-row",
              data: { action: entry.action, outcome: entry.outcome },
              cells: {
                at: <span className="whitespace-nowrap tabular-nums">{formatDateTime(entry.occurredAt, locale)}</span>,
                action: (
                  <span className="flex flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{label ?? entry.action}</span>
                      {entry.supportGrantId ? (
                        <Badge size="sm" tone="info">
                          {t("underGrant")}
                        </Badge>
                      ) : null}
                    </span>
                  </span>
                ),
                actor,
                subject: (
                  <span className="flex flex-col">
                    <span>{about.tenant ?? about.kind ?? "—"}</span>
                    {about.tenant && about.kind ? <span className="text-muted text-sm">{about.kind}</span> : null}
                  </span>
                ),
                outcome:
                  entry.outcome === "success" ? (
                    <span className="text-muted text-sm">{t(`outcome.${entry.outcome}`)}</span>
                  ) : (
                    <Badge size="sm" tone={entry.outcome === "denied" ? "warning" : "danger"}>
                      {t(`outcome.${entry.outcome}`)}
                    </Badge>
                  ),
                change: (
                  <DetailDrawer
                    label={t("details")}
                    title={label ?? entry.action}
                    description={`${formatDateTime(entry.occurredAt, locale)} · ${actor}`}
                    testId={`audit-details-${entry.id}`}
                  >
                    <AuditDetails entry={entry} />
                  </DetailDrawer>
                ),
              },
            };
          })}
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

/** The drawer of one audit row: the reason, the stored change (before → after, formatted), the reference ids. */
async function AuditDetails({ entry }: { entry: Schemas["AuditEntryDto"] }) {
  const t = await getTranslations("admin.operations.audit");
  const reason = (entry.metadata as { reason?: unknown }).reason;
  const pretty = (value: unknown) => JSON.stringify(value, null, 2);
  const { reason: _omit, ...metadata } = entry.metadata as Record<string, unknown>;
  void _omit;
  return (
    <>
      {typeof reason === "string" && reason ? (
        <section className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold">{t("reason")}</h3>
          <p className="bg-bg-subtle rounded-control m-0 p-3 text-sm">{reason}</p>
        </section>
      ) : null}
      <section className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold">{t("change")}</h3>
        {entry.before || entry.after ? (
          <div className="grid gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-muted text-xs">{t("before")}</span>
              <pre className="bg-bg-subtle rounded-control relative m-0 max-h-56 overflow-auto p-3 font-mono text-xs whitespace-pre-wrap">
                {entry.before ? pretty(entry.before) : "—"}
              </pre>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted text-xs">{t("after")}</span>
              <pre className="bg-primary-subtle text-primary-subtle-fg rounded-control relative m-0 max-h-56 overflow-auto p-3 font-mono text-xs whitespace-pre-wrap">
                {entry.after ? pretty(entry.after) : "—"}
              </pre>
            </div>
          </div>
        ) : (
          <p className="text-muted m-0 text-sm">{t("noChange")}</p>
        )}
      </section>
      {Object.keys(metadata).length > 0 ? (
        <section className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold">{t("context")}</h3>
          <pre className="bg-bg-subtle rounded-control relative m-0 max-h-56 overflow-auto p-3 font-mono text-xs whitespace-pre-wrap">
            {pretty(metadata)}
          </pre>
        </section>
      ) : null}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{t("references")}</h3>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted">{t("eventId")}</dt>
            <dd>
              <CopyValue value={entry.id} label={t("eventId")} />
            </dd>
          </div>
          {entry.subjectId ? (
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted">{t("subjectId")}</dt>
              <dd>
                <CopyValue value={entry.subjectId} label={t("subjectId")} />
              </dd>
            </div>
          ) : null}
          {entry.supportGrantId ? (
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted">{t("grantId")}</dt>
              <dd>
                <CopyValue value={entry.supportGrantId} label={t("grantId")} />
              </dd>
            </div>
          ) : null}
          {entry.ip ? (
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted">{t("ip")}</dt>
              <dd className="font-mono">{entry.ip}</dd>
            </div>
          ) : null}
        </dl>
      </section>
    </>
  );
}

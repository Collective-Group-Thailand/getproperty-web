import { getTranslations } from "next-intl/server";

import { MEMBERSHIP_STATUS } from "@/domain/status/membership";
import { SectionError } from "@/features/shared/console/SectionError";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatPhone } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { IconShow } from "@/ui/icons/glyphs/show";

import { section, type AdminContext } from "../shared/server";

/**
 * "View as tenant" (F5 5.1, D-090, D-206): what a support grant lets Collective staff read about one
 * tenant — its members and its audit trail — under a banner that says the view is read-only. This
 * screen renders **no** mutation control (the API answers `403 support.read_only` to any non-GET
 * under a grant anyway); every read here is itself audited (`support_grant.used`), and those rows are
 * listed so the trail of reads is visible to the person reading.
 */
export async function ViewAsTenant({
  context,
  tenant,
}: {
  context: AdminContext;
  tenant: Schemas["TenantProfileDto"];
}) {
  const t = await getTranslations("admin.support.view");
  const roles = await getTranslations("glossary.tenantRole");
  const { api, locale } = context;
  const tenantId = tenant.id;
  const members = await section(
    unwrap(api.GET("/v1/admin/tenants/{tenantId}/members", { params: { path: { tenantId } } })),
  );
  const [reads, trail] = await Promise.all([
    section(
      unwrap(
        api.GET("/v1/admin/tenants/{tenantId}/audit-log", {
          params: { path: { tenantId }, query: { action: "support_grant.*", limit: 20 } },
        }),
      ),
    ),
    section(
      unwrap(
        api.GET("/v1/admin/tenants/{tenantId}/audit-log", { params: { path: { tenantId }, query: { limit: 20 } } }),
      ),
    ),
  ]);
  return (
    <div className="flex flex-col gap-6" data-testid="view-as" data-readonly="true">
      <Callout tone="warning" icon={IconShow} title={t("bannerTitle", { name: tenant.displayName })}>
        <span data-testid="view-as-banner">{t("bannerBody")}</span>
      </Callout>
      <section aria-labelledby="view-members" className="flex flex-col gap-3">
        <h2 id="view-members" className="text-lg font-semibold">
          {t("members")}
        </h2>
        {!members.data ? (
          <SectionError error={members.error} />
        ) : (
          <SimpleTable
            caption={t("members")}
            testId="view-members"
            columns={[
              { key: "name", header: t("col.name") },
              { key: "role", header: t("col.role") },
              { key: "contact", header: t("col.contact") },
              { key: "joined", header: t("col.joined") },
              { key: "status", header: t("col.status") },
            ]}
            rows={members.data.map((member) => ({
              key: member.id,
              testId: "view-member",
              cells: {
                name: member.displayName,
                role: roles(member.role),
                contact:
                  [member.phone ? formatPhone(member.phone) : null, member.email].filter(Boolean).join(" · ") || "—",
                joined: member.joinedAt ? formatDateTime(member.joinedAt, locale) : "—",
                status: <StatusBadgeOf map={MEMBERSHIP_STATUS} value={member.status} size="sm" />,
              },
            }))}
          />
        )}
      </section>
      <AuditRows title={t("reads")} hint={t("readsHint")} result={reads} testId="view-reads" locale={locale} />
      <AuditRows title={t("trail")} result={trail} testId="view-trail" locale={locale} />
    </div>
  );
}

async function AuditRows({
  title,
  hint,
  result,
  testId,
  locale,
}: {
  title: string;
  hint?: string;
  result: { data: { data: Schemas["AuditEntryDto"][] } | null; error: unknown };
  testId: string;
  locale: AdminContext["locale"];
}) {
  const t = await getTranslations("admin.support.view");
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {hint ? <p className="text-muted text-sm">{hint}</p> : null}
      {result.error || !result.data ? (
        <SectionError error={result.error} />
      ) : result.data.data.length === 0 ? (
        <p className="text-muted">{t("noRows")}</p>
      ) : (
        <SimpleTable
          caption={title}
          testId={testId}
          minWidth="48rem"
          columns={[
            { key: "at", header: t("col.at") },
            { key: "action", header: t("col.action") },
            { key: "actor", header: t("col.actor") },
            { key: "outcome", header: t("col.outcome") },
            { key: "path", header: t("col.path") },
          ]}
          rows={result.data.data.map((row) => ({
            key: row.id,
            testId: "audit-row",
            data: { action: row.action, outcome: row.outcome },
            tone: row.outcome === "denied" ? "warning" : "default",
            cells: {
              at: formatDateTime(row.occurredAt, locale),
              action: <span className="font-mono text-xs">{row.action}</span>,
              actor: actorLabel(row.actor),
              outcome: t(`outcome.${row.outcome}`),
              path: (
                <span className="font-mono text-xs">{String((row.metadata as { path?: unknown }).path ?? "—")}</span>
              ),
            },
          }))}
        />
      )}
    </section>
  );
}

/** The audit actor envelope as a short label (`platform · 3b24…`), never more than the API gave. */
export function actorLabel(actor: Record<string, unknown>): string {
  const audience =
    typeof actor.audience === "string" ? actor.audience : typeof actor.type === "string" ? actor.type : "?";
  const id = typeof actor.id === "string" ? actor.id.slice(0, 8) : "";
  return id ? `${audience} · ${id}` : audience;
}

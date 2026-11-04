import { getTranslations } from "next-intl/server";

import { MEMBERSHIP_STATUS } from "@/domain/status/membership";
import { SectionError } from "@/features/shared/console/SectionError";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatPhone, formatTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { IconShow } from "@/ui/icons/glyphs/show";

import { auditActionLabel, auditActorLabel, platformUserNames } from "../operations/auditLabels";
import { section, type AdminContext } from "../shared/server";
import { isLive } from "./SupportView";

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
  const [reads, trail, grants, users] = await Promise.all([
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
    section(unwrap(api.GET("/v1/admin/support-grants"))),
    platformUserNames(context),
  ]);
  const grant = (grants.data ?? []).find((one) => one.tenantId === tenantId && isLive(one)) ?? null;
  return (
    <div className="flex flex-col gap-6" data-testid="view-as" data-readonly="true">
      <div className="z-sticky sticky top-16 md:top-4">
        <Callout
          tone="info"
          icon={IconShow}
          title={grant?.validTo ? t("stripLive", { time: formatTime(grant.validTo, locale) }) : t("stripBypass")}
        >
          <span data-testid="view-as-banner">{t("bannerBody")}</span>
        </Callout>
      </div>
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
            stackOnPhones
            columns={[
              { key: "name", header: t("col.name"), phone: "title" },
              { key: "role", header: t("col.role"), phone: "meta" },
              { key: "contact", header: t("col.contact"), phone: "meta" },
              { key: "joined", header: t("col.joined"), phone: "hidden" },
              { key: "status", header: t("col.status"), phone: "status" },
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
      <AuditRows
        title={t("reads")}
        hint={t("readsHint")}
        result={reads}
        testId="view-reads"
        locale={locale}
        users={users}
      />
      <AuditRows title={t("trail")} result={trail} testId="view-trail" locale={locale} users={users} />
    </div>
  );
}

async function AuditRows({
  title,
  hint,
  result,
  testId,
  locale,
  users,
}: {
  title: string;
  hint?: string;
  result: { data: { data: Schemas["AuditEntryDto"][] } | null; error: unknown };
  testId: string;
  locale: AdminContext["locale"];
  users: Map<string, string>;
}) {
  const t = await getTranslations("admin.support.view");
  const audit = await getTranslations("admin.operations.audit");
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {hint ? <p className="text-muted text-sm">{hint}</p> : null}
      {result.error || !result.data ? (
        <SectionError error={result.error} />
      ) : result.data.data.length === 0 ? (
        <p className="border-border bg-surface rounded-card text-muted border px-4 py-6 text-center text-sm">
          {t("noRows")}
        </p>
      ) : (
        <SimpleTable
          caption={title}
          testId={testId}
          stackOnPhones
          minWidth="52rem"
          columns={[
            { key: "action", header: t("col.action"), phone: "title" },
            { key: "at", header: t("col.at"), phone: "meta" },
            { key: "actor", header: t("col.actor"), phone: "meta" },
            { key: "outcome", header: t("col.outcome"), phone: "status" },
            { key: "path", header: t("col.path"), phone: "hidden" },
          ]}
          rows={result.data.data.map((row) => ({
            key: row.id,
            testId: "audit-row",
            data: { action: row.action, outcome: row.outcome },
            cells: {
              at: <span className="whitespace-nowrap">{formatDateTime(row.occurredAt, locale)}</span>,
              action: auditActionLabel(audit, row.action) ?? <span className="font-mono text-sm">{row.action}</span>,
              actor: auditActorLabel(audit, row.actor, users),
              outcome:
                row.outcome === "success" ? (
                  <span className="text-muted text-sm">{t(`outcome.${row.outcome}`)}</span>
                ) : (
                  <Badge size="sm" tone={row.outcome === "denied" ? "warning" : "danger"}>
                    {t(`outcome.${row.outcome}`)}
                  </Badge>
                ),
              path: readLabel(t, (row.metadata as { path?: unknown }).path),
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

/**
 * What a support read opened, in words ("รายชื่อสมาชิก"), from the API path the audit row keeps; a path the catalogue
 * does not name shows its last part, never the tenant id.
 */
function readLabel(t: Awaited<ReturnType<typeof getTranslations<"admin.support.view">>>, path: unknown) {
  if (typeof path !== "string" || !path) return "—";
  const resource = path.replace(/^\/v1\/admin\/tenants\/[^/]+\/?/, "").split("?")[0] ?? "";
  const key = `resource.${resource.replace(/[^a-z]/gi, "_")}`;
  if (resource && t.has(key)) return t(key as Parameters<typeof t>[0]);
  return <span className="font-mono text-xs">{resource || "—"}</span>;
}

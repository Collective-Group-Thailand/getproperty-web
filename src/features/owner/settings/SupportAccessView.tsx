import { getTranslations } from "next-intl/server";

import { SUPPORT_GRANT_STATUS } from "@/domain/status/supportGrant";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { ownerPath } from "../shared/links";
import { readOnly, section, type OwnerContext } from "../shared/server";
import { SupportGrantActions } from "./AccessActions";
import { SettingsNav } from "./SettingsNav";

/**
 * Support access (F2 2.6, D-090): Collective's requests to read this tenant's data for a ticket — the
 * reason, the ticket, how long, and whether it was approved here or by the platform for an incident;
 * approve, deny or revoke. The reads themselves are in the audit log.
 */
export async function SupportAccessView({
  context,
}: {
  context: OwnerContext;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.settings.support");
  const { api, locale, me } = context;
  const grants = await section(unwrap(api.GET("/v1/owner/support-grants")));
  const live = (grants.data ?? []).filter((grant) => grant.state === "active" || grant.state === "approved");
  return (
    <OwnerPage testId="support-access">
      <PageHeader title={t("title")} description={t("description")} />
      <SettingsNav me={me} current="/settings/support-access" locale={locale} />
      {live.length > 0 ? (
        <Callout tone="info" title={t("liveTitle", { count: live.length })}>
          {t.rich("liveBody", {
            audit: (chunks) => (
              <a className="underline" href={ownerPath(locale, "/settings/audit-log?action=support_grant.*")}>
                {chunks}
              </a>
            ),
          })}
        </Callout>
      ) : null}
      {!grants.data ? (
        <SectionError error={grants.error} />
      ) : grants.data.length === 0 ? (
        <Card>
          <EmptyState title={t("empty")} description={t("emptyHint")} />
        </Card>
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="support-table"
          minWidth="56rem"
          columns={[
            { key: "requested", header: t("col.requested") },
            { key: "reason", header: t("col.reason") },
            { key: "window", header: t("col.window") },
            { key: "state", header: t("col.state") },
            { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
          ]}
          rows={grants.data.map((grant) => ({
            key: grant.id,
            testId: "support-row",
            data: { state: grant.state },
            cells: {
              requested: formatDateTime(grant.createdAt, locale),
              reason: (
                <span className="flex max-w-md flex-col">
                  <span>{grant.reason}</span>
                  {grant.ticketRef ? (
                    <span className="text-muted text-xs">{t("ticket", { ref: grant.ticketRef })}</span>
                  ) : null}
                </span>
              ),
              window:
                grant.validFrom && grant.validTo
                  ? `${formatDateTime(grant.validFrom, locale)} – ${formatDateTime(grant.validTo, locale)}`
                  : "—",
              state: (
                <span className="flex flex-col gap-1">
                  <StatusBadgeOf map={SUPPORT_GRANT_STATUS} value={grant.state} size="sm" />
                  {grant.approvedVia ? (
                    <span className="text-muted text-xs">{t(`via.${grant.approvedVia}`)}</span>
                  ) : null}
                </span>
              ),
              actions: readOnly(me) ? null : <SupportGrantActions grant={grant} />,
            },
          }))}
        />
      )}
    </OwnerPage>
  );
}

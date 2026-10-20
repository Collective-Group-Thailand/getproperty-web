import { getTranslations } from "next-intl/server";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { param, section } from "@/features/shared/console/params";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatDate, formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconRules } from "@/ui/icons/glyphs/rules";

import { ownerPath, withQuery } from "../shared/links";
import { focusedBuilding, ownerCan, readOnly, type OwnerContext } from "../shared/server";
import { CommunityNav } from "./CommunityNav";
import { NewRuleVersion } from "./RuleActions";
import { bangkokToday } from "@/features/shared/console/time";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Building rules (F2 2.7, D-212): the building's versions — the one in force, the scheduled ones and the
 * past ones — with how many residents acknowledged each, and who did for the version chosen.
 */
export async function RulesView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.community.rules");
  const { api, locale, me } = context;
  const building = focusedBuilding(context) ?? context.buildings[0] ?? null;
  const canManage = ownerCan(me, "community.manage") && !readOnly(me);
  const versions = building
    ? await unwrap(
        api.GET("/v1/owner/buildings/{buildingId}/rules", { params: { path: { buildingId: building.id } } }),
      ).then((body) => [...body.data].sort((a, b) => b.version - a.version))
    : [];
  const today = bangkokToday();
  const inForce = versions
    .filter((rule) => rule.effectiveFrom <= today)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.version - a.version)[0];
  const chosen = versions.find((rule) => rule.id === param(searchParams.rule)) ?? inForce ?? versions[0] ?? null;
  const acks = chosen
    ? await section(
        unwrap(
          api.GET("/v1/owner/building-rules/{ruleId}/acknowledgements", { params: { path: { ruleId: chosen.id } } }),
        ),
      )
    : null;
  const base = ownerPath(locale, "/community/rules");

  return (
    <OwnerPage testId="rules">
      <PageHeader
        title={t("title")}
        description={building ? t("descriptionBuilding", { building: building.name }) : t("description")}
        crumbs={[{ label: t("title") }]}
        actions={canManage && building ? <NewRuleVersion buildingId={building.id} latest={versions[0]} /> : null}
      />
      <CommunityNav current="/community/rules" locale={locale} />
      {versions.length === 0 ? (
        <Card>
          <EmptyState icon={IconRules} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <SimpleTable
          caption={t("versions")}
          testId="rule-table"
          minWidth="40rem"
          columns={[
            { key: "version", header: t("version") },
            { key: "effective", header: t("effectiveFrom") },
            { key: "acks", header: t("acknowledgements"), align: "end" },
          ]}
          rows={versions.map((rule) => ({
            key: rule.id,
            testId: "rule-row",
            data: {
              version: rule.version,
              state: rule === inForce ? "in-force" : rule.effectiveFrom > today ? "scheduled" : "past",
            },
            cells: {
              version: (
                <span className="flex flex-wrap items-center gap-2">
                  <a
                    className="font-medium underline-offset-4 hover:underline"
                    href={withQuery(base, { rule: rule.id })}
                  >
                    {t("versionLabel", { version: rule.version, title: rule.title })}
                  </a>
                  {rule === inForce ? (
                    <Badge tone="success" size="sm">
                      {t("inForce")}
                    </Badge>
                  ) : rule.effectiveFrom > today ? (
                    <Badge tone="info" size="sm">
                      {t("scheduled")}
                    </Badge>
                  ) : null}
                </span>
              ),
              effective: formatDate(rule.effectiveFrom, locale),
              acks: String(rule.acknowledgements),
            },
          }))}
        />
      )}
      {chosen ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card as="section" aria-labelledby="rule-text" data-testid="rule-text">
            <CardHeader
              title={<span id="rule-text">{t("versionLabel", { version: chosen.version, title: chosen.title })}</span>}
              description={
                chosen.publishedAt ? t("publishedAt", { at: formatDateTime(chosen.publishedAt, locale) }) : undefined
              }
            />
            <p className="whitespace-pre-line">{chosen.bodyTh}</p>
          </Card>
          <Card as="section" aria-labelledby="rule-acks" data-testid="rule-acks">
            <CardHeader title={<span id="rule-acks">{t("acknowledgedBy")}</span>} description={t("ackHint")} />
            {acks?.error ? (
              <SectionError error={acks.error} />
            ) : acks?.data && acks.data.data.length ? (
              <SimpleTable
                caption={t("acknowledgedBy")}
                minWidth="16rem"
                columns={[
                  { key: "name", header: t("resident") },
                  { key: "at", header: t("ackedAt") },
                  { key: "how", header: t("how") },
                ]}
                rows={acks.data.data.map((ack) => ({
                  key: `${ack.partyId}-${ack.ackedAt}`,
                  testId: "ack-row",
                  cells: {
                    name: ack.name,
                    at: formatDateTime(ack.ackedAt, locale),
                    how: ack.leaseId ? t("withLease") : t("inApp"),
                  },
                }))}
              />
            ) : (
              <p className="text-muted text-sm">{t("noAcks")}</p>
            )}
          </Card>
        </div>
      ) : null}
    </OwnerPage>
  );
}

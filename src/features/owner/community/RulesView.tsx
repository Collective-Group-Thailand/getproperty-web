import { getTranslations } from "next-intl/server";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { param, section } from "@/features/shared/console/params";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatDate, formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { DetailLayout } from "@/ui/components/DetailLayout";
import { EmptyState } from "@/ui/components/EmptyState";
import { Paper, PaperFoot, PaperHead, PaperSection } from "@/ui/components/Paper";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconHistory } from "@/ui/icons/glyphs/history";
import { IconRules } from "@/ui/icons/glyphs/rules";
import { IconSign } from "@/ui/icons/glyphs/sign";

import { ownerPath, withQuery } from "../shared/links";
import { focusedBuilding, ownerCan, readOnly, type OwnerContext } from "../shared/server";
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

  const stateOf = (rule: (typeof versions)[number]) =>
    rule === inForce ? "in-force" : rule.effectiveFrom > today ? "scheduled" : "past";
  const stateBadge = (rule: (typeof versions)[number]) =>
    rule === inForce ? (
      <Badge tone="success" size="sm" icon={IconCheckCircle}>
        {t("inForce")}
      </Badge>
    ) : rule.effectiveFrom > today ? (
      <Badge tone="info" size="sm" icon={IconCalendar}>
        {t("scheduled")}
      </Badge>
    ) : (
      <Badge tone="neutral" size="sm" icon={IconHistory}>
        {t("past")}
      </Badge>
    );

  return (
    <OwnerPage testId="rules">
      <PageHeader
        title={t("title")}
        description={building ? t("descriptionBuilding", { building: building.name }) : t("description")}
        actions={canManage && building ? <NewRuleVersion buildingId={building.id} latest={versions[0]} /> : null}
      />
      {!building ? (
        <EmptyState
          variant="card"
          icon={IconBuilding}
          title={t("noBuilding")}
          description={t("noBuildingBody")}
          action={
            <Button asChild variant="secondary">
              <a href={ownerPath(locale, "/buildings")}>{t("goBuildings")}</a>
            </Button>
          }
        />
      ) : versions.length === 0 || !chosen ? (
        <EmptyState
          variant="card"
          icon={IconRules}
          title={t("empty.title")}
          description={t("empty.body")}
          action={
            canManage ? (
              <NewRuleVersion buildingId={building.id} variant="secondary" />
            ) : (
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/announcements")}>{t("goAnnouncements")}</a>
              </Button>
            )
          }
        />
      ) : (
        <DetailLayout
          panelFirstOnPhones={false}
          panel={
            <div className="flex flex-col gap-4">
              <section
                className="rounded-card border-border bg-surface shadow-card flex flex-col gap-1 border p-5"
                aria-labelledby="rule-ack-figure"
              >
                <h2 id="rule-ack-figure" className="text-muted text-sm font-medium">
                  {t("acknowledgedBy")}
                </h2>
                <p className="text-primary text-2xl font-semibold tabular-nums">
                  {t("ackCount", { count: chosen.acknowledgements })}
                </p>
                <p className="text-muted text-sm">{t("ackHint")}</p>
              </section>
              <section
                className="rounded-card border-border bg-surface shadow-card border"
                aria-labelledby="rule-versions"
              >
                <h2 id="rule-versions" className="px-5 pt-5 text-base font-semibold">
                  {t("versions")}
                </h2>
                <ul className="divide-border flex flex-col divide-y px-2 py-2" data-testid="rule-table">
                  {versions.map((rule) => (
                    <li key={rule.id} data-testid="rule-row" data-version={rule.version} data-state={stateOf(rule)}>
                      <a
                        href={withQuery(base, { rule: rule.id })}
                        aria-current={rule.id === chosen.id ? "true" : undefined}
                        className="rounded-control hover:bg-bg-subtle aria-[current=true]:bg-primary-subtle flex flex-col gap-1 px-3 py-2.5"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-medium">{t("versionShort", { version: rule.version })}</span>
                          {stateBadge(rule)}
                        </span>
                        <span className="text-muted text-sm tabular-nums">
                          {t("effectiveLine", {
                            date: formatDate(rule.effectiveFrom, locale),
                            count: rule.acknowledgements,
                          })}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          }
        >
          <Paper label={t("versionLabel", { version: chosen.version, title: chosen.title })} testId="rule-text">
            <PaperHead
              kind={`${t("documentKind", { building: building.name })} · ${t("versionShort", { version: chosen.version })}`}
              status={stateBadge(chosen)}
              facts={[
                { key: "effective", label: t("effectiveFrom"), value: formatDate(chosen.effectiveFrom, locale) },
                ...(chosen.publishedAt
                  ? [{ key: "published", label: t("publishedOn"), value: formatDate(chosen.publishedAt, locale) }]
                  : []),
              ]}
            />
            <PaperSection title={chosen.title}>
              <p className="leading-relaxed whitespace-pre-line">{chosen.bodyTh}</p>
            </PaperSection>
            {chosen.publishedAt ? (
              <PaperFoot>{t("publishedAt", { at: formatDateTime(chosen.publishedAt, locale) })}</PaperFoot>
            ) : null}
          </Paper>
          <Card as="section" aria-labelledby="rule-acks" data-testid="rule-acks">
            <CardHeader title={<span id="rule-acks">{t("acknowledgedBy")}</span>} />
            {acks?.error ? (
              <SectionError error={acks.error} />
            ) : acks?.data && acks.data.data.length ? (
              <SimpleTable
                caption={t("acknowledgedBy")}
                minWidth="24rem"
                stackOnPhones
                columns={[
                  { key: "name", header: t("resident"), phone: "title" },
                  { key: "at", header: t("ackedAt"), phone: "meta" },
                  { key: "how", header: t("how"), phone: "status" },
                ]}
                rows={acks.data.data.map((ack) => ({
                  key: `${ack.partyId}-${ack.ackedAt}`,
                  testId: "ack-row",
                  cells: {
                    name: ack.name,
                    at: <span className="tabular-nums">{formatDateTime(ack.ackedAt, locale)}</span>,
                    how: (
                      <Badge tone="neutral" size="sm" icon={ack.leaseId ? IconSign : IconCheck}>
                        {ack.leaseId ? t("withLease") : t("inApp")}
                      </Badge>
                    ),
                  },
                }))}
              />
            ) : (
              <p className="text-muted text-sm">{t("noAcks")}</p>
            )}
          </Card>
        </DetailLayout>
      )}
    </OwnerPage>
  );
}

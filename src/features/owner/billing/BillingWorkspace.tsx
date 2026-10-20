import { getTranslations } from "next-intl/server";

import { BILLING_CYCLE_STATUS } from "@/domain/status/billingCycle";
import { METER_HEALTH_STATUS } from "@/domain/status/meterHealth";
import { READING_SOURCE_VALUES, type ReadingSource } from "@/domain/status/readingSource";
import { ReadingSourceBadge } from "@/features/shared/status/ReadingSourceBadge";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatNumber, formatPeriodKey, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Badge } from "@/ui/components/Badge";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { Stat } from "@/ui/components/Stat";
import { Stepper } from "@/ui/components/Stepper";
import { IconBill } from "@/ui/icons/glyphs/bill";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ownerPath, withQuery } from "../shared/links";
import { MoneyNav } from "../shared/MoneyNav";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { focusedBuilding, param, section, type OwnerContext } from "../shared/server";
import { SettingValue } from "../shared/SettingValue";
import { fieldMembers } from "../shared/members";
import { CycleActions, OpenCycleButton } from "./CycleActions";
import { DraftReview } from "./DraftReview";

type SearchParams = Record<string, string | string[] | undefined>;
const STEPS: Schemas["BillingCycleStatus"][] = ["open", "readings_pending", "computed", "issued", "closed"];

function stat(stats: Record<string, unknown>, key: string): number | null {
  const value = stats[key];
  return typeof value === "number" ? value : null;
}

function isSource(value: string): value is ReadingSource {
  return (READING_SOURCE_VALUES as string[]).includes(value);
}

/**
 * The billing-cycle workspace (F2 2.3, B4.2): one property's cycle of the month — its state stepper,
 * cut-off and grace, the auto-issue setting, the meters still to read before the cut-off, the computed
 * drafts to review (flags, lines with sources and photos, one-off charges) and the cycle's actions. The
 * API computes and issues; this page shows and asks.
 */
export async function BillingWorkspace({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("owner.billing");
  const { api, locale } = context;
  const building = focusedBuilding(context);
  const propertyId = param(searchParams.property) ?? building?.propertyId ?? context.properties[0]?.id;
  const property = context.properties.find((candidate) => candidate.id === propertyId);
  const header = (
    <>
      <PageHeader title={t("title")} description={t("description")} crumbs={[{ label: t("title") }]} />
      <MoneyNav section="billing" current="/billing" locale={locale} />
      {context.properties.length > 1 ? (
        <FilterBar
          fields={[
            {
              name: "property",
              label: t("property"),
              type: "select",
              placeholder: t("chooseProperty"),
              options: context.properties.map((candidate) => ({ value: candidate.id, label: candidate.name })),
            },
          ]}
        />
      ) : null}
    </>
  );
  if (!property) {
    return (
      <OwnerPage testId="billing">
        {header}
        <Card>
          <EmptyState icon={IconBill} title={t("noProperty")} />
        </Card>
      </OwnerPage>
    );
  }

  const cycles = await unwrap(
    api.GET("/v1/owner/billing-cycles", { params: { query: { propertyId: property.id, perPage: 12 } } }),
  );
  const chosen =
    cycles.data.find((cycle) => cycle.id === param(searchParams.cycle)) ??
    cycles.data.find((cycle) => cycle.status !== "closed" && cycle.status !== "cancelled") ??
    cycles.data[0];
  if (!chosen) {
    return (
      <OwnerPage testId="billing">
        {header}
        <Card>
          <EmptyState
            icon={IconBill}
            title={t("noCycle")}
            description={t("noCycleBody")}
            action={<OpenCycleButton propertyId={property.id} />}
          />
        </Card>
      </OwnerPage>
    );
  }

  const buildingIds = new Set(
    context.buildings.filter((candidate) => candidate.propertyId === property.id).map((candidate) => candidate.id),
  );
  const [cycle, rounds, settings, members] = await Promise.all([
    unwrap(api.GET("/v1/owner/billing-cycles/{billingCycleId}", { params: { path: { billingCycleId: chosen.id } } })),
    section(unwrap(api.GET("/v1/owner/reading-rounds/current", { params: { query: {} } }))),
    section(unwrap(api.GET("/v1/owner/settings", { params: { query: { propertyId: property.id } } }))),
    fieldMembers(api, { permission: "reading.capture" }),
  ]);
  const stats = (cycle.stats ?? {}) as Record<string, unknown>;
  const drafts = cycle.invoices.filter((invoice) => invoice.status === "draft");
  const issued = cycle.invoices.filter((invoice) => invoice.status !== "draft");
  const totalLabel = typeof stats.total === "string" ? formatTHB(stats.total, locale) : "—";
  const periodLabel = formatPeriodKey(cycle.periodKey, locale);
  const pending = (rounds.data ?? [])
    .filter((round) => buildingIds.has(round.buildingId))
    .flatMap((round) =>
      round.floors.flatMap((floor) =>
        floor.items.filter((item) => item.purpose === "unit" || item.unitId).map((item) => ({ round, floor, item })),
      ),
    );
  const autoIssue = (settings.data ?? []).find((setting) => setting.key === "billing.auto_issue");
  const stepIndex = Math.max(0, STEPS.indexOf(cycle.status));

  return (
    <OwnerPage testId="billing">
      {header}
      {cycles.data.length > 1 ? (
        <LinkTabs
          label={t("periods")}
          current={ownerPath(
            locale,
            withQuery("/billing", { property: param(searchParams.property), cycle: cycle.id }),
          )}
          tabs={cycles.data.slice(0, 6).map((candidate) => ({
            href: ownerPath(
              locale,
              withQuery("/billing", { property: param(searchParams.property), cycle: candidate.id }),
            ),
            label: formatPeriodKey(candidate.periodKey, locale),
            testId: "cycle-tab",
          }))}
        />
      ) : null}

      <Card as="section" aria-labelledby="cycle-title" data-testid="cycle-workspace" data-status={cycle.status}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-1">
            <h2 id="cycle-title" className="text-lg font-semibold">
              {t("cycleTitle", { property: cycle.propertyName, period: periodLabel })}
            </h2>
            <StatusBadgeOf map={BILLING_CYCLE_STATUS} value={cycle.status} />
          </div>
          <CycleActions
            cycle={cycle}
            periodLabel={periodLabel}
            draftCount={drafts.length}
            totalLabel={totalLabel}
            members={members}
            missing={pending.filter(({ item }) => !item.iot).length}
          />
        </div>
        {cycle.status !== "cancelled" ? (
          <Stepper
            className="mt-4"
            steps={STEPS.map((id) => ({ id, label: t(`step.${id}`) }))}
            current={stepIndex}
            label={t("steps")}
            progressText={t("progress", { step: stepIndex + 1, total: STEPS.length })}
          />
        ) : null}
        <DescriptionList
          className="mt-4"
          columns={3}
          items={[
            { id: "cutoff", term: t("cutoff"), description: formatDateTime(cycle.cutOffAt, locale) },
            { id: "grace", term: t("grace"), description: formatDateTime(cycle.graceDeadlineAt, locale) },
            { id: "estimate", term: t("estimatePolicy"), description: t(`estimate.${cycle.estimatePolicy}`) },
            {
              id: "requested",
              term: t("readingsRequested"),
              description: cycle.readingsRequestedAt ? formatDateTime(cycle.readingsRequestedAt, locale) : null,
            },
            {
              id: "computed",
              term: t("computedAt"),
              description: cycle.computedAt ? formatDateTime(cycle.computedAt, locale) : null,
            },
            {
              id: "issued",
              term: t("issuedAt"),
              description: cycle.issuedAt ? formatDateTime(cycle.issuedAt, locale) : null,
            },
            ...(autoIssue
              ? [
                  {
                    id: "auto",
                    term: t("autoIssueSetting"),
                    description: <SettingValue setting={autoIssue} locale={locale} />,
                  },
                ]
              : []),
          ]}
        />
        {cycle.autoIssueAt ? (
          <div className="mt-4" data-testid="auto-issue-banner">
            <Callout tone="info" title={t("autoIssueTitle")}>
              {t("autoIssueBody", { at: formatDateTime(cycle.autoIssueAt, locale) })}
            </Callout>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="cycle-stats">
        <Stat
          label={t("stats.billables")}
          value={formatNumber(stat(stats, "billables") ?? cycle.invoices.length, locale)}
        />
        <Stat label={t("stats.drafts")} value={formatNumber(drafts.length, locale)} />
        <Stat label={t("stats.needsReview")} value={formatNumber(stat(stats, "needsReview") ?? 0, locale)} />
        <Stat label={t("stats.total")} value={totalLabel} />
      </div>

      <Card as="section" aria-labelledby="readings-pending" data-testid="readings-pending">
        <CardHeader
          title={<span id="readings-pending">{t("pendingTitle")}</span>}
          description={t("pendingHint", { cutoff: formatDateTime(cycle.cutOffAt, locale) })}
        />
        {pending.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">{t("pendingTitle")}</caption>
              <thead>
                <tr className="border-border text-muted border-b">
                  <th scope="col" className="py-2 text-start font-medium">
                    {t("unit")}
                  </th>
                  <th scope="col" className="py-2 text-start font-medium">
                    {t("meter")}
                  </th>
                  <th scope="col" className="py-2 text-start font-medium">
                    {t("lastReading")}
                  </th>
                  <th scope="col" className="py-2 text-start font-medium">
                    {t("health")}
                  </th>
                  <th scope="col" className="py-2 text-start font-medium">
                    {t("assigned")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pending.map(({ round, item }) => (
                  <tr key={item.meterAssignmentId} className="border-border border-b" data-testid="pending-row">
                    <th scope="row" className="py-2 text-start font-normal">
                      <span className="flex flex-col">
                        <span className="font-mono font-semibold">{item.unitNo ?? "—"}</span>
                        <span className="text-muted text-xs">{round.buildingName}</span>
                      </span>
                    </th>
                    <td className="py-2">
                      <a
                        className="font-mono underline-offset-4 hover:underline"
                        href={ownerPath(locale, `/meters/${item.assetItemId}`)}
                      >
                        {item.code}
                      </a>{" "}
                      <span className="text-muted">{t(`utility.${item.utility}`)}</span>
                    </td>
                    <td className="py-2">
                      {item.lastReading ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono tabular-nums">{item.lastReading.register}</span>
                          {isSource(item.lastReading.source) ? (
                            <ReadingSourceBadge source={item.lastReading.source} />
                          ) : null}
                          <span className="text-muted">{formatDateTime(item.lastReading.readAt, locale)}</span>
                        </span>
                      ) : (
                        <span className="text-muted">{t("never")}</span>
                      )}
                    </td>
                    <td className="py-2">
                      {item.health ? <StatusBadgeOf map={METER_HEALTH_STATUS} value={item.health} size="sm" /> : null}
                    </td>
                    <td className="py-2" data-testid="pending-assignee">
                      {item.assignee ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <span>{item.assignee.displayName}</span>
                          {item.requested ? (
                            <Badge tone="info" size="sm">
                              {t("requested")}
                            </Badge>
                          ) : null}
                        </span>
                      ) : item.requested ? (
                        <Badge tone="info" size="sm">
                          {t("requestedAnyone")}
                        </Badge>
                      ) : (
                        <span className="text-muted">{item.iot ? t("assignedIot") : t("assignedStaff")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted text-sm" data-testid="no-pending">
            {t("noPending")}
          </p>
        )}
      </Card>

      <Card as="section" aria-labelledby="drafts-title" data-testid="cycle-drafts">
        <CardHeader title={<span id="drafts-title">{t("draftsTitle")}</span>} description={t("draftsHint")} />
        {drafts.length ? <DraftReview drafts={drafts} /> : <p className="text-muted text-sm">{t("noDrafts")}</p>}
      </Card>

      {issued.length ? (
        <Card as="section" aria-labelledby="issued-title" data-testid="cycle-issued">
          <CardHeader
            title={<span id="issued-title">{t("issuedTitle", { count: issued.length })}</span>}
            action={
              <a
                className="text-sm underline-offset-4 hover:underline"
                href={ownerPath(locale, withQuery("/invoices", { cycle: cycle.id }))}
              >
                {t("openInvoices")}
              </a>
            }
          />
        </Card>
      ) : null}
    </OwnerPage>
  );
}

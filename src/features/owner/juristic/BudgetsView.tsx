import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { kindOf, vocabularyKeys } from "@/domain/juristic/vocabulary";
import { BUDGET_STATUS } from "@/domain/status";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { enumParam } from "@/features/shared/console/params";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatNumber, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { RowList } from "@/ui/components/RowList";
import { Statement, type StatementLine } from "@/ui/components/Statement";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCalculator } from "@/ui/icons/glyphs/calculator";

import { ownerPath, withQuery } from "../shared/links";
import { ownerCan, pageParam, param, readOnly, section, type OwnerContext } from "../shared/server";
import { ApproveBudgetButton } from "./BudgetActions";
import { BudgetForm } from "./BudgetForm";
import { RateBuilder } from "./RateBuilder";

type SearchParams = Record<string, string | string[] | undefined>;
const STATES: Schemas["BudgetState"][] = ["draft", "approved", "superseded"];
const KINDS: Schemas["BudgetLineKind"][] = ["expense", "fund", "income"];

/** The fiscal year as people read it: the Buddhist year for Thai readers. */
function yearLabel(year: number, locale: string) {
  return String(locale === "th" ? year + 543 : year);
}

/**
 * Budgets (JW1a, D-304): each building's yearly budget — what the owners pay for, the fund contributions and the other
 * income beside them — approved with an adopted resolution, then turned into a common-fee rate.
 */
export async function BudgetsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.juristic.budget");
  const { api, locale, me } = context;
  const state = enumParam(searchParams.state, STATES);
  const buildingId = context.buildings.find((building) => building.id === param(searchParams.building))?.id;
  const page = pageParam(searchParams.page);
  const base = ownerPath(locale, "/juristic/budgets");
  const list = await section(
    unwrap(
      api.GET("/v1/owner/juristic/budgets", {
        params: {
          query: { page, perPage: 25, ...(state ? { state } : {}), ...(buildingId ? { buildingId } : {}) },
        },
      }),
    ),
  );
  const canManage = !readOnly(me) && ownerCan(me, "juristic.budget.manage");
  const buildingName = (id: string) => context.buildings.find((building) => building.id === id)?.name ?? "—";
  const filtered = Boolean(state || buildingId);
  const keep = { building: buildingId };

  return (
    <OwnerPage testId="juristic-budgets">
      <PageHeader
        title={t("title")}
        description={t("lede")}
        actions={
          canManage ? (
            <Button asChild iconStart={IconAdd}>
              <a href={withQuery(ownerPath(locale, "/juristic/budgets/new"), keep)} data-testid="budget-new">
                {t("new")}
              </a>
            </Button>
          ) : undefined
        }
      />
      <ListToolbar
        tabs={
          <ViewTabs
            label={t("show")}
            current={state ?? "all"}
            tabs={[
              { key: "all", href: withQuery(base, keep), label: t("all"), testId: "budgets-all" },
              ...STATES.map((value) => ({
                key: value,
                href: withQuery(base, { ...keep, state: value }),
                label: t(`stateTab.${value}`),
                testId: `budgets-${value}`,
              })),
            ]}
          />
        }
        filters={
          context.buildings.length > 1 ? (
            <FilterBar
              variant="toolbar"
              fields={[
                {
                  name: "building",
                  label: t("building"),
                  type: "select",
                  placeholder: t("anyBuilding"),
                  options: context.buildings.map((building) => ({ value: building.id, label: building.name })),
                },
              ]}
            />
          ) : undefined
        }
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : (
        <RowList
          label={t("title")}
          testId="budget-rows"
          empty={
            <EmptyState
              variant="card"
              icon={IconCalculator}
              title={filtered ? t("empty.filteredTitle") : t("empty.title")}
              description={filtered ? t("empty.filtered") : t("empty.body")}
              action={
                <Button asChild variant="secondary">
                  <a
                    href={
                      filtered
                        ? base
                        : canManage
                          ? ownerPath(locale, "/juristic/budgets/new")
                          : ownerPath(locale, "/juristic/resolutions")
                    }
                  >
                    {filtered ? t("empty.clear") : canManage ? t("new") : t("empty.resolutions")}
                  </a>
                </Button>
              }
            />
          }
          items={list.data.data.map((budget) => ({
            key: budget.id,
            href: ownerPath(locale, `/juristic/budgets/${budget.id}`),
            lead: <span className="tabular-nums">{yearLabel(budget.fiscalYear, locale)}</span>,
            title: budget.name,
            meta: t("rowMeta", {
              building: buildingName(budget.buildingId),
              from: formatDate(budget.periodStart, locale),
              to: formatDate(budget.periodEnd, locale),
            }),
            status: <StatusBadgeOf map={BUDGET_STATUS} value={budget.state} size="sm" />,
            figure: <span className="font-semibold tabular-nums">{formatTHB(budget.total, locale)}</span>,
            testId: "budget-row",
          }))}
        />
      )}
      {list.data && list.data.meta.total > list.data.meta.perPage ? (
        <ListPagination meta={list.data.meta} path={base} searchParams={searchParams} locale={locale} />
      ) : null}
    </OwnerPage>
  );
}

/** A new budget (numbered form; the totals are the API's after saving). */
export async function NewBudgetView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.juristic.budget");
  const { locale } = context;
  return (
    <OwnerPage testId="juristic-budget-new">
      <PageHeader
        title={t("newTitle")}
        description={t("newLede")}
        back={{ label: t("title"), href: ownerPath(locale, "/juristic/budgets") }}
      />
      <BudgetForm
        buildings={context.buildings.map((building) => ({ id: building.id, name: building.name }))}
        defaultBuildingId={param(searchParams.building) ?? context.building?.id}
      />
    </OwnerPage>
  );
}

/**
 * One budget (J-DESIGN §JW1): its lines by kind (and by account once the chart of accounts exists, J2.1) with the
 * API's totals, the resolution that approved it, and "สร้างอัตราจากงบนี้" — the basis picker with the live per-unit
 * preview and the rate-plan draft.
 */
export async function BudgetView({ context, budgetId }: { context: OwnerContext; budgetId: string }) {
  const t = await getTranslations("owner.juristic.budget");
  const juristic = await getTranslations("owner.juristic");
  const { api, locale, me } = context;
  let budget: Schemas["BudgetDto"];
  try {
    budget = await unwrap(api.GET("/v1/owner/juristic/budgets/{budgetId}", { params: { path: { budgetId } } }));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const building = context.buildings.find((candidate) => candidate.id === budget.buildingId);
  const property = context.properties.find((candidate) => candidate.id === building?.propertyId);
  const kind = kindOf(property);
  const writable = !readOnly(me);
  const canApprove = writable && ownerCan(me, "juristic.budget.approve") && budget.nextActions.includes("approve");
  const canDraft = writable && ownerCan(me, "juristic.budget.manage");
  const [resolution, adopted] = await Promise.all([
    budget.resolutionId
      ? section(
          unwrap(
            api.GET("/v1/owner/juristic/resolutions/{resolutionId}", {
              params: { path: { resolutionId: budget.resolutionId } },
            }),
          ),
        )
      : Promise.resolve(null),
    canApprove
      ? section(
          unwrap(
            api.GET("/v1/owner/juristic/resolutions", {
              params: { query: { buildingId: budget.buildingId, state: "adopted", perPage: 100 } },
            }),
          ),
        )
      : Promise.resolve(null),
  ]);
  const money = (value: string) => formatTHB(value, locale);
  const lines: StatementLine[] = KINDS.flatMap((lineKind) => {
    const rows = budget.lines.filter((line) => line.kind === lineKind);
    if (rows.length === 0) return [];
    return [
      { key: `${lineKind}-head`, label: t(`section.${lineKind}`), kind: "heading" as const, level: 0 as const },
      ...rows.map((line) => ({
        key: line.id,
        label: line.label,
        value: money(line.amount),
        level: 1 as const,
        testId: "budget-line-row",
      })),
      ...(lineKind === "fund"
        ? [
            {
              key: "total",
              label: t("totalOwners"),
              value: money(budget.total),
              kind: "result" as const,
              testId: "budget-total",
            },
          ]
        : lineKind === "income"
          ? [{ key: "income", label: t("totalIncome"), value: money(budget.incomeTotal), kind: "subtotal" as const }]
          : []),
    ];
  });
  // Without fund lines, the owners' total closes the expense section.
  if (!budget.lines.some((line) => line.kind === "fund")) {
    const at = lines.findIndex((line) => line.key.startsWith("income"));
    lines.splice(at < 0 ? lines.length : at, 0, {
      key: "total",
      label: t("totalOwners"),
      value: money(budget.total),
      kind: "result",
      testId: "budget-total",
    });
  }

  return (
    <OwnerPage testId="juristic-budget">
      <PageHeader
        title={budget.name}
        status={<StatusBadgeOf map={BUDGET_STATUS} value={budget.state} />}
        description={t("recordLede", {
          building: building?.name ?? "—",
          from: formatDate(budget.periodStart, locale),
          to: formatDate(budget.periodEnd, locale),
        })}
        back={{ label: t("title"), href: ownerPath(locale, "/juristic/budgets") }}
      />
      <DetailLayout
        panel={
          <ActionPanel
            title={t("panelTitle")}
            status={<StatusBadgeOf map={BUDGET_STATUS} value={budget.state} size="sm" />}
            description={
              budget.state === "draft"
                ? t("panelDraft")
                : budget.state === "approved"
                  ? t("panelApproved")
                  : t("panelSuperseded")
            }
            facts={[
              { key: "total", label: t("totalOwners"), value: money(budget.total) },
              { key: "income", label: t("totalIncome"), value: money(budget.incomeTotal) },
              { key: "lines", label: t("lineCount"), value: formatNumber(budget.lines.length, locale) },
              ...(budget.approvedAt
                ? [{ key: "approved", label: t("approvedAt"), value: formatDateTime(budget.approvedAt, locale) }]
                : []),
            ]}
            primary={
              canApprove ? (
                <ApproveBudgetButton
                  budget={budget}
                  resolutions={(adopted?.data?.data ?? []).map((row) => ({
                    id: row.id,
                    label: t("resolutionOption", { number: row.number, title: row.title }),
                  }))}
                />
              ) : budget.state === "approved" ? (
                <Button asChild block>
                  <a href="#rate-builder">{t("toRate")}</a>
                </Button>
              ) : undefined
            }
            secondary={
              resolution?.data ? (
                <Button asChild variant="secondary" block>
                  <a
                    href={ownerPath(locale, `/juristic/resolutions/${resolution.data.id}`)}
                    data-testid="budget-resolution"
                  >
                    {t("openResolution", { number: resolution.data.number })}
                  </a>
                </Button>
              ) : undefined
            }
          />
        }
      >
        <Card as="section" aria-labelledby="lines-title" className="flex flex-col gap-4" data-testid="budget-lines">
          <CardHeader title={<span id="lines-title">{t("linesTitle")}</span>} description={t("linesHint")} />
          <Statement caption={t("linesTitle")} lines={lines} />
        </Card>
        <Card as="section" aria-labelledby="rate-builder" className="flex flex-col gap-4" id="rate-builder-card">
          <CardHeader title={<span id="rate-builder">{t("rateTitle")}</span>} description={t("rateHint")} />
          <RateBuilder
            budget={budget}
            propertyKind={property?.kind ?? null}
            unitsWord={juristic(vocabularyKeys(kind).units)}
            blocked={!canDraft ? "permission" : budget.state !== "approved" ? "approve" : undefined}
          />
        </Card>
      </DetailLayout>
    </OwnerPage>
  );
}

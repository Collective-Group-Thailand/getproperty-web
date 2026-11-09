import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { VENDOR_CONTRACT_STATUS, VENDOR_STATUS } from "@/domain/status";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { bangkokToday } from "@/features/shared/console/time";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatPhone, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconContract } from "@/ui/icons/glyphs/contract";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconEvaluation } from "@/ui/icons/glyphs/evaluation";
import { IconVendor } from "@/ui/icons/glyphs/vendor";

import { ownerPath, withQuery } from "../../shared/links";
import { ownerCan, pageParam, param, readOnly, section, type OwnerContext } from "../../shared/server";
import { expiryBadge } from "./contracts";
import { CategoryText, ExpiryBadgeView, scoreText, TrendBadge } from "./pieces";
import { contractChoices, vendorSettings } from "./shared";
import { BlockVendorButton, UnblockVendorButton } from "./VendorActions";
import { VendorForm } from "./VendorForm";

type SearchParams = Record<string, string | string[] | undefined>;
const TABS = ["active", "blocked", "all"] as const;
type Tab = (typeof TABS)[number];

export const VENDOR_CATEGORIES: readonly Schemas["VendorCategory"][] = [
  "security",
  "cleaning",
  "gardening",
  "lift",
  "pump",
  "fire_system",
  "electrical",
  "plumbing",
  "pest_control",
  "pool",
  "cctv",
  "waste",
  "building_works",
  "professional",
  "insurance",
  "other",
];

/**
 * The office's vendors (D-331): active ones first, blocked ones in their own tab; filter by category and name. Each row:
 * the name with the contact person, the categories, the last four digits of the tax id (the full id is printed only on
 * the 50 ทวิ), active contracts and the state.
 */
export async function VendorsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.vendors.list");
  const categories = await getTranslations("owner.vendors.category");
  const { api, locale, me } = context;
  const tab: Tab = TABS.find((which) => which === param(searchParams.tab)) ?? "active";
  const q = param(searchParams.q);
  const category = VENDOR_CATEGORIES.find((value) => value === param(searchParams.category));
  const page = pageParam(searchParams.page);
  const queryOf = (which: Tab) => (which === "all" ? {} : { state: which });
  const filters = { ...(q ? { q } : {}), ...(category ? { category } : {}) };
  const list = await section(
    unwrap(
      api.GET("/v1/owner/juristic/vendors", {
        params: { query: { page, perPage: 25, ...queryOf(tab), ...filters } },
      }),
    ),
  );
  // Tab badges from the page's `counts` (J-CR): per state for the same search and category.
  const tabCounts = list.data?.counts;
  const counts = TABS.map((which) => tabCounts?.[which]);
  const canManage = !readOnly(me) && ownerCan(me, "juristic.vendor.manage");
  const base = ownerPath(locale, "/juristic/vendors");
  const rows = list.data?.data ?? [];
  const filtered = Boolean(q || category);
  const add = (variant: "primary" | "secondary") => (
    <Button
      asChild
      variant={variant}
      iconStart={IconAdd}
      data-testid={variant === "primary" ? "vendor-new" : undefined}
    >
      <a href={ownerPath(locale, "/juristic/vendors/new")}>{t("new")}</a>
    </Button>
  );
  return (
    <OwnerPage testId="juristic-vendors">
      <PageHeader title={t("title")} description={t("lede")} actions={canManage ? add("primary") : undefined} />
      <ListToolbar
        tabs={
          <ViewTabs
            label={t("tabs")}
            current={tab}
            tabs={TABS.map((which, index) => ({
              key: which,
              href: withQuery(base, { tab: which, q, category }),
              label: t(`tab.${which}`),
              count: counts[index],
              testId: `vendors-tab-${which}`,
            }))}
          />
        }
        filters={
          <FilterBar
            variant="toolbar"
            fields={[
              {
                name: "category",
                label: t("category"),
                type: "select",
                options: [
                  { value: "", label: t("allCategories") },
                  ...VENDOR_CATEGORIES.map((value) => ({ value, label: categories(value) })),
                ],
              },
              { name: "q", label: t("search"), type: "search", placeholder: t("searchPlaceholder") },
            ]}
          />
        }
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : rows.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconVendor}
          title={filtered ? t("empty.filtered.title") : t(`empty.${tab}.title`)}
          description={filtered ? t("empty.filtered.body") : t(`empty.${tab}.body`)}
          action={
            filtered ? (
              <Button asChild variant="secondary">
                <a href={withQuery(base, { tab })}>{t("empty.clear")}</a>
              </Button>
            ) : tab === "blocked" ? (
              <Button asChild variant="secondary">
                <a href={withQuery(base, { tab: "active" })}>{t("empty.toActive")}</a>
              </Button>
            ) : canManage ? (
              add("secondary")
            ) : undefined
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="vendor-rows"
          stackOnPhones
          minWidth="56rem"
          columns={[
            { key: "vendor", header: t("col.vendor"), phone: "title" },
            { key: "categories", header: t("col.categories"), phone: "meta" },
            { key: "taxId", header: t("col.taxId"), phone: "hidden" },
            { key: "contracts", header: t("col.contracts"), align: "end", phone: "figure" },
            { key: "state", header: t("col.state"), phone: "status" },
          ]}
          rows={rows.map((vendor) => ({
            key: vendor.id,
            href: ownerPath(locale, `/juristic/vendors/${vendor.id}`),
            testId: "vendor-row",
            data: { state: vendor.state, name: vendor.name },
            cells: {
              vendor: (
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{vendor.name}</span>
                  <span className="text-muted text-sm">
                    {[vendor.contactName, vendor.contactPhone ? formatPhone(vendor.contactPhone) : null]
                      .filter(Boolean)
                      .join(" · ") || t(`partyType.${vendor.partyType}`)}
                  </span>
                </span>
              ),
              categories: (
                <span className="text-sm">
                  <CategoryText categories={vendor.categories} />
                </span>
              ),
              taxId: vendor.taxIdHint ? (
                <span className="text-sm whitespace-nowrap tabular-nums">
                  {t("taxIdHint", { last: vendor.taxIdHint })}
                </span>
              ) : (
                <span className="text-muted text-sm">{t("noTaxId")}</span>
              ),
              contracts: (
                <span className="tabular-nums">
                  {vendor.activeContracts ? t("contracts", { count: vendor.activeContracts }) : "—"}
                </span>
              ),
              state: <StatusBadgeOf map={VENDOR_STATUS} value={vendor.state} size="sm" />,
            },
          }))}
        />
      )}
      {list.data && list.data.meta.total > list.data.meta.perPage ? (
        <ListPagination meta={list.data.meta} path={base} searchParams={searchParams} locale={locale} />
      ) : null}
    </OwnerPage>
  );
}

async function loadVendor(context: OwnerContext, vendorId: string): Promise<Schemas["VendorDto"]> {
  try {
    return await unwrap(context.api.GET("/v1/owner/juristic/vendors/{vendorId}", { params: { path: { vendorId } } }));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
}

/**
 * One vendor: who they are (tax id last four, contact, the bank account by its last four only — the office records
 * payments, it never executes them), their contracts with the expiry badge, and the evaluation summary of each
 * contract that has one (the evidence for a renewal). The panel: a new contract, edit, block with a reason / unblock.
 */
export async function VendorView({ context, vendorId }: { context: OwnerContext; vendorId: string }) {
  const t = await getTranslations("owner.vendors.record");
  const list = await getTranslations("owner.vendors.list");
  const { api, locale, me } = context;
  const vendor = await loadVendor(context, vendorId);
  const [contracts, settings] = await Promise.all([contractChoices(api, { vendorId }), vendorSettings(context)]);
  const evaluated = await Promise.all(
    contracts
      .filter((contract) => contract.state !== "draft")
      .slice(0, 5)
      .map((contract) =>
        unwrap(
          api.GET("/v1/owner/juristic/vendor-contracts/{contractId}", {
            params: { path: { contractId: contract.id } },
          }),
        ).catch(() => null),
      ),
  );
  const summaries = evaluated.filter(
    (detail): detail is Schemas["VendorContractDetailDto"] => detail !== null && detail.evaluationSummary.count > 0,
  );
  const canManage = !readOnly(me) && ownerCan(me, "juristic.vendor.manage");
  const blocked = vendor.state === "blocked";
  const today = bangkokToday();
  const money = (value: string) => formatTHB(value, locale);
  const bank = [
    vendor.bankName,
    vendor.bankAccountName,
    vendor.bankAccountLast4 ? `····${vendor.bankAccountLast4}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const newContract = ownerPath(locale, `/juristic/contracts/new?vendor=${vendor.id}`);

  return (
    <OwnerPage testId="juristic-vendor">
      <PageHeader
        title={vendor.name}
        status={<StatusBadgeOf map={VENDOR_STATUS} value={vendor.state} />}
        description={t("lede", {
          type: list(`partyType.${vendor.partyType}`),
          contracts: vendor.activeContracts,
        })}
        back={{ label: t("back"), href: ownerPath(locale, "/juristic/vendors") }}
      />
      <DetailLayout
        panelFirstOnPhones
        panel={
          <ActionPanel
            testId="vendor-panel"
            summary={
              <div className="flex flex-col gap-1">
                <span className="text-muted text-sm">{t("activeContracts")}</span>
                <span className="text-2xl font-semibold tracking-tight tabular-nums">{vendor.activeContracts}</span>
              </div>
            }
            title={t(blocked ? "panel.blocked" : "panel.active")}
            description={t(blocked ? "panel.blockedBody" : "panel.activeBody")}
            primary={
              canManage && !blocked ? (
                <Button asChild block iconStart={IconContract}>
                  <a href={newContract} data-testid="vendor-new-contract">
                    {t("newContract")}
                  </a>
                </Button>
              ) : undefined
            }
            secondary={
              canManage ? (
                <>
                  <Button asChild variant="secondary" block iconStart={IconEdit}>
                    <a href={ownerPath(locale, `/juristic/vendors/${vendor.id}/edit`)} data-testid="vendor-edit">
                      {t("edit")}
                    </a>
                  </Button>
                  {blocked ? <UnblockVendorButton vendor={vendor} /> : null}
                </>
              ) : undefined
            }
            destructive={canManage && !blocked ? <BlockVendorButton vendor={vendor} /> : undefined}
          />
        }
      >
        {blocked ? (
          <div data-testid="vendor-blocked">
            <Callout tone="warning" title={t("blockedTitle")}>
              <p className="m-0">{t("blockedReason", { reason: vendor.blockedReason ?? "—" })}</p>
              <p className="m-0">{t("blockedBody")}</p>
            </Callout>
          </div>
        ) : null}
        <Card as="section" aria-labelledby="vendor-facts">
          <CardHeader title={<span id="vendor-facts">{t("facts")}</span>} />
          <DescriptionList
            columns={2}
            items={[
              { id: "type", term: t("type"), description: list(`partyType.${vendor.partyType}`) },
              {
                id: "taxId",
                term: t("taxId"),
                description: vendor.taxIdHint ? (
                  <span className="flex flex-col">
                    <span className="tabular-nums" data-testid="vendor-tax-id">
                      {list("taxIdHint", { last: vendor.taxIdHint })}
                    </span>
                    <span className="text-muted text-sm">{t("taxIdNote")}</span>
                  </span>
                ) : (
                  <span className="flex flex-col">
                    <span className="text-muted">{list("noTaxId")}</span>
                    <span className="text-muted text-sm">{t("noTaxIdNote")}</span>
                  </span>
                ),
              },
              { id: "categories", term: t("categories"), description: <CategoryText categories={vendor.categories} /> },
              { id: "contact", term: t("contact"), description: vendor.contactName },
              {
                id: "phone",
                term: t("phone"),
                description: vendor.contactPhone ? formatPhone(vendor.contactPhone) : null,
              },
              { id: "email", term: t("email"), description: vendor.contactEmail },
              {
                id: "bank",
                term: t("bank"),
                description: bank ? (
                  <span className="flex flex-col">
                    <span data-testid="vendor-bank">{bank}</span>
                    <span className="text-muted text-sm">{t("bankNote")}</span>
                  </span>
                ) : null,
                wide: true,
              },
              ...(vendor.note ? [{ id: "note", term: t("note"), description: vendor.note, wide: true }] : []),
            ]}
          />
        </Card>
        <Card as="section" aria-labelledby="vendor-contracts" className="flex flex-col gap-2">
          <CardHeader title={<span id="vendor-contracts">{t("contracts")}</span>} description={t("contractsHint")} />
          {contracts.length === 0 ? (
            <EmptyState
              icon={IconContract}
              title={t("noContracts")}
              description={t("noContractsBody")}
              action={
                canManage && !blocked ? (
                  <Button asChild variant="secondary" iconStart={IconAdd}>
                    <a href={newContract}>{t("newContract")}</a>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <SimpleTable
              caption={t("contracts")}
              testId="vendor-contract-rows"
              stackOnPhones
              minWidth="44rem"
              columns={[
                { key: "contract", header: t("col.contract"), phone: "title" },
                { key: "term", header: t("col.term"), phone: "meta" },
                { key: "value", header: t("col.value"), align: "end", phone: "figure" },
                { key: "state", header: t("col.state"), phone: "status" },
              ]}
              rows={contracts.map((contract) => ({
                key: contract.id,
                href: ownerPath(locale, `/juristic/contracts/${contract.id}`),
                testId: "vendor-contract-row",
                cells: {
                  contract: (
                    <span className="flex flex-col">
                      <span className="font-medium">{contract.title}</span>
                      <span className="text-muted text-sm">{contract.buildingName}</span>
                    </span>
                  ),
                  term: (
                    <span className="text-sm whitespace-nowrap">
                      {t("term", {
                        from: formatDate(contract.startsOn, locale),
                        to: formatDate(contract.endsOn, locale),
                      })}
                    </span>
                  ),
                  value: <span className="tabular-nums">{money(contract.value)}</span>,
                  state: (
                    <span className="flex flex-col items-start gap-1 max-md:items-end">
                      <StatusBadgeOf map={VENDOR_CONTRACT_STATUS} value={contract.state} size="sm" />
                      <ExpiryBadgeView badge={expiryBadge(contract, today, settings.windows[0] ?? null)} />
                    </span>
                  ),
                },
              }))}
            />
          )}
        </Card>
        <Card as="section" aria-labelledby="vendor-evaluations" className="flex flex-col gap-2">
          <CardHeader
            title={<span id="vendor-evaluations">{t("evaluations")}</span>}
            description={t("evaluationsHint")}
          />
          {summaries.length === 0 ? (
            <EmptyState
              icon={IconEvaluation}
              title={t("noEvaluations")}
              description={t("noEvaluationsBody")}
              action={
                contracts.some((contract) => contract.state === "active") ? (
                  <Button asChild variant="secondary" iconStart={IconEvaluation}>
                    <a
                      href={ownerPath(
                        locale,
                        `/juristic/contracts/${contracts.find((contract) => contract.state === "active")!.id}#evaluations`,
                      )}
                    >
                      {t("toEvaluations")}
                    </a>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <SimpleTable
              caption={t("evaluations")}
              testId="vendor-evaluation-rows"
              stackOnPhones
              minWidth="44rem"
              columns={[
                { key: "contract", header: t("col.contract"), phone: "title" },
                { key: "average", header: t("col.average"), align: "end", phone: "figure" },
                { key: "last", header: t("col.last"), align: "end", phone: "hidden" },
                { key: "breaches", header: t("col.breaches"), align: "end", phone: "meta" },
                { key: "trend", header: t("col.trend"), phone: "status" },
              ]}
              rows={summaries.map((detail) => ({
                key: detail.id,
                href: ownerPath(locale, `/juristic/contracts/${detail.id}#evaluations`),
                cells: {
                  contract: (
                    <span className="flex flex-col">
                      <span className="font-medium">{detail.title}</span>
                      <span className="text-muted text-sm">
                        {t("evaluatedMonths", { count: detail.evaluationSummary.count })}
                      </span>
                    </span>
                  ),
                  average: (
                    <span className="font-medium tabular-nums">{scoreText(detail.evaluationSummary.averageScore)}</span>
                  ),
                  last: <span className="tabular-nums">{scoreText(detail.evaluationSummary.lastScore)}</span>,
                  breaches: (
                    <span className="tabular-nums">
                      {t("breaches", { count: detail.evaluationSummary.slaBreaches })}
                    </span>
                  ),
                  trend: detail.evaluationSummary.trend ? (
                    <TrendBadge trend={detail.evaluationSummary.trend} />
                  ) : (
                    <span className="text-muted text-sm">{t("tooFew")}</span>
                  ),
                },
              }))}
            />
          )}
        </Card>
      </DetailLayout>
    </OwnerPage>
  );
}

/** The register's companies and people that are not vendors yet — a vendor wraps a party of the tenant. */
async function partyChoices(context: OwnerContext, taken: ReadonlySet<string>) {
  const parties = await unwrap(context.api.GET("/v1/owner/parties", { params: { query: { perPage: 100 } } }))
    .then((list) => list.data)
    .catch(() => [] as Schemas["PartyDto"][]);
  return parties
    .filter((party) => !party.anonymised && !taken.has(party.id))
    .sort(
      (a, b) =>
        Number(b.type === "company") - Number(a.type === "company") || a.displayName.localeCompare(b.displayName, "th"),
    )
    .map((party) => ({
      id: party.id,
      name: party.displayName,
      company: party.type === "company",
      taxId: Boolean(party.taxId),
    }));
}

/** The vendor form page: new (from a party of the register or a new one) or edit. */
export async function VendorFormView({ context, vendorId }: { context: OwnerContext; vendorId?: string }) {
  const t = await getTranslations("owner.vendors.form");
  const { api, locale, me } = context;
  const vendor = vendorId ? await loadVendor(context, vendorId) : undefined;
  const existing = vendor
    ? []
    : await unwrap(api.GET("/v1/owner/juristic/vendors", { params: { query: { perPage: 100 } } }))
        .then((list) => list.data)
        .catch(() => [] as Schemas["VendorDto"][]);
  const parties = vendor ? [] : await partyChoices(context, new Set(existing.map((entry) => entry.partyId)));
  const canManage = !readOnly(me) && ownerCan(me, "juristic.vendor.manage");
  const back = vendor ? ownerPath(locale, `/juristic/vendors/${vendor.id}`) : ownerPath(locale, "/juristic/vendors");
  return (
    <OwnerPage testId={vendor ? "juristic-vendor-edit" : "juristic-vendor-new"}>
      <PageHeader
        title={vendor ? t("editTitle", { name: vendor.name }) : t("title")}
        description={t("lede")}
        back={{ label: vendor ? t("backToVendor") : t("back"), href: back }}
      />
      {canManage ? (
        <VendorForm vendor={vendor} parties={parties} />
      ) : (
        <EmptyState
          variant="card"
          icon={IconVendor}
          title={t("forbiddenTitle")}
          description={t("forbidden")}
          action={
            <Button asChild variant="secondary">
              <a href={back}>{vendor ? t("backToVendor") : t("back")}</a>
            </Button>
          }
        />
      )}
    </OwnerPage>
  );
}

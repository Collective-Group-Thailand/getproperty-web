import { getTranslations } from "next-intl/server";

import { SUBSCRIPTION_STATUS, SUBSCRIPTION_VALUES } from "@/domain/status/subscription";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatPercent } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { IconWallet } from "@/ui/icons/glyphs/wallet";

import { enumParam, pageParam, param, section, type AdminContext } from "../shared/server";

type SearchParams = Record<string, string | string[] | undefined>;

export type BillingTab = "subscriptions" | "invoices" | "hardware" | "field-work" | "plans" | "storage";
const TAB_HREF: Record<BillingTab, string> = {
  subscriptions: "/subscriptions",
  invoices: "/subscriptions/invoices",
  hardware: "/subscriptions/hardware",
  "field-work": "/subscriptions/field-work",
  plans: "/subscriptions/plans",
  storage: "/subscriptions/storage",
};

/** The subscriptions section's pages (F5 5.1): subscriptions · invoices · rented hardware · field work · price plans · storage. */
export async function BillingFrame({
  current,
  title,
  description,
  actions,
  children,
}: {
  current: BillingTab;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = await getTranslations("admin.billing");
  return (
    <ConsolePage testId={`billing-${current}`}>
      <PageHeader title={title} description={description} actions={actions} />
      <LinkTabs
        label={t("tabsLabel")}
        current={TAB_HREF[current]}
        tabs={(Object.keys(TAB_HREF) as BillingTab[]).map((tab) => ({
          href: TAB_HREF[tab],
          label: t(`tab.${tab}`),
          testId: `billing-tab-${tab}`,
        }))}
      />
      {children}
    </ConsolePage>
  );
}

/** Every subscription (F5 5.1, D-082): tenant, plan, state, trial end, discount; filter by state. */
export async function SubscriptionsView({
  context,
  searchParams,
}: {
  context: AdminContext;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("admin.billing.subscriptions");
  const status = await getTranslations("status.subscription");
  const { api, locale } = context;
  const list = await section(
    unwrap(
      api.GET("/v1/admin/subscriptions", {
        params: {
          query: {
            page: pageParam(searchParams.page),
            perPage: 25,
            q: param(searchParams.q),
            state: enumParam(searchParams.state, SUBSCRIPTION_VALUES),
          },
        },
      }),
    ),
  );
  return (
    <BillingFrame current="subscriptions" title={t("title")} description={t("description")}>
      <FilterBar
        fields={[
          { name: "q", label: t("search"), type: "search", placeholder: t("searchPlaceholder") },
          {
            name: "state",
            label: t("state"),
            type: "select",
            placeholder: t("allStates"),
            options: SUBSCRIPTION_VALUES.map((value) => ({ value, label: status(value) })),
          },
        ]}
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : list.data.data.length === 0 ? (
        <Card>
          <EmptyState icon={IconWallet} title={t("empty")} />
        </Card>
      ) : (
        <>
          <SimpleTable
            caption={t("title")}
            testId="subscription-table"
            columns={[
              { key: "tenant", header: t("col.tenant") },
              { key: "plan", header: t("col.plan") },
              { key: "state", header: t("col.state") },
              { key: "trial", header: t("col.trialEnds") },
              { key: "discount", header: t("col.discount"), align: "end" },
            ]}
            rows={list.data.data.map((sub) => ({
              key: sub.id,
              testId: "subscription-row",
              data: { state: sub.state },
              tone: sub.state === "suspended" ? "danger" : sub.state === "past_due" ? "warning" : "default",
              cells: {
                tenant: (
                  <a href={`/tenants/${sub.tenantId}/subscription`} className="font-semibold hover:underline">
                    {sub.tenantName}
                  </a>
                ),
                plan: [sub.plan.nameTh, ...sub.addons.map((addon) => addon.nameTh)].join(" + "),
                state: <StatusBadgeOf map={SUBSCRIPTION_STATUS} value={sub.state} size="sm" />,
                trial: sub.state === "trial" ? formatDate(sub.trialEndsAt, locale) : "—",
                discount: sub.discountPct !== "0.00" ? formatPercent(sub.discountPct, locale) : "—",
              },
            }))}
          />
          <ListPagination meta={list.data.meta} path="/subscriptions" searchParams={searchParams} locale={locale} />
        </>
      )}
    </BillingFrame>
  );
}

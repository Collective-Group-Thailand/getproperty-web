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
import { EmptyState } from "@/ui/components/EmptyState";
import { Button } from "@/ui/components/Button";
import { ListToolbar } from "@/ui/components/ListToolbar";
import { IconWallet } from "@/ui/icons/glyphs/wallet";

import { StateTabs } from "../shared/lists";
import { enumParam, pageParam, param, section, withQuery, type AdminContext } from "../shared/server";

type SearchParams = Record<string, string | string[] | undefined>;

export type BillingTab =
  "subscriptions" | "invoices" | "hardware" | "field-work" | "plans" | "storage" | "messaging" | "fees";
/** Each page of the section (the rail lists them; links elsewhere point here). */
export const TAB_HREF: Record<BillingTab, string> = {
  subscriptions: "/subscriptions",
  invoices: "/subscriptions/invoices",
  hardware: "/subscriptions/hardware",
  "field-work": "/subscriptions/field-work",
  plans: "/subscriptions/plans",
  storage: "/subscriptions/storage",
  messaging: "/subscriptions/messaging",
  // G5 (D-297): agencies' success / co-broke fees on the platform invoice.
  fees: "/subscriptions/fees",
};

/**
 * The subscriptions section's pages (F5 5.1, redesign G8): subscriptions · invoices · rented hardware · field work ·
 * price plans · storage · LINE messages · growth fees — listed under "การสมัครใช้งาน" in the navigation column, so
 * the page carries no tab row.
 */
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
  return (
    <ConsolePage testId={`billing-${current}`}>
      <PageHeader title={title} description={description} actions={actions} />
      {children}
    </ConsolePage>
  );
}

/**
 * Every subscription (F5 5.1, D-082): one view per state with the API's totals, the search, and rows that open the
 * customer's subscription — tenant, plan with add-ons, state, trial end, discount.
 */
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
  const q = param(searchParams.q);
  const state = enumParam(searchParams.state, SUBSCRIPTION_VALUES);
  const read = (one: (typeof SUBSCRIPTION_VALUES)[number] | undefined, perPage: number) =>
    unwrap(
      api.GET("/v1/admin/subscriptions", {
        params: { query: { page: perPage === 1 ? 1 : pageParam(searchParams.page), perPage, q, state: one } },
      }),
    );
  const list = await section(read(state, 25));
  const filtered = Boolean(q || state);
  return (
    <BillingFrame current="subscriptions" title={t("title")} description={t("description")}>
      <ListToolbar
        tabs={
          <StateTabs
            states={SUBSCRIPTION_VALUES}
            current={state}
            total={(one) => read(one, 1)}
            href={(one) => withQuery("/subscriptions", { q, state: one })}
            label={(one) => status(one)}
            allLabel={t("allStates")}
            navLabel={t("views")}
          />
        }
        filters={
          <FilterBar
            variant="toolbar"
            fields={[{ name: "q", label: t("search"), type: "search", placeholder: t("searchPlaceholder") }]}
          />
        }
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconWallet}
          title={filtered ? t("emptyFiltered") : t("empty")}
          action={
            <Button asChild variant="secondary">
              <a href={filtered ? "/subscriptions" : "/tenants"}>{filtered ? t("clear") : t("openTenants")}</a>
            </Button>
          }
        />
      ) : (
        <>
          <SimpleTable
            caption={t("title")}
            testId="subscription-table"
            stackOnPhones
            minWidth="52rem"
            columns={[
              { key: "tenant", header: t("col.tenant"), phone: "title" },
              { key: "plan", header: t("col.plan"), phone: "meta" },
              { key: "state", header: t("col.state"), phone: "status" },
              { key: "trial", header: t("col.trialEnds"), phone: "hidden" },
              { key: "discount", header: t("col.discount"), align: "end", phone: "hidden" },
            ]}
            rows={list.data.data.map((sub) => ({
              key: sub.id,
              href: `/tenants/${sub.tenantId}/subscription`,
              testId: "subscription-row",
              data: { state: sub.state },
              cells: {
                tenant: <span className="font-semibold">{sub.tenantName}</span>,
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

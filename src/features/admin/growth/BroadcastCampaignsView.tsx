import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { SPONSORED_CAMPAIGN_STATUS, SPONSORED_CAMPAIGN_VALUES } from "@/domain/status";
import { ActionMenu } from "@/features/shared/console/ActionMenu";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { perRecipient, ratePercent } from "@/features/shared/growth/sponsored";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { ListToolbar } from "@/ui/components/ListToolbar";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";
import { IconSettings } from "@/ui/icons/glyphs/settings";

import { StateTabs } from "../shared/lists";
import { NotAllowed } from "../shared/NotAllowed";
import { can, enumParam, pageParam, section, withQuery, type AdminContext } from "../shared/server";
import { RejectCampaign } from "./RejectCampaign";

type SearchParams = Record<string, string | string[] | undefined>;
type Campaign = Schemas["AdminSponsoredCampaignDto"];
const STOPPABLE: Schemas["SponsoredCampaignState"][] = ["draft", "scheduled", "sending"];

/**
 * Listings › LINE broadcasts (G6, D-300): every account's sponsored campaigns, newest first, by state — listings,
 * when, reach (estimate or delivered) and clicks as totals, the price locked at scheduling and the invoice; *Stop* a
 * draft, scheduled or sending one with a reason (`admin.listing.moderate`; not billed). No recipient data exists here.
 */
export async function BroadcastCampaignsView({
  context,
  searchParams,
}: {
  context: AdminContext;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("admin.broadcast.campaigns");
  const listings = await getTranslations("admin.listings");
  const status = await getTranslations("status.sponsoredCampaign");
  const { api, locale, me } = context;
  if (!can(me, "admin.tenant.read")) return <NotAllowed context={context} />;
  const state = enumParam(searchParams.state, SPONSORED_CAMPAIGN_VALUES);
  const list = await section(
    unwrap(
      api.GET("/v1/admin/sponsored-campaigns", {
        params: {
          query: {
            page: pageParam(searchParams.page),
            perPage: 25,
            state,
          },
        },
      }),
    ),
  );
  const moderate = can(me, "admin.listing.moderate");
  const when = (c: Campaign) =>
    c.completedAt && (c.state === "sent" || c.state === "rejected" || c.state === "cancelled")
      ? t("completed", { date: formatDateTime(c.completedAt, locale) })
      : c.scheduledAt
        ? t("scheduledFor", { date: formatDateTime(c.scheduledAt, locale) })
        : t("created", { date: formatDate(c.createdAt, locale) });
  return (
    <ConsolePage testId="admin-broadcasts">
      <PageHeader
        title={listings("tab.broadcasts")}
        description={t("intro")}
        actions={
          can(me, "admin.setting.manage") ? (
            <Button asChild variant="secondary" iconStart={IconSettings}>
              <Link href="/settings/broadcast" data-testid="broadcast-settings-link">
                {t("settingsLink")}
              </Link>
            </Button>
          ) : null
        }
      />
      <ListToolbar
        tabs={
          <StateTabs
            states={SPONSORED_CAMPAIGN_VALUES}
            current={state}
            total={(one) =>
              unwrap(api.GET("/v1/admin/sponsored-campaigns", { params: { query: { perPage: 1, state: one } } }))
            }
            href={(one) => withQuery("/listings/broadcasts", { state: one })}
            label={(one) => status(one)}
            allLabel={t("all")}
            navLabel={t("state")}
          />
        }
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconMegaphone}
          title={t("empty")}
          description={t("emptyHint")}
          action={
            <Button asChild variant="secondary">
              <a href={state ? "/listings/broadcasts" : "/listings"}>{state ? t("clear") : t("openListings")}</a>
            </Button>
          }
        />
      ) : (
        <>
          <SimpleTable
            caption={listings("tab.broadcasts")}
            testId="admin-campaigns"
            stackOnPhones
            minWidth="64rem"
            columns={[
              { key: "campaign", header: t("col.campaign"), phone: "title" },
              { key: "tenant", header: t("col.tenant"), phone: "meta" },
              { key: "state", header: t("col.state"), phone: "status" },
              { key: "reach", header: t("col.reach"), align: "end", phone: "meta" },
              { key: "price", header: t("col.price"), align: "end", phone: "hidden" },
              {
                key: "actions",
                header: <span className="sr-only">{t("col.actions")}</span>,
                phone: "figure",
                className: "w-14",
              },
            ]}
            rows={list.data.data.map((c) => ({
              key: c.id,
              testId: "admin-campaign-row",
              data: { state: c.state, id: c.id },
              cells: {
                campaign: (
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-muted line-clamp-1 text-sm">
                      {t("listings", { count: c.listings.length })} ·{" "}
                      {c.listings.map((listing) => listing.title).join(", ")}
                    </span>
                    <span className="text-muted text-sm tabular-nums">{when(c)}</span>
                    {c.rejectReason ? (
                      <span className="text-muted text-xs">{t("rejectedReason", { reason: c.rejectReason })}</span>
                    ) : null}
                  </span>
                ),
                tenant: (
                  <a href={`/tenants/${c.tenantId}`} className="hover:underline">
                    {c.tenantName}
                  </a>
                ),
                state: <StatusBadgeOf map={SPONSORED_CAMPAIGN_STATUS} value={c.state} size="sm" />,
                reach: (
                  <span className="flex flex-col items-end gap-0.5 tabular-nums">
                    <span>
                      {c.state === "sending" || c.state === "sent"
                        ? t("delivered", { count: c.delivered })
                        : c.estimated === null
                          ? t("withheld")
                          : t("estimated", { count: c.estimated })}
                    </span>
                    {c.state === "sending" || c.state === "sent" ? (
                      <span className="text-muted text-xs">{t("clicks", { count: c.clicks })}</span>
                    ) : null}
                  </span>
                ),
                price: (
                  <span className="flex flex-col items-end gap-0.5 tabular-nums">
                    <span>
                      {c.pricePerRecipient && c.vatRate
                        ? t("priceValue", {
                            price: perRecipient(c.pricePerRecipient, locale),
                            vat: ratePercent(c.vatRate),
                          })
                        : t("notPriced")}
                    </span>
                    {c.invoice ? (
                      <a
                        href={`/subscriptions/invoices/${c.invoice.id}`}
                        className="text-primary text-xs hover:underline"
                      >
                        {t("invoice", { number: c.invoice.number })}
                      </a>
                    ) : null}
                  </span>
                ),
                actions:
                  moderate && STOPPABLE.includes(c.state) ? (
                    <ActionMenu>
                      <RejectCampaign campaignId={c.id} name={c.name} tenant={c.tenantName} />
                    </ActionMenu>
                  ) : null,
              },
            }))}
          />
          <ListPagination
            meta={list.data.meta}
            path="/listings/broadcasts"
            searchParams={searchParams}
            locale={locale}
          />
        </>
      )}
    </ConsolePage>
  );
}

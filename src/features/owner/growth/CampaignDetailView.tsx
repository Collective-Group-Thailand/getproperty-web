import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { SPONSORED_CAMPAIGN_STATUS } from "@/domain/status";
import { publicListingAreas } from "@/features/owner/marketing/publicApi";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatNumber, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Stat } from "@/ui/components/Stat";
import { Icon } from "@/ui/icons";
import { IconShield } from "@/ui/icons/glyphs/shield";

import { ownerPath } from "../shared/links";
import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { ProductCard } from "./BroadcastParts";
import { availability, CANCELLABLE, perRecipient, ratePercent, REPORTED } from "./broadcast";
import { CancelCampaign, ScheduleCampaign } from "./CampaignActions";

type Campaign = Schemas["SponsoredCampaignDto"];
type Translator = Awaited<ReturnType<typeof getTranslations<"owner.broadcast">>>;

/** The segment the API kept, in words; an empty dimension reads "any". */
function segmentItems(t: Translator, campaign: Campaign, locale: Locale, areaNames: Map<string, string>) {
  const s = campaign.segment;
  const money = (value: string) => formatTHB(value, locale, { decimals: 0 });
  const date = (value: string) => formatDate(value, locale);
  const budget =
    s.budgetMin && s.budgetMax
      ? t("detail.budgetRange", { min: money(s.budgetMin), max: money(s.budgetMax) })
      : s.budgetMin
        ? t("detail.budgetFrom", { min: money(s.budgetMin) })
        : s.budgetMax
          ? t("detail.budgetTo", { max: money(s.budgetMax) })
          : t("detail.anyBudget");
  const moveIn =
    s.moveInFrom && s.moveInTo
      ? t("detail.moveInRange", { from: date(s.moveInFrom), to: date(s.moveInTo) })
      : s.moveInFrom
        ? t("detail.moveInFrom", { from: date(s.moveInFrom) })
        : s.moveInTo
          ? t("detail.moveInTo", { to: date(s.moveInTo) })
          : t("detail.anyTime");
  const languages = s.languages.filter((l): l is Schemas["ResidentLanguage"] =>
    ["th", "en", "my", "km", "lo", "zh"].includes(l),
  );
  return [
    {
      id: "areas",
      term: t("detail.areas"),
      description: s.areas.length ? s.areas.map((slug) => areaNames.get(slug) ?? slug).join(", ") : t("detail.anyArea"),
    },
    { id: "budget", term: t("detail.budget"), description: <span className="tabular-nums">{budget}</span> },
    {
      id: "kinds",
      term: t("detail.kinds"),
      description: s.unitKinds.length ? s.unitKinds.map((kind) => t(`kinds.${kind}`)).join(", ") : t("detail.anyKind"),
    },
    { id: "moveIn", term: t("detail.moveIn"), description: moveIn },
    {
      id: "languages",
      term: t("detail.languages"),
      description: languages.length
        ? languages.map((language) => t(`languages.${language}`)).join(", ")
        : t("detail.anyLanguage"),
    },
  ];
}

/**
 * A sponsored campaign (G6, D-300): its state with what it means (scheduled → when and how it is sent; rejected → the
 * platform's reason, not billed; cancelled → nothing sent), the next actions (schedule a draft when the product is
 * open, cancel a draft / scheduled one), the **report** in totals only once sending started, what is sent to whom,
 * and — for a draft — the API's cost preview of the current estimate.
 */
export async function CampaignDetailView({ context, campaignId }: { context: OwnerContext; campaignId: string }) {
  const t = await getTranslations("owner.broadcast");
  const growth = await getTranslations("owner.growth");
  const { api, locale, me } = context;
  if (!ownerCan(me, "listing.read")) notFound();
  const found = await section(
    unwrap(api.GET("/v1/owner/sponsored-campaigns/{campaignId}", { params: { path: { campaignId } } })),
  );
  if (!found.data) {
    if (isApiError(found.error) && (found.error.status === 404 || found.error.status === 422)) notFound();
    return (
      <OwnerPage testId="campaign">
        <SectionError error={found.error} />
      </OwnerPage>
    );
  }
  const campaign = found.data;
  const allPublic = campaign.listings.every((listing) => listing.public);
  const draft = campaign.state === "draft";
  const [product, report, preview, areas] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/sponsored-campaigns/product"))),
    REPORTED.includes(campaign.state)
      ? section(
          unwrap(api.GET("/v1/owner/sponsored-campaigns/{campaignId}/report", { params: { path: { campaignId } } })),
        )
      : Promise.resolve(null),
    draft && allPublic
      ? section(
          unwrap(
            api.POST("/v1/owner/sponsored-campaigns/estimate", {
              body: {
                listingIds: campaign.listings.map((listing) => listing.id),
                segment: {
                  ...campaign.segment,
                  languages: campaign.segment.languages as Schemas["ResidentLanguage"][],
                },
                maxRecipients: campaign.maxRecipients,
              },
            }),
          ),
        )
      : Promise.resolve(null),
    publicListingAreas(),
  ]);
  const areaNames = new Map(areas.map((area) => [area.slug, locale === "en" ? area.nameEn : area.name]));
  const canManage = ownerCan(me, "tenant.subscription.manage") && !readOnly(me);
  const open = product.data ? availability(product.data) === "open" : false;
  const estimate = preview?.data ?? null;
  const summary =
    estimate && estimate.estimated !== null && estimate.product.pricePerRecipient
      ? {
          count: formatNumber(estimate.estimated, locale),
          price: perRecipient(estimate.product.pricePerRecipient, locale),
          total: estimate.cost ? formatTHB(estimate.cost.total, locale) : null,
        }
      : null;

  const actions =
    canManage && CANCELLABLE.includes(campaign.state) ? (
      <>
        {draft && open && allPublic ? (
          <ScheduleCampaign campaignId={campaign.id} name={campaign.name} summary={summary} />
        ) : null}
        <CancelCampaign campaignId={campaign.id} name={campaign.name} />
      </>
    ) : null;

  return (
    <OwnerPage testId="campaign">
      <PageHeader
        title={campaign.name}
        status={
          <span data-testid="campaign-state" data-state={campaign.state}>
            <StatusBadgeOf map={SPONSORED_CAMPAIGN_STATUS} value={campaign.state} />
          </span>
        }
        description={t("list.created", { date: formatDateTime(campaign.createdAt, locale) })}
        crumbs={[
          { label: growth("page.title"), href: ownerPath(locale, "/promote") },
          { label: t("tabs.broadcasts"), href: ownerPath(locale, "/promote/broadcasts") },
          { label: campaign.name },
        ]}
        actions={actions}
      />

      {campaign.state === "rejected" ? (
        <Callout tone="danger" title={t("detail.rejected")}>
          <span data-testid="campaign-rejected">
            {t("detail.rejectedBody", { reason: campaign.rejectReason ?? "—" })}
          </span>
        </Callout>
      ) : campaign.state === "cancelled" ? (
        <Callout tone="neutral" title={t("detail.cancelled")}>
          {t("detail.cancelledBody")}
        </Callout>
      ) : campaign.state === "scheduled" && campaign.scheduledAt ? (
        <Callout tone="info" title={t("detail.scheduled")}>
          {t("detail.scheduledBody", { date: formatDateTime(campaign.scheduledAt, locale) })}
        </Callout>
      ) : null}

      {draft && !allPublic ? (
        <Callout tone="warning" title={t("problems.listing_not_public.title")}>
          <span data-testid="campaign-not-public">{t("detail.notPublicHint")}</span>
        </Callout>
      ) : null}
      {draft && product.data && !open ? <ProductCard product={product.data} locale={locale} compact /> : null}
      {draft && open && estimate && estimate.estimated === null ? (
        <Callout tone="warning" title={t("problems.below_minimum.title")}>
          <span data-testid="campaign-below-minimum">{t("problems.below_minimum.body")}</span>
        </Callout>
      ) : null}

      {report ? (
        <Card
          as="section"
          aria-labelledby="campaign-report"
          className="flex flex-col gap-4"
          data-testid="campaign-report"
        >
          <CardHeader
            title={<span id="campaign-report">{t("report.title")}</span>}
            description={campaign.state === "sending" ? t("report.sending") : undefined}
          />
          {!report.data ? (
            <SectionError error={report.error} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Stat
                  label={t("report.sent")}
                  value={<span data-testid="report-sent">{formatNumber(report.data.sent, locale)}</span>}
                  hint={t("report.sentHint")}
                />
                <Stat
                  label={t("report.opened")}
                  value={<span className="text-muted text-xl">{t("report.openedValue")}</span>}
                  hint={t("report.openedHint")}
                />
                <Stat
                  label={t("report.clicks")}
                  value={<span data-testid="report-clicks">{formatNumber(report.data.clicks, locale)}</span>}
                  hint={t("report.clicksHint")}
                />
                <Stat
                  label={t("report.leads")}
                  value={<span data-testid="report-leads">{formatNumber(report.data.leads, locale)}</span>}
                  hint={t("report.leadsHint", { days: report.data.attributionDays })}
                />
              </div>
              <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm">
                <span className="font-medium">{t("report.billed")}</span>
                {report.data.invoice ? (
                  <a
                    href={ownerPath(locale, `/subscription/invoices/${report.data.invoice.id}`)}
                    className="text-primary font-medium tabular-nums hover:underline"
                    data-testid="report-invoice"
                  >
                    {t("invoice", { number: report.data.invoice.number })} ·{" "}
                    {formatTHB(report.data.invoice.total, locale)}
                  </a>
                ) : (
                  <span className="text-muted">
                    {campaign.state === "sent" ? t("report.nobody") : t("report.notBilledYet")}
                  </span>
                )}
              </div>
              <p className="text-muted m-0 flex items-center gap-2 text-xs">
                <Icon icon={IconShield} className="text-sm" />
                {t("report.privacy")}
              </p>
            </>
          )}
        </Card>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card as="section" aria-labelledby="campaign-what" className="flex flex-col gap-5">
          <CardHeader title={<span id="campaign-what">{t("detail.what")}</span>} />
          <section aria-labelledby="campaign-listings" className="flex flex-col gap-2">
            <h3 id="campaign-listings" className="text-muted m-0 text-sm font-medium">
              {t("detail.listings")}
            </h3>
            <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="campaign-detail-listings">
              {campaign.listings.map((listing) => (
                <li key={listing.id} className="flex flex-wrap items-center gap-2" data-public={listing.public}>
                  <a href={ownerPath(locale, `/listings/${listing.id}`)} className="font-medium hover:underline">
                    {listing.title}
                  </a>
                  {listing.public ? null : (
                    <Badge tone="warning" size="sm">
                      {t("detail.notPublic")}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <DescriptionList items={segmentItems(t, campaign, locale, areaNames)} />
        </Card>

        <Card as="section" aria-labelledby="campaign-numbers" className="flex flex-col gap-4">
          <h2 id="campaign-numbers" className="m-0 text-base font-semibold">
            {t("detail.numbers")}
          </h2>
          <DescriptionList
            columns={1}
            items={[
              {
                id: "max",
                term: t("detail.max"),
                description: t("estimate.people", { count: campaign.maxRecipients }),
              },
              {
                id: "estimated",
                term: t("detail.estimated"),
                description: (
                  <span data-testid="campaign-estimated">
                    {campaign.estimated === null
                      ? t("estimate.withheld", {
                          minimum: campaign.minimumRecipients ?? product.data?.minimumRecipients ?? 0,
                        })
                      : t("estimate.people", { count: campaign.estimated })}
                  </span>
                ),
              },
              {
                id: "scheduledAt",
                term: t("detail.scheduledAt"),
                description: campaign.scheduledAt
                  ? formatDateTime(campaign.scheduledAt, locale)
                  : t("detail.notScheduled"),
              },
              campaign.pricePerRecipient && campaign.vatRate
                ? {
                    id: "price",
                    term: t("detail.priceSnapshot"),
                    description: (
                      <span className="tabular-nums" data-testid="campaign-price-snapshot">
                        {t("detail.priceSnapshotValue", {
                          price: perRecipient(campaign.pricePerRecipient, locale),
                          vat: ratePercent(campaign.vatRate),
                        })}
                      </span>
                    ),
                  }
                : null,
            ].filter((item) => item !== null)}
          />
          {draft && summary?.total ? (
            <div className="border-border flex flex-col gap-1 border-t pt-4" data-testid="campaign-cost">
              <h3 className="m-0 text-sm font-semibold">{t("detail.costTitle")}</h3>
              <p className="text-muted m-0 text-sm">
                {t("detail.costBody", { count: summary.count, total: summary.total })}
              </p>
            </div>
          ) : null}
          {draft && !open ? (
            <p className="text-muted m-0 text-sm" data-testid="campaign-schedule-waiting">
              {t("schedule.waiting")}
            </p>
          ) : draft ? (
            <p className="text-muted m-0 text-sm">{t("detail.draftHint")}</p>
          ) : null}
        </Card>
      </div>
    </OwnerPage>
  );
}

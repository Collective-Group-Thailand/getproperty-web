import { getTranslations } from "next-intl/server";

import { SPONSORED_CAMPAIGN_STATUS } from "@/domain/status";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { Icon, type IconGlyph } from "@/ui/icons";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconChart } from "@/ui/icons/glyphs/chart";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { IconTag } from "@/ui/icons/glyphs/tag";

import { ownerPath } from "../shared/links";
import { availability, perRecipient, ratePercent } from "./broadcast";

type Translator = Awaited<ReturnType<typeof getTranslations<"owner.broadcast">>>;

/** The promotion section's two pages: boosts & photo services, LINE broadcasts (G5, G6). */
export async function PromoteTabs({ locale, current }: { locale: Locale; current: "boosts" | "broadcasts" }) {
  const t = await getTranslations("owner.broadcast.tabs");
  const boosts = ownerPath(locale, "/promote");
  const broadcasts = ownerPath(locale, "/promote/broadcasts");
  return (
    <LinkTabs
      label={t("label")}
      current={current === "boosts" ? boosts : broadcasts}
      tabs={[
        { href: boosts, label: t("boosts"), testId: "promote-tab-boosts" },
        { href: broadcasts, label: t("broadcasts"), testId: "promote-tab-broadcasts" },
      ]}
    />
  );
}

const STATE_TONE = { open: "success", off: "warning", unpriced: "neutral", off_unpriced: "warning" } as const;

/**
 * Whether sponsored broadcasts can be bought now (G6, D-300): switched on (O-023) and priced (O-027) — otherwise why
 * not, and what still works (drafts and estimates). The facts are the API's: price per recipient, minimum, listings
 * per campaign, the weekly cap per person. Never a price the API did not send.
 */
export async function ProductCard({
  product,
  locale,
  compact = false,
}: {
  product: Schemas["SponsoredProductDto"];
  locale: Locale;
  /** Without the billing note (the builder and the campaign page carry their own cost lines). */
  compact?: boolean;
}) {
  const t = await getTranslations("owner.broadcast.product");
  const state = availability(product);
  const facts: { id: string; term: string; value: React.ReactNode; hint?: string }[] = [
    {
      id: "price",
      term: t("price"),
      value: product.pricePerRecipient ? (
        <span data-testid="broadcast-price">
          {t("priceValue", { price: perRecipient(product.pricePerRecipient, locale) })}
        </span>
      ) : (
        <span className="text-muted" data-testid="broadcast-no-price">
          {t("noPrice")}
        </span>
      ),
      hint: product.pricePerRecipient ? t("priceNote", { vat: ratePercent(product.vatRate) }) : undefined,
    },
    { id: "minimum", term: t("minimum"), value: t("minimumValue", { count: product.minimumRecipients }) },
    { id: "listings", term: t("maxListings"), value: t("maxListingsValue", { count: product.maxListings }) },
    { id: "cap", term: t("cap"), value: t("capValue", { count: product.maxPerWeek }), hint: t("capHint") },
  ];
  return (
    <Card
      as="section"
      aria-labelledby="broadcast-product"
      className="flex flex-col gap-5"
      data-testid="broadcast-product"
      data-state={state}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="bg-primary-subtle text-primary-subtle-fg rounded-card flex size-10 shrink-0 items-center justify-center text-xl"
        >
          <Icon icon={IconMegaphone} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="broadcast-product" className="m-0 text-base font-semibold">
              {t("title")}
            </h2>
            <span data-testid="broadcast-availability">
              <Badge tone={STATE_TONE[state]} size="sm">
                {t(`state.${state}`)}
              </Badge>
            </span>
          </div>
          <p className="text-muted m-0 text-sm">{t(`body.${state}`)}</p>
        </div>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.id} className="flex flex-col gap-0.5">
            <dt className="text-muted text-xs">{fact.term}</dt>
            <dd className="m-0 font-semibold tabular-nums">{fact.value}</dd>
            {fact.hint ? <dd className="text-muted m-0 text-xs">{fact.hint}</dd> : null}
          </div>
        ))}
      </dl>
      {compact ? null : <p className="text-muted border-border m-0 border-t pt-4 text-xs">{t("billing")}</p>}
    </Card>
  );
}

const HOW: { key: "consent" | "match" | "numbers" | "ad"; icon: IconGlyph }[] = [
  { key: "consent", icon: IconCheckCircle },
  { key: "match", icon: IconShield },
  { key: "numbers", icon: IconChart },
  { key: "ad", icon: IconTag },
];

/** Who receives a sponsored message and what the buyer sees (D-300, D-025) — the promise, in four lines. */
export async function HowItWorks() {
  const t = await getTranslations("owner.broadcast.how");
  return (
    <Card as="section" aria-labelledby="broadcast-how" className="flex flex-col gap-4" data-testid="broadcast-how">
      <h2 id="broadcast-how" className="m-0 text-base font-semibold">
        {t("title")}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {HOW.map((item) => (
          <li key={item.key} className="flex items-start gap-3 text-sm">
            <Icon icon={item.icon} className="text-primary mt-0.5 shrink-0 text-lg" />
            <span>{t(item.key)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** When a campaign starts / finished, in words. */
function timeLine(t: Translator, campaign: Schemas["SponsoredCampaignDto"], locale: Locale): string {
  if (campaign.completedAt && (campaign.state === "sent" || campaign.state === "rejected"))
    return t("list.completed", { date: formatDateTime(campaign.completedAt, locale) });
  if (campaign.scheduledAt && (campaign.state === "scheduled" || campaign.state === "sending"))
    return t("list.scheduledFor", { date: formatDateTime(campaign.scheduledAt, locale) });
  return t("list.created", { date: formatDate(campaign.createdAt, locale) });
}

/** One campaign in the list: name, state, listings, when, reach (estimate or delivered), clicks, invoice. */
export async function CampaignRow({ campaign, locale }: { campaign: Schemas["SponsoredCampaignDto"]; locale: Locale }) {
  const t = await getTranslations("owner.broadcast");
  const reported = campaign.state === "sending" || campaign.state === "sent";
  return (
    <li
      className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 py-4"
      data-testid="campaign-row"
      data-state={campaign.state}
      data-id={campaign.id}
    >
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <a
            href={ownerPath(locale, `/promote/broadcasts/${campaign.id}`)}
            className="font-semibold hover:underline"
            aria-label={t("list.open", { name: campaign.name })}
          >
            {campaign.name}
          </a>
          <StatusBadgeOf map={SPONSORED_CAMPAIGN_STATUS} value={campaign.state} size="sm" />
        </span>
        <span className="text-muted line-clamp-1 text-sm">
          {t("list.listings", { count: campaign.listings.length })} ·{" "}
          {campaign.listings.map((listing) => listing.title).join(", ")}
        </span>
        <span className="text-muted text-sm tabular-nums">{timeLine(t, campaign, locale)}</span>
      </span>
      <span className="flex flex-col items-start gap-1 text-sm sm:items-end">
        <span className="font-semibold tabular-nums" data-testid="campaign-reach">
          {reported
            ? t("list.delivered", { count: campaign.delivered })
            : campaign.estimated === null
              ? t("list.withheld")
              : t("list.estimated", { count: campaign.estimated })}
        </span>
        {reported ? (
          <span className="text-muted tabular-nums">{t("list.clicks", { count: campaign.clicks })}</span>
        ) : null}
        {campaign.invoice ? (
          <a
            href={ownerPath(locale, `/subscription/invoices/${campaign.invoice.id}`)}
            className="text-primary font-medium hover:underline"
          >
            {t("invoice", { number: campaign.invoice.number })}
          </a>
        ) : null}
      </span>
    </li>
  );
}

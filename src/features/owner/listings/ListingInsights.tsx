import { getTranslations } from "next-intl/server";

import { ListingUtility } from "@/features/owner/marketing/listings/ListingUtility";
import { SectionError } from "@/features/shared/console/SectionError";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { formatNumber, formatTHB } from "@/i18n/format";
import { Card, CardHeader } from "@/ui/components/Card";

import { ownerPath } from "../shared/links";
import { section, type OwnerContext } from "../shared/server";

type Listing = Schemas["ListingDto"];

/**
 * Two honest numbers beside the listing (B7.9): the rent of comparable homes and how fast they let (D-269) — shown
 * only once the API has enough of them — and the utility cost renters will see on the public page (D-265).
 */
export async function ListingInsights({ context, listing }: { context: OwnerContext; listing: Listing }) {
  const t = await getTranslations("owner.listings.insights");
  const { api, locale } = context;
  const comparables = await section(
    unwrap(api.GET("/v1/owner/listings/{listingId}/comparables", { params: { path: { listingId: listing.id } } })),
  );
  const money = (value: string) => formatTHB(value, locale, { decimals: 0 });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card as="section" aria-labelledby="listing-comparables" className="flex flex-col gap-4">
        <CardHeader
          title={<span id="listing-comparables">{t("comparables.title")}</span>}
          description={t("comparables.description")}
        />
        {!comparables.data ? (
          <SectionError error={comparables.error} />
        ) : comparables.data.band ? (
          <div className="flex flex-col gap-4" data-testid="listing-comparables-band">
            <div className="border-fg flex flex-col gap-1 border-s-2 ps-4">
              <p className="text-muted m-0 text-sm">{t("comparables.band")}</p>
              <p className="m-0 text-2xl font-semibold tabular-nums">
                {money(comparables.data.band.p25)}–{money(comparables.data.band.p75)}
              </p>
              <p className="text-muted m-0 text-sm">
                {t("comparables.median", { amount: money(comparables.data.band.p50) })}
              </p>
            </div>
            <dl className="border-border m-0 grid grid-cols-2 border-t">
              <div className="border-border border-b py-3 pe-4">
                <dt className="text-muted text-sm">{t("comparables.yours")}</dt>
                <dd className="m-0 mt-1 font-semibold tabular-nums">{money(listing.rent)}</dd>
              </div>
              <div className="border-border border-b py-3 pe-4">
                <dt className="text-muted text-sm">{t("comparables.daysLabel")}</dt>
                <dd className="m-0 mt-1 font-semibold">
                  {comparables.data.medianDaysToLet === null
                    ? t("comparables.daysUnknown")
                    : t("comparables.days", { count: comparables.data.medianDaysToLet })}
                </dd>
              </div>
            </dl>
            <p className="text-muted m-0 text-xs">
              {t("comparables.sample", { count: formatNumber(comparables.data.sampleSize, locale) })}
            </p>
          </div>
        ) : (
          <p className="text-muted m-0 text-sm" data-testid="listing-comparables-few">
            {t("comparables.few", {
              minimum: comparables.data.minimum,
              count: comparables.data.sampleSize,
            })}
          </p>
        )}
      </Card>

      <Card as="section" aria-labelledby="listing-utility" className="flex flex-col gap-4">
        <CardHeader
          title={<span id="listing-utility">{t("utility.title")}</span>}
          description={t(listing.showUtilityHistory ? "utility.description" : "utility.descriptionHidden")}
        />
        {listing.utility ? (
          <ListingUtility utility={listing.utility} locale={locale} />
        ) : (
          <p className="text-muted m-0 text-sm" data-testid="listing-utility-empty">
            {t("utility.empty")}{" "}
            <a
              href={ownerPath(locale, "/billing/rate-plans")}
              className="text-primary font-semibold underline-offset-4 hover:underline"
            >
              {t("utility.setRates")}
            </a>
          </p>
        )}
      </Card>
    </div>
  );
}

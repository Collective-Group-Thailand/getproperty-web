import { getTranslations } from "next-intl/server";

import { ListingUtility } from "@/features/owner/marketing/listings/ListingUtility";
import { SectionError } from "@/features/shared/console/SectionError";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { formatNumber, formatTHB } from "@/i18n/format";
import { FormSection } from "@/ui/components/FormLayout";

import { ownerPath } from "../shared/links";
import { section, type OwnerContext } from "../shared/server";

type Listing = Schemas["ListingDto"];

/**
 * The rent of comparable homes and how fast they let (B7.9, D-269) — shown only once the API has enough of them —
 * as one section of the listing editor, beside the rent the owner asks.
 */
export async function ListingComparables({
  context,
  listing,
  number,
}: {
  context: OwnerContext;
  listing: Listing;
  number?: number;
}) {
  const t = await getTranslations("owner.listings.insights");
  const { api, locale } = context;
  const comparables = await section(
    unwrap(api.GET("/v1/owner/listings/{listingId}/comparables", { params: { path: { listingId: listing.id } } })),
  );
  const money = (value: string) => formatTHB(value, locale, { decimals: 0 });

  return (
    <FormSection number={number} title={t("comparables.title")} description={t("comparables.description")}>
      {!comparables.data ? (
        <SectionError error={comparables.error} />
      ) : comparables.data.band ? (
        <div className="flex flex-col gap-4" data-testid="listing-comparables-band">
          <dl className="m-0 grid gap-x-6 gap-y-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <dt className="text-muted text-sm">{t("comparables.band")}</dt>
              <dd className="m-0 text-xl font-semibold tabular-nums">
                {money(comparables.data.band.p25)}–{money(comparables.data.band.p75)}
              </dd>
              <dd className="text-muted m-0 text-sm">
                {t("comparables.median", { amount: money(comparables.data.band.p50) })}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted text-sm">{t("comparables.yours")}</dt>
              <dd className="m-0 text-xl font-semibold tabular-nums">{money(listing.rent)}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted text-sm">{t("comparables.daysLabel")}</dt>
              <dd className="m-0 text-xl font-semibold">
                {comparables.data.medianDaysToLet === null
                  ? t("comparables.daysUnknown")
                  : t("comparables.days", { count: comparables.data.medianDaysToLet })}
              </dd>
            </div>
          </dl>
          <p className="border-border text-muted m-0 border-t pt-3 text-xs">
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
    </FormSection>
  );
}

/** The utility cost renters will see on the public page (D-265), under the switch that hides past bills. */
export async function ListingUtilityPreview({ context, listing }: { context: OwnerContext; listing: Listing }) {
  const t = await getTranslations("owner.listings.insights");
  const { locale } = context;
  return (
    <section aria-labelledby="listing-utility" className="rounded-control border-border flex flex-col gap-3 border p-4">
      <div className="flex flex-col gap-0.5">
        <h3 id="listing-utility" className="text-sm font-semibold">
          {t("utility.title")}
        </h3>
        <p className="text-muted m-0 text-sm">
          {t(listing.showUtilityHistory ? "utility.description" : "utility.descriptionHidden")}
        </p>
      </div>
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
    </section>
  );
}

import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { ListingCard } from "@/features/owner/marketing/listings/ListingCard";
import { publicOwner } from "@/features/owner/marketing/publicApi";
import { marketingMetadata, marketingOrigin } from "@/features/owner/marketing/seo";
import { breadcrumbSchema } from "@/features/owner/marketing/structured-data";
import { formatDate, formatNumber } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Badge } from "@/ui/components/Badge";
import { Icon } from "@/ui/icons";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconChevronLeft } from "@/ui/icons/glyphs/chevron-left";

type Params = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const owner = await publicOwner(slug, locale);
  if (!owner) return { title: "getproperty", robots: { index: false } };
  const t = await getTranslations("owner.marketing.listings.ownerPage");
  return marketingMetadata(`/owners/${slug}`, locale, {
    title: t("metaTitle", { name: owner.displayName }),
    description: t("metaDescription", { name: owner.displayName, count: owner.listingCount }),
    noindex: owner.listingCount === 0,
  });
}

/**
 * A verified owner's page (D-274): who they are on getproperty — what the platform checked, since when, how fast they
 * answer — and every home they rent out now. No phone, no LINE id: renters reach the owner from a listing.
 */
export default async function OwnerPage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const owner = await publicOwner(slug, locale);
  if (!owner) notFound();
  const t = await getTranslations("owner.marketing.listings.ownerPage");
  const nav = await getTranslations("owner.marketing.nav");
  const origin = marketingOrigin();
  const href = (path: string) => getPathname({ href: path, locale });
  const reply = owner.medianReplyMinutes;
  const replyText =
    reply === null
      ? null
      : reply < 60
        ? t("minutes", { count: reply })
        : t("hours", { count: Math.max(1, Math.round(reply / 60)) });

  return (
    <>
      <JsonLdScript
        graphs={[
          breadcrumbSchema([
            { name: nav("home"), url: `${origin}${href("/")}` },
            { name: nav("rent"), url: `${origin}${href("/rent")}` },
            { name: owner.displayName },
          ]),
        ]}
      />
      <section className="bg-surface-subtle">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pt-8 pb-12">
          <a href={href("/rent")} className="text-muted hover:text-fg inline-flex items-center gap-1 text-sm">
            <Icon icon={IconChevronLeft} />
            {t("back")}
          </a>
          <div className="flex flex-col gap-4">
            <p className="text-primary text-sm font-semibold">{t("kicker")}</p>
            <h1 className="text-display" data-testid="owner-name">
              {owner.displayName}
            </h1>
            <div>
              <Badge tone="success" icon={IconCheckCircle}>
                {t("verified", { count: owner.verification.verifiedUnits })}
              </Badge>
            </div>
          </div>
          <dl className="m-0 grid gap-6 sm:grid-cols-3">
            <div className="border-fg flex flex-col gap-1 border-s-2 ps-4">
              <dt className="text-muted text-sm">{t("listingsLabel")}</dt>
              <dd className="m-0 text-2xl font-semibold tabular-nums">{formatNumber(owner.listingCount, locale)}</dd>
            </div>
            <div className="border-border flex flex-col gap-1 border-s-2 ps-4">
              <dt className="text-muted text-sm">{t("memberSinceLabel")}</dt>
              <dd className="m-0 text-2xl font-semibold">
                {formatDate(owner.memberSince, locale, { style: "month" })}
              </dd>
            </div>
            <div className="border-border flex flex-col gap-1 border-s-2 ps-4">
              <dt className="text-muted text-sm">{t("replyLabel")}</dt>
              <dd className="m-0 text-2xl font-semibold" data-testid="owner-reply">
                {replyText ?? <span className="text-muted text-base font-normal">{t("replyUnknown")}</span>}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="owner-listings" className="mx-auto max-w-7xl px-4 py-12">
        <h2 id="owner-listings" className="text-2xl">
          {t("listings", { name: owner.displayName })}
        </h2>
        {owner.listings.length > 0 ? (
          <ul
            className="m-0 mt-8 grid list-none gap-x-6 gap-y-10 p-0 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="listings"
          >
            {owner.listings.map((listing) => (
              <li key={listing.slug}>
                <ListingCard listing={listing} locale={locale} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted py-10 text-center">{t("empty")}</p>
        )}
        <p className="text-muted mt-10 max-w-2xl text-sm">{t("note")}</p>
      </section>
    </>
  );
}

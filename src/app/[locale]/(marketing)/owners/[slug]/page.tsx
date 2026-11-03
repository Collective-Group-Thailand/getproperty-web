import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { JsonLdScript } from "@/features/owner/marketing/JsonLdScript";
import { PageHead, Section, SectionHead, WRAP } from "@/features/owner/marketing/Layout";
import { ListingCard } from "@/features/owner/marketing/listings/ListingCard";
import { publicOwner } from "@/features/owner/marketing/publicApi";
import { marketingMetadata, marketingOrigin } from "@/features/owner/marketing/seo";
import { breadcrumbSchema } from "@/features/owner/marketing/structured-data";
import { formatDate, formatNumber } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { IconHome } from "@/ui/icons/glyphs/home";

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
      <PageHead
        back={{ href: href("/rent"), label: t("back") }}
        eyebrow={t("kicker")}
        title={owner.displayName}
        titleTestId="owner-name"
        className="pb-8 md:pb-10"
      >
        <div className="flex flex-wrap gap-2">
          <Badge tone="success" icon={IconCheckCircle}>
            {t("verified", { count: owner.verification.verifiedUnits })}
          </Badge>
          {owner.verification.identityVerified ? (
            <span data-testid="owner-identity-verified">
              <Badge tone="success" icon={IconShield}>
                {t("identityVerified")}
              </Badge>
            </span>
          ) : null}
        </div>
      </PageHead>

      <div className={WRAP}>
        <dl className="bg-surface border-border rounded-card shadow-card divide-border m-0 grid border max-sm:divide-y sm:grid-cols-3 sm:divide-x">
          <div className="flex flex-col gap-1 p-5 md:p-6">
            <dt className="text-muted text-sm">{t("listingsLabel")}</dt>
            <dd className="m-0 text-2xl font-semibold tabular-nums">{formatNumber(owner.listingCount, locale)}</dd>
          </div>
          <div className="flex flex-col gap-1 p-5 md:p-6">
            <dt className="text-muted text-sm">{t("memberSinceLabel")}</dt>
            <dd className="m-0 text-2xl font-semibold">{formatDate(owner.memberSince, locale, { style: "month" })}</dd>
          </div>
          <div className="flex flex-col gap-1 p-5 md:p-6">
            <dt className="text-muted text-sm">{t("replyLabel")}</dt>
            <dd className="m-0 text-2xl font-semibold" data-testid="owner-reply">
              {replyText ?? <span className="text-muted text-base font-normal">{t("replyUnknown")}</span>}
            </dd>
          </div>
        </dl>
      </div>

      <Section labelledBy="owner-listings">
        <SectionHead id="owner-listings" title={t("listings", { name: owner.displayName })} lede={t("note")} />
        {owner.listings.length > 0 ? (
          <ul
            className="m-0 mt-10 grid list-none gap-x-6 gap-y-12 p-0 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="listings"
          >
            {owner.listings.map((listing) => (
              <li key={listing.slug}>
                <ListingCard listing={listing} locale={locale} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            variant="card"
            className="mt-10"
            icon={IconHome}
            title={t("empty")}
            description={t("emptyBody")}
            action={
              <Button asChild variant="secondary">
                <a href={href("/rent")}>{t("back")}</a>
              </Button>
            }
          />
        )}
      </Section>
    </>
  );
}

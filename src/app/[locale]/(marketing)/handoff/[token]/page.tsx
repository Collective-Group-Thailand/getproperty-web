import { getTranslations, setRequestLocale } from "next-intl/server";

import { DeclineHandoff } from "@/features/owner/marketing/handoff/DeclineHandoff";
import { publicHandoff } from "@/features/owner/marketing/handoff/publicHandoff";
import { StatusPanel } from "@/features/owner/marketing/Layout";
import { ownerHref } from "@/features/owner/marketing/seo";
import { handoffPlace } from "@/features/shared/growth/handoff";
import { formatDate, formatDecimal } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconHome } from "@/ui/icons/glyphs/home";
import { IconInfo } from "@/ui/icons/glyphs/info";
import { IconLink } from "@/ui/icons/glyphs/link";

type Params = { params: Promise<{ locale: Locale; token: string }> };

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * A getbuild rental invitation (G8, D-299): the buyer of a new unit opens the link getbuild showed them and sees the
 * unit as getbuild described it — their first name only, nothing else about them — with one way forward (a free
 * landlord account that receives a ready listing draft) and one way out ("not now"). getproperty never contacts the
 * buyer itself. Not indexed, not cached, no referrer (the token is in the path).
 */
export default async function HandoffInvitationPage({ params }: Params) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.marketing.handoff");
  const handoff = await publicHandoff(token);
  const claim = ownerHref(`/listings/handoffs/claim?token=${encodeURIComponent(token)}`, locale);
  const signUp = `${ownerHref("/signup", locale)}?next=${encodeURIComponent(
    `${locale === "th" ? "" : `/${locale}`}/listings/handoffs/claim?token=${encodeURIComponent(token)}`,
  )}`;

  if (!handoff) {
    return (
      <Frame kicker={t("kicker")} title={t("notFound.title")}>
        <StatusPanel
          testId="handoff-not-found"
          icon={IconLink}
          body={t("notFound.body")}
          action={
            <Button asChild variant="secondary">
              <a href={getPathname({ href: "/landlords", locale })}>{t("notFound.action")}</a>
            </Button>
          }
        />
      </Frame>
    );
  }

  const facts = handoff.facts;
  const rows = (
    [
      [t("facts.project"), facts.projectName],
      [t("facts.unit"), facts.unitNo],
      [t("facts.kind"), t(`kind.${facts.kind}`)],
      [t("facts.floor"), facts.floorLabel],
      [t("facts.area"), facts.areaSqm ? t("facts.sqm", { size: formatDecimal(facts.areaSqm, locale, 1) }) : null],
      [t("facts.bedrooms"), facts.bedrooms !== null ? String(facts.bedrooms) : null],
      [t("facts.bathrooms"), facts.bathrooms !== null ? String(facts.bathrooms) : null],
      [t("facts.place"), handoffPlace(facts) || null],
      [t("facts.transfer"), formatDate(handoff.transferDate, locale)],
    ] as [string, string | null][]
  ).filter((row): row is [string, string] => !!row[1]);
  const open = handoff.state === "invited";

  return (
    <Frame
      kicker={t("kicker")}
      title={open ? t("title", { name: handoff.buyerFirstName }) : t(`closed.${handoff.state}.title`)}
    >
      <div
        className="border-border bg-surface rounded-card shadow-card flex flex-col gap-5 border p-5 md:p-6"
        data-testid="handoff-invitation"
        data-state={handoff.state}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="bg-primary-subtle text-primary grid size-11 shrink-0 place-items-center rounded-full">
            <Icon icon={IconHome} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="font-semibold">{facts.projectName ?? t(`kind.${facts.kind}`)}</span>
            <span className="text-muted text-sm">{handoffPlace(facts)}</span>
          </div>
          {open ? (
            <span className="text-muted inline-flex items-center gap-1 text-sm">
              <Icon icon={IconClock} />
              {t("expires", { date: formatDate(handoff.expiresAt, locale) })}
            </span>
          ) : null}
        </div>
        <dl className="border-border m-0 grid grid-cols-2 border-t sm:grid-cols-3" data-testid="handoff-facts">
          {rows.map(([term, value]) => (
            <div key={term} className="border-border border-b py-3 pe-4">
              <dt className="text-muted text-sm">{term}</dt>
              <dd className="m-0 mt-1 font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-muted m-0 text-xs">{t("source")}</p>
      </div>

      {open ? (
        <>
          <section aria-labelledby="handoff-steps" className="flex flex-col gap-4">
            <h2 id="handoff-steps" className="m-0 text-xl">
              {t("steps.title")}
            </h2>
            <ol className="m-0 grid list-none gap-x-6 gap-y-5 p-0 md:grid-cols-3">
              {(["account", "draft", "publish"] as const).map((step, i) => (
                <li key={step} className="border-border flex flex-col gap-1 border-t pt-4">
                  <span className="text-primary font-mono text-sm tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-semibold">{t(`steps.${step}.title`)}</span>
                  <span className="text-muted text-sm">{t(`steps.${step}.body`)}</span>
                </li>
              ))}
            </ol>
          </section>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button asChild size="lg">
              <a href={claim} data-testid="handoff-claim">
                {t("claim")}
              </a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href={signUp} data-testid="handoff-signup">
                {t("signUp")}
              </a>
            </Button>
            <DeclineHandoff token={token} />
          </div>
          <p className="text-muted m-0 flex items-start gap-2 text-sm">
            <Icon icon={IconCheckCircle} className="text-success-subtle-fg mt-0.5 shrink-0" />
            {t("free")}
          </p>
        </>
      ) : (
        <StatusPanel
          testId="handoff-closed"
          icon={handoff.state === "expired" ? IconClock : handoff.state === "declined" ? IconInfo : IconCheckCircle}
          tone={handoff.state === "accepted" || handoff.state === "listed" ? "success" : "neutral"}
          body={t(`closed.${handoff.state}.body`)}
          action={
            handoff.state === "accepted" || handoff.state === "listed" ? (
              <Button asChild>
                <a href={ownerHref("/listings/handoffs", locale)}>{t("closed.signIn")}</a>
              </Button>
            ) : (
              <Button asChild variant="secondary">
                <a href={getPathname({ href: "/landlords", locale })}>{t("notFound.action")}</a>
              </Button>
            )
          }
        />
      )}
    </Frame>
  );
}

/** The invitation's page: one reading column — label, the h1, then the invitation itself. */
function Frame({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-10 pb-16 sm:px-6 md:pt-14 md:pb-24">
      <div className="flex flex-col gap-3">
        <p className="text-muted m-0 text-sm font-medium">{kicker}</p>
        <h1 className="m-0 text-4xl text-balance" data-testid="handoff-title">
          {title}
        </h1>
      </div>
      {children}
    </div>
  );
}

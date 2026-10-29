import { getTranslations, setRequestLocale } from "next-intl/server";

import { DeclineHandoff } from "@/features/owner/marketing/handoff/DeclineHandoff";
import { publicHandoff } from "@/features/owner/marketing/handoff/publicHandoff";
import { ownerHref } from "@/features/owner/marketing/seo";
import { handoffPlace } from "@/features/shared/growth/handoff";
import { formatDate, formatDecimal } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Icon } from "@/ui/icons";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconHome } from "@/ui/icons/glyphs/home";

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
        <div data-testid="handoff-not-found">
          <Callout tone="warning">{t("notFound.body")}</Callout>
        </div>
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
        className="border-border bg-surface rounded-card flex flex-col gap-5 border p-5 md:p-6"
        data-testid="handoff-invitation"
        data-state={handoff.state}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="bg-primary-subtle text-primary-subtle-fg grid size-11 place-items-center rounded-full">
            <Icon icon={IconHome} />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="font-semibold">{facts.projectName ?? t(`kind.${facts.kind}`)}</span>
            <span className="text-muted text-sm">{handoffPlace(facts)}</span>
          </div>
          {open ? (
            <Badge tone="info" size="sm" className="ms-auto">
              {t("expires", { date: formatDate(handoff.expiresAt, locale) })}
            </Badge>
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
          <section aria-labelledby="handoff-steps" className="flex flex-col gap-3">
            <h2 id="handoff-steps" className="text-xl">
              {t("steps.title")}
            </h2>
            <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-3">
              {(["account", "draft", "publish"] as const).map((step, i) => (
                <li key={step} className="border-border bg-surface rounded-card flex flex-col gap-1 border p-4">
                  <span className="text-primary text-sm font-semibold tabular-nums">{i + 1}</span>
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
        <div data-testid="handoff-closed">
          <Callout
            tone={handoff.state === "expired" ? "warning" : "neutral"}
            action={
              handoff.state === "accepted" || handoff.state === "listed" ? (
                <Button asChild size="sm" variant="secondary">
                  <a href={ownerHref("/listings/handoffs", locale)}>{t("closed.signIn")}</a>
                </Button>
              ) : undefined
            }
          >
            {t(`closed.${handoff.state}.body`)}
          </Callout>
        </div>
      )}
    </Frame>
  );
}

function Frame({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface-subtle">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-10 pb-16">
        <div className="flex flex-col gap-2">
          <p className="text-primary text-sm font-semibold">{kicker}</p>
          <h1 className="text-display" data-testid="handoff-title">
            {title}
          </h1>
        </div>
        {children}
      </div>
    </section>
  );
}

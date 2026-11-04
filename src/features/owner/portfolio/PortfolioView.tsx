import { getTranslations } from "next-intl/server";

import { INVOICE_STATUS, type InvoiceStatus } from "@/domain/status/invoice";
import { LISTING_STATUS } from "@/domain/status/listing";
import { PORTFOLIO_UNIT_STATUS } from "@/domain/status/portfolioUnit";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDecimal, formatNumber, formatPeriodKey, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { StatsRow } from "@/ui/components/StatsRow";
import { isZeroDecimal } from "@/ui/lib/decimal";
import { Icon, type IconGlyph } from "@/ui/icons";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconDoor } from "@/ui/icons/glyphs/door";
import { IconFloor } from "@/ui/icons/glyphs/floor";
import { IconHome } from "@/ui/icons/glyphs/home";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconSign } from "@/ui/icons/glyphs/sign";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";
import { IconWrench } from "@/ui/icons/glyphs/wrench";

import { LinkMenu } from "@/features/shared/console/LinkMenu";
import { ownerPath } from "../shared/links";
import { ownerCan, section, type OwnerContext } from "../shared/server";

type Unit = Schemas["PortfolioUnitDto"];
type Kind = Schemas["PortfolioUnitKind"];

export const KIND_ICON: Record<Kind, IconGlyph> = {
  condo_unit: IconBuilding,
  house: IconHome,
  townhouse: IconFloor,
  room: IconDoor,
};

/**
 * The landlord's home (B7.1, F6.1, D-251): this month's rent at a glance, then every unit across projects as a
 * card — state, rent, lease end, this month's invoice and open repairs. Portfolio-first: a landlord thinks in
 * "my condo at Ari, my house in Nonthaburi", never in buildings and floors. Amounts are the API's strings.
 */
export async function PortfolioView({ context, welcome }: { context: OwnerContext; welcome: boolean }) {
  const t = await getTranslations("owner.portfolio");
  const { api, locale } = context;
  const [portfolio, requests] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/portfolio"))),
    section(unwrap(api.GET("/v1/owner/rent-certificates", { params: { query: { state: "requested" } } }))),
  ]);
  const addHref = ownerPath(locale, "/portfolio/new");
  const add = (
    <Button asChild iconStart={IconAdd} data-testid="portfolio-add">
      <a href={addHref}>{t("add")}</a>
    </Button>
  );

  return (
    <OwnerPage testId="portfolio">
      <PageHeader title={t("title")} description={t("description")} actions={add} />
      {welcome ? (
        <Callout tone="success" title={t("welcome.title")}>
          {t("welcome.body")}
        </Callout>
      ) : null}
      {!portfolio.data ? (
        <SectionError error={portfolio.error} />
      ) : portfolio.data.units.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={IconHome}
            title={t("empty.title")}
            description={t("empty.description")}
            action={
              <Button asChild size="lg" iconStart={IconAdd}>
                <a href={addHref}>{t("empty.action")}</a>
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <MonthSummary totals={portfolio.data.totals} units={portfolio.data.units} locale={locale} />
          <Tasks units={portfolio.data.units} waiting={requests.data?.length ?? 0} locale={locale} />
          <section aria-labelledby="portfolio-units" className="flex flex-col gap-4">
            <h2 id="portfolio-units" className="text-lg font-semibold">
              {t("units.title", { count: portfolio.data.units.length })}
            </h2>
            <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 xl:grid-cols-3" data-testid="portfolio-units">
              {portfolio.data.units.map((unit) => (
                <UnitCard
                  key={unit.unitId}
                  unit={unit}
                  locale={locale}
                  canInvite={context.me.menu.includes("mandates") && ownerCan(context.me, "tenant.grant.manage")}
                />
              ))}
            </ul>
          </section>
          {/* The year's income summary: a quiet download card, not a tile that looks like a task. */}
          <a
            href={ownerPath(locale, "/income")}
            className="border-border bg-surface rounded-card hover:border-border-strong flex items-center justify-between gap-4 border px-5 py-4 sm:max-w-md"
            data-testid="portfolio-income"
          >
            <span className="flex min-w-0 items-center gap-3">
              <Icon icon={IconBill} className="text-muted shrink-0 text-xl" />
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{t("paperwork.income")}</span>
                <span className="text-muted text-sm">{t("paperwork.incomeHint")}</span>
              </span>
            </span>
            <span className="text-primary shrink-0 text-sm font-medium">{t("paperwork.download")}</span>
          </a>
        </>
      )}
    </OwnerPage>
  );
}

/**
 * "Needs you" (Stitch revision): one list of what to do next — the units that are empty or whose end is decided, each
 * with its listing and enquiries (no empty months, D-261), and the rent certificates tenants asked for — every row
 * with one outlined action, never a filled button inside the list. Which leases are "ending" is the API's.
 */
async function Tasks({ units, waiting, locale }: { units: Unit[]; waiting: number; locale: Locale }) {
  const t = await getTranslations("owner.portfolio.vacancy");
  const p = await getTranslations("owner.portfolio");
  const rows = units.filter((unit) => unit.state === "vacant" || unit.state === "notice_given");
  if (!rows.length && !waiting) return null;
  const action =
    "text-primary border-border hover:border-border-strong rounded-control inline-flex h-9 items-center gap-1.5 border px-3 text-sm font-medium";
  return (
    <section aria-labelledby="portfolio-tasks" className="flex flex-col gap-3" data-testid="portfolio-vacancy">
      <h2 id="portfolio-tasks" className="text-lg font-semibold">
        {p("tasks.title")}
      </h2>
      <Card padding="none">
        <ul className="divide-border m-0 flex list-none flex-col divide-y p-0">
          {rows.map((unit) => {
            const listing = unit.listing;
            const live = listing && ["published", "pending_review", "paused", "draft"].includes(listing.state);
            const name = unit.kind === "house" || unit.kind === "townhouse" ? unit.building.name : unit.unitNo;
            return (
              <li
                key={unit.unitId}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                data-testid="vacancy-row"
                data-unit-no={unit.unitNo}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{name}</span>
                  <span className="text-muted text-sm">
                    {unit.state === "vacant"
                      ? unit.vacantSince
                        ? t("vacantSince", { date: formatDate(unit.vacantSince, locale) })
                        : t("vacant")
                      : t("endsOn", { date: unit.leaseEndDate ? formatDate(unit.leaseEndDate, locale) : "-" })}
                    {live ? (
                      <>
                        {" · "}
                        <span data-testid="vacancy-leads">{t("openLeads", { count: listing.openLeads })}</span>
                      </>
                    ) : null}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-3">
                  {live ? (
                    <>
                      <StatusBadgeOf map={LISTING_STATUS} value={listing.state} size="sm" />
                      <a className={action} href={ownerPath(locale, `/listings/${listing.id}`)}>
                        {t("openListing")}
                      </a>
                    </>
                  ) : listing ? (
                    <a
                      className={action}
                      href={ownerPath(locale, `/listings/${listing.id}`)}
                      data-testid="vacancy-relist"
                    >
                      {t("relist")}
                    </a>
                  ) : (
                    <a
                      className={action}
                      href={ownerPath(locale, `/listings/new?unit=${unit.unitId}`)}
                      data-testid="vacancy-list"
                    >
                      {unit.state === "vacant" ? t("list") : t("listEarly")}
                    </a>
                  )}
                </span>
              </li>
            );
          })}
          {waiting ? (
            <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{p("paperwork.certificates")}</span>
                <span className="text-muted text-sm">{p("tasks.certificatesBody")}</span>
              </span>
              <a className={action} href={ownerPath(locale, "/certificates")} data-testid="portfolio-certificates">
                {p("tasks.issue", { waiting: p("paperwork.waiting", { count: waiting }) })}
              </a>
            </li>
          ) : null}
        </ul>
      </Card>
    </section>
  );
}

async function MonthSummary({
  totals,
  units,
  locale,
}: {
  totals: Schemas["PortfolioTotalsDto"];
  units: Unit[];
  locale: Locale;
}) {
  const t = await getTranslations("owner.portfolio.summary");
  const leased = units.filter((unit) => unit.state !== "vacant").length;
  const month = formatPeriodKey(totals.month, locale);
  return (
    <div data-testid="portfolio-summary">
      <StatsRow
        label={t("label", { month })}
        highlight={isZeroDecimal(totals.overdue) ? undefined : "overdue"}
        figures={[
          { key: "expected", label: t("expected", { month }), value: formatTHB(totals.expected, locale) },
          {
            key: "collected",
            label: t("collected"),
            value: <span data-testid="portfolio-collected">{formatTHB(totals.collected, locale)}</span>,
          },
          { key: "overdue", label: t("overdue"), value: formatTHB(totals.overdue, locale), hint: t("overdueHint") },
          {
            key: "occupancy",
            label: t("occupancy"),
            value: t("occupancyValue", {
              leased: formatNumber(leased, locale),
              total: formatNumber(units.length, locale),
            }),
          },
        ]}
      />
    </div>
  );
}

async function UnitCard({ unit, locale, canInvite }: { unit: Unit; locale: Locale; canInvite: boolean }) {
  const t = await getTranslations("owner.portfolio.unit");
  const kind = unit.kind ?? "condo_unit";
  const isHouse = kind === "house" || kind === "townhouse";
  const title = isHouse ? unit.building.name : t("unitNo", { unitNo: unit.unitNo });
  const facts = [
    isHouse ? null : t(`kind.${kind}`),
    unit.areaSqm ? t("area", { area: formatDecimal(unit.areaSqm, locale) }) : null,
    unit.bedrooms != null ? t("bedrooms", { count: unit.bedrooms }) : null,
    unit.bathrooms != null ? t("bathrooms", { count: unit.bathrooms }) : null,
    unit.floorLabel ? t("floor", { floor: unit.floorLabel }) : null,
  ].filter(Boolean) as string[];

  return (
    <Card as="li" className="flex flex-col gap-4" data-testid="portfolio-unit" data-unit-no={unit.unitNo}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="bg-primary-subtle text-primary-subtle-fg rounded-control flex size-10 shrink-0 items-center justify-center">
            <Icon icon={KIND_ICON[kind]} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{title}</h3>
            <p className="text-muted truncate text-sm">{isHouse ? t(`kind.${kind}`) : unit.building.name}</p>
          </div>
        </div>
        <StatusBadgeOf map={PORTFOLIO_UNIT_STATUS} value={unit.state} size="sm" />
      </div>

      {facts.length ? (
        <p className="text-muted flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
        </p>
      ) : null}

      <dl className="border-border mt-auto grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 text-sm">
        <div>
          <dt className="text-muted">{t("rent")}</dt>
          <dd className="font-semibold tabular-nums">
            {unit.defaultRent ? t("perMonth", { amount: formatTHB(unit.defaultRent, locale) }) : t("rentNotSet")}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{t("lease")}</dt>
          <dd className="font-medium">
            {unit.leaseEndDate ? t("leaseUntil", { date: formatDate(unit.leaseEndDate, locale) }) : t("noLease")}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{t("invoice")}</dt>
          <dd className="flex flex-wrap items-center gap-2">
            {unit.invoice ? (
              <>
                <StatusBadgeOf map={INVOICE_STATUS} value={unit.invoice.status as InvoiceStatus} size="sm" />
                {unit.invoice.status !== "paid" ? (
                  <span className="tabular-nums">
                    {t("balance", { amount: formatTHB(unit.invoice.balance, locale) })}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-muted">{t("noInvoice")}</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{t("repairs")}</dt>
          <dd className="flex items-center gap-1.5">
            {unit.openServiceRequests > 0 ? (
              <Badge tone="warning" size="sm" icon={IconWrench}>
                {t("repairsOpen", { count: unit.openServiceRequests })}
              </Badge>
            ) : (
              <span className="text-muted">{t("repairsNone")}</span>
            )}
          </dd>
        </div>
      </dl>

      {unit.building.external ? <p className="text-muted text-xs">{t("external")}</p> : null}
      {/* One contextual action on the card (list an empty unit); the rest in one "⋯" menu. */}
      <div className="flex items-center justify-between gap-2">
        {unit.state === "vacant" ? (
          <Button asChild size="sm" variant="secondary" iconStart={IconMegaphone}>
            <a href={ownerPath(locale, `/listings/new?unit=${unit.unitId}`)} data-testid="portfolio-list-unit">
              {t("listIt")}
            </a>
          </Button>
        ) : (
          <span />
        )}
        <LinkMenu
          label={t("more", { name: title })}
          testId="portfolio-unit-menu"
          items={[
            ...(canInvite
              ? [
                  {
                    id: "invite",
                    label: t("inviteAgency"),
                    icon: IconSign,
                    href: ownerPath(locale, `/mandates?invite=${unit.unitId}`),
                    testId: "portfolio-invite-agency",
                  },
                ]
              : []),
            {
              id: "documents",
              label: t("documents"),
              icon: IconBill,
              href: ownerPath(locale, `/documents?unit=${unit.unitId}`),
              testId: "portfolio-documents",
            },
          ]}
        />
      </div>
    </Card>
  );
}

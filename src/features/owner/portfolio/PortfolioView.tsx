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
import { Stat } from "@/ui/components/Stat";
import { Icon, type IconGlyph } from "@/ui/icons";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconDoor } from "@/ui/icons/glyphs/door";
import { IconFloor } from "@/ui/icons/glyphs/floor";
import { IconHome } from "@/ui/icons/glyphs/home";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";
import { IconWrench } from "@/ui/icons/glyphs/wrench";

import { ownerPath } from "../shared/links";
import { section, type OwnerContext } from "../shared/server";

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
          <nav
            aria-label={t("paperwork.title")}
            className="grid gap-3 sm:grid-cols-2"
            data-testid="portfolio-paperwork"
          >
            <a
              href={ownerPath(locale, "/certificates")}
              className="border-border bg-surface rounded-card flex min-h-12 items-center justify-between gap-3 border p-4"
              data-testid="portfolio-certificates"
            >
              <span className="flex flex-col">
                <span className="font-medium">{t("paperwork.certificates")}</span>
                <span className="text-muted text-sm">{t("paperwork.certificatesHint")}</span>
              </span>
              {requests.data?.length ? (
                <Badge tone="warning" size="sm">
                  {t("paperwork.waiting", { count: requests.data.length })}
                </Badge>
              ) : null}
            </a>
            <a
              href={ownerPath(locale, "/income")}
              className="border-border bg-surface rounded-card flex min-h-12 items-center justify-between gap-3 border p-4"
              data-testid="portfolio-income"
            >
              <span className="flex flex-col">
                <span className="font-medium">{t("paperwork.income")}</span>
                <span className="text-muted text-sm">{t("paperwork.incomeHint")}</span>
              </span>
            </a>
          </nav>
          <Vacancy units={portfolio.data.units} locale={locale} />
          <section aria-labelledby="portfolio-units" className="flex flex-col gap-4">
            <h2 id="portfolio-units" className="text-lg font-semibold">
              {t("units.title", { count: portfolio.data.units.length })}
            </h2>
            <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 xl:grid-cols-3" data-testid="portfolio-units">
              {portfolio.data.units.map((unit) => (
                <UnitCard key={unit.unitId} unit={unit} locale={locale} />
              ))}
            </ul>
          </section>
        </>
      )}
    </OwnerPage>
  );
}

/**
 * No empty months (D-261): the units that are empty or whose end is decided, each with its listing and enquiries —
 * so the next tenancy starts before the last one ends. Which leases are "ending" is the API's: notice given.
 */
async function Vacancy({ units, locale }: { units: Unit[]; locale: Locale }) {
  const t = await getTranslations("owner.portfolio.vacancy");
  const rows = units.filter((unit) => unit.state === "vacant" || unit.state === "notice_given");
  if (!rows.length) return null;
  return (
    <section aria-labelledby="portfolio-vacancy" className="flex flex-col gap-3" data-testid="portfolio-vacancy">
      <div className="flex flex-col gap-1">
        <h2 id="portfolio-vacancy" className="text-lg font-semibold">
          {t("title", { count: rows.length })}
        </h2>
        <p className="text-muted text-sm">{t("description")}</p>
      </div>
      <Card padding="none">
        <ul className="divide-border m-0 flex list-none flex-col divide-y p-0">
          {rows.map((unit) => {
            const listing = unit.listing;
            const live = listing && ["published", "pending_review", "paused", "draft"].includes(listing.state);
            const name = unit.kind === "house" || unit.kind === "townhouse" ? unit.building.name : unit.unitNo;
            return (
              <li
                key={unit.unitId}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
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
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {live ? (
                    <>
                      <StatusBadgeOf map={LISTING_STATUS} value={listing.state} size="sm" />
                      <span className="text-muted text-sm" data-testid="vacancy-leads">
                        {t("openLeads", { count: listing.openLeads })}
                      </span>
                      <Button asChild size="sm" variant="secondary">
                        <a href={ownerPath(locale, `/listings/${listing.id}`)}>{t("openListing")}</a>
                      </Button>
                    </>
                  ) : listing ? (
                    <Button asChild size="sm" variant="secondary" iconStart={IconMegaphone}>
                      <a href={ownerPath(locale, `/listings/${listing.id}`)} data-testid="vacancy-relist">
                        {t("relist")}
                      </a>
                    </Button>
                  ) : (
                    <Button asChild size="sm" iconStart={IconMegaphone}>
                      <a href={ownerPath(locale, `/listings/new?unit=${unit.unitId}`)} data-testid="vacancy-list">
                        {unit.state === "vacant" ? t("list") : t("listEarly")}
                      </a>
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
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
    <section
      aria-label={t("label", { month })}
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      data-testid="portfolio-summary"
    >
      <Stat label={t("expected", { month })} value={formatTHB(totals.expected, locale)} />
      <Stat
        label={t("collected")}
        value={<span data-testid="portfolio-collected">{formatTHB(totals.collected, locale)}</span>}
      />
      <Stat label={t("overdue")} value={formatTHB(totals.overdue, locale)} hint={t("overdueHint")} />
      <Stat
        label={t("occupancy")}
        value={t("occupancyValue", { leased: formatNumber(leased, locale), total: formatNumber(units.length, locale) })}
      />
    </section>
  );
}

async function UnitCard({ unit, locale }: { unit: Unit; locale: Locale }) {
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
          <span className="bg-primary-subtle text-primary-subtle-fg flex size-10 shrink-0 items-center justify-center rounded-lg">
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
      <div className="flex flex-wrap gap-2">
        {unit.state === "vacant" ? (
          <Button asChild size="sm" variant="secondary" iconStart={IconMegaphone}>
            <a href={ownerPath(locale, `/listings/new?unit=${unit.unitId}`)} data-testid="portfolio-list-unit">
              {t("listIt")}
            </a>
          </Button>
        ) : null}
        <Button asChild size="sm" variant="ghost" iconStart={IconBill}>
          <a href={ownerPath(locale, `/documents?unit=${unit.unitId}`)} data-testid="portfolio-documents">
            {t("documents")}
          </a>
        </Button>
      </div>
    </Card>
  );
}

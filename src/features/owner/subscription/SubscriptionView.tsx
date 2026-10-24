import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { HAAS_STATUS } from "@/domain/status/haas";
import { PLATFORM_INVOICE_STATUS } from "@/domain/status/platformInvoice";
import { SITE_SURVEY_STATUS } from "@/domain/status/siteSurvey";
import { SUBSCRIPTION_STATUS } from "@/domain/status/subscription";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { PlatformInvoiceBody } from "@/features/shared/console/PlatformInvoiceBody";
import { PlatformInvoicePdfButton } from "@/features/shared/console/PlatformInvoicePdfButton";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatNumber, formatPeriodKey, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { Stat } from "@/ui/components/Stat";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconCpu } from "@/ui/icons/glyphs/cpu";
import { IconMeter } from "@/ui/icons/glyphs/meter";
import { IconRoom } from "@/ui/icons/glyphs/room";

import { ownerPath } from "../shared/links";
import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { StorageCard } from "./StorageCard";
import { UpgradeToSmart } from "./UpgradeAction";

/**
 * The subscription (F2 2.6, D-082, D-156): the plan and its state (trial end, past due, suspended →
 * read-only with what to do), what is counted today and this month's estimate, monthly usage, the
 * invoices from getproperty with their Thai QR and PDF, the platform hardware at the tenant's buildings,
 * and Starter → Smart through a site survey; storage against its allowance (D-276). Every figure is the API's.
 */
export async function SubscriptionView({
  context,
}: {
  context: OwnerContext;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.subscription");
  const kinds = await getTranslations("owner.subscription.hardwareKind");
  const { api, locale, me, buildings } = context;
  const [overview, usage, invoices, hardware, surveys, storage] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/subscription"))),
    section(unwrap(api.GET("/v1/owner/subscription/usage"))),
    section(unwrap(api.GET("/v1/owner/subscription/invoices"))),
    section(unwrap(api.GET("/v1/owner/subscription/hardware"))),
    section(unwrap(api.GET("/v1/owner/subscription/site-surveys"))),
    section(unwrap(api.GET("/v1/owner/storage"))),
  ]);
  const sub = overview.data?.subscription ?? null;
  const buildingName = (id: string | null) =>
    id ? (buildings.find((building) => building.id === id)?.name ?? id.slice(0, 8)) : "—";
  const canUpgrade =
    (overview.data?.nextActions.includes("upgrade") ?? false) &&
    ownerCan(me, "tenant.subscription.manage") &&
    !readOnly(me);

  return (
    <OwnerPage testId="subscription">
      <PageHeader
        title={t("title")}
        description={t("description")}
        status={sub ? <StatusBadgeOf map={SUBSCRIPTION_STATUS} value={sub.state} /> : undefined}
        actions={
          canUpgrade ? (
            <UpgradeToSmart buildings={buildings.map((building) => ({ id: building.id, name: building.name }))} />
          ) : null
        }
      />

      {sub?.readOnly || readOnly(me) ? (
        <Callout tone="danger" title={t("readOnly.title")}>
          <span data-testid="subscription-read-only">
            {t("readOnly.body", { count: overview.data?.openInvoices ?? 0 })}
          </span>
        </Callout>
      ) : sub?.state === "past_due" ? (
        <Callout tone="warning" title={t("pastDue.title")}>
          {t("pastDue.body", { date: sub.pastDueSince ? formatDate(sub.pastDueSince, locale) : "—" })}
        </Callout>
      ) : sub?.state === "trial" ? (
        <Callout tone="info" title={t("trial.title")}>
          {t("trial.body", { date: formatDate(sub.trialEndsAt, locale) })}
        </Callout>
      ) : null}

      {!overview.data ? (
        <SectionError error={overview.error} />
      ) : !sub ? (
        <Card>
          <EmptyState title={t("none")} description={t("noneHint")} />
        </Card>
      ) : (
        <>
          <Card as="section" aria-labelledby="sub-plan" data-testid="subscription-plan">
            <CardHeader title={<span id="sub-plan">{t("plan")}</span>} />
            <DescriptionList
              columns={3}
              items={[
                {
                  id: "plan",
                  term: t("planName"),
                  description: <span data-testid="plan-name">{sub.plan.nameTh}</span>,
                },
                {
                  id: "addons",
                  term: t("addons"),
                  description: sub.addons.length ? sub.addons.map((addon) => addon.nameTh).join(", ") : t("noAddons"),
                },
                { id: "period", term: t("billingPeriod"), description: t(`period.${sub.billingPeriod}`) },
                { id: "started", term: t("started"), description: formatDate(sub.startedAt, locale) },
                {
                  id: "trial",
                  term: t("trialEnds"),
                  description: sub.state === "trial" ? formatDate(sub.trialEndsAt, locale) : null,
                },
                {
                  id: "discount",
                  term: t("discount"),
                  description:
                    sub.discountPct !== "0" && sub.discountPct !== "0.00"
                      ? `${sub.discountPct} %${sub.discountReason ? ` · ${sub.discountReason}` : ""}`
                      : null,
                },
                { id: "pilot", term: t("pilot"), description: sub.pilotAgreementId ? t("pilotYes") : null },
                {
                  id: "cancel",
                  term: t("cancelAt"),
                  description: sub.cancelEffectiveDate ? formatDate(sub.cancelEffectiveDate, locale) : null,
                },
              ]}
            />
          </Card>
          {overview.data.usageToday ? (
            <section aria-labelledby="sub-today" className="flex flex-col gap-3" data-testid="usage-today">
              <h2 id="sub-today" className="text-lg font-semibold">
                {t("today")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat
                  icon={IconRoom}
                  label={t("units")}
                  value={<span data-testid="usage-units">{formatNumber(overview.data.usageToday.units, locale)}</span>}
                  hint={t("unitsHint")}
                />
                <Stat
                  icon={IconMeter}
                  label={t("meterPoints")}
                  value={formatNumber(overview.data.usageToday.meterPoints, locale)}
                />
                <Stat
                  icon={IconBuilding}
                  label={t("buildings")}
                  value={formatNumber(overview.data.usageToday.buildings, locale)}
                />
                <Stat
                  icon={IconCpu}
                  label={t("ocrImages")}
                  value={formatNumber(overview.data.usageToday.ocrImages, locale)}
                />
              </div>
            </section>
          ) : null}
          {overview.data.estimate ? (
            <Card as="section" aria-labelledby="sub-estimate" data-testid="estimate">
              <CardHeader title={<span id="sub-estimate">{t("estimate")}</span>} description={t("estimateHint")} />
              <SimpleTable
                caption={t("estimate")}
                minWidth="36rem"
                columns={[
                  { key: "description", header: t("col.description") },
                  { key: "quantity", header: t("col.quantity"), align: "end" },
                  { key: "price", header: t("col.unitPrice"), align: "end" },
                  { key: "amount", header: t("col.amount"), align: "end" },
                ]}
                rows={overview.data.estimate.lines.map((line, index) => ({
                  key: `${line.kind}-${index}`,
                  cells: {
                    description: line.description,
                    quantity: line.quantity,
                    price: formatTHB(line.unitPrice, locale),
                    amount: formatTHB(line.amount, locale),
                  },
                }))}
              />
              <p className="mt-3 text-sm">
                {t("estimateTotal", {
                  subtotal: formatTHB(overview.data.estimate.subtotal, locale),
                  vat: formatTHB(overview.data.estimate.vatAmount, locale),
                  total: formatTHB(overview.data.estimate.total, locale),
                })}
              </p>
            </Card>
          ) : null}
        </>
      )}

      <StorageCard storage={storage.data ?? null} error={storage.error} locale={locale} />

      <Card as="section" aria-labelledby="sub-invoices">
        <CardHeader title={<span id="sub-invoices">{t("invoices")}</span>} description={t("invoicesHint")} />
        {!invoices.data ? (
          <SectionError error={invoices.error} />
        ) : invoices.data.length === 0 ? (
          <EmptyState title={t("noInvoices")} />
        ) : (
          <SimpleTable
            caption={t("invoices")}
            testId="platform-invoices"
            minWidth="48rem"
            columns={[
              { key: "number", header: t("col.number") },
              { key: "period", header: t("col.period") },
              { key: "due", header: t("col.due") },
              { key: "total", header: t("col.total"), align: "end" },
              { key: "open", header: t("col.open"), align: "end" },
              { key: "state", header: t("col.state") },
            ]}
            rows={invoices.data.map((invoice) => ({
              key: invoice.id,
              testId: "platform-invoice-row",
              data: { number: invoice.number, state: invoice.state },
              tone: invoice.state === "overdue" ? "danger" : "default",
              cells: {
                number: (
                  <a
                    href={ownerPath(locale, `/subscription/invoices/${invoice.id}`)}
                    className="font-mono font-semibold hover:underline"
                  >
                    {invoice.number}
                  </a>
                ),
                period: `${formatDate(invoice.periodStart, locale)} – ${formatDate(invoice.periodEnd, locale)}`,
                due: formatDate(invoice.dueAt, locale),
                total: formatTHB(invoice.total, locale),
                open: formatTHB(invoice.openAmount, locale),
                state: <StatusBadgeOf map={PLATFORM_INVOICE_STATUS} value={invoice.state} size="sm" />,
              },
            }))}
          />
        )}
      </Card>

      <Card as="section" aria-labelledby="sub-usage">
        <CardHeader title={<span id="sub-usage">{t("usage")}</span>} description={t("usageHint")} />
        {!usage.data ? (
          <SectionError error={usage.error} />
        ) : usage.data.length === 0 ? (
          <EmptyState title={t("noUsage")} />
        ) : (
          <SimpleTable
            caption={t("usage")}
            testId="usage-months"
            minWidth="40rem"
            columns={[
              { key: "month", header: t("col.month") },
              { key: "units", header: t("units"), align: "end" },
              { key: "meters", header: t("meterPoints"), align: "end" },
              { key: "ocr", header: t("ocrImages"), align: "end" },
              { key: "amount", header: t("col.amount"), align: "end" },
            ]}
            rows={[...usage.data]
              .sort((a, b) => b.month.localeCompare(a.month))
              .map((month) => ({
                key: month.month,
                cells: {
                  month: formatPeriodKey(month.month.slice(0, 7), locale),
                  units: formatNumber(month.unitsCounted, locale),
                  meters: formatNumber(month.meterPointsCounted, locale),
                  ocr: formatNumber(month.ocrImages, locale),
                  amount: formatTHB(month.amountComputed, locale),
                },
              }))}
          />
        )}
      </Card>

      <Card as="section" aria-labelledby="sub-hardware" data-testid="hardware">
        <CardHeader title={<span id="sub-hardware">{t("hardware")}</span>} description={t("hardwareHint")} />
        {!hardware.data ? (
          <SectionError error={hardware.error} />
        ) : hardware.data.length === 0 ? (
          <EmptyState title={t("noHardware")} />
        ) : (
          <SimpleTable
            caption={t("hardware")}
            minWidth="44rem"
            columns={[
              { key: "device", header: t("col.device") },
              { key: "building", header: t("col.building") },
              { key: "installed", header: t("col.installed") },
              { key: "term", header: t("col.term") },
              { key: "monthly", header: t("col.monthly"), align: "end" },
              { key: "state", header: t("col.state") },
            ]}
            rows={hardware.data.map((asset) => ({
              key: asset.id,
              cells: {
                device: (
                  <span className="flex flex-col">
                    <span>{kinds.has(asset.kind) ? kinds(asset.kind) : asset.kind}</span>
                    <span className="text-muted font-mono text-xs">{asset.serial}</span>
                  </span>
                ),
                building: buildingName(asset.buildingId),
                installed: asset.installedOn ? formatDate(asset.installedOn, locale) : "—",
                term: asset.termEnd
                  ? t("termUntil", { months: asset.termMonths, date: formatDate(asset.termEnd, locale) })
                  : t("termMonths", { months: asset.termMonths }),
                monthly: formatTHB(asset.monthlyValue, locale),
                state: <StatusBadgeOf map={HAAS_STATUS} value={asset.state} size="sm" />,
              },
            }))}
          />
        )}
      </Card>

      <Card as="section" aria-labelledby="sub-surveys" data-testid="site-surveys">
        <CardHeader title={<span id="sub-surveys">{t("surveys")}</span>} description={t("surveysHint")} />
        {!surveys.data ? (
          <SectionError error={surveys.error} />
        ) : surveys.data.length === 0 ? (
          <p className="text-muted text-sm">{t("noSurveys")}</p>
        ) : (
          <SimpleTable
            caption={t("surveys")}
            testId="survey-table"
            minWidth="40rem"
            columns={[
              { key: "building", header: t("col.building") },
              { key: "requested", header: t("col.requested") },
              { key: "scheduled", header: t("col.scheduled") },
              { key: "state", header: t("col.state") },
            ]}
            rows={surveys.data.map((survey) => ({
              key: survey.id,
              testId: "survey-row",
              data: { state: survey.state },
              cells: {
                building: buildingName(survey.buildingId),
                requested: formatDateTime(survey.createdAt, locale),
                scheduled: survey.scheduledFor ? formatDateTime(survey.scheduledFor, locale) : "—",
                state: <StatusBadgeOf map={SITE_SURVEY_STATUS} value={survey.state} size="sm" />,
              },
            }))}
          />
        )}
      </Card>
    </OwnerPage>
  );
}

/** One invoice from getproperty (F2 2.6, D-146): lines, totals, the Thai QR while open, payments, PDF. */
export async function SubscriptionInvoice({ context, invoiceId }: { context: OwnerContext; invoiceId: string }) {
  const t = await getTranslations("owner.subscription");
  const { api, locale } = context;
  let invoice: Schemas["PlatformInvoiceDto"];
  try {
    invoice = await unwrap(api.GET("/v1/owner/subscription/invoices/{invoiceId}", { params: { path: { invoiceId } } }));
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 422)) notFound();
    throw error;
  }
  return (
    <OwnerPage testId="subscription-invoice">
      <PageHeader
        title={<span className="font-mono">{invoice.number}</span>}
        crumbs={[{ label: t("title"), href: ownerPath(locale, "/subscription") }, { label: invoice.number }]}
        description={t("invoiceFrom")}
        status={<StatusBadgeOf map={PLATFORM_INVOICE_STATUS} value={invoice.state} />}
        actions={invoice.documentId ? <PlatformInvoicePdfButton invoiceId={invoice.id} surface="owner" /> : null}
      />
      <PlatformInvoiceBody invoice={invoice} locale={locale} />
    </OwnerPage>
  );
}

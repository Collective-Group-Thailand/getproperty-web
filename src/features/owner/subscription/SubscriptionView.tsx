import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { CREDIT_NOTE_STATUS } from "@/domain/status/creditNote";
import { HAAS_STATUS } from "@/domain/status/haas";
import { PLATFORM_INVOICE_STATUS } from "@/domain/status/platformInvoice";
import { SITE_SURVEY_STATUS } from "@/domain/status/siteSurvey";
import { SUBSCRIPTION_STATUS } from "@/domain/status/subscription";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { QrImage } from "@/features/shared/console/QrImage";
import { PlatformInvoicePdfButton } from "@/features/shared/console/PlatformInvoicePdfButton";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatDecimal, formatNumber, formatPeriodKey, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Wordmark } from "@/ui/brand/Wordmark";
import { Callout } from "@/ui/components/Callout";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { Paper, PaperFoot, PaperParties, PaperSection } from "@/ui/components/Paper";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { Statement } from "@/ui/components/Statement";
import { StatsRow } from "@/ui/components/StatsRow";

import { ownerPath } from "../shared/links";
import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { StorageBanner } from "./StorageBanner";
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
    (id ? buildings.find((building) => building.id === id)?.name : undefined) ?? "—";
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

      <StorageBanner storage={storage.data ?? null} manageHref={ownerPath(locale, "/subscription/storage")} />

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
          <CardHeader title={t("none")} description={t("noneHint")} />
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
              <StatsRow
                label={t("today")}
                figures={[
                  {
                    key: "units",
                    label: t("units"),
                    value: (
                      <span data-testid="usage-units">{formatNumber(overview.data.usageToday.units, locale)}</span>
                    ),
                    hint: t("unitsHint"),
                  },
                  {
                    key: "meters",
                    label: t("meterPoints"),
                    value: formatNumber(overview.data.usageToday.meterPoints, locale),
                  },
                  {
                    key: "buildings",
                    label: t("buildings"),
                    value: formatNumber(overview.data.usageToday.buildings, locale),
                  },
                  {
                    key: "ocr",
                    label: t("ocrImages"),
                    value: formatNumber(overview.data.usageToday.ocrImages, locale),
                  },
                ]}
              />
            </section>
          ) : null}
          {overview.data.estimate ? (
            <Card as="section" aria-labelledby="sub-estimate" data-testid="estimate">
              <CardHeader title={<span id="sub-estimate">{t("estimate")}</span>} description={t("estimateHint")} />
              <Statement
                caption={t("estimate")}
                columns={[t("col.quantity"), t("col.unitPrice"), t("col.amount")]}
                lines={[
                  ...overview.data.estimate.lines.map((line, index) => ({
                    key: `${line.kind}-${index}`,
                    label: line.description,
                    values: [
                      formatDecimal(line.quantity, locale, 3),
                      formatTHB(line.unitPrice, locale),
                      formatTHB(line.amount, locale),
                    ],
                  })),
                  ...(overview.data.estimate.discount !== "0.00"
                    ? [
                        {
                          key: "discount",
                          label: t("discount"),
                          values: ["", "", formatTHB(`-${overview.data.estimate.discount}`, locale)],
                        },
                      ]
                    : []),
                  {
                    key: "subtotal",
                    label: t("beforeVat"),
                    kind: "subtotal" as const,
                    values: ["", "", formatTHB(overview.data.estimate.subtotal, locale)],
                  },
                  {
                    key: "vat",
                    label: t("vat"),
                    values: ["", "", formatTHB(overview.data.estimate.vatAmount, locale)],
                  },
                  {
                    key: "total",
                    label: t("estimateTotalLabel"),
                    kind: "result" as const,
                    values: ["", "", formatTHB(overview.data.estimate.total, locale)],
                    testId: "subscription-estimate-total",
                  },
                ]}
              />
            </Card>
          ) : null}
        </>
      )}

      <StorageCard
        storage={storage.data ?? null}
        error={storage.error}
        locale={locale}
        manageHref={ownerPath(locale, "/subscription/storage")}
      />

      <Card as="section" aria-labelledby="sub-invoices">
        <CardHeader title={<span id="sub-invoices">{t("invoices")}</span>} description={t("invoicesHint")} />
        {!invoices.data ? (
          <SectionError error={invoices.error} />
        ) : invoices.data.length === 0 ? (
          <p className="text-muted m-0 text-sm">{t("noInvoices")}</p>
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
              href: ownerPath(locale, `/subscription/invoices/${invoice.id}`),
              cells: {
                number: <span className="font-mono">{invoice.number}</span>,
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
          <p className="text-muted m-0 text-sm">{t("noUsage")}</p>
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
          <p className="text-muted m-0 text-sm">{t("noHardware")}</p>
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

/**
 * One invoice from getproperty (F2 2.6, D-146; G5) as paper: the wordmark, the number and dates, who it is billed to,
 * the lines as the API issued them and the totals as a statement (paid, credited and outstanding under the rule).
 * Beside it the outstanding amount with its due date, the Thai QR while it is open, and the PDF (the tax invoice).
 * The operator pays getproperty by QR: there is nothing to record here, so no filled button.
 */
export async function SubscriptionInvoice({ context, invoiceId }: { context: OwnerContext; invoiceId: string }) {
  const t = await getTranslations("owner.subscription");
  const p = await getTranslations("console.platformInvoice");
  const { api, locale } = context;
  let invoice: Schemas["PlatformInvoiceDto"];
  try {
    invoice = await unwrap(api.GET("/v1/owner/subscription/invoices/{invoiceId}", { params: { path: { invoiceId } } }));
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 422)) notFound();
    throw error;
  }
  const money = (value: string) => formatTHB(value, locale);
  const open = invoice.openAmount !== "0.00";
  return (
    <OwnerPage testId="subscription-invoice">
      <PageHeader
        title={<span className="font-mono">{invoice.number}</span>}
        crumbs={[{ label: t("title"), href: ownerPath(locale, "/subscription") }, { label: invoice.number }]}
        description={t("invoiceFrom")}
        status={<StatusBadgeOf map={PLATFORM_INVOICE_STATUS} value={invoice.state} />}
      />
      <DetailLayout
        panel={
          <ActionPanel
            title={open ? p("open") : p("paid")}
            description={
              open
                ? t("invoicePanel.due", { date: formatDate(invoice.dueAt, locale) })
                : invoice.payments[0]
                  ? t("invoicePanel.paidOn", { date: formatDate(invoice.payments[0].paidAt, locale) })
                  : undefined
            }
            facts={[
              {
                key: "amount",
                label: open ? p("open") : p("total"),
                value: (
                  <span className="text-2xl font-semibold" data-testid="pinv-open">
                    {money(open ? invoice.openAmount : invoice.total)}
                  </span>
                ),
              },
            ]}
            primary={
              invoice.qr ? (
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className="text-sm font-medium">{p("qrTitle")}</span>
                  <QrImage payload={invoice.qr.payload} label={p("qrAlt", { number: invoice.number })} />
                  <span className="text-muted text-sm">
                    {p("reference")}{" "}
                    <span className="text-fg font-mono" data-testid="pinv-reference">
                      {invoice.qr.reference}
                    </span>
                  </span>
                  {invoice.qr.expiresAt ? (
                    <span className="text-muted text-xs">
                      {p("qrExpires", { date: formatDateTime(invoice.qr.expiresAt, locale) })}
                    </span>
                  ) : null}
                </div>
              ) : undefined
            }
            secondary={
              invoice.documentId ? <PlatformInvoicePdfButton invoiceId={invoice.id} surface="owner" /> : undefined
            }
          />
        }
      >
        <Paper label={t("invoicePaper", { number: invoice.number })}>
          <header className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <Wordmark size="sm" />
            <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1.5 text-sm md:text-end">
              <dt className="text-muted">{t("col.number")}</dt>
              <dd className="m-0 font-mono font-medium">{invoice.number}</dd>
              <dt className="text-muted">{p("issued")}</dt>
              <dd className="m-0 font-medium tabular-nums">{formatDate(invoice.issuedAt, locale)}</dd>
              <dt className="text-muted">{p("due")}</dt>
              <dd className="m-0 font-medium tabular-nums">{formatDate(invoice.dueAt, locale)}</dd>
              <dt className="text-muted">{p("period")}</dt>
              <dd className="m-0 font-medium tabular-nums">
                {invoice.periodStart === invoice.periodEnd
                  ? formatDate(invoice.periodStart, locale)
                  : `${formatDate(invoice.periodStart, locale)} – ${formatDate(invoice.periodEnd, locale)}`}
              </dd>
            </dl>
          </header>
          <PaperParties items={[{ key: "to", label: t("billedTo"), value: invoice.tenantName }]} />
          <PaperSection title={p("lines")}>
            <Statement
              caption={p("lines")}
              columns={[p("col.quantity"), p("col.unitPrice"), p("col.amount")]}
              lines={[
                ...invoice.lines.map((line) => ({
                  key: String(line.lineNo),
                  label: line.description,
                  values: [formatDecimal(line.quantity, locale, 3), money(line.unitPrice), money(line.amount)],
                  testId: "pinv-line",
                })),
                {
                  key: "subtotal",
                  label: invoice.discount !== "0.00" ? p("subtotal") : t("beforeVat"),
                  kind: "subtotal" as const,
                  values: ["", "", money(invoice.subtotal)],
                },
                ...(invoice.discount !== "0.00"
                  ? [{ key: "discount", label: p("discount"), values: ["", "", money(`-${invoice.discount}`)] }]
                  : []),
                { key: "vat", label: p("vat"), values: ["", "", money(invoice.vatAmount)] },
                {
                  key: "total",
                  label: p("total"),
                  kind: "result" as const,
                  values: [
                    "",
                    "",
                    <span key="total" data-testid="pinv-total">
                      {money(invoice.total)}
                    </span>,
                  ],
                },
                ...(invoice.paidTotal !== "0.00"
                  ? [
                      {
                        key: "paid",
                        label: p("paid"),
                        level: 1 as const,
                        values: ["", "", money(`-${invoice.paidTotal}`)],
                      },
                    ]
                  : []),
                ...(invoice.creditedTotal !== "0.00"
                  ? [
                      {
                        key: "credited",
                        label: p("credited"),
                        level: 1 as const,
                        values: ["", "", money(`-${invoice.creditedTotal}`)],
                      },
                    ]
                  : []),
                {
                  key: "open",
                  label: p("open"),
                  kind: "subtotal" as const,
                  values: ["", "", money(invoice.openAmount)],
                },
              ]}
            />
          </PaperSection>
          {invoice.payments.length ? (
            <PaperSection title={p("payments")}>
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm" data-testid="pinv-payments">
                {invoice.payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex flex-wrap items-baseline justify-between gap-3"
                    data-testid="pinv-payment"
                  >
                    <span>
                      {formatDateTime(payment.paidAt, locale)} · {p(`method.${payment.method}`)}
                      {payment.receiptNumber ? (
                        <span className="text-muted font-mono"> · {payment.receiptNumber}</span>
                      ) : null}
                    </span>
                    <span className="tabular-nums">{money(payment.amount)}</span>
                  </li>
                ))}
              </ul>
            </PaperSection>
          ) : null}
          {invoice.creditNotes.length ? (
            <PaperSection title={p("creditNotes")}>
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
                {invoice.creditNotes.map((note) => (
                  <li key={note.id} className="flex flex-wrap items-baseline justify-between gap-3">
                    <span className="flex items-center gap-2">
                      {note.number ? <span className="font-mono">{note.number}</span> : p("notIssued")} · {note.reason}
                      <StatusBadgeOf map={CREDIT_NOTE_STATUS} value={note.state} size="sm" />
                    </span>
                    <span className="tabular-nums">{money(note.amount)}</span>
                  </li>
                ))}
              </ul>
            </PaperSection>
          ) : null}
          <PaperFoot>
            <span>{t("invoicesHint")}</span>
          </PaperFoot>
        </Paper>
      </DetailLayout>
    </OwnerPage>
  );
}

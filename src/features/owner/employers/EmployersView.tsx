import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { EMPLOYER_AGREEMENT_STATUS } from "@/domain/status";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { currentTime } from "@/features/shared/console/time";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatPercent, formatPeriodKey, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap, unwrapWithETag, type ApiClient } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconChevronLeft } from "@/ui/icons/glyphs/chevron-left";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";
import { IconResidents } from "@/ui/icons/glyphs/residents";
import { IconShield } from "@/ui/icons/glyphs/shield";

import { ContractsNav } from "../contracts/ContractsNav";
import { ownerPath } from "../shared/links";
import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { shiftMonth, statementMonth, workerRows } from "./employer";
import {
  EditAgreementButton,
  EndAgreementButton,
  NewAgreementButton,
  PayrollExportButton,
  WorkersEditor,
} from "./EmployerForms";

type Agreement = Schemas["EmployerAgreementDto"];

async function companies(api: ApiClient): Promise<{ id: string; name: string }[]> {
  const list = await section(
    unwrap(api.GET("/v1/owner/parties", { params: { query: { type: "company", perPage: 100 } } })),
  );
  return (list.data?.data ?? []).map((party) => ({ id: party.id, name: party.companyName ?? party.displayName }));
}

/**
 * Employer housing (G8, D-299): companies that pay for their workers' rooms. Each agreement names the employer (a
 * company among the tenant's people), optionally one building, how each invoice is split between the people staying
 * and how much the employer recovers through payroll. Invoices of attached leases are addressed to the employer.
 */
export async function EmployersView({ context, create }: { context: OwnerContext; create?: boolean }) {
  const t = await getTranslations("owner.network.employers");
  const { api, locale, me } = context;
  const canManage = !readOnly(me) && ownerCan(me, "lease.manage");
  const [agreements, employers] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/employer-agreements"))),
    canManage ? companies(api) : Promise.resolve([]),
  ]);
  const rows = agreements.data?.data ?? [];
  return (
    <OwnerPage testId="employers">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          canManage ? (
            <NewAgreementButton
              companies={employers}
              buildings={context.buildings.map((building) => ({ id: building.id, name: building.name }))}
              defaultOpen={create && employers.length > 0}
            />
          ) : undefined
        }
      />
      <ContractsNav current="/employers" locale={locale} />
      {canManage && employers.length === 0 ? (
        <Callout
          tone="info"
          title={t("noCompanyTitle")}
          action={
            <Button asChild size="sm" variant="secondary">
              <a href={ownerPath(locale, "/parties")}>{t("addCompany")}</a>
            </Button>
          }
        >
          {t("noCompanyBody")}
        </Callout>
      ) : null}
      {!agreements.data ? (
        <SectionError error={agreements.error} />
      ) : rows.length === 0 ? (
        <Card padding="lg">
          <EmptyState icon={IconResidents} title={t("empty.title")} description={t("empty.description")} />
        </Card>
      ) : (
        <ul className="m-0 grid list-none gap-4 p-0 lg:grid-cols-2" data-testid="employer-rows">
          {rows.map((agreement) => (
            <AgreementCard key={agreement.id} agreement={agreement} locale={locale} />
          ))}
        </ul>
      )}
      <p className="text-muted text-sm">{t("lawNote")}</p>
    </OwnerPage>
  );
}

async function AgreementCard({ agreement, locale }: { agreement: Agreement; locale: Locale }) {
  const t = await getTranslations("owner.network.employers");
  return (
    <Card
      as="li"
      interactive
      className="relative flex flex-col gap-3"
      data-testid="employer-row"
      data-state={agreement.state}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-base font-semibold">
            <a href={ownerPath(locale, `/employers/${agreement.id}`)} className="after:absolute after:inset-0">
              {agreement.employer.displayName}
            </a>
          </h2>
          <span className="text-muted text-sm">
            {[agreement.buildingName ?? t("anyBuilding"), agreement.reference].filter(Boolean).join(" · ")}
          </span>
        </div>
        <StatusBadgeOf map={EMPLOYER_AGREEMENT_STATUS} value={agreement.state} size="sm" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge size="sm">{t(`form.splitRule.${agreement.splitRule}`)}</Badge>
        <Badge size="sm" tone="info">
          {t("deductBadge", { percent: formatPercent(agreement.deductPercent, locale) })}
        </Badge>
      </div>
      <dl className="border-border m-0 grid grid-cols-3 gap-3 border-t pt-3 text-sm">
        <div>
          <dt className="text-muted">{t("leases")}</dt>
          <dd className="m-0 font-semibold tabular-nums">{agreement.leaseIds.length}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("workersLabel")}</dt>
          <dd className="m-0 font-semibold tabular-nums">{agreement.workers.length}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("since")}</dt>
          <dd className="m-0 font-semibold">{formatDate(agreement.validFrom, locale)}</dd>
        </div>
      </dl>
    </Card>
  );
}

/**
 * One employer agreement (G8): its terms (edit / end), the leases attached, the workers' payroll numbers, the month's
 * statement (each invoice split per worker, their deduction and what the employer carries — all API figures) with the
 * payroll CSV, and the TM30 notifications of these workers.
 */
export async function EmployerDetailView({
  context,
  agreementId,
  month: monthParam,
}: {
  context: OwnerContext;
  agreementId: string;
  month?: string;
}) {
  const t = await getTranslations("owner.network.employers");
  const { api, locale, me } = context;
  const path = { params: { path: { agreementId } } };
  let agreement: Agreement;
  let etag: string | null;
  try {
    ({ data: agreement, etag } = await unwrapWithETag(api.GET("/v1/owner/employer-agreements/{agreementId}", path)));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const month = statementMonth(monthParam, currentTime());
  const canManage = !readOnly(me) && ownerCan(me, "lease.manage");
  const [statement, leases] = await Promise.all([
    section(
      unwrap(
        api.GET("/v1/owner/employer-agreements/{agreementId}/statement", {
          params: { path: { agreementId }, query: { month } },
        }),
      ),
    ),
    Promise.all(
      agreement.leaseIds
        .slice(0, 50)
        .map((leaseId) =>
          unwrap(api.GET("/v1/owner/leases/{leaseId}", { params: { path: { leaseId } } })).catch(() => null),
        ),
    ),
  ]);
  const found = leases.filter((lease): lease is Schemas["LeaseDto"] => lease !== null);
  const names = new Map(
    (statement.data?.lines ?? []).flatMap((line) => line.shares.map((share) => [share.partyId, share.name] as const)),
  );
  const rows = workerRows(found, agreement.workers, names);
  const base = ownerPath(locale, `/employers/${agreement.id}`);
  const ended = agreement.state === "ended";

  return (
    <OwnerPage testId="employer-detail">
      <PageHeader
        title={agreement.employer.displayName}
        description={[agreement.buildingName ?? t("anyBuilding"), agreement.reference].filter(Boolean).join(" · ")}
        status={<StatusBadgeOf map={EMPLOYER_AGREEMENT_STATUS} value={agreement.state} />}
        crumbs={[
          { label: t("title"), href: ownerPath(locale, "/employers") },
          { label: agreement.employer.displayName },
        ]}
        actions={
          canManage && !ended ? (
            <>
              <EditAgreementButton agreement={agreement} etag={etag} />
              <EndAgreementButton agreement={agreement} etag={etag} />
            </>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card as="section" aria-labelledby="employer-terms" className="flex flex-col gap-4">
          <CardHeader title={<span id="employer-terms">{t("terms")}</span>} />
          <DescriptionList
            items={[
              { id: "split", term: t("form.split"), description: t(`form.splitRule.${agreement.splitRule}`) },
              {
                id: "deduct",
                term: t("form.deduct"),
                description: formatPercent(agreement.deductPercent, locale),
              },
              { id: "from", term: t("form.validFrom"), description: formatDate(agreement.validFrom, locale) },
              {
                id: "to",
                term: t("form.validTo"),
                description: agreement.validTo ? formatDate(agreement.validTo, locale) : t("open"),
              },
              {
                id: "format",
                term: t("format"),
                description:
                  agreement.payrollExportFormat === "generic_csv" ? t("genericCsv") : agreement.payrollExportFormat,
              },
              ...(agreement.endedAt
                ? [{ id: "ended", term: t("endedOn"), description: formatDate(agreement.endedAt, locale) }]
                : []),
            ]}
          />
          <p className="text-muted m-0 text-sm">{t(`form.splitHint.${agreement.splitRule}`)}</p>
        </Card>

        <Card as="section" aria-labelledby="employer-leases" className="flex flex-col gap-3">
          <CardHeader
            title={<span id="employer-leases">{t("leasesTitle", { count: agreement.leaseIds.length })}</span>}
            description={t("leasesHint")}
          />
          {found.length === 0 ? (
            <p className="text-muted m-0 text-sm">{t("noLeases")}</p>
          ) : (
            <ul className="divide-border m-0 list-none divide-y p-0" data-testid="employer-leases">
              {found.map((lease) => (
                <li key={lease.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <a
                    className="font-medium underline-offset-4 hover:underline"
                    href={ownerPath(locale, `/leases/${lease.id}`)}
                  >
                    {t("leaseLabel", { unit: lease.unitNo, name: lease.lesseeName ?? "—" })}
                  </a>
                  <span className="text-muted">{lease.buildingName}</span>
                </li>
              ))}
            </ul>
          )}
          {ownerCan(me, "tm30.manage") ? (
            <Button asChild size="sm" variant="secondary" iconStart={IconShield} className="self-start">
              <a href={`${ownerPath(locale, "/tm30")}?employer=${agreement.id}`} data-testid="employer-tm30">
                {t("tm30")}
              </a>
            </Button>
          ) : null}
        </Card>
      </div>

      <Card as="section" aria-labelledby="employer-workers-title" className="flex flex-col gap-3">
        <CardHeader
          title={<span id="employer-workers-title">{t("workersLabel")}</span>}
          description={t("workersHint")}
        />
        <WorkersEditor agreementId={agreement.id} rows={rows} canManage={canManage && !ended} />
      </Card>

      <Card
        as="section"
        aria-labelledby="employer-statement"
        className="flex flex-col gap-4"
        data-testid="employer-statement"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardHeader
            title={
              <span id="employer-statement">{t("statement.title", { month: formatPeriodKey(month, locale) })}</span>
            }
            description={t("statement.hint")}
          />
          <nav aria-label={t("statement.monthNav")} className="flex items-center gap-2">
            <Button asChild size="sm" variant="secondary" iconStart={IconChevronLeft}>
              <a href={`${base}?month=${shiftMonth(month, -1)}`} data-testid="statement-previous">
                {formatPeriodKey(shiftMonth(month, -1), locale)}
              </a>
            </Button>
            <Button asChild size="sm" variant="secondary" iconEnd={IconChevronRight}>
              <a href={`${base}?month=${shiftMonth(month, 1)}`} data-testid="statement-next">
                {formatPeriodKey(shiftMonth(month, 1), locale)}
              </a>
            </Button>
          </nav>
        </div>
        {!statement.data ? (
          <SectionError error={statement.error} />
        ) : (
          <Statement statement={statement.data} locale={locale} />
        )}
        {statement.data && statement.data.lines.length > 0 && canManage ? (
          <PayrollExportButton agreementId={agreement.id} month={month} />
        ) : null}
        <p className="text-muted m-0 text-xs">{t("lawNote")}</p>
      </Card>
    </OwnerPage>
  );
}

async function Statement({ statement, locale }: { statement: Schemas["EmployerStatementDto"]; locale: Locale }) {
  const t = await getTranslations("owner.network.employers.statement");
  if (statement.lines.length === 0) {
    return (
      <p className="text-muted m-0 text-sm" data-testid="statement-empty">
        {t("empty")}
      </p>
    );
  }
  const money = (value: string) => formatTHB(value, locale);
  return (
    <div className="flex flex-col gap-4">
      <dl className="m-0 grid grid-cols-2 gap-3 md:grid-cols-5" data-testid="statement-totals">
        {(
          [
            ["total", statement.total],
            ["paid", statement.paid],
            ["balance", statement.balance],
            ["deductions", statement.deductions],
            ["employerPays", statement.employerPays],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="bg-bg-subtle rounded-card flex flex-col gap-1 p-3">
            <dt className="text-muted text-xs">{t(`totals.${key}`)}</dt>
            <dd className="m-0 text-base font-semibold tabular-nums" data-testid={`statement-${key}`}>
              {money(value)}
            </dd>
          </div>
        ))}
      </dl>
      <ul className="m-0 flex list-none flex-col gap-3 p-0" data-testid="statement-lines">
        {statement.lines.map((line) => (
          <li key={line.invoiceId} className="border-border rounded-card border" data-testid="statement-line">
            <div className="border-border flex flex-wrap items-baseline justify-between gap-2 border-b px-3 py-2 text-sm">
              <span className="font-semibold">
                {line.number ?? t("draftNumber")} · {t("unit", { unit: line.unitNo })}
              </span>
              <span className="text-muted">
                {formatDate(line.periodStart, locale, { style: "dayMonth" })} – {formatDate(line.periodEnd, locale)}
              </span>
              <span className="tabular-nums">
                {money(line.total)}
                {line.balance !== "0.00" ? (
                  <span className="text-muted"> · {t("due", { amount: money(line.balance) })}</span>
                ) : null}
              </span>
            </div>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead className="text-muted text-start text-xs">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-start font-medium">
                      {t("worker")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-start font-medium">
                      {t("employeeNo")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-end font-medium">
                      {t("share")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-end font-medium">
                      {t("deduction")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-end font-medium">
                      {t("employerPays")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {line.shares.map((share) => (
                    <tr key={share.partyId} className="border-border border-t" data-testid="statement-share">
                      <td className="px-3 py-2">{share.name}</td>
                      <td className="text-muted px-3 py-2">{share.employeeNo ?? "—"}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{money(share.share)}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{money(share.deduction)}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{money(share.employerPays)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

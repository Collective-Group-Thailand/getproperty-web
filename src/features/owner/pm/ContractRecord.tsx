import { getTranslations } from "next-intl/server";

import { MANAGEMENT_CONTRACT_STATUS } from "@/domain/status";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { bangkokToday } from "@/features/shared/console/time";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatPeriodKey, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { EmptyState } from "@/ui/components/EmptyState";
import { FactGrid } from "@/ui/components/FactGrid";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusText } from "@/ui/components/StatusText";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconReceipt } from "@/ui/icons/glyphs/receipt";
import { IconStaff } from "@/ui/icons/glyphs/staff";

import { ownerPath } from "../shared/links";
import { readOnly, type OwnerContext } from "../shared/server";
import {
  AcceptContractButton,
  CancelContractButton,
  DeclineContractButton,
  OfferContractButton,
  TerminateContractButton,
  type ContractSide,
} from "./PmActions";
import { offerExpired } from "./pm";

type Contract = Schemas["ManagementContractDto"];

/** The fee per period in words: "฿85,600.00 ต่อเดือน รวม VAT ฿5,600.00". */
export async function feeLine(contract: Pick<Contract, "fee" | "feePeriod"> & { vatAmount?: string }, locale: Locale) {
  const t = await getTranslations("owner.pm.fee");
  if (contract.vatAmount === undefined)
    return t("lineIncl", { fee: formatTHB(contract.fee, locale), period: t(`per.${contract.feePeriod}`) });
  return t("line", {
    fee: formatTHB(contract.fee, locale),
    period: t(`per.${contract.feePeriod}`),
    vat: formatTHB(contract.vatAmount, locale),
  });
}

/**
 * One management contract, from either side (JW3b, D-334): the terms (fee in words, due day in arrears, term, scope),
 * the access the PM company holds on the building (a read grant on aggregates), the fees requested per ended period
 * (with the juristic office's expense request on its side), the PM staff assigned (juristic side). The panel carries
 * the caller's `nextActions`.
 */
export async function ContractRecordView({
  context,
  contract,
  side,
  charges,
  staff,
}: {
  context: OwnerContext;
  contract: Contract;
  side: ContractSide;
  charges: Schemas["ManagementFeeChargeDto"][] | null;
  staff: Schemas["PmStaffAssignmentDto"][] | null;
}) {
  const t = await getTranslations("owner.pm.contract");
  const roles = await getTranslations("owner.pm.role");
  const { locale, me } = context;
  const today = bangkokToday();
  const can = (action: string) => !readOnly(me) && contract.nextActions.includes(action);
  const expired = offerExpired(contract, today);
  const counterpart = side === "pm" ? contract.juristicName : contract.pmName;
  const fee = await feeLine(contract, locale);

  const facts = [
    { key: "counterpart", label: t(side === "pm" ? "fact.juristic" : "fact.pm"), value: counterpart },
    { key: "building", label: t("fact.building"), value: contract.buildingName },
    { key: "fee", label: t("fact.fee"), value: fee },
    { key: "due", label: t("fact.due"), value: t("fact.dueValue", { day: contract.dueDay }) },
    {
      key: "term",
      label: t("fact.term"),
      value: t("fact.termValue", {
        from: formatDate(contract.startsOn, locale),
        to: formatDate(contract.endsOn, locale),
      }),
    },
    { key: "fees", label: t("fact.feesRequested"), value: t("fact.feesValue", { count: contract.feesRequested }) },
  ];

  const primary = can("accept") ? (
    expired ? (
      <StatusText tone="warning" icon={IconAlert} testId="contract-offer-expired">
        {t("panel.expired", { date: formatDate(contract.startsOn, locale) })}
      </StatusText>
    ) : (
      <AcceptContractButton contract={contract} />
    )
  ) : can("offer") ? (
    <OfferContractButton contract={contract} />
  ) : undefined;
  const destructive = can("decline") ? (
    <DeclineContractButton contract={contract} />
  ) : can("cancel") ? (
    <CancelContractButton contract={contract} />
  ) : can("terminate") ? (
    <TerminateContractButton contract={contract} side={side} today={today} />
  ) : undefined;
  const ended = contract.terminatedOn
    ? t("panel.terminated", {
        date: formatDate(contract.terminatedOn, locale),
        by: t(`panel.by.${contract.terminatedBy ?? "juristic"}`),
      })
    : null;
  const panelBody =
    contract.state === "offered"
      ? side === "pm"
        ? expired
          ? t("panel.body.offeredExpired")
          : t("panel.body.offeredPm", { date: formatDate(contract.startsOn, locale) })
        : t("panel.body.offeredJuristic", { pm: contract.pmName })
      : contract.state === "draft"
        ? t("panel.body.draft")
        : contract.state === "active"
          ? t(side === "pm" ? "panel.body.activePm" : "panel.body.activeJuristic")
          : contract.state === "terminated"
            ? ended
            : t(`panel.body.${contract.state}`);
  const reason = contract.terminationReason ?? contract.declineReason ?? contract.cancelReason;

  return (
    <OwnerPage testId="management-contract">
      <PageHeader
        title={contract.title}
        status={<StatusBadgeOf map={MANAGEMENT_CONTRACT_STATUS} value={contract.state} />}
        description={t("lede", { building: contract.buildingName, counterpart })}
        back={{
          label: t(side === "pm" ? "backPm" : "backJuristic"),
          href: ownerPath(locale, side === "pm" ? "/portfolio/contracts" : "/juristic/management-contracts"),
        }}
      />
      <DetailLayout
        panel={
          <ActionPanel
            testId="contract-panel"
            title={t(`panel.title.${contract.state}`)}
            description={
              <div className="flex flex-col gap-2">
                <p className="m-0">{panelBody}</p>
                {contract.nextActions.length === 0 && ["offered", "active", "draft"].includes(contract.state) ? (
                  <p className="text-muted m-0 text-sm">{t("panel.readOnly")}</p>
                ) : null}
              </div>
            }
            primary={primary}
            destructive={destructive}
            secondary={
              side === "pm" && contract.state === "active" && contract.access.active ? (
                <a
                  className="text-primary text-sm font-medium underline-offset-4 hover:underline"
                  href={ownerPath(locale, `/portfolio/buildings/${contract.buildingId}`)}
                  data-testid="contract-to-building"
                >
                  {t("panel.toBuilding")}
                </a>
              ) : undefined
            }
          />
        }
      >
        <div className="flex flex-col gap-6">
          <Card as="section" aria-labelledby="contract-terms">
            <div className="flex flex-col gap-3">
              <h2 id="contract-terms" className="text-base font-semibold">
                {t("terms")}
              </h2>
              <FactGrid facts={facts} columns={3} label={t("terms")} />
            </div>
          </Card>
          {reason ? (
            <Callout tone="neutral" title={t("reasonTitle")} size="sm">
              <p className="m-0 whitespace-pre-line" data-testid="contract-reason">
                {reason}
              </p>
            </Callout>
          ) : null}
          {contract.scope ? (
            <Card as="section" aria-labelledby="contract-scope">
              <div className="flex flex-col gap-2">
                <h2 id="contract-scope" className="text-base font-semibold">
                  {t("scope")}
                </h2>
                <p className="m-0 max-w-[65ch] whitespace-pre-line">{contract.scope}</p>
              </div>
            </Card>
          ) : null}
          <Card as="section" aria-labelledby="contract-access" data-testid="contract-access">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="contract-access" className="text-base font-semibold">
                  {t("access.title")}
                </h2>
                {contract.access.active ? (
                  <Badge tone="success" icon={IconCheckCircle} size="sm">
                    {t("access.active")}
                  </Badge>
                ) : (
                  <Badge tone="neutral" icon={IconLock} size="sm">
                    {t("access.inactive")}
                  </Badge>
                )}
              </div>
              <p className="text-muted m-0 text-sm">{t(side === "pm" ? "access.bodyPm" : "access.bodyJuristic")}</p>
              {contract.access.validFrom ? (
                <p className="m-0 text-sm">
                  {contract.access.revokedAt
                    ? t("access.revoked", { date: formatDateTime(contract.access.revokedAt, locale) })
                    : t("access.window", {
                        from: formatDate(contract.access.validFrom, locale),
                        to: contract.access.validTo ? formatDate(contract.access.validTo, locale) : "—",
                      })}
                </p>
              ) : null}
            </div>
          </Card>
          {charges ? (
            <section aria-labelledby="contract-charges" className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <h2 id="contract-charges" className="text-lg font-semibold">
                  {t("charges.title")}
                </h2>
                <p className="text-muted m-0 text-sm">{t(side === "pm" ? "charges.ledePm" : "charges.ledeJuristic")}</p>
              </div>
              {charges.length === 0 ? (
                <EmptyState
                  variant="card"
                  icon={IconReceipt}
                  title={t("charges.empty")}
                  description={t("charges.emptyBody")}
                  action={
                    <a
                      className="text-primary font-medium underline-offset-4 hover:underline"
                      href={ownerPath(
                        locale,
                        side === "pm" ? `/portfolio/buildings/${contract.buildingId}` : "/juristic/expenses",
                      )}
                    >
                      {t(side === "pm" ? "charges.toBuilding" : "charges.toExpenses")}
                    </a>
                  }
                />
              ) : (
                <SimpleTable
                  caption={t("charges.title")}
                  testId="contract-charges"
                  stackOnPhones
                  minWidth="44rem"
                  columns={[
                    { key: "period", header: t("charges.col.period"), phone: "title" },
                    { key: "days", header: t("charges.col.days"), phone: "meta" },
                    { key: "amount", header: t("charges.col.amount"), align: "end", phone: "figure" },
                    { key: "due", header: t("charges.col.due"), phone: "meta" },
                    ...(side === "juristic"
                      ? [{ key: "request", header: t("charges.col.request"), phone: "status" as const }]
                      : []),
                  ]}
                  rows={charges.map((charge) => ({
                    key: charge.id,
                    testId: "contract-charge",
                    cells: {
                      period: formatPeriodKey(charge.periodKey, locale),
                      days:
                        charge.serviceDays === charge.periodDays ? (
                          <span className="text-muted text-sm">{t("charges.full")}</span>
                        ) : (
                          <span className="text-sm">
                            {t("charges.partial", { days: charge.serviceDays, of: charge.periodDays })}
                          </span>
                        ),
                      amount: (
                        <span className="flex flex-col items-end">
                          <span>{formatTHB(charge.amount, locale)}</span>
                          <span className="text-muted text-xs">
                            {t("charges.vat", { vat: formatTHB(charge.vatAmount, locale) })}
                          </span>
                        </span>
                      ),
                      due: <span className="whitespace-nowrap">{formatDate(charge.dueOn, locale)}</span>,
                      request: charge.expenseRequest ? (
                        <a
                          className="text-primary text-sm font-medium underline-offset-4 hover:underline"
                          href={ownerPath(locale, `/juristic/expenses/${charge.expenseRequest.id}`)}
                        >
                          {charge.expenseRequest.number ?? t("charges.request")}
                          <span className="text-muted ms-1 font-normal">
                            ·{" "}
                            {t.has(`charges.state.${charge.expenseRequest.state}`)
                              ? t(`charges.state.${charge.expenseRequest.state}` as "charges.state.paid")
                              : charge.expenseRequest.state}
                          </span>
                        </a>
                      ) : null,
                    },
                  }))}
                />
              )}
            </section>
          ) : null}
          {staff ? (
            <section aria-labelledby="contract-staff" className="flex flex-col gap-3">
              <h2 id="contract-staff" className="text-lg font-semibold">
                {t("staff.title")}
              </h2>
              {staff.length === 0 ? (
                <EmptyState
                  variant="card"
                  icon={IconStaff}
                  title={t("staff.empty")}
                  description={t("staff.emptyBody")}
                  action={
                    <a
                      className="text-primary font-medium underline-offset-4 hover:underline"
                      href={ownerPath(locale, "/juristic/management-contracts")}
                    >
                      {t("staff.toList")}
                    </a>
                  }
                />
              ) : (
                <SimpleTable
                  caption={t("staff.title")}
                  testId="contract-staff"
                  stackOnPhones
                  columns={[
                    { key: "name", header: t("staff.col.name"), phone: "title" },
                    { key: "role", header: t("staff.col.role"), phone: "meta" },
                    { key: "shift", header: t("staff.col.shift"), phone: "meta" },
                    { key: "dates", header: t("staff.col.dates"), phone: "meta" },
                  ]}
                  rows={staff.map((entry) => ({
                    key: entry.id,
                    cells: {
                      name: entry.displayName,
                      role: roles(entry.role),
                      shift: entry.shift ?? <span className="text-muted">—</span>,
                      dates: (
                        <span className="text-sm whitespace-nowrap">
                          {entry.endsOn
                            ? t("staff.range", {
                                from: formatDate(entry.startsOn, locale),
                                to: formatDate(entry.endsOn, locale),
                              })
                            : t("staff.since", { from: formatDate(entry.startsOn, locale) })}
                        </span>
                      ),
                    },
                  }))}
                />
              )}
            </section>
          ) : null}
        </div>
      </DetailLayout>
    </OwnerPage>
  );
}

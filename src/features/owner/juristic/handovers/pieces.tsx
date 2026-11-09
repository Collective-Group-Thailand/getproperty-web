import { useTranslations } from "next-intl";

import { formatDate, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { StatusText } from "@/ui/components/StatusText";
import { Icon } from "@/ui/icons";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconForward } from "@/ui/icons/glyphs/forward";
import { IconBank } from "@/ui/icons/glyphs/bank";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconInfo } from "@/ui/icons/glyphs/info";
import { cn } from "@/ui/lib/cn";

import { unitNoOf } from "./handover";

/*
 * Pieces of the handover review that render the same on the server and in Storybook (JW3b): the problems that block an
 * acceptance, the receiving account beside the office's account, the owners matched or new.
 */

/** The problems the developer must fix, one line each in words with the unit number — never a code or a ref. */
export function HandoverProblems({
  problems,
  units,
}: {
  problems: readonly Schemas["HandoverProblemDto"][];
  units: readonly Schemas["HandoverUnitDto"][];
}) {
  const t = useTranslations("owner.handovers.review.problems");
  if (problems.length === 0) return null;
  return (
    <Card as="section" aria-labelledby="handover-problems" data-testid="handover-problems">
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="border-border text-subtle grid size-9 shrink-0 place-items-center rounded-full border">
            <Icon icon={IconAlert} size={18} />
          </span>
          <div className="flex flex-col gap-0.5">
            <h2 id="handover-problems" className="text-base font-semibold">
              {t("title", { count: problems.length })}
            </h2>
            <p className="text-muted m-0 text-sm">{t("lede")}</p>
          </div>
        </div>
        <ul className="divide-border m-0 flex list-none flex-col divide-y p-0">
          {problems.map((problem, index) => {
            const unitNo = unitNoOf(units, problem.unitRef);
            return (
              <li
                key={`${problem.code}-${problem.unitRef ?? ""}-${index}`}
                className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-4"
                data-testid="handover-problem-row"
                data-code={problem.code}
              >
                <span className="w-28 shrink-0 font-mono text-sm">{unitNo ?? t("noUnit")}</span>
                <span className="text-sm">{t(`code.${problem.code}`)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

/**
 * Where the developer's money lands (masked, from the payload) beside the office's own account with the same bank and
 * last four digits — or a calm line that none matches yet (the journals then post to the operating bank role).
 */
export function ReceivingBank({
  bank,
  matched,
  bankAccountsHref,
}: {
  bank: Schemas["HandoverBankDto"] | null;
  matched: Schemas["BankAccountDto"] | null;
  bankAccountsHref: string | null;
}) {
  const t = useTranslations("owner.handovers.review.bank");
  return (
    <Card as="section" aria-labelledby="handover-bank" data-testid="handover-bank">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 id="handover-bank" className="text-base font-semibold">
            {t("title")}
          </h2>
          <p className="text-muted m-0 text-sm">{t("lede")}</p>
        </div>
        {!bank ? (
          <p className="text-muted m-0 flex items-center gap-2 text-sm" data-testid="handover-bank-none">
            <Icon icon={IconInfo} size={16} className="text-subtle shrink-0" />
            {t("none")}
          </p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
              <AccountBox
                caption={t("fromDeveloper")}
                bankName={bank.bankName ?? t("bankCode", { code: bank.bankCode })}
                name={bank.accountName}
                number={bank.accountNoMasked}
              />
              <span className="text-subtle hidden place-items-center md:grid" aria-hidden>
                <Icon icon={IconForward} size={18} />
              </span>
              {matched ? (
                <AccountBox
                  caption={t("office")}
                  bankName={matched.bankNameTh}
                  name={matched.accountName}
                  number={matched.accountNoMasked}
                  tone="matched"
                />
              ) : (
                <div className="border-border rounded-control flex flex-col justify-center gap-1 border border-dashed p-4 text-sm">
                  <span className="text-muted">{t("office")}</span>
                  <span>{t("noMatch")}</span>
                </div>
              )}
            </div>
            {bank.matchedBankAccountId ? (
              <StatusText tone="success" icon={IconCheckCircle} testId="handover-bank-matched">
                {t("matched")}
              </StatusText>
            ) : (
              <div className="flex flex-col gap-1" data-testid="handover-bank-unmatched">
                <StatusText tone="warning" icon={IconAlert}>
                  {t("unmatched")}
                </StatusText>
                {bankAccountsHref ? (
                  <a
                    href={bankAccountsHref}
                    className="text-primary ms-6 text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {t("addAccount")}
                  </a>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function AccountBox({
  caption,
  bankName,
  name,
  number,
  tone = "plain",
}: {
  caption: string;
  bankName: string;
  name: string;
  number: string;
  tone?: "plain" | "matched";
}) {
  return (
    <div
      className={cn(
        "rounded-control flex items-start gap-3 border p-4",
        tone === "matched" ? "border-border bg-primary-subtle" : "border-border",
      )}
    >
      <span className="border-border bg-surface text-subtle grid size-9 shrink-0 place-items-center rounded-full border">
        <Icon icon={IconBank} size={18} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5 text-sm">
        <span className="text-muted">{caption}</span>
        <span className="font-medium">{bankName}</span>
        <span className="truncate">{name}</span>
        <span className="font-mono tabular-nums">{number}</span>
      </div>
    </div>
  );
}

/** Owners in the payload: how many become new parties and how many join people already in the register. */
export function OwnerMatches({ create, attach }: { create: number; attach: number }) {
  const t = useTranslations("owner.handovers.review.owners");
  return (
    <Card as="section" aria-labelledby="handover-owners" data-testid="handover-owners">
      <div className="flex flex-col gap-3">
        <h2 id="handover-owners" className="text-base font-semibold">
          {t("title")}
        </h2>
        <dl className="m-0 grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted text-sm">{t("create")}</dt>
            <dd className="m-0 text-xl font-semibold tabular-nums" data-testid="handover-owners-create">
              {t("count", { count: create })}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted text-sm">{t("attach")}</dt>
            <dd className="m-0 text-xl font-semibold tabular-nums" data-testid="handover-owners-attach">
              {t("count", { count: attach })}
            </dd>
          </div>
        </dl>
        <p className="text-muted m-0 text-sm">{t("rule")}</p>
      </div>
    </Card>
  );
}

/** What an acceptance recorded, in ink, with one line saying it equals the payload (the API's invariant). */
export function AppliedCard({
  applied,
  matches,
  acceptedAt,
  locale,
}: {
  applied: Schemas["HandoverAppliedDto"];
  matches: boolean;
  acceptedAt: string | null;
  locale: Locale;
}) {
  const t = useTranslations("owner.handovers.review.applied");
  const rows = [
    { key: "credits", label: t("credits"), value: formatTHB(applied.credits, locale) },
    { key: "fund", label: t("fund"), value: formatTHB(applied.fundContributions, locale) },
    {
      key: "opening",
      label: t("opening", { count: applied.openingInvoices }),
      value: formatTHB(applied.openingInvoicesTotal, locale),
    },
  ];
  return (
    <Card as="section" aria-labelledby="handover-applied" data-testid="handover-applied">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="handover-applied" className="text-base font-semibold">
            {t("title")}
          </h2>
          {acceptedAt ? <span className="text-muted text-sm">{formatDate(acceptedAt, locale)}</span> : null}
        </div>
        <dl className="divide-border m-0 flex flex-col divide-y">
          {rows.map((row) => (
            <div key={row.key} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0">
              <dt className="text-muted text-sm">{row.label}</dt>
              <dd className="m-0 font-semibold tabular-nums" data-testid={`handover-applied-${row.key}`}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
        {matches ? (
          <Badge tone="success" icon={IconCheckCircle} className="self-start">
            {t("matches")}
          </Badge>
        ) : null}
      </div>
    </Card>
  );
}

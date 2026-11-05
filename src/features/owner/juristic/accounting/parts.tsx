import { getTranslations } from "next-intl/server";

import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { StatusText } from "@/ui/components/StatusText";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconWarning } from "@/ui/icons/glyphs/warning";

import { ownerPath } from "../../shared/links";
import { isZero } from "./money";

type Section = "statements" | "journals" | "accounts";

/** The three pages of the books (statements, the journal, the chart) as link tabs. */
export async function AccountingNav({ current, locale }: { current: Section; locale: Locale }) {
  const t = await getTranslations("owner.accounting.nav");
  const href: Record<Section, string> = {
    statements: ownerPath(locale, "/juristic/accounting"),
    journals: ownerPath(locale, "/juristic/accounting/journals"),
    accounts: ownerPath(locale, "/juristic/accounting/accounts"),
  };
  return (
    <LinkTabs
      label={t("books")}
      current={href[current]}
      tabs={(Object.keys(href) as Section[]).map((key) => ({
        href: href[key],
        label: t(key),
        testId: `accounting-tab-${key}`,
      }))}
    />
  );
}

/** Expense requests, their 50 ทวิ certificates and the approval / tax settings as link tabs. */
export async function ExpensesNav({
  current,
  locale,
}: {
  current: "expenses" | "certificates" | "settings";
  locale: Locale;
}) {
  const t = await getTranslations("owner.accounting.nav");
  const href = {
    expenses: ownerPath(locale, "/juristic/expenses"),
    certificates: ownerPath(locale, "/juristic/expenses/certificates"),
    settings: ownerPath(locale, "/juristic/expenses/settings"),
  };
  return (
    <LinkTabs
      label={t("expenses")}
      current={href[current]}
      tabs={[
        { href: href.expenses, label: t("expenses"), testId: "expenses-tab-requests" },
        { href: href.certificates, label: t("certificates"), testId: "expenses-tab-certificates" },
        { href: href.settings, label: t("expenseSettings"), testId: "expenses-tab-settings" },
      ]}
    />
  );
}

/** Funds and petty cash as link tabs (petty cash only for members who cannot read the books). */
export async function FundsNav({
  current,
  locale,
  funds,
}: {
  current: "funds" | "petty";
  locale: Locale;
  funds: boolean;
}) {
  const t = await getTranslations("owner.accounting.nav");
  const href = { funds: ownerPath(locale, "/juristic/funds"), petty: ownerPath(locale, "/juristic/petty-cash") };
  if (!funds) return null;
  return (
    <LinkTabs
      label={t("funds")}
      current={href[current]}
      tabs={[
        { href: href.funds, label: t("funds"), testId: "funds-tab-funds" },
        { href: href.petty, label: t("pettyCash"), testId: "funds-tab-petty" },
      ]}
    />
  );
}

/** A balance check in words: "ตรงกัน" with a check, or the difference as a warning (never red: nothing is owed). */
export async function CheckStatus({
  difference,
  locale,
  testId,
}: {
  difference: string;
  locale: Locale;
  testId?: string;
}) {
  const t = await getTranslations("owner.accounting.common");
  return isZero(difference) ? (
    <StatusText tone="success" icon={IconCheckCircle} testId={testId} state="match">
      {t("matches")}
    </StatusText>
  ) : (
    <StatusText tone="warning" icon={IconWarning} testId={testId} state="difference">
      {t("differs", { amount: formatTHB(difference, locale) })}
    </StatusText>
  );
}

/** A member's display name by user id (the API returns ids on approvals, transfers and floats). */
export function memberName(members: readonly Schemas["MemberDto"][], userId: string | null, fallback: string) {
  if (!userId) return fallback;
  return members.find((member) => member.userId === userId)?.displayName ?? fallback;
}

/** Where a journal came from, as a console link — only for documents the console has a page for. */
export function journalSourceHref(
  journal: Pick<Schemas["JournalDto"], "sourceType" | "sourceId" | "reversesJournalId">,
): string | null {
  const id = journal.sourceId;
  switch (journal.sourceType) {
    case "invoice":
    case "invoice_void":
      return id ? `/invoices/${id}` : null;
    case "payment":
    case "payment_reversal":
      return id ? `/payments/${id}` : null;
    case "expense_payment":
      return id ? `/juristic/expenses/${id}` : null;
    case "fund_transfer":
      return id ? `/juristic/funds/transfers/${id}` : null;
    case "petty_cash":
      return "/juristic/petty-cash";
    case "reversal":
      return journal.reversesJournalId ? `/juristic/accounting/journals/${journal.reversesJournalId}` : null;
    default:
      return null;
  }
}

/** A short, stable reference for a journal that has no number of its own: the date and the id's last six. */
export function journalRef(journal: Pick<Schemas["JournalDto"], "id" | "postedOn">): string {
  return `JV-${journal.postedOn.replace(/-/g, "").slice(2)}-${journal.id.replace(/-/g, "").slice(-4).toUpperCase()}`;
}

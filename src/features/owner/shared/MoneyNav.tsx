import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { LinkTabs } from "@/ui/components/LinkTabs";

import { ownerPath } from "./links";

const SECTIONS = {
  billing: ["/billing", "/invoices", "/billing/rate-plans"],
  payments: ["/payments", "/payments/slips", "/payments/new", "/payments/credits", "/arrears", "/documents"],
} as const;

const KEYS: Record<string, string> = {
  "/billing": "billing",
  "/invoices": "invoices",
  "/billing/rate-plans": "rates",
  "/payments": "payments",
  "/payments/slips": "slips",
  "/payments/new": "manual",
  "/payments/credits": "credits",
  "/arrears": "arrears",
  "/documents": "documents",
};

/**
 * The Money section's sub-pages as link tabs (F2 2.3/2.4): billing cycle · invoices · rate plans, and payments ·
 * slips · manual payment · credits & refunds · arrears · documents. Counts (slips to review) come from
 * the page that renders the tabs.
 */
export async function MoneyNav({
  section,
  current,
  locale,
  counts = {},
}: {
  section: keyof typeof SECTIONS;
  current: (typeof SECTIONS)[keyof typeof SECTIONS][number];
  locale: Locale;
  counts?: Partial<Record<string, number>>;
}) {
  const t = await getTranslations("owner.common.money");
  return (
    <LinkTabs
      label={t(`nav.${section}`)}
      current={ownerPath(locale, current)}
      tabs={SECTIONS[section].map((path) => ({
        href: ownerPath(locale, path),
        label: t(`tab.${KEYS[path]}`),
        count: counts[path],
        testId: `money-tab-${KEYS[path]}`,
      }))}
    />
  );
}

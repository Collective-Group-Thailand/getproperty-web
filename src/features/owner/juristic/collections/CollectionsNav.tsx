import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { LinkTabs } from "@/ui/components/LinkTabs";

import { ownerPath } from "../../shared/links";

/** The two settings pages of collection (the ladder, the payment rules) as link tabs. */
export async function CollectionsNav({ current, locale }: { current: "ladder" | "payments"; locale: Locale }) {
  const t = await getTranslations("owner.collections.nav");
  const href = {
    ladder: ownerPath(locale, "/juristic/collections/settings"),
    payments: ownerPath(locale, "/juristic/collections/payments"),
  };
  return (
    <LinkTabs
      label={t("ladder")}
      current={href[current]}
      tabs={[
        { href: href.ladder, label: t("ladder"), testId: "collections-tab-ladder" },
        { href: href.payments, label: t("paymentSettings"), testId: "collections-tab-payments" },
      ]}
    />
  );
}

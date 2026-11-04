import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { ViewTabs } from "@/ui/components/ListToolbar";

import { ownerPath } from "../shared/links";

type View = "/payments" | "/payments/slips" | "/payments/held";

/**
 * The views of "money in" (G3): every payment · slips waiting for a person · payments the API held (D-220). Counts
 * are the API's (`meta.total` / the held list); the other pages of the section (arrears, credits, documents) are in
 * the sidebar under the same entry.
 */
export async function PaymentsTabs({
  current,
  locale,
  slips,
  held,
}: {
  current: View;
  locale: Locale;
  slips: number | undefined;
  held: number | undefined;
}) {
  const t = await getTranslations("owner.common.money");
  return (
    <ViewTabs
      label={t("nav.payments")}
      current={current}
      tabs={[
        {
          key: "/payments",
          href: ownerPath(locale, "/payments"),
          label: t("tab.payments"),
          testId: "money-tab-payments",
        },
        {
          key: "/payments/slips",
          href: ownerPath(locale, "/payments/slips"),
          label: t("tab.slips"),
          count: slips,
          testId: "money-tab-slips",
        },
        {
          key: "/payments/held",
          href: ownerPath(locale, "/payments/held"),
          label: t("tab.held"),
          count: held,
          testId: "money-tab-held",
        },
      ]}
    />
  );
}

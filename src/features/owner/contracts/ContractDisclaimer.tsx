import { useTranslations } from "next-intl";

import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { IconShield } from "@/ui/icons/glyphs/shield";

/**
 * The library disclaimer (D-290, D-294, O-025): the API's text (`contract.library.disclaimer`, edited by the platform
 * admin) in the console's language, shown with every draft and contract — never replaced by copy of our own.
 */
export function ContractDisclaimer({
  disclaimer,
  locale,
  className,
}: {
  disclaimer: Schemas["DisclaimerDto"];
  locale: string;
  className?: string;
}) {
  const t = useTranslations("owner.contracts");
  return (
    <div data-testid="contract-disclaimer" className={className}>
      <Callout tone="neutral" icon={IconShield} title={t("disclaimerTitle")}>
        {locale === "en" ? disclaimer.en : disclaimer.th}
      </Callout>
    </div>
  );
}

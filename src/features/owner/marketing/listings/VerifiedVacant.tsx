import { getTranslations } from "next-intl/server";

import { formatDate } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { Badge } from "@/ui/components/Badge";
import { IconCalendarCheck } from "@/ui/icons/glyphs/calendar-check";

/**
 * "ว่างจริง" (G4, D-296): getproperty's own lease records show nobody lives there and the last lease on the platform
 * ended — never the owner's say-so. With `explain` the page says where the badge comes from.
 */
export async function VerifiedVacantBadge({
  since,
  locale,
  explain = false,
  testId = "listing-vacant",
}: {
  since: string | null;
  locale: Locale;
  explain?: boolean;
  testId?: string;
}) {
  const t = await getTranslations("owner.marketing.listings.vacant");
  return (
    <span className="flex flex-col items-start gap-1" data-testid={testId}>
      <Badge tone="success" icon={IconCalendarCheck} size="sm">
        {since ? t("since", { date: formatDate(since, locale) }) : t("badge")}
      </Badge>
      {explain ? <span className="text-muted text-sm">{t("explain")}</span> : null}
    </span>
  );
}

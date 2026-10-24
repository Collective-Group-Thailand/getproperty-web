import { getTranslations } from "next-intl/server";

import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { Icon } from "@/ui/icons";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconHome } from "@/ui/icons/glyphs/home";

/** A static sample of the landlord's portfolio-first home (blueprint D2 #1), labelled as a sample; nothing computed. */
const UNITS = [
  { key: "a", icon: IconBuilding, rent: "15000.00", tone: "success" },
  { key: "b", icon: IconHome, rent: "18500.00", tone: "info" },
  { key: "c", icon: IconBuilding, rent: "12000.00", tone: "neutral" },
  { key: "d", icon: IconHome, rent: null, tone: "neutral" },
] as const;

export async function LandlordPreview({ locale }: { locale: Locale }) {
  const t = await getTranslations("owner.marketing.landlords.preview");
  return (
    <figure className="m-0" aria-label={t("label")}>
      <Card padding="none" className="shadow-raised overflow-hidden">
        <div className="border-border border-b px-5 py-4">
          <p className="text-muted text-xs">{t("title")}</p>
          <p className="text-muted mt-2 text-sm">{t("summary")}</p>
          <p className="font-mono text-3xl font-semibold tabular-nums">{formatTHB("45500.00", locale)}</p>
        </div>
        <ul className="m-0 list-none px-5 py-1">
          {UNITS.map((unit) => (
            <li key={unit.key} className="border-border flex items-center gap-3 border-b py-3 last:border-b-0">
              <span className="bg-primary-subtle text-primary-subtle-fg rounded-control grid size-9 shrink-0 place-items-center">
                <Icon icon={unit.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{t(`units.${unit.key}.name`)}</span>
                <Badge size="sm" tone={unit.tone} className="mt-1">
                  {t(`units.${unit.key}.status`)}
                </Badge>
              </span>
              {unit.rent ? (
                <span className="text-sm font-semibold tabular-nums">{formatTHB(unit.rent, locale)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
    </figure>
  );
}

import { getTranslations } from "next-intl/server";

import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { Icon, type IconGlyph } from "@/ui/icons";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconElectric } from "@/ui/icons/glyphs/electric";
import { IconWarning } from "@/ui/icons/glyphs/warning";

/*
 * A static picture of the owner's morning (the hero's product shot): sample figures, labelled as a sample, so the
 * landing page shows what the product does without a screenshot that goes stale. Money is formatted from decimal
 * strings like everywhere else; nothing here is computed.
 */
const SAMPLE = { paid: "4850.00" } as const;

function Row({
  icon,
  tone,
  title,
  body,
  trailing,
}: {
  icon: IconGlyph;
  tone: "warning" | "success";
  title: string;
  body: string;
  trailing: string;
}) {
  const toneClass =
    tone === "warning" ? "bg-primary-subtle text-primary-subtle-fg" : "bg-success-subtle text-success-subtle-fg";
  return (
    <li className="border-border flex items-center gap-3 border-b py-3 last:border-b-0">
      <span className={`rounded-control grid size-9 shrink-0 place-items-center ${toneClass}`}>
        <Icon icon={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="text-muted block text-xs">{body}</span>
      </span>
      <span className="text-primary text-sm font-semibold">{trailing}</span>
    </li>
  );
}

export async function ProductPreview({ locale }: { locale: Locale }) {
  const t = await getTranslations("owner.marketing.preview");
  return (
    <figure className="relative m-0" aria-label={t("label")}>
      <Card padding="none" className="shadow-raised overflow-hidden">
        <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
          <div>
            <p className="text-muted text-xs">{t("cycle")}</p>
            <p className="font-semibold">{t("building")}</p>
          </div>
          <Badge size="sm" tone="success">
            {t("readings")}
          </Badge>
        </div>
        <dl className="border-border grid grid-cols-3 border-b">
          {(
            [
              ["paid", "41", "text-success-subtle-fg"],
              ["pending", "5", "text-fg"],
              ["decide", "2", "text-primary"],
            ] as const
          ).map(([key, value, tone]) => (
            <div key={key} className="border-border border-e px-5 py-3 last:border-e-0">
              <dt className="text-muted text-xs">{t(key)}</dt>
              <dd className={`m-0 font-mono text-2xl font-semibold tabular-nums ${tone}`}>{value}</dd>
            </div>
          ))}
        </dl>
        <ul className="m-0 list-none px-5 py-1">
          <Row icon={IconWarning} tone="warning" title={t("spikeTitle")} body={t("spikeBody")} trailing={t("review")} />
          <Row icon={IconElectric} tone="warning" title={t("rateTitle")} body={t("rateBody")} trailing={t("view")} />
          <Row
            icon={IconCheck}
            tone="success"
            title={t("paidTitle", { amount: formatTHB(SAMPLE.paid, locale) })}
            body={t("paidBody")}
            trailing="09:12"
          />
        </ul>
      </Card>
    </figure>
  );
}

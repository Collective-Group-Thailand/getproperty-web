import { getTranslations } from "next-intl/server";

import { formatPeriodKey, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { Mark } from "@/ui/brand";
import { Icon } from "@/ui/icons";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconQr } from "@/ui/icons/glyphs/qr";
import { cn } from "@/ui/lib/cn";

/** The one sample amount of the illustration — labelled as an example on the card itself, never a business figure. */
const SAMPLE_TOTAL = "5966.40";

function currentPeriodKey(): string {
  const now = new Date(Date.now() + 7 * 3_600_000); // Asia/Bangkok
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * A clearly illustrative product moment (redesign G1, Stitch revision): the bill a resident receives in LINE — month,
 * room, one total, a QR to pay — drawn as a small chat message. Used over the home hero photograph and in the sign-in
 * frame's panel. It carries an "example" caption, so it never reads as a claim about real buildings.
 */
export async function BillMessage({ locale, className }: { locale: Locale; className?: string }) {
  const t = await getTranslations("owner.marketing.billMessage");
  return (
    <figure
      className={cn(
        "bg-surface border-border rounded-panel shadow-overlay m-0 flex w-full max-w-[18rem] flex-col gap-3 border p-3",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-1">
        <span className="bg-primary-subtle grid size-7 shrink-0 place-items-center rounded-full">
          <Mark size={16} decorative />
        </span>
        <span className="text-muted min-w-0 truncate text-xs font-medium">{t("channel")}</span>
      </div>
      <div className="bg-bg border-border rounded-card flex flex-col gap-3 border p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-primary text-sm font-semibold">
              {t("title", { month: formatPeriodKey(currentPeriodKey(), locale) })}
            </span>
            <span className="text-sm font-medium">{t("room")}</span>
            <span className="text-muted text-xs">{t("lines")}</span>
          </div>
          <span className="bg-surface border-border rounded-thumb grid size-10 shrink-0 place-items-center border text-xl">
            <Icon icon={IconQr} />
          </span>
        </div>
        <div className="border-border flex items-baseline justify-between gap-3 border-t pt-2.5">
          <span className="text-muted text-xs">{t("total")}</span>
          <span className="font-semibold tabular-nums">{formatTHB(SAMPLE_TOTAL, locale)}</span>
        </div>
        <span className="bg-primary-subtle text-primary-subtle-fg rounded-control flex h-9 items-center justify-center text-sm font-semibold">
          {t("pay")}
        </span>
      </div>
      <figcaption className="text-muted px-1 text-xs">{t("example")}</figcaption>
    </figure>
  );
}

/** The sign-in frame's right panel: the bill message and three outcomes in plain words. */
export async function AuthShowcase({ locale }: { locale: Locale }) {
  const t = await getTranslations("owner.marketing.billMessage.points");
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-10">
      <BillMessage locale={locale} className="max-w-[20rem]" />
      <ul className="m-0 flex w-full list-none flex-col gap-3 p-0">
        {(["issue", "pay", "receipt"] as const).map((key) => (
          <li key={key} className="flex items-center gap-3">
            <span className="bg-primary-subtle text-primary-subtle-fg rounded-thumb grid size-6 shrink-0 place-items-center text-sm">
              <Icon icon={IconCheck} />
            </span>
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

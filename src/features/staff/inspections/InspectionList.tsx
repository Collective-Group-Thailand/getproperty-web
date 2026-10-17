import { getLocale, getTranslations } from "next-intl/server";

import { formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { BigActionButton } from "@/ui/components/BigActionButton";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconCamera } from "@/ui/icons/glyphs/camera";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconChecklist } from "@/ui/icons/glyphs/checklist";

const OPEN = new Set<Schemas["InspectionStatus"]>(["scheduled", "in_progress"]);

/** Inspections of my buildings (F4 4.2): to do first (move-outs appear when a lease ends, D-023), then done. */
export async function InspectionList({ inspections }: { inspections: Schemas["InspectionDto"][] }) {
  const t = await getTranslations("staff.inspections");
  const locale = (await getLocale()) as Locale;
  const open = inspections.filter((inspection) => OPEN.has(inspection.status));
  const done = inspections.filter((inspection) => !OPEN.has(inspection.status)).slice(0, 10);
  const describe = (inspection: Schemas["InspectionDto"]) =>
    [
      t(`statusWord.${inspection.status}`),
      inspection.scheduledFor ? formatDateTime(inspection.scheduledFor, locale) : null,
      inspection.reportNumber,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="flex flex-col gap-6 py-6" data-testid="inspection-list">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <section aria-labelledby="inspections-open" className="flex flex-col gap-3">
        <h2 id="inspections-open" className="text-lg font-semibold">
          {t("open")}
        </h2>
        {open.length === 0 ? (
          <EmptyState icon={IconCheckCircle} title={t("noneOpen")} description={t("noneOpenHint")} />
        ) : (
          <ul className="flex flex-col gap-3">
            {open.map((inspection) => (
              <li key={inspection.id}>
                <BigActionButton
                  href={`/inspections/${inspection.id}`}
                  icon={IconCamera}
                  title={t("heading", { unit: inspection.unitNo, type: inspection.type })}
                  description={describe(inspection)}
                  data-testid="inspection-open"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      {done.length > 0 ? (
        <section aria-labelledby="inspections-done" className="flex flex-col gap-3">
          <h2 id="inspections-done" className="text-lg font-semibold">
            {t("done")}
          </h2>
          <ul className="flex flex-col gap-3">
            {done.map((inspection) => (
              <li key={inspection.id}>
                <BigActionButton
                  href={`/inspections/${inspection.id}`}
                  icon={IconChecklist}
                  title={t("heading", { unit: inspection.unitNo, type: inspection.type })}
                  description={describe(inspection)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

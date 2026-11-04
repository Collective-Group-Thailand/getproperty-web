import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { INSPECTION_STATUS } from "@/domain/status/inspection";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";

import { StaffList, StaffSection } from "../shell/StaffList";

const OPEN = new Set<Schemas["InspectionStatus"]>(["scheduled", "in_progress"]);

/**
 * Inspections of my buildings (F4 4.2; redesign G7): to do first (move-outs appear when a lease ends, D-023), then the
 * last ten done — one card each, a row per room that opens its checklist; a signed report shows its number, muted.
 */
export async function InspectionList({ inspections }: { inspections: Schemas["InspectionDto"][] }) {
  const t = await getTranslations("staff.inspections");
  const locale = (await getLocale()) as Locale;
  const open = inspections.filter((inspection) => OPEN.has(inspection.status));
  const done = inspections.filter((inspection) => !OPEN.has(inspection.status)).slice(0, 10);
  const row = (inspection: Schemas["InspectionDto"]) => ({
    key: inspection.id,
    href: `/inspections/${inspection.id}`,
    lead: inspection.reportNumber ?? undefined,
    title: t("heading", { unit: inspection.unitNo, type: inspection.type }),
    meta: inspection.completedAt
      ? t("completedAt", { at: formatDateTime(inspection.completedAt, locale) })
      : inspection.scheduledFor
        ? t("scheduledFor", { at: formatDateTime(inspection.scheduledFor, locale) })
        : undefined,
    status: <StatusBadgeOf map={INSPECTION_STATUS} value={inspection.status} size="sm" />,
    testId: OPEN.has(inspection.status) ? "inspection-open" : "inspection-done",
  });

  return (
    <div className="flex flex-col gap-8 py-6" data-testid="inspection-list">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted">{t("lede")}</p>
      </header>
      <StaffSection id="inspections-open" title={t("open")} count={open.length}>
        {open.length === 0 ? (
          <EmptyState
            variant="card"
            icon={IconCheckCircle}
            title={t("noneOpen")}
            description={t("noneOpenHint")}
            action={
              <Button asChild variant="secondary" size="lg">
                <Link href="/">{t("backToday")}</Link>
              </Button>
            }
          />
        ) : (
          <StaffList label={t("open")} groups={[{ key: "open", rows: open.map(row) }]} />
        )}
      </StaffSection>
      {done.length > 0 ? (
        <StaffSection id="inspections-done" title={t("done")}>
          <StaffList label={t("done")} groups={[{ key: "done", rows: done.map(row) }]} />
        </StaffSection>
      ) : null}
    </div>
  );
}

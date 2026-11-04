import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { ReadingRound } from "@/features/staff/readings/ReadingRound";
import { staffScope } from "@/features/staff/shared/server";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ErrorState } from "@/ui/components/ErrorState";
import { IconMeter } from "@/ui/icons/glyphs/meter";

export async function generateMetadata() {
  const t = await getTranslations("staff.readings");
  return { title: t("title") };
}

/**
 * The reading round of the focused building (F4 4.1 §2, `GET /v1/staff/reading-rounds/current`); the building is
 * switched in the top bar.
 */
export default async function StaffReadings() {
  const scope = await staffScope();
  const t = await getTranslations("staff.readings");
  const round = scope.rounds?.find((candidate) => candidate.buildingId === scope.buildingId);
  return scope.rounds === null ? (
    <div className="py-6">
      <ErrorState title={t("unavailableTitle")} description={t("unavailable")} />
    </div>
  ) : round ? (
    <ReadingRound round={round} />
  ) : (
    <div className="py-6">
      <EmptyState
        variant="card"
        icon={IconMeter}
        title={t("noRound")}
        description={t("noRoundHint")}
        action={
          <Button asChild variant="secondary" size="lg">
            <Link href="/">{t("backToday")}</Link>
          </Button>
        }
      />
    </div>
  );
}

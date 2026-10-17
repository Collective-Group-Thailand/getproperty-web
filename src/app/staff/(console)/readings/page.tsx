import { getTranslations } from "next-intl/server";

import { ReadingRound } from "@/features/staff/readings/ReadingRound";
import { BuildingSelect } from "@/features/staff/shared/BuildingSelect";
import { staffScope } from "@/features/staff/shared/server";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconMeter } from "@/ui/icons/glyphs/meter";

export async function generateMetadata() {
  const t = await getTranslations("staff.readings");
  return { title: t("title") };
}

/** The reading round of the focused building (F4 4.1 §2, `GET /v1/staff/reading-rounds/current`). */
export default async function StaffReadings() {
  const scope = await staffScope();
  const t = await getTranslations("staff.readings");
  const round = scope.rounds.find((candidate) => candidate.buildingId === scope.buildingId);
  return (
    <div className="flex flex-col">
      {scope.buildings.length > 1 ? (
        <div className="pt-4">
          <BuildingSelect buildings={scope.buildings} buildingId={scope.buildingId} />
        </div>
      ) : null}
      {round ? (
        <ReadingRound round={round} />
      ) : (
        <EmptyState icon={IconMeter} title={t("noRound")} description={t("noRoundHint")} />
      )}
    </div>
  );
}

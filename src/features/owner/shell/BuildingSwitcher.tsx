"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { LazyDropdownMenu } from "@/ui/components/overlays";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconChevronDown } from "@/ui/icons/glyphs/chevron-down";

import { writeBuildingCookie } from "@/features/shared/shell/building";

/**
 * Top-bar building switcher (design-system.md §5: always visible). The list is `GET /v1/owner/buildings`
 * of the current tenant (B2.1); one building needs no switcher, so its name is shown instead.
 */
export function BuildingSwitcher({
  buildings,
  currentBuildingId,
}: {
  buildings: Schemas["BuildingDto"][];
  currentBuildingId: string | null;
}) {
  const t = useTranslations("shell.buildingSwitcher");
  const router = useRouter();
  if (buildings.length === 0) return null;
  if (buildings.length === 1) {
    return (
      <span className="text-muted hidden truncate text-sm md:inline" data-testid="building-name">
        {buildings[0]!.name}
      </span>
    );
  }
  const current = buildings.find((building) => building.id === currentBuildingId);
  const choose = (id: string | null) => {
    writeBuildingCookie(id);
    router.refresh();
  };
  return (
    <LazyDropdownMenu
      label={t("label")}
      align="start"
      trigger={
        <Button
          variant="ghost"
          size="sm"
          iconStart={IconBuilding}
          iconEnd={IconChevronDown}
          data-testid="building-switcher"
        >
          <span className="max-w-40 truncate">{current?.name ?? t("all")}</span>
        </Button>
      }
      items={[
        { id: "all", label: t("all"), selected: !current, onSelect: () => choose(null) },
        ...buildings.map((building, index) => ({
          id: building.id,
          label: building.name,
          icon: IconBuilding,
          selected: building.id === current?.id,
          separatorBefore: index === 0,
          onSelect: () => choose(building.id),
        })),
      ]}
    />
  );
}

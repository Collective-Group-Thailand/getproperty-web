"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
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
  variant = "chip",
  testId = "building-switcher",
}: {
  buildings: Schemas["BuildingDto"][];
  currentBuildingId: string | null;
  /** `chip` (column row, phone top bar); `icon` in the collapsed rail — the building named in its label. */
  variant?: "chip" | "icon";
  /** The column's switcher keeps `building-switcher`; the phone bar and the rail get their own (all are in the DOM). */
  testId?: string;
}) {
  const t = useTranslations("shell.buildingSwitcher");
  const router = useRouter();
  if (buildings.length === 0) return null;
  if (buildings.length === 1) {
    if (variant === "icon") return null;
    return (
      <span
        className="text-muted block truncate text-sm"
        data-testid={testId === "building-switcher" ? "building-name" : undefined}
      >
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
        variant === "icon" ? (
          <IconButton icon={IconBuilding} label={`${t("label")}: ${current?.name ?? t("all")}`} data-testid={testId} />
        ) : (
          <Button
            variant="secondary"
            size="sm"
            iconEnd={IconChevronDown}
            data-testid={testId}
            className="max-w-full px-2.5"
          >
            <span className="min-w-0 truncate">{current?.name ?? t("all")}</span>
          </Button>
        )
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

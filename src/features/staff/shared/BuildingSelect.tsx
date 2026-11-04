"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { writeBuildingCookie } from "@/features/shared/shell/building";
import { Icon } from "@/ui/icons";
import { IconChevronDown } from "@/ui/icons/glyphs/chevron-down";

/**
 * The staff building switcher (F4 4.1 "building switcher for staff assigned to several"), in the top bar: a native
 * select — the phone's own picker, big and one-handed — drawn as the building's name with a chevron, so the context
 * reads as a title rather than a form. It focuses Today, the round, work orders, parcels and devices on one building.
 * One building needs no switcher: its name is plain text.
 */
export function BuildingSelect({
  buildings,
  buildingId,
}: {
  buildings: { id: string; name: string }[];
  buildingId: string | null;
}) {
  const t = useTranslations("shell.buildingSwitcher");
  const router = useRouter();
  const current = buildings.find((building) => building.id === buildingId) ?? buildings[0];
  if (!current) return null;
  if (buildings.length < 2)
    return (
      <span className="truncate text-base font-semibold" data-testid="building-name">
        {current.name}
      </span>
    );
  return (
    <span className="relative -ms-2 inline-flex min-w-0 items-center">
      <select
        aria-label={t("label")}
        value={current.id}
        onChange={(event) => {
          writeBuildingCookie(event.target.value);
          router.refresh();
        }}
        className="rounded-control text-fg hover:bg-bg-subtle focus-visible:outline-focus-ring h-12 max-w-full min-w-0 cursor-pointer appearance-none truncate bg-transparent ps-2 pe-8 text-base font-semibold focus-visible:outline-2"
        data-testid="building-select"
      >
        {buildings.map((building) => (
          <option key={building.id} value={building.id}>
            {building.name}
          </option>
        ))}
      </select>
      <Icon icon={IconChevronDown} size={18} className="text-muted pointer-events-none absolute end-2" />
    </span>
  );
}

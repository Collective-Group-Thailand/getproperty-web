"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId } from "react";

import { writeBuildingCookie } from "@/features/shared/shell/building";

/**
 * The staff building switcher (F4 4.1 "building switcher for staff assigned to several"): a native
 * select — the phone's own picker, big and one-handed — that focuses Today, the round and the devices
 * on one building. One building needs no switcher; its name is the heading.
 */
export function BuildingSelect({
  buildings,
  buildingId,
}: {
  buildings: { id: string; name: string }[];
  buildingId: string | null;
}) {
  const t = useTranslations("staff.today");
  const router = useRouter();
  const id = useId();
  if (buildings.length < 2) return null;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-muted text-sm font-medium">
        {t("building")}
      </label>
      <select
        id={id}
        value={buildingId ?? ""}
        onChange={(event) => {
          writeBuildingCookie(event.target.value);
          router.refresh();
        }}
        className="rounded-control border-border-strong bg-surface text-fg h-14 w-full border px-4 text-lg"
        data-testid="building-select"
      >
        {buildings.map((building) => (
          <option key={building.id} value={building.id}>
            {building.name}
          </option>
        ))}
      </select>
    </div>
  );
}

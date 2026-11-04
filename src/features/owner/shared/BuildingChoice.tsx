"use client";

import { useRouter } from "next/navigation";

import { writeBuildingCookie } from "@/features/shared/shell/building";
import { NativeSelect } from "@/ui/components/NativeSelect";

/**
 * The next step of a page that works on one building while the console shows all of them (G4): a building select
 * that focuses the console on the chosen building — the same focus as the rail's building switcher.
 */
export function BuildingChoice({
  buildings,
  label,
  placeholder,
}: {
  buildings: { id: string; name: string }[];
  /** Accessible name of the select, from `src/i18n`. */
  label: string;
  placeholder: string;
}) {
  const router = useRouter();
  return (
    <div className="w-72 max-w-full">
      <NativeSelect
        aria-label={label}
        placeholder={placeholder}
        value=""
        options={buildings.map((building) => ({ value: building.id, label: building.name }))}
        onChange={(event) => {
          if (!event.target.value) return;
          writeBuildingCookie(event.target.value);
          router.refresh();
        }}
        data-testid="building-choice"
      />
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconDelete } from "@/ui/icons/glyphs/delete";

type Slot = Schemas["WeeklySlotDto"];
const SLOT_MINUTES = [15, 20, 30, 45, 60, 90, 120];

/**
 * Viewing windows of a listing (F6.2, D-252; viewings book against them in B7.3): weekly windows in Bangkok time
 * and the length of one viewing. Exceptions (a closed day) are kept as the API holds them.
 */
export function ListingAvailabilityForm({
  listingId,
  availability,
}: {
  listingId: string;
  availability: Schemas["ListingAvailabilityDto"];
}) {
  const t = useTranslations("owner.listings.availability");
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => t(`days.${i}`));
  const action = useApiAction();
  const [slots, setSlots] = useState<Slot[]>(availability.weekly);
  const [slotMinutes, setSlotMinutes] = useState(String(availability.slotMinutes ?? 30));
  const [saved, setSaved] = useState(false);

  const update = (index: number, patch: Partial<Slot>) => {
    setSlots(slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
    setSaved(false);
  };

  const save = () =>
    action.run(
      () =>
        unwrap(
          browserApi().PUT("/v1/owner/listings/{listingId}/availability", {
            params: { path: { listingId } },
            body: { weekly: slots, exceptions: availability.exceptions ?? [], slotMinutes: Number(slotMinutes) },
          }),
        ),
      () => setSaved(true),
    );

  return (
    <div className="flex flex-col gap-4" data-testid="listing-availability">
      {slots.length === 0 ? <p className="text-muted text-sm">{t("empty")}</p> : null}
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {slots.map((slot, index) => (
          <li
            key={index}
            className="grid grid-cols-[1fr_auto] items-end gap-3 sm:grid-cols-[12rem_8rem_8rem_auto]"
            data-testid="listing-slot"
          >
            <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1">
              <span className="font-medium">{t("weekday")}</span>
              <NativeSelect
                value={String(slot.weekday)}
                onChange={(event) => update(index, { weekday: Number(event.target.value) })}
                options={days.map((day, i) => ({ value: String(i), label: day }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("from")}</span>
              <Input type="time" value={slot.from} onChange={(event) => update(index, { from: event.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("to")}</span>
              <Input type="time" value={slot.to} onChange={(event) => update(index, { to: event.target.value })} />
            </label>
            <IconButton
              icon={IconDelete}
              label={t("remove")}
              variant="ghost"
              onClick={() => {
                setSlots(slots.filter((_, i) => i !== index));
                setSaved(false);
              }}
            />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Button
            type="button"
            variant="secondary"
            iconStart={IconAdd}
            onClick={() => {
              setSlots([...slots, { weekday: 6, from: "10:00", to: "16:00" }]);
              setSaved(false);
            }}
            data-testid="listing-slot-add"
          >
            {t("add")}
          </Button>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("slot")}</span>
            <NativeSelect
              value={slotMinutes}
              onChange={(event) => {
                setSlotMinutes(event.target.value);
                setSaved(false);
              }}
              options={SLOT_MINUTES.map((m) => ({ value: String(m), label: t("slotUnit", { minutes: m }) }))}
            />
          </label>
        </div>
        <div className="flex items-center gap-3">
          {saved ? (
            <span className="text-muted text-sm" role="status">
              {t("saved")}
            </span>
          ) : null}
          <Button onClick={save} loading={action.busy} data-testid="listing-availability-save">
            {t("save")}
          </Button>
        </div>
      </div>
      <ProblemNotice error={action.error} />
    </div>
  );
}

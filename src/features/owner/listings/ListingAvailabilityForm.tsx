"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { IconButton } from "@/ui/components/IconButton";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconDelete } from "@/ui/icons/glyphs/delete";
import { IconKey } from "@/ui/icons/glyphs/key";

import type { SelfViewingRules } from "../viewings/selfViewing";

type Slot = Schemas["WeeklySlotDto"];
const SLOT_MINUTES = [15, 20, 30, 45, 60, 90, 120];

/**
 * Viewing windows of a listing (F6.2, D-252; viewings book against them in B7.3): weekly windows in Bangkok time
 * and the length of one viewing. Exceptions (a closed day) are kept as the API holds them.
 * G7 (D-295): each window is shown by someone (accompanied) or self-viewing with a time-boxed door code. While
 * `viewing.self.enabled` is off (O-024) the self option is offered to no one; windows already marked self stay as
 * the API holds them (it offers no self slot while the switch is off).
 */
export function ListingAvailabilityForm({
  listingId,
  availability,
  selfViewing,
}: {
  listingId: string;
  availability: Schemas["ListingAvailabilityDto"];
  selfViewing: SelfViewingRules;
}) {
  const t = useTranslations("owner.listings.availability");
  const v = useTranslations("owner.viewings.availability");
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
      {selfViewing.enabled ? (
        <Callout tone="info" icon={IconKey} title={v("onTitle")}>
          <span data-testid="self-viewing-on">
            {selfViewing.earlyMinutes !== null && selfViewing.codeMinutes !== null
              ? v("onBody", { early: selfViewing.earlyMinutes, minutes: selfViewing.codeMinutes })
              : v("onBodyPlain")}
          </span>
        </Callout>
      ) : (
        <Callout tone="neutral" icon={IconKey} title={v("offTitle")}>
          <span data-testid="self-viewing-off">{v("offBody")}</span>
        </Callout>
      )}
      {slots.length === 0 ? <p className="text-muted text-sm">{t("empty")}</p> : null}
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {slots.map((slot, index) => (
          <li
            key={index}
            className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_minmax(0,1.2fr)_auto]"
            data-testid="listing-slot"
            data-mode={slot.mode ?? "accompanied"}
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
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{v("mode")}</span>
              <NativeSelect
                value={slot.mode ?? "accompanied"}
                onChange={(event) => update(index, { mode: event.target.value as Schemas["ViewingMode"] })}
                options={[
                  { value: "accompanied", label: v("accompanied") },
                  {
                    value: "self",
                    label: selfViewing.enabled ? v("self") : v("selfUnavailable"),
                    disabled: !selfViewing.enabled && slot.mode !== "self",
                  },
                ]}
                data-testid="listing-slot-mode"
              />
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

"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import type { Schemas } from "@/lib/api/types";
import { KioskButton as Button, KioskInput as Input } from "@/ui/components/Kiosk";
import { FieldError } from "@/ui/components/FieldError";
import { KindTiles } from "@/ui/components/KindTiles";
import type { IconGlyph } from "@/ui/icons";
import { IconCar } from "@/ui/icons/glyphs/car";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconMore } from "@/ui/icons/glyphs/more";
import { IconResident } from "@/ui/icons/glyphs/resident";
import { IconSiren } from "@/ui/icons/glyphs/siren";
import { IconTruck } from "@/ui/icons/glyphs/truck";
import { IconWrench } from "@/ui/icons/glyphs/wrench";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { KioskDialog } from "./KioskDialog";
import type { GuardVisit } from "./lib/api";
import { formatPlate } from "./lib/plate";

/** A confirmation with an optional (or required, ≥ `min`) note — switch shift, resolve an SOS. */
export function NoteDialog({
  title,
  lede,
  noteLabel,
  noteHint,
  confirm,
  min = 0,
  requiredMessage,
  destructive,
  onClose,
  onConfirm,
  testId,
}: {
  title: string;
  lede?: string;
  noteLabel?: string;
  noteHint?: string;
  confirm: string;
  min?: number;
  requiredMessage?: string;
  destructive?: boolean;
  onClose: () => void;
  onConfirm: (note: string) => Promise<boolean | void>;
  testId?: string;
}) {
  const t = useTranslations("owner.guard");
  const id = useId();
  const [note, setNote] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (note.trim().length < min) return setError(true);
    setBusy(true);
    const result = await onConfirm(note.trim());
    setBusy(false);
    if (result !== false) onClose();
  };
  return (
    <KioskDialog
      open
      onClose={onClose}
      title={title}
      closeLabel={t("close")}
      testId={testId}
      footer={
        <>
          <Button variant="secondary" size="xl" className="h-14" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            size="xl"
            className="h-14"
            loading={busy}
            onClick={() => void submit()}
            data-testid={testId ? `${testId}-confirm` : undefined}
          >
            {confirm}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {lede ? <p className="text-muted">{lede}</p> : null}
        {noteLabel ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-note`} className="font-semibold">
              {noteLabel}
            </label>
            <Input
              id={`${id}-note`}
              value={note}
              maxLength={500}
              aria-invalid={error ? true : undefined}
              aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
              onChange={(event) => {
                setError(false);
                setNote(event.target.value);
              }}
              className="h-14 text-lg"
              data-testid={testId ? `${testId}-note` : undefined}
            />
            {noteHint ? (
              <p id={`${id}-hint`} className="text-muted text-sm">
                {noteHint}
              </p>
            ) : null}
            {error && requiredMessage ? <FieldError id={`${id}-error`}>{requiredMessage}</FieldError> : null}
          </div>
        ) : null}
      </div>
    </KioskDialog>
  );
}

/**
 * The options of a waiting row: let in without waiting (a guard override — the API requires a reason, D-315 "never
 * force every visit to wait") or cancel (the visitor left). Two large choices, then the reason.
 */
export function ManageVisitDialog({
  visit,
  onClose,
  onOverride,
  onCancel,
}: {
  visit: GuardVisit;
  onClose: () => void;
  onOverride: (reason: string) => Promise<boolean>;
  onCancel: (reason: string) => Promise<boolean>;
}) {
  const t = useTranslations("owner.guard");
  const [mode, setMode] = useState<"override" | "cancel" | null>(null);
  const title = t("waiting.manageTitle", { plate: formatPlate(visit.plate) || "—", unit: visit.unitNo ?? "—" });
  if (mode === "override") {
    return (
      <NoteDialog
        title={title}
        noteLabel={t("waiting.overrideReason")}
        noteHint={t("waiting.overrideHint")}
        confirm={t("waiting.override")}
        min={5}
        requiredMessage={t("waiting.overrideRequired")}
        onClose={onClose}
        onConfirm={onOverride}
        testId="override"
      />
    );
  }
  if (mode === "cancel") {
    return (
      <NoteDialog
        title={title}
        noteLabel={t("waiting.cancelReason")}
        noteHint={t("waiting.cancelHint")}
        confirm={t("waiting.cancelVisit")}
        destructive
        onClose={onClose}
        onConfirm={onCancel}
        testId="cancel-visit"
      />
    );
  }
  return (
    <KioskDialog open onClose={onClose} title={title} closeLabel={t("close")} testId="manage-visit">
      <div className="flex flex-col gap-3">
        <Button
          variant="secondary"
          size="xl"
          className="h-16 justify-start"
          iconStart={IconCheckCircle}
          onClick={() => setMode("override")}
          data-testid="choose-override"
        >
          {t("waiting.override")}
        </Button>
        <Button
          variant="destructive"
          size="xl"
          className="h-16 justify-start"
          iconStart={IconXCircle}
          onClick={() => setMode("cancel")}
          data-testid="choose-cancel"
        >
          {t("waiting.cancelVisit")}
        </Button>
      </div>
    </KioskDialog>
  );
}

type OpenReason = Schemas["GuardOpenReason"];
const OPEN_REASONS: { value: OpenReason; icon: IconGlyph }[] = [
  { value: "resident", icon: IconCar },
  { value: "visit", icon: IconResident },
  { value: "delivery", icon: IconTruck },
  { value: "service", icon: IconWrench },
  { value: "emergency", icon: IconSiren },
  { value: "other", icon: IconMore },
];

/** Open the barrier by hand (J4.2 §4): a reason always, a note for "other"; every opening is audited by the API. */
export function OpenBarrierDialog({
  onClose,
  onOpen,
}: {
  onClose: () => void;
  onOpen: (reason: OpenReason, note: string) => Promise<boolean>;
}) {
  const t = useTranslations("owner.guard");
  const id = useId();
  const [reason, setReason] = useState<OpenReason | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <KioskDialog
      open
      onClose={onClose}
      title={t("open.title")}
      closeLabel={t("close")}
      variant="sheet"
      testId="open-barrier-dialog"
      footer={
        <>
          <Button variant="secondary" size="xl" className="h-14" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            size="xl"
            className="h-14"
            loading={busy}
            onClick={async () => {
              if (!reason) return setError(t("open.lede"));
              if (reason === "other" && !note.trim()) return setError(t("open.noteRequired"));
              setBusy(true);
              const ok = await onOpen(reason, note.trim());
              setBusy(false);
              if (ok) onClose();
            }}
            data-testid="open-barrier-confirm"
          >
            {t("open.submit")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-muted">{t("open.lede")}</p>
        <KindTiles
          label={t("open.title")}
          value={reason}
          onValueChange={(value) => {
            setError(null);
            setReason(value as OpenReason);
          }}
          options={OPEN_REASONS.map((option) => ({
            value: option.value,
            icon: option.icon,
            label: t(`open.reason.${option.value}`),
          }))}
        />
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-note`} className="font-semibold">
            {t("open.note")}
            {reason === "other" ? null : <span className="text-muted ms-2 font-normal">{t("entry.optional")}</span>}
          </label>
          <Input
            id={`${id}-note`}
            value={note}
            maxLength={200}
            onChange={(event) => setNote(event.target.value)}
            className="h-14 text-lg"
          />
        </div>
        {error ? <FieldError alert>{error}</FieldError> : null}
      </div>
    </KioskDialog>
  );
}

"use client";

import { INSPECTION_STATUS } from "@/domain/status/inspection";
import { useLocale, useTranslations } from "next-intl";
import { Suspense, useEffect, useId, useMemo, useState } from "react";

import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatUnits } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { isCompleteDecimal } from "@/ui/lib/decimal";
import { Textarea } from "@/ui/components/Input";
import { Icon } from "@/ui/icons";
import { IconCamera } from "@/ui/icons/glyphs/camera";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClose } from "@/ui/icons/glyphs/close";
import { IconOffline } from "@/ui/icons/glyphs/offline";
import { IconSyncPending } from "@/ui/icons/glyphs/sync-pending";
import { cn } from "@/ui/lib/cn";
import { lazyWarm } from "@/ui/lib/lazy";

import { useKeypadLabels } from "../shared/labels";
import { PhotoThumb } from "../shared/PhotoThumb";
import { editItem, mergedItem, type DraftItem } from "./draft";
import { useInspectionDraft, type SyncState } from "./useInspectionDraft";

const PhotoShooter = lazyWarm(() => import("./PhotoShooter").then((module) => module.PhotoShooter));
const NumericKeypad = lazyWarm(() => import("@/ui/components/NumericKeypad").then((module) => module.NumericKeypad));
const CompletePanel = lazyWarm(() => import("./CompletePanel").then((module) => module.CompletePanel));

const CONDITIONS: Schemas["ItemCondition"][] = ["good", "fair", "damaged", "missing", "not_applicable"];

/**
 * The inspection checklist (F4 4.2, D-023): one card per line of the template — condition, note, photos
 * (multi-shot, compressed on the device), the meter register on meter lines — saved on the device at
 * every change and synced when there is signal. A move-out shows each line's move-in condition and
 * photos beside it, and beside the camera, so the comparison is made on the spot. Completing asks for
 * the inspector's and the resident's signatures on the device.
 */
export function InspectionChecklist({
  inspection,
  etag,
  moveIn,
}: {
  inspection: Schemas["InspectionDto"];
  etag: string | null;
  moveIn: Schemas["InspectionDto"] | null;
}) {
  const t = useTranslations("staff.inspections");
  const locale = useLocale() as Locale;
  const { server, draft, state, problem, update, sync, patch } = useInspectionDraft(inspection, etag);
  const [shooting, setShooting] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const editable = server.status === "scheduled" || server.status === "in_progress";
  const lines = server.items.map((item) => mergedItem(item, draft.items[item.itemKey]));
  const missing = lines.filter((line) => !line.condition).length;

  return (
    <div className="flex flex-col gap-5 py-6" data-testid="inspection-checklist" data-sync={state}>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t("heading", { unit: server.unitNo, type: server.type })}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadgeOf map={INSPECTION_STATUS} value={server.status} />
          {server.reportNumber ? (
            <span className="text-muted text-sm">{t("report", { number: server.reportNumber })}</span>
          ) : null}
        </div>
        {editable ? <SyncLine state={state} missing={missing} /> : null}
        {problem ? (
          <Callout tone="danger" title={t("sync.errorTitle")}>
            {problem.detail || problem.code}
            {problem.requestId ? <span className="text-muted block font-mono text-xs">{problem.requestId}</span> : null}
          </Callout>
        ) : null}
      </header>

      {!editable ? (
        <Callout tone="success" icon={IconCheckCircle} title={t("doneTitle")}>
          {server.completedAt ? t("doneBody", { date: formatDateTime(server.completedAt, locale) }) : null}
        </Callout>
      ) : null}

      <ol className="flex flex-col gap-4" data-testid="inspection-items">
        {lines.map((line) => {
          const before = moveIn?.items.find((item) => item.itemKey === line.itemKey) ?? null;
          return (
            <li key={line.id}>
              <ItemCard
                line={line}
                before={before}
                editable={editable}
                shooting={shooting === line.itemKey}
                onShoot={(open) => setShooting(open ? line.itemKey : null)}
                onChange={(change) => void update((current) => editItem(current, line.itemKey, change))}
              />
              {shooting === line.itemKey ? (
                <Suspense fallback={<p className="text-muted py-6 text-center">{t("cameraLoading")}</p>}>
                  <PhotoShooter
                    before={before}
                    label={line.label}
                    onClose={() => setShooting(null)}
                    onPhotos={(files) => {
                      setShooting(null);
                      void update((current) =>
                        editItem(current, line.itemKey, (item) => ({
                          ...item,
                          added: [...item.added, ...files.map((blob) => ({ localId: crypto.randomUUID(), blob }))],
                        })),
                      );
                    }}
                  />
                </Suspense>
              ) : null}
            </li>
          );
        })}
      </ol>

      {editable ? (
        <section aria-labelledby="inspection-complete" className="flex flex-col gap-3">
          <h2 id="inspection-complete" className="text-lg font-semibold">
            {t("complete.title")}
          </h2>
          {missing > 0 ? <p className="text-muted">{t("complete.missing", { count: missing })}</p> : null}
          {completing ? (
            <Suspense fallback={<p className="text-muted py-6 text-center">{t("cameraLoading")}</p>}>
              <CompletePanel
                inspection={server}
                draft={draft}
                patch={patch}
                sync={sync}
                onCancel={() => setCompleting(false)}
              />
            </Suspense>
          ) : (
            <Button
              size="xl"
              block
              disabled={missing > 0}
              onClick={() => setCompleting(true)}
              data-testid="start-complete"
            >
              {t("complete.start")}
            </Button>
          )}
        </section>
      ) : null}
    </div>
  );
}

function SyncLine({ state, missing }: { state: SyncState; missing: number }) {
  const t = useTranslations("staff.inspections.sync");
  const text =
    state === "saving"
      ? t("saving")
      : state === "local"
        ? t("local")
        : state === "offline"
          ? t("offline")
          : state === "saved"
            ? t("saved")
            : state === "error"
              ? t("error")
              : t("idle", { count: missing });
  return (
    <p className="text-muted flex items-center gap-2 text-sm" role="status" data-testid="sync-line">
      <Icon icon={state === "offline" ? IconOffline : state === "saved" ? IconCheckCircle : IconSyncPending} />
      {text}
    </p>
  );
}

type Line = ReturnType<typeof mergedItem>;

function ItemCard({
  line,
  before,
  editable,
  shooting,
  onShoot,
  onChange,
}: {
  line: Line;
  before: Schemas["InspectionItemDto"] | null;
  editable: boolean;
  shooting: boolean;
  onShoot: (open: boolean) => void;
  onChange: (change: (item: DraftItem) => DraftItem) => void;
}) {
  const t = useTranslations("staff.inspections");
  const locale = useLocale() as Locale;
  const keypadLabels = useKeypadLabels();
  const id = useId();
  const meter = line.itemKey.startsWith("meter:");
  const [editingRegister, setEditingRegister] = useState(false);
  const [register, setRegister] = useState(line.meterRegister ?? "");
  /** The note being typed (null = show the saved one); saved on blur. */
  const [notes, setNotes] = useState<string | null>(null);
  const registerUnit = line.itemKey === "meter:water" ? "m3" : "kWh";

  return (
    <article
      className="rounded-card border-border bg-surface shadow-card flex flex-col gap-3 border p-4"
      aria-labelledby={`${id}-label`}
      data-testid="inspection-item"
      data-item={line.itemKey}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 id={`${id}-label`} className="text-lg font-semibold">
          {line.label}
        </h2>
        {line.area ? <Badge size="sm">{t.has(`area.${line.area}`) ? t(`area.${line.area}`) : line.area}</Badge> : null}
      </div>

      {before ? (
        <div className="rounded-control bg-bg-subtle flex flex-col gap-2 p-3" data-testid="move-in">
          <p className="text-sm">
            <span className="font-semibold">{t("moveIn")}</span>{" "}
            {before.condition ? t(`condition.${before.condition}`) : t("noCondition")}
            {before.notes ? ` · ${before.notes}` : null}
            {before.meterRegister ? ` · ${formatUnits(before.meterRegister, registerUnit, locale)}` : null}
          </p>
          {before.photoDocumentIds.length > 0 ? (
            <div className="relative flex gap-2 overflow-x-auto">
              {before.photoDocumentIds.map((photoId, index) => (
                <PhotoThumb
                  key={photoId}
                  fileId={photoId}
                  alt={t("moveInPhoto", { item: line.label, index: index + 1 })}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <fieldset disabled={!editable} className="flex flex-col gap-2">
        <legend className="text-muted mb-1 text-sm font-medium">{t("conditionLabel")}</legend>
        <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3">
          {CONDITIONS.map((condition) => (
            <label key={condition} className="relative">
              <input
                type="radio"
                name={`${id}-condition`}
                value={condition}
                checked={line.condition === condition}
                onChange={() => onChange((item) => ({ ...item, condition }))}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "rounded-control flex min-h-12 cursor-pointer items-center justify-center border-2 px-2 text-center font-medium",
                  "border-border-strong bg-surface peer-checked:border-primary peer-checked:bg-primary-subtle peer-checked:text-primary-subtle-fg",
                  "peer-focus-visible:outline-focus-ring peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
                )}
              >
                {t(`condition.${condition}`)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-notes`} className="text-muted text-sm font-medium">
          {t("notes")}
        </label>
        <Textarea
          id={`${id}-notes`}
          rows={2}
          value={notes ?? line.notes ?? ""}
          disabled={!editable}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={() => {
            if (notes === null) return;
            const value = notes.trim() ? notes : null;
            setNotes(null);
            if (value !== (line.notes ?? null)) onChange((item) => ({ ...item, notes: value }));
          }}
          className="min-h-12 text-lg"
        />
      </div>

      {meter ? (
        editingRegister ? (
          <Suspense fallback={null}>
            <div className="flex flex-col gap-2">
              <NumericKeypad
                label={t("register")}
                labels={keypadLabels}
                value={register}
                onChange={setRegister}
                maxDecimals={3}
              />
              <Button
                size="xl"
                block
                disabled={!isCompleteDecimal(register)}
                onClick={() => {
                  onChange((item) => ({ ...item, meterRegister: register }));
                  setEditingRegister(false);
                }}
              >
                {t("registerSave")}
              </Button>
            </div>
          </Suspense>
        ) : (
          <Button
            variant="secondary"
            size="lg"
            disabled={!editable}
            onClick={() => setEditingRegister(true)}
            data-testid="register-button"
          >
            {line.meterRegister
              ? t("registerValue", { value: formatUnits(line.meterRegister, registerUnit, locale) })
              : t("registerAdd")}
          </Button>
        )
      ) : null}

      {line.photoDocumentIds.length + line.added.length > 0 ? (
        <ul className="relative flex gap-2 overflow-x-auto pb-1" aria-label={t("photos")} data-testid="item-photos">
          {line.photoDocumentIds.map((photoId, index) => (
            <li key={photoId} className="relative shrink-0">
              <PhotoThumb fileId={photoId} alt={t("photoAlt", { item: line.label, index: index + 1 })} />
              {editable ? (
                <RemoveButton
                  label={t("removePhoto", { index: index + 1 })}
                  onRemove={() => onChange((item) => ({ ...item, removed: [...item.removed, photoId] }))}
                />
              ) : null}
            </li>
          ))}
          {line.added.map((photo, index) => (
            <li key={photo.localId} className="relative shrink-0" data-uploaded={Boolean(photo.fileId)}>
              {photo.blob ? (
                <BlobThumb
                  blob={photo.blob}
                  alt={t("photoAlt", { item: line.label, index: line.photoDocumentIds.length + index + 1 })}
                />
              ) : photo.fileId ? (
                <PhotoThumb fileId={photo.fileId} alt={t("photoAlt", { item: line.label, index: index + 1 })} />
              ) : null}
              {!photo.fileId ? (
                <span className="bg-overlay text-fg-inverse rounded-b-control absolute inset-x-0 bottom-0 px-1 text-center text-xs">
                  {t("photoWaiting")}
                </span>
              ) : null}
              {editable ? (
                <RemoveButton
                  label={t("removePhoto", { index: line.photoDocumentIds.length + index + 1 })}
                  onRemove={() =>
                    onChange((item) => ({ ...item, added: item.added.filter((p) => p.localId !== photo.localId) }))
                  }
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {editable && !shooting ? (
        <Button
          variant="secondary"
          size="lg"
          iconStart={IconCamera}
          onClick={() => onShoot(true)}
          data-testid="add-photos"
        >
          {t("addPhotos")}
        </Button>
      ) : null}
    </article>
  );
}

function RemoveButton({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onRemove}
      className="absolute -end-3 -top-3 flex size-12 items-center justify-center"
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-black/70 text-white">
        <Icon icon={IconClose} size={16} />
      </span>
    </button>
  );
}

function BlobThumb({ blob, alt }: { blob: Blob; alt: string }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <span className="rounded-control bg-bg-subtle block size-20 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element -- a local photo waiting to upload */}
      <img src={url} alt={alt} className="size-full object-cover" />
    </span>
  );
}

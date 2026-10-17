"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Suspense, useId, useRef, useState } from "react";

import { formatUnits } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { StaffMeterPoint } from "@/lib/api/pending";
import type { Schemas } from "@/lib/api/types";
import { uploadFile, UploadError } from "@/lib/pwa/queue";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Textarea } from "@/ui/components/Input";
import { isCompleteDecimal } from "@/ui/lib/decimal";
import { lazyWarm } from "@/ui/lib/lazy";
import { ScanButton } from "@/ui/components/ScanButton";
import { Stepper } from "@/ui/components/Stepper";
import { IconBack } from "@/ui/icons/glyphs/back";
import { IconForward } from "@/ui/icons/glyphs/forward";

import { useCameraLabels, useKeypadLabels, useScanLabels } from "../shared/labels";
import { meterUnit } from "../shared/units";
import { TextField } from "./fields";

// The camera, the keypad and the command button load on first use: the staff budget is 200 KB (D-179).
const CameraCapture = lazyWarm(() => import("@/ui/components/CameraCapture").then((module) => module.CameraCapture));
const NumericKeypad = lazyWarm(() => import("@/ui/components/NumericKeypad").then((module) => module.NumericKeypad));

type Step = "point" | "old" | "new" | "confirm" | "done";
const STEPS: Step[] = ["point", "old", "new", "confirm", "done"];

interface Shot {
  file: File;
  url: string;
}

/**
 * Meter replacement (F4 4.3 swap flow, D-033, D-030): the old meter's final register with its photo,
 * the new meter (serial scanned or typed) with its initial register and photo, and the reason — one
 * `POST /v1/staff/devices/actions/swap` (Idempotency-Key per wizard). The API closes the old assignment
 * and opens the new one at the same instant, so consumption never spans the two meters; a gateway
 * channel moves to the new meter with its wiring.
 */
export function SwapWizard({ points, initialMeter }: { points: StaffMeterPoint[] | null; initialMeter?: string }) {
  const t = useTranslations("staff.devices.swap");
  const common = useTranslations("common");
  const locale = useLocale() as Locale;
  const cameraLabels = useCameraLabels();
  const keypadLabels = useKeypadLabels();
  const scanLabels = useScanLabels();
  const formId = useId();
  const key = useRef(crypto.randomUUID());
  const [step, setStep] = useState<Step>("point");
  const [pointId, setPointId] = useState<string | null>(
    initialMeter && points?.some((point) => point.assetItemId === initialMeter) ? initialMeter : null,
  );
  const [oldShot, setOldShot] = useState<Shot | null>(null);
  const [oldRegister, setOldRegister] = useState("");
  const [newMeter, setNewMeter] = useState({ serial: "", model: "", manufacturer: "" });
  const [newShot, setNewShot] = useState<Shot | null>(null);
  const [newRegister, setNewRegister] = useState("0");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ detail: string; requestId?: string } | null>(null);
  const [result, setResult] = useState<Schemas["MeterSwappedDto"] | null>(null);

  const point = points?.find((candidate) => candidate.assetItemId === pointId) ?? null;
  const unit = point ? meterUnit(point.utility) : "kWh";
  const index = STEPS.indexOf(step);
  const go = (next: Step) => {
    setFailure(null);
    setStep(next);
  };
  const shot = (set: (value: Shot) => void) => (files: File[]) => {
    const file = files[0];
    if (file) set({ file, url: URL.createObjectURL(file) });
  };

  const submit = async () => {
    if (!point || !oldShot || !newShot) return;
    setBusy(true);
    setFailure(null);
    try {
      const upload = (file: File) =>
        uploadFile({
          blob: file,
          fileName: file.name,
          kind: "meter_photo",
          scopeType: "asset_item",
          scopeId: point.assetItemId,
          bodyField: "photoDocumentId",
        });
      const [oldPhotoDocumentId, newPhotoDocumentId] = [await upload(oldShot.file), await upload(newShot.file)];
      const answer = await unwrap(
        browserApi().POST("/v1/staff/devices/actions/swap", {
          params: { header: { "Idempotency-Key": key.current } },
          body: {
            meterAssetItemId: point.assetItemId,
            oldFinalRegister: oldRegister,
            oldPhotoDocumentId,
            newMeter: {
              serial: newMeter.serial.trim() || null,
              model: newMeter.model.trim() || null,
              manufacturer: newMeter.manufacturer.trim() || null,
            },
            newInitialRegister: newRegister,
            newPhotoDocumentId,
            reason: reason.trim(),
            swappedAt: new Date().toISOString(),
          },
        }),
      );
      setResult(answer);
      go("done");
    } catch (error) {
      if (isApiError(error)) setFailure({ detail: error.detail || error.code, requestId: error.requestId });
      else if (error instanceof UploadError && error.problem.code !== "network")
        setFailure({ detail: error.problem.detail || error.problem.code, requestId: error.problem.requestId });
      else setFailure({ detail: t("offline") });
    } finally {
      setBusy(false);
    }
  };

  const steps = STEPS.map((id) => ({ id, label: t(`steps.${id}`) }));
  const photoBlock = (current: Shot | null, set: (value: Shot | null) => void, base: string) =>
    current ? (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element -- the register photo just taken */}
        <img src={current.url} alt={t("photoAlt")} className="rounded-control aspect-[4/3] w-full object-cover" />
        <Button variant="ghost" size="lg" onClick={() => set(null)}>
          {t("retake")}
        </Button>
      </>
    ) : (
      <CameraCapture
        label={t("shoot")}
        hint={t("guide")}
        labels={cameraLabels}
        guide="meter"
        fileBaseName={base}
        onCapture={shot(set)}
      />
    );

  return (
    <section
      className="flex flex-col gap-5 py-6"
      aria-labelledby={`${formId}-title`}
      data-testid="swap-wizard"
      data-step={step}
    >
      <h1 id={`${formId}-title`} className="text-2xl font-semibold">
        {t("title")}
      </h1>
      <Stepper
        steps={steps}
        current={index}
        label={t("stepsLabel")}
        progressText={t("stepOf", { step: index + 1, total: steps.length })}
      />
      <Suspense fallback={<p className="text-muted py-6 text-center">{t("loading")}</p>}>
        {failure ? (
          <Callout tone="danger" title={t("errorTitle")}>
            {failure.detail}
            {failure.requestId ? (
              <span className="text-muted block font-mono text-xs">
                {common("requestId")}: {failure.requestId}
              </span>
            ) : null}
          </Callout>
        ) : null}

        {step === "point" ? (
          <div className="flex flex-col gap-4">
            {points === null ? (
              <Callout tone="warning">{t("pointsUnavailable")}</Callout>
            ) : (
              <fieldset className="flex flex-col gap-2">
                <legend className="text-muted mb-1 text-sm font-medium">{t("pointLabel")}</legend>
                {points.map((candidate) => (
                  <label key={candidate.assetItemId} className="relative">
                    <input
                      type="radio"
                      name={`${formId}-point`}
                      checked={pointId === candidate.assetItemId}
                      onChange={() => setPointId(candidate.assetItemId)}
                      className="peer sr-only"
                    />
                    <span className="rounded-control border-border-strong bg-surface peer-checked:border-primary peer-checked:bg-primary-subtle peer-focus-visible:outline-focus-ring flex min-h-14 cursor-pointer flex-col justify-center border-2 px-4 py-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
                      <span className="font-semibold">
                        {candidate.unitNo ?? candidate.code} · {t(`utility.${candidate.utility}`)}
                      </span>
                      <span className="text-muted text-sm">
                        {candidate.code}
                        {candidate.serial ? ` · ${candidate.serial}` : null}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            <Button size="xl" block iconEnd={IconForward} disabled={!point} onClick={() => go("old")}>
              {t("next")}
            </Button>
          </div>
        ) : null}

        {step === "old" && point ? (
          <div className="flex flex-col gap-4">
            <p className="text-muted">{t("oldHint", { meter: point.unitNo ?? point.code })}</p>
            {photoBlock(oldShot, setOldShot, `swap-old-${point.code}`)}
            <NumericKeypad
              label={t("oldRegister")}
              unit={unit === "kWh" ? "kWh" : "m³"}
              labels={keypadLabels}
              value={oldRegister}
              onChange={setOldRegister}
              maxDecimals={3}
              hint={
                point.lastRegister ? t("last", { value: formatUnits(point.lastRegister, unit, locale) }) : undefined
              }
            />
            <Button
              size="xl"
              block
              iconEnd={IconForward}
              disabled={!oldShot || !isCompleteDecimal(oldRegister)}
              onClick={() => go("new")}
            >
              {t("next")}
            </Button>
            <Button variant="ghost" size="lg" iconStart={IconBack} onClick={() => go("point")}>
              {t("back")}
            </Button>
          </div>
        ) : null}

        {step === "new" && point ? (
          <div className="flex flex-col gap-4">
            <ScanButton
              label={t("scanNew")}
              labels={scanLabels}
              onScan={(serial) => setNewMeter((current) => ({ ...current, serial }))}
            />
            <TextField
              label={t("serial")}
              value={newMeter.serial}
              onChange={(serial) => setNewMeter({ ...newMeter, serial })}
              mono
              testId="swap-serial"
            />
            <TextField
              label={t("model")}
              value={newMeter.model}
              onChange={(model) => setNewMeter({ ...newMeter, model })}
            />
            <TextField
              label={t("manufacturer")}
              value={newMeter.manufacturer}
              onChange={(manufacturer) => setNewMeter({ ...newMeter, manufacturer })}
            />
            {photoBlock(newShot, setNewShot, `swap-new-${point.code}`)}
            <NumericKeypad
              label={t("newRegister")}
              unit={unit === "kWh" ? "kWh" : "m³"}
              labels={keypadLabels}
              value={newRegister}
              onChange={setNewRegister}
              maxDecimals={3}
            />
            <Button
              size="xl"
              block
              iconEnd={IconForward}
              disabled={!newShot || !isCompleteDecimal(newRegister)}
              onClick={() => go("confirm")}
            >
              {t("next")}
            </Button>
            <Button variant="ghost" size="lg" iconStart={IconBack} onClick={() => go("old")}>
              {t("back")}
            </Button>
          </div>
        ) : null}

        {step === "confirm" && point ? (
          <div className="flex flex-col gap-4">
            <dl className="rounded-card border-border bg-surface grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border p-4">
              <dt className="text-muted">{t("summary.meter")}</dt>
              <dd className="font-semibold">{point.unitNo ?? point.code}</dd>
              <dt className="text-muted">{t("summary.old")}</dt>
              <dd className="tabular-nums" data-testid="swap-old-register">
                {formatUnits(oldRegister, unit, locale)}
              </dd>
              <dt className="text-muted">{t("summary.new")}</dt>
              <dd className="tabular-nums">
                {formatUnits(newRegister, unit, locale)}
                {newMeter.serial ? ` · ${newMeter.serial}` : null}
              </dd>
            </dl>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${formId}-reason`} className="text-muted text-sm font-medium">
                {t("reason")}
              </label>
              <Textarea
                id={`${formId}-reason`}
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="min-h-12 text-lg"
              />
            </div>
            <Button
              size="xl"
              block
              loading={busy}
              disabled={!reason.trim()}
              onClick={() => void submit()}
              data-testid="swap-submit"
            >
              {t("submit")}
            </Button>
            <Button variant="ghost" size="lg" iconStart={IconBack} onClick={() => go("new")}>
              {t("back")}
            </Button>
          </div>
        ) : null}

        {step === "done" && result && point ? (
          <div className="flex flex-col gap-4" data-testid="swap-done">
            <Callout tone="success" title={t("doneTitle")}>
              {t("doneBody", { meter: point.unitNo ?? point.code })}
            </Callout>
            <Button asChild size="xl" block>
              <Link href="/devices">{t("toDevices")}</Link>
            </Button>
          </div>
        ) : null}
      </Suspense>
    </section>
  );
}

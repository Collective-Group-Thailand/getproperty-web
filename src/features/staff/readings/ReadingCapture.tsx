"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { ReadingSourceBadge } from "@/features/shared/status/ReadingSourceBadge";
import { DomainStatusBadge } from "@/features/shared/status/DomainStatusBadge";
import { formatDate, formatDateTime, formatUnits } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { discard, getEntry, replayQueue, retry, type QueueEntry } from "@/lib/pwa/queue";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { CameraCapture } from "@/ui/components/CameraCapture";
import { isCompleteDecimal, NumericKeypad } from "@/ui/components/NumericKeypad";
import { IconBack } from "@/ui/icons/glyphs/back";
import { IconCamera } from "@/ui/icons/glyphs/camera";
import { IconForward } from "@/ui/icons/glyphs/forward";

import { submitThroughQueue } from "../pwa/submit";
import { useCameraLabels, useKeypadLabels } from "../shared/labels";
import { PhotoThumb } from "../shared/PhotoThumb";
import { meterUnit, ratioToPercent, readingUnit } from "../shared/units";
import type { ReadingEntry } from "./roundState";

type Step = "photo" | "value" | "sending" | "result";

/** A photo kept for this capture: a fresh blob, or one already uploaded by an earlier (refused) entry. */
type Photo = { blob: Blob; url: string } | { fileId: string };

export interface ReadingCaptureProps {
  item: Schemas["RoundItemDto"];
  round: { buildingId: string; periodKey: string };
  /** Opens on an entry this device already queued: its result, or its conflict to resolve. */
  resume?: ReadingEntry;
  onClose: () => void;
  onNext: (assetItemId: string) => void;
}

/**
 * The capture flow (F4 4.1 §2): rear camera with the register guide frame and the torch → the photo
 * beside the previous reading and a big keypad for the value (or "let the system read it") → submit
 * through the offline queue with its Idempotency-Key. The API reads the photo (OCR, D-035/D-187) and
 * answers with the register, the OCR value and confidence, and whether the reading is accepted or goes
 * to the owner's review (out of the plausibility band, decreasing, doubtful OCR). Offline, the reading
 * waits in IndexedDB with its photo and the round already counts it. A refusal (`reading.unreadable`,
 * `reading.photo_required`, …) is shown with the API's words and the one action that fixes it.
 */
export function ReadingCapture({ item, round, resume, onClose, onNext }: ReadingCaptureProps) {
  const t = useTranslations("staff.readings.capture");
  const tr = useTranslations("staff.readings");
  const common = useTranslations("common");
  const locale = useLocale() as Locale;
  const cameraLabels = useCameraLabels();
  const keypadLabels = useKeypadLabels();
  const headingId = useId();
  const unit = meterUnit(item.utility);

  const [step, setStep] = useState<Step>(resume ? "result" : "photo");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [value, setValue] = useState(resume?.meta.typedValue ?? "");
  const [entry, setEntry] = useState<QueueEntry | null>(resume ?? null);
  const [readAt, setReadAt] = useState<string>(() => new Date().toISOString());
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);
  useEffect(() => () => (photo && "url" in photo ? URL.revokeObjectURL(photo.url) : undefined), [photo]);

  // Keep the result fresh while the entry waits in the queue (the shell replays it when online).
  useEffect(() => {
    if (!entry || entry.state !== "pending") return;
    const refresh = () => void getEntry(entry.id).then((latest) => latest && setEntry(latest));
    window.addEventListener("gp:offline-queue", refresh);
    return () => window.removeEventListener("gp:offline-queue", refresh);
  }, [entry]);

  const submit = async (typed: string | null) => {
    setStep("sending");
    const queued = await submitThroughQueue({
      method: "POST",
      path: "/v1/staff/meter-readings",
      label: `${item.unitNo ?? item.code} · ${tr(`utility.${item.utility}`)}`,
      body: {
        assetItemId: item.assetItemId,
        readAt,
        typedValue: typed,
        note: null,
        ...(photo && "fileId" in photo ? { photoDocumentId: photo.fileId } : {}),
      },
      photo:
        photo && "blob" in photo
          ? {
              blob: photo.blob,
              fileName: `meter-${item.code}-${Date.now()}.jpg`,
              kind: "meter_photo",
              scopeType: "asset_item",
              scopeId: item.assetItemId,
              bodyField: "photoDocumentId",
            }
          : undefined,
      meta: {
        kind: "meter-reading",
        assetItemId: item.assetItemId,
        buildingId: round.buildingId,
        periodKey: round.periodKey,
        unitNo: item.unitNo,
        code: item.code,
        utility: item.utility,
        typedValue: typed,
      },
    });
    setEntry(queued);
    setStep("result");
  };

  /** Starts over from a refused entry, keeping its uploaded photo when the fix is a typed value. */
  const resolve = async (to: "value" | "photo") => {
    if (!entry) return;
    const fileId = entry.photo?.fileId;
    await discard(entry.id);
    setEntry(null);
    setReadAt(new Date().toISOString());
    if (to === "value" && fileId) setPhoto({ fileId });
    else setPhoto(null);
    setStep(to);
  };

  const previous = item.lastReading;
  const reading = entry?.state === "sent" ? (entry.result as Schemas["MeterReadingDto"] | null) : null;
  const previousLine = previous
    ? t("previous", {
        value: formatUnits(previous.register, unit, locale),
        date: formatDate(previous.readAt, locale),
      })
    : t("noPrevious");

  const confidence = reading?.ocrConfidence ? ratioToPercent(reading.ocrConfidence) : null;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 py-4"
      data-testid="reading-capture"
      data-step={step}
    >
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="lg" iconStart={IconBack} onClick={onClose}>
          {t("backToRound")}
        </Button>
      </div>
      <header className="flex flex-col gap-1">
        <h1 id={headingId} ref={headingRef} tabIndex={-1} className="text-2xl font-semibold outline-none">
          {item.unitNo ?? item.code} · {tr(`utility.${item.utility}`)}
        </h1>
        <p className="text-muted">
          {item.code} · {previousLine}
        </p>
      </header>

      {step === "photo" ? (
        <>
          <CameraCapture
            label={t("shoot")}
            hint={t("guide")}
            labels={cameraLabels}
            guide="meter"
            fileBaseName={`meter-${item.code}`}
            onCapture={([file]) => {
              if (!file) return;
              setReadAt(new Date().toISOString());
              setPhoto({ blob: file, url: URL.createObjectURL(file) });
              setStep("value");
            }}
          />
          <Button variant="ghost" size="lg" onClick={() => setStep("value")} data-testid="capture-without-photo">
            {t("withoutPhoto")}
          </Button>
        </>
      ) : null}

      {step === "value" ? (
        <>
          <div className="flex items-start gap-3">
            {photo ? (
              "url" in photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- the local photo just taken
                <img
                  src={photo.url}
                  alt={t("photoAlt")}
                  className="rounded-control aspect-[4/3] w-1/2 object-cover"
                  data-testid="capture-photo"
                />
              ) : (
                <PhotoThumb fileId={photo.fileId} alt={t("photoAlt")} size="lg" className="w-1/2" />
              )
            ) : (
              <Callout tone="neutral" className="w-full">
                {t("noPhoto")}
              </Callout>
            )}
            {previous?.photoDocumentId ? (
              <figure className="flex w-1/2 flex-col gap-1">
                <PhotoThumb fileId={previous.photoDocumentId} alt={t("previousPhotoAlt")} size="lg" />
                <figcaption className="text-muted text-xs">{t("previousPhoto")}</figcaption>
              </figure>
            ) : null}
          </div>
          <NumericKeypad
            label={t("valueLabel")}
            unit={unit === "kWh" ? "kWh" : "m³"}
            labels={keypadLabels}
            value={value}
            onChange={setValue}
            maxDecimals={3}
            hint={photo ? t("valueHintPhoto") : t("valueHint")}
          />
          <Button
            size="xl"
            block
            disabled={!isCompleteDecimal(value)}
            onClick={() => void submit(value)}
            data-testid="capture-submit"
          >
            {t("submitTyped")}
          </Button>
          {photo ? (
            <Button
              size="xl"
              variant="secondary"
              block
              onClick={() => void submit(null)}
              data-testid="capture-submit-ocr"
            >
              {t("submitOcr")}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="lg"
            iconStart={IconCamera}
            onClick={() => {
              setPhoto(null);
              setStep("photo");
            }}
          >
            {photo ? t("retake") : t("takePhoto")}
          </Button>
        </>
      ) : null}

      {step === "sending" ? (
        <p className="text-muted py-8 text-center" role="status">
          {t("sending")}
        </p>
      ) : null}

      {step === "result" && entry ? (
        <div className="flex flex-col gap-4" data-testid="capture-result" data-state={entry.state}>
          {entry.state === "sent" && reading ? (
            <>
              <div className="rounded-card border-border bg-surface flex flex-col gap-2 border p-4">
                <span className="text-muted text-sm">{t("recorded")}</span>
                <span className="font-mono text-4xl font-semibold tabular-nums" data-testid="result-register">
                  {formatUnits(reading.register, readingUnit(reading.unit), locale)}
                </span>
                <span className="flex flex-wrap gap-2">
                  <ReadingSourceBadge source={reading.source} />
                  <DomainStatusBadge domain="reading" value={reading.reviewState} size="sm" />
                </span>
                <dl className="text-muted mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  {reading.ocrRawValue ? (
                    <>
                      <dt>{t("ocrValue")}</dt>
                      <dd className="tabular-nums" data-testid="result-ocr">
                        {formatUnits(reading.ocrRawValue, readingUnit(reading.unit), locale)}
                        {confidence ? ` · ${t("confidence", { percent: confidence })}` : null}
                      </dd>
                    </>
                  ) : null}
                  {previous ? (
                    <>
                      <dt>{t("previousLabel")}</dt>
                      <dd className="tabular-nums">{formatUnits(previous.register, unit, locale)}</dd>
                    </>
                  ) : null}
                  {reading.consumption ? (
                    <>
                      <dt>{t("consumption")}</dt>
                      <dd className="tabular-nums">
                        {formatUnits(reading.consumption, readingUnit(reading.unit), locale)}
                      </dd>
                    </>
                  ) : null}
                  <dt>{t("readAt")}</dt>
                  <dd>{formatDateTime(reading.readAt, locale)}</dd>
                </dl>
              </div>
              {reading.reviewState === "pending_review" ? (
                <Callout tone="warning" title={t("reviewTitle")}>
                  {t("reviewBody")}
                </Callout>
              ) : reading.reviewState === "accepted" ? (
                <Callout tone="success">{t("acceptedBody")}</Callout>
              ) : null}
            </>
          ) : null}

          {entry.state === "pending" ? (
            <Callout tone="info" title={t("queuedTitle")}>
              {t("queuedBody")}
            </Callout>
          ) : null}

          {entry.state === "conflict" && entry.problem ? (
            <>
              <Callout tone="danger" title={t("refusedTitle")}>
                {entry.problem.detail || entry.problem.code}
                {entry.problem.requestId ? (
                  <span className="text-muted block font-mono text-xs">
                    {common("requestId")}: {entry.problem.requestId}
                  </span>
                ) : null}
              </Callout>
              {entry.problem.code === "reading.unreadable" ? (
                <Button size="xl" block onClick={() => void resolve("value")} data-testid="resolve-type">
                  {t("typeInstead")}
                </Button>
              ) : entry.problem.code === "reading.photo_required" || entry.problem.code.startsWith("document.") ? (
                <Button size="xl" block iconStart={IconCamera} onClick={() => void resolve("photo")}>
                  {t("takePhoto")}
                </Button>
              ) : (
                <Button
                  size="xl"
                  block
                  onClick={async () => {
                    await retry(entry.id);
                    await replayQueue().catch(() => undefined);
                    const latest = await getEntry(entry.id);
                    if (latest) setEntry(latest);
                  }}
                >
                  {t("retry")}
                </Button>
              )}
              <Button variant="destructive" size="lg" onClick={() => void resolve("photo")}>
                {t("discardAndRedo")}
              </Button>
            </>
          ) : null}

          {entry.state !== "conflict" ? (
            <Button
              size="xl"
              block
              iconEnd={IconForward}
              onClick={() => onNext(item.assetItemId)}
              data-testid="capture-next"
            >
              {t("next")}
            </Button>
          ) : null}
          <Button variant="secondary" size="xl" block onClick={onClose}>
            {t("backToRound")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

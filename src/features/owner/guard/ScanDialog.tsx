"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { KioskButton as Button, KioskNote, KioskInput as Input } from "@/ui/components/Kiosk";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";
import { IconInfo } from "@/ui/icons/glyphs/info";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { Spinner } from "@/ui/components/Spinner";
import { barcodeDetectorClass } from "@/ui/components/ScanPanel";

import { KioskDialog } from "./KioskDialog";

export type ScanOutcome =
  { kind: "ok"; unitNo: string | null; visitId: string } | { kind: "queued" } | { kind: "refused"; message: string };

type Detect = (video: HTMLVideoElement, canvas: HTMLCanvasElement) => Promise<string | null>;

/**
 * The platform `BarcodeDetector` where the tablet has it (Chrome on Android); otherwise `jsqr` on canvas frames,
 * loaded only now (it never weighs on the `/gate` first load).
 */
export async function makeDetector(scope: unknown = globalThis): Promise<Detect> {
  const Detector = barcodeDetectorClass(scope);
  if (Detector) {
    const detector = new Detector({ formats: ["qr_code"] });
    return async (video) => {
      const codes = await detector.detect(video).catch(() => []);
      return codes[0]?.rawValue ?? null;
    };
  }
  const { default: jsQR } = await import("jsqr");
  return async (video, canvas) => {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return null;
    const scale = Math.min(1, 640 / Math.max(width, height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}

/**
 * "สแกน QR เชิญ" (J4.1 §3): the rear camera with a square guide, the code typed under the QR as the alternative, then
 * `POST /v1/guard/invites/actions/scan` — the API checks the window, the uses and the plate, and the visitor is in.
 */
export default function ScanDialog({
  onClose,
  onToken,
  plateNote,
}: {
  onClose: () => void;
  onToken: (token: string) => Promise<ScanOutcome>;
  plateNote: boolean;
}) {
  const t = useTranslations("owner.guard");
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [camera, setCamera] = useState<"starting" | "on" | "off">("starting");
  const [manual, setManual] = useState("");
  const [checking, setChecking] = useState(false);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (outcome) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play().catch(() => undefined);
        setCamera("on");
        const detect = await makeDetector();
        while (!stopped) {
          const value = video.current && canvas.current ? await detect(video.current, canvas.current) : null;
          if (value && !stopped) {
            stopped = true;
            setChecking(true);
            setOutcome(await onToken(value));
            setChecking(false);
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      } catch {
        if (!stopped) setCamera("off");
      }
    })();
    return () => {
      stopped = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onToken, outcome, round]);

  const submitManual = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!manual.trim()) return;
    setChecking(true);
    setOutcome(await onToken(manual.trim()));
    setChecking(false);
  };

  return (
    <KioskDialog
      open
      onClose={onClose}
      title={t("scan.title")}
      closeLabel={t("close")}
      variant="sheet"
      testId="scan-dialog"
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="rounded-panel border-border bg-bg-subtle relative aspect-[4/3] overflow-hidden border">
          <video ref={video} playsInline muted className="size-full object-cover" aria-label={t("scan.aim")} />
          <canvas ref={canvas} className="hidden" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-panel border-surface size-[55%] border-4 shadow-[0_0_0_2000px_rgb(0_0_0/0.25)]" />
          </div>
          {camera === "starting" ? (
            <p className="bg-surface/90 absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 py-3">
              <Spinner size="sm" label={t("scan.starting")} />
              <span aria-hidden>{t("scan.starting")}</span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-4">
          {outcome ? (
            <>
              {outcome.kind === "ok" ? (
                <KioskNote tone="success" icon={IconCheckCircle} title={t("scan.ok")}>
                  <span data-testid="scan-result">
                    {outcome.unitNo ? t("scan.okUnit", { unit: outcome.unitNo }) : null}
                  </span>
                </KioskNote>
              ) : outcome.kind === "queued" ? (
                <KioskNote tone="info" icon={IconInfo}>
                  {t("scan.queued")}
                </KioskNote>
              ) : (
                <KioskNote tone="danger" icon={IconXCircle}>
                  <span data-testid="scan-result">{outcome.message}</span>
                </KioskNote>
              )}
              <Button
                variant="secondary"
                size="xl"
                className="h-14"
                onClick={() => {
                  setOutcome(null);
                  setManual("");
                  setCamera("starting");
                  setRound((value) => value + 1);
                }}
              >
                {t("scan.again")}
              </Button>
            </>
          ) : checking ? (
            <p className="flex items-center gap-2 text-lg" aria-live="polite">
              <Spinner size="sm" label={t("scan.checking")} />
              <span aria-hidden>{t("scan.checking")}</span>
            </p>
          ) : (
            <p className="text-lg">{camera === "off" ? t("scan.noCamera") : t("scan.aim")}</p>
          )}
          {plateNote && !outcome ? <p className="text-muted text-sm">{t("scan.plateNote")}</p> : null}
          {!outcome ? (
            <form onSubmit={submitManual} className="flex flex-col gap-2">
              <label htmlFor="scan-manual" className="font-semibold">
                {t("scan.manual")}
              </label>
              <Input
                id="scan-manual"
                value={manual}
                onChange={(event) => setManual(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="h-14 font-mono text-lg"
                data-testid="scan-manual"
              />
              <Button
                type="submit"
                variant="secondary"
                size="xl"
                className="h-14"
                disabled={!manual.trim() || checking}
              >
                {t("scan.manualSubmit")}
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </KioskDialog>
  );
}

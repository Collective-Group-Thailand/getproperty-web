"use client";

import { useTranslations } from "next-intl";

import { KioskButton as Button, KioskChip } from "@/ui/components/Kiosk";
import { Icon } from "@/ui/icons";
import { IconCctv } from "@/ui/icons/glyphs/cctv";
import { IconShieldAlert } from "@/ui/icons/glyphs/shield-alert";
import { IconWarning } from "@/ui/icons/glyphs/warning";

import { IconHistory } from "@/ui/icons/glyphs/history";

import type { PlateDetection } from "./lib/api";
import { lprView } from "./lib/lpr";
import { formatPlate } from "./lib/plate";
import { bangkokTime } from "./lib/timers";

/** `0.94` → `94` for the read-out (a confidence, not money). */
export function confidencePercent(confidence: string): number {
  const value = Number(confidence);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

/**
 * The LPR camera's pending reads (J4.2 §3): unknown, blacklisted, ambiguous or unclear plates waiting for a guard.
 * "ใช้กรอกฟอร์ม" claims the read (first guard wins) and pre-fills the entry form; "ไม่ใช่รถเข้า" dismisses it.
 * Reads that reached the cloud late (`historical`, D-330) follow as "อ่านย้อนหลัง": the time the camera read the
 * plate and when it arrived, no action — they opened nothing and cannot be claimed.
 */
export function LprCard({
  detections,
  busy,
  onClaim,
  onDismiss,
}: {
  detections: readonly PlateDetection[];
  busy: string | null;
  onClaim: (detection: PlateDetection) => void;
  onDismiss: (detection: PlateDetection) => void;
}) {
  const t = useTranslations("owner.guard.lpr");
  const { claimable, late } = lprView(detections);
  if (claimable.length === 0 && late.length === 0) return null;
  return (
    <section
      aria-label={t("title")}
      className={
        claimable.length
          ? "rounded-card border-primary/40 bg-surface shadow-card flex shrink-0 flex-col border-2"
          : "rounded-card border-border bg-surface shadow-card flex shrink-0 flex-col border"
      }
      data-testid="lpr-card"
    >
      <header className="flex items-center gap-3 px-5 pt-3.5">
        <Icon icon={IconCctv} size={24} className="text-primary" />
        <h2 className="text-lg font-semibold">{t("title")}</h2>
      </header>
      <ul className="flex flex-col gap-2 p-3">
        {claimable.slice(0, 2).map((detection) => {
          const danger = detection.match === "blacklisted";
          return (
            <li key={detection.id} className="flex flex-col gap-3 px-2 py-1" data-testid="lpr-row">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-mono text-2xl font-semibold tracking-wide">{formatPlate(detection.plate)}</span>
                  {detection.plate.province ? <span className="text-muted">{detection.plate.province}</span> : null}
                </span>
                <span className="text-muted text-sm">
                  {t("confidence", { percent: confidencePercent(detection.confidence) })} ·{" "}
                  {t("at", { time: bangkokTime(detection.detectedAt) })}
                </span>
              </div>
              <KioskChip
                tone={danger ? "danger" : "warning"}
                icon={danger ? IconShieldAlert : IconWarning}
                className="w-fit"
              >
                {t(`match.${detection.match}`)}
              </KioskChip>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="lg"
                  className="h-14 flex-1"
                  loading={busy === detection.id}
                  onClick={() => onClaim(detection)}
                  data-testid="lpr-claim"
                >
                  {t("claim")}
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  className="h-14"
                  onClick={() => onDismiss(detection)}
                  data-testid="lpr-dismiss"
                >
                  {t("dismiss")}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {late.length ? (
        <div className="border-border flex flex-col gap-1 border-t px-5 pt-3 pb-4" data-testid="lpr-late">
          <h3 className="text-muted flex items-center gap-2 text-base font-medium">
            <Icon icon={IconHistory} size={20} className="text-subtle" />
            {t("late.title")}
          </h3>
          <p className="text-muted m-0 text-base">{t("late.note")}</p>
          <ul className="m-0 flex list-none flex-col p-0">
            {late.map((detection) => (
              <li
                key={detection.id}
                className="border-border flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-2.5 last:border-b-0"
                data-testid="lpr-late-row"
                data-state={detection.state}
              >
                <span className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-mono text-xl font-semibold tracking-wide">{formatPlate(detection.plate)}</span>
                  {detection.plate.province ? <span className="text-muted">{detection.plate.province}</span> : null}
                </span>
                <span className="text-muted text-base">
                  {t("late.when", {
                    read: bangkokTime(detection.detectedAt),
                    received: bangkokTime(detection.receivedAt),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

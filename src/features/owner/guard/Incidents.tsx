"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { KioskButton as Button } from "@/ui/components/Kiosk";
import { TakeoverBanner } from "@/ui/components/TakeoverBanner";
import { IconFlame } from "@/ui/icons/glyphs/flame";
import { IconHeartPulse } from "@/ui/icons/glyphs/heart-pulse";
import { IconMore } from "@/ui/icons/glyphs/more";
import { IconShieldAlert } from "@/ui/icons/glyphs/shield-alert";
import { IconSiren } from "@/ui/icons/glyphs/siren";

import type { GuardIncident } from "./lib/api";
import { bangkokTime, durationParts, sinceMs } from "./lib/timers";
import { useNow } from "./lib/useNow";

export const INCIDENT_ICONS = {
  fire: IconFlame,
  medical: IconHeartPulse,
  intrusion: IconShieldAlert,
  other: IconMore,
} as const;

/** A short two-tone chime for a new SOS (Web Audio: no file, no library); silent where audio is not allowed yet. */
export function chime(): void {
  try {
    const AudioCtx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const context = new AudioCtx();
    [880, 660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.15;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + index * 0.25);
      oscillator.stop(context.currentTime + index * 0.25 + 0.2);
    });
    setTimeout(() => void context.close(), 1200);
  } catch {
    // no audio on this device
  }
}

/**
 * The SOS takeover (J4.2 §5, J-DESIGN §4): every open incident of the estate as a band across the top, above the PIN
 * pad too; acknowledge first, then resolve. An acknowledged one stays as a calmer amber band until it is resolved.
 */
export function SosBanners({
  incidents,
  busy,
  onAcknowledge,
  onResolve,
}: {
  incidents: readonly GuardIncident[];
  busy: string | null;
  onAcknowledge: (incident: GuardIncident) => void;
  onResolve: (incident: GuardIncident) => void;
}) {
  const t = useTranslations("owner.guard.incident");
  const tk = useTranslations("owner.guard.sos.kinds");
  const now = useNow(15_000);
  const active = incidents.filter((incident) => incident.state === "open" || incident.state === "acknowledged");
  const open = active.filter((incident) => incident.state === "open");
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const fresh = open.filter((incident) => !seen.current.has(incident.id));
    fresh.forEach((incident) => seen.current.add(incident.id));
    if (fresh.length > 0) chime();
  }, [open]);

  if (active.length === 0) return null;
  const ordered = [...open, ...active.filter((incident) => incident.state === "acknowledged")];
  const shown = ordered.slice(0, 2);

  return (
    <div className="flex flex-col" data-testid="sos-banners">
      {shown.map((incident) => {
        const kind = tk(incident.kind);
        const { minutes, hours } = durationParts(sinceMs(incident.createdAt, now));
        return (
          <TakeoverBanner
            key={incident.id}
            icon={IconSiren}
            tone={incident.state === "open" ? "alert" : "acknowledged"}
            title={incident.unit ? t("titleUnit", { kind, unit: incident.unit.unitNo }) : t("title", { kind })}
            meta={
              <>
                {hours * 60 + minutes === 0
                  ? t("metaJustNow", { source: t(`source.${incident.source}`), time: bangkokTime(incident.createdAt) })
                  : t("meta", {
                      source: t(`source.${incident.source}`),
                      time: bangkokTime(incident.createdAt),
                      minutes: hours * 60 + minutes,
                    })}
                {incident.note ? ` · ${incident.note}` : ""}
                {incident.visitCount > 0 ? ` · ${t("visits", { count: incident.visitCount })}` : ""}
                {incident.state === "acknowledged" ? ` · ${t("acknowledged")}` : ""}
              </>
            }
          >
            {incident.state === "open" ? (
              <Button
                variant="secondary"
                size="xl"
                className="h-16 min-w-48 text-xl"
                loading={busy === incident.id}
                onClick={() => onAcknowledge(incident)}
                data-testid="sos-acknowledge"
              >
                {t("acknowledge")}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="xl"
                className="h-14"
                onClick={() => onResolve(incident)}
                data-testid="sos-resolve"
              >
                {t("resolve")}
              </Button>
            )}
          </TakeoverBanner>
        );
      })}
      {ordered.length > shown.length ? (
        <p className="bg-surface border-border border-b px-6 py-2 text-sm font-medium">
          {t("more", { count: ordered.length - shown.length })}
        </p>
      ) : null}
    </div>
  );
}

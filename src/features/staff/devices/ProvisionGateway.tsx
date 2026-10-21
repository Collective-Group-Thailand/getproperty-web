"use client";

import { DEVICE_STATUS } from "@/domain/status/device";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { useRealtimeEvents } from "@/features/shared/realtime/RealtimeProvider";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { ScanButton } from "@/ui/components/ScanButton";
import { Stepper } from "@/ui/components/Stepper";
import { IconCopy } from "@/ui/icons/glyphs/copy";
import { IconExternal } from "@/ui/icons/glyphs/external";
import { IconForward } from "@/ui/icons/glyphs/forward";

import { useScanLabels } from "../shared/labels";
import { statusPageUrl } from "./statusPage";

type Step = "scan" | "code" | "online";

/** After this long without the gateway, the screen suggests checks (a UX hint, not a business rule). */
const HINT_AFTER_MS = 10 * 60_000;
const POLL_MS = 15_000;

/**
 * Gateway provisioning (F4 4.3, D-033, D-130): scan the gateway's QR (its serial) → the API issues a
 * single-use provisioning code (72 h) → the installer enters it on the gateway's LAN status page
 * (`http://<gateway-ip>:8080`, getproperty-edge) → the network check waits for the gateway to bootstrap
 * and send its first heartbeat, by the realtime stream (`device.bootstrapped`, `device.online`) with a
 * slow poll as a fallback.
 */
export function ProvisionGateway({
  buildingId,
  candidates,
  initialSerial,
}: {
  buildingId: string;
  /** Gateways assigned to this building and not yet online (a shortcut to scanning). */
  candidates: Schemas["FleetDeviceDto"][];
  initialSerial?: string;
}) {
  const t = useTranslations("staff.devices.provision");
  const common = useTranslations("common");
  const locale = useLocale() as Locale;
  const format = useFormatter();
  const scanLabels = useScanLabels();
  const ipId = useId();
  const [step, setStep] = useState<Step>("scan");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ detail: string; requestId?: string } | null>(null);
  const [code, setCode] = useState<Schemas["ProvisioningCodeDto"] | null>(null);
  const [device, setDevice] = useState<Schemas["FleetDeviceDto"] | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [ip, setIp] = useState("");
  const [copied, setCopied] = useState(false);

  // One Idempotency-Key per serial being provisioned, reused when the same serial is sent again after a
  // failure (the API replays the first answer, contract §3); a new serial or a success starts a new key.
  const attempt = useRef<{ serial: string; key: string } | null>(null);

  const provision = useCallback(
    async (serial: string) => {
      setBusy(true);
      setError(null);
      const trimmed = serial.trim();
      if (attempt.current?.serial !== trimmed) attempt.current = { serial: trimmed, key: crypto.randomUUID() };
      try {
        const issued = await unwrap(
          browserApi().POST("/v1/staff/devices/actions/provision", {
            params: { header: { "Idempotency-Key": attempt.current.key } },
            body: { serial: trimmed, buildingId },
          }),
        );
        attempt.current = null;
        setCode(issued);
        setStartedAt(Date.now());
        setNow(Date.now());
        setStep("code");
      } catch (failure) {
        setError(
          isApiError(failure)
            ? { detail: failure.detail || failure.code, requestId: failure.requestId }
            : { detail: t("offline") },
        );
      } finally {
        setBusy(false);
      }
    },
    [buildingId, t],
  );

  const check = useCallback(async () => {
    if (!code) return;
    try {
      const detail = await unwrap(
        browserApi().GET("/v1/staff/devices/{deviceId}", { params: { path: { deviceId: code.deviceId } } }),
      );
      setDevice(detail.device);
      if (detail.device.status === "online" || detail.device.status === "degraded") setStep("online");
    } catch {
      // keep waiting: the next event or poll tries again
    }
  }, [code]);

  useRealtimeEvents(
    useCallback(
      (event) => {
        if (code && event.type.startsWith("device.") && event.ids.aggregateId === code.deviceId) void check();
      },
      [check, code],
    ),
  );

  useEffect(() => {
    if (step !== "code") return;
    const poll = window.setInterval(() => void check(), POLL_MS);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [check, step]);

  const steps = [
    { id: "scan", label: t("steps.scan") },
    { id: "code", label: t("steps.code") },
    { id: "online", label: t("steps.online") },
  ];
  const index = steps.findIndex((candidate) => candidate.id === step);
  const waited = now - startedAt;
  const link = statusPageUrl(ip);

  return (
    <section
      className="flex flex-col gap-5 py-6"
      aria-labelledby="provision-title"
      data-testid="provision"
      data-step={step}
    >
      <h1 id="provision-title" className="text-2xl font-semibold">
        {t("title")}
      </h1>
      <Stepper
        steps={steps}
        current={index}
        label={t("stepsLabel")}
        progressText={t("stepOf", { step: index + 1, total: steps.length })}
      />

      {error ? (
        <Callout tone="danger" title={t("errorTitle")}>
          {error.detail}
          {error.requestId ? (
            <span className="text-muted block font-mono text-xs">
              {common("requestId")}: {error.requestId}
            </span>
          ) : null}
        </Callout>
      ) : null}

      {step === "scan" ? (
        <div className="flex flex-col gap-4">
          <p className="text-muted">{t("scanHint")}</p>
          {initialSerial ? (
            <Button
              size="xl"
              block
              loading={busy}
              onClick={() => void provision(initialSerial)}
              data-testid="provision-initial"
            >
              {t("provisionSerial", { serial: initialSerial })}
            </Button>
          ) : null}
          <ScanButton label={t("scan")} labels={scanLabels} onScan={(value) => void provision(value)} disabled={busy} />
          {candidates.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h2 className="font-semibold">{t("assigned")}</h2>
              {candidates.map((gateway) => (
                <Button
                  key={gateway.id}
                  variant="secondary"
                  size="xl"
                  block
                  loading={busy}
                  onClick={() => void provision(gateway.serial)}
                  data-testid="provision-candidate"
                >
                  <span className="font-mono">{gateway.serial}</span>
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {step === "code" && code ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-card border-border bg-surface flex flex-col items-center gap-2 border p-5 text-center">
            <span className="text-muted text-sm">{t("codeLabel")}</span>
            <span className="font-mono text-4xl font-semibold tracking-wider" data-testid="provision-code">
              {code.code}
            </span>
            <span className="text-muted text-sm">{t("expires", { date: formatDateTime(code.expiresAt, locale) })}</span>
            <Button
              variant="secondary"
              size="lg"
              iconStart={IconCopy}
              onClick={async () => {
                await navigator.clipboard?.writeText(code.code).catch(() => undefined);
                setCopied(true);
              }}
            >
              {copied ? t("copied") : t("copy")}
            </Button>
          </div>
          <ol className="flex list-decimal flex-col gap-2 ps-6">
            <li>{t("instructions.power")}</li>
            <li>{t("instructions.page")}</li>
            <li>{t("instructions.enter")}</li>
          </ol>
          <div className="flex flex-col gap-1">
            <label htmlFor={ipId} className="text-muted text-sm font-medium">
              {t("ipLabel")}
            </label>
            <input
              id={ipId}
              value={ip}
              inputMode="decimal"
              autoComplete="off"
              placeholder={t("ipPlaceholder")}
              onChange={(event) => setIp(event.target.value)}
              className="rounded-control border-border-strong bg-surface h-14 border px-4 font-mono text-lg"
            />
            {link ? (
              <Button asChild variant="secondary" size="xl" block iconEnd={IconExternal}>
                <a href={link} target="_blank" rel="noreferrer" data-testid="status-page-link">
                  {t("openStatusPage")}
                </a>
              </Button>
            ) : null}
          </div>
          <Callout tone="info" title={t("waitingTitle")}>
            <span role="status" data-testid="network-check">
              {t("waiting", { elapsed: format.relativeTime(startedAt, now) })}
            </span>
            {device ? (
              <span className="mt-2 flex items-center gap-2">
                <StatusBadgeOf map={DEVICE_STATUS} value={device.status} size="sm" />
              </span>
            ) : null}
          </Callout>
          {waited > HINT_AFTER_MS ? <Callout tone="warning">{t("slowHint")}</Callout> : null}
        </div>
      ) : null}

      {step === "online" && device ? (
        <div className="flex flex-col gap-4" data-testid="provision-online">
          <Callout tone="success" title={t("onlineTitle", { serial: device.serial })}>
            {t("onlineBody", {
              link: device.health?.link ?? "—",
              version: device.health?.agentVersion ?? device.firmwareVersion ?? "—",
            })}
          </Callout>
          <Button asChild size="xl" block iconEnd={IconForward}>
            <Link href={`/devices/install?gateway=${encodeURIComponent(device.id)}`}>{t("installMeters")}</Link>
          </Button>
          <Button asChild variant="secondary" size="xl" block>
            <Link href={`/devices/${device.id}`}>{t("openGateway")}</Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
}

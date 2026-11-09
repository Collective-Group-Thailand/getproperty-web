"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import { KioskButton as Button } from "@/ui/components/Kiosk";
import { IconSiren } from "@/ui/icons/glyphs/siren";
import { IconUnlock } from "@/ui/icons/glyphs/unlock";
import { cx as cn } from "@/ui/lib/cx";

import { barrierOf, DeskHeader } from "./DeskHeader";
import { EMPTY_FORM, EntryCard, toRecordInput, type EntryForm, type EntryResult } from "./EntryCard";
import { SosBanners } from "./Incidents";
import { LprCard } from "./LprCard";
import type { ScanOutcome } from "./ScanDialog";
import { WaitingCard, InsideCard } from "./VisitLists";
import {
  guardFetch,
  type GuardIncident,
  type GuardMe,
  type GuardResult,
  type GuardUnit,
  type GuardVisit,
} from "./lib/api";
import { isPlateEmpty, normalisePlate, type PlateField } from "./lib/plate";
import { pendingCount } from "./lib/queue";
import { autoLockMinutes, isIdle } from "./lib/timers";
import { useDesk } from "./lib/useDesk";
import type { GateSnapshot } from "./server";

// Everything the guard opens later loads on first use: the `/gate` first load stays inside 180 KB (D-179).
const ScanDialog = dynamic(() => import("./ScanDialog"), { ssr: false });
const SosDialog = dynamic(() => import("./SosDialog"), { ssr: false });
const PlateSheet = dynamic(() => import("./PlateSheet").then((module) => module.PlateSheet), { ssr: false });
const DestinationPicker = dynamic(() => import("./DestinationPicker").then((module) => module.DestinationPicker), {
  ssr: false,
});
const NoteDialog = dynamic(() => import("./Dialogs").then((module) => module.NoteDialog), { ssr: false });
const ManageVisitDialog = dynamic(() => import("./Dialogs").then((module) => module.ManageVisitDialog), { ssr: false });
const OpenBarrierDialog = dynamic(() => import("./Dialogs").then((module) => module.OpenBarrierDialog), { ssr: false });
const PinStep = dynamic(() => import("./SignIn").then((module) => module.PinStep), { ssr: false });

type Dialog =
  | { kind: "plate"; field: PlateField }
  | { kind: "destination" }
  | { kind: "scan" }
  | { kind: "sos" }
  | { kind: "manage"; visit: GuardVisit }
  | { kind: "open" }
  | { kind: "switch" }
  | { kind: "resolve"; incident: GuardIncident }
  | null;

interface Notice {
  tone: "info" | "danger";
  text: string;
}

function problemText(result: GuardResult<unknown>, fallback: string, offline: string): string {
  if (result.ok) return "";
  if (result.offline) return offline;
  return result.problem?.detail ?? result.problem?.title ?? fallback;
}

/** The screen wake lock (kiosk): kept while the desk is visible, taken again when the tablet wakes the page. */
function useWakeLock() {
  useEffect(() => {
    let sentinel: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    const take = async () => {
      if (document.visibilityState !== "visible" || !nav.wakeLock) return;
      sentinel = await nav.wakeLock.request("screen").catch(() => null);
    };
    void take();
    document.addEventListener("visibilitychange", take);
    return () => {
      document.removeEventListener("visibilitychange", take);
      void sentinel?.release().catch(() => undefined);
    };
  }, []);
}

/**
 * The gate desk (J-DESIGN §3 gate-tablet): header; the SOS takeover above everything; the visitor entry on the left
 * (60 %) and the live lists on the right (40 %), stacked on a portrait tablet; the tablet's SOS at the foot. Locks to
 * the PIN pad after `autoLockMinutes` without a touch — the lists, the stream and the SOS banner stay alive.
 */
export function Desk({
  me,
  snapshot,
  onSessionEnded,
  onSessionRenewed,
}: {
  me: GuardMe;
  /** The lists as the server rendered them (`/gate` SSR), so nothing moves while the first fetch runs. */
  snapshot?: GateSnapshot | null;
  /** The session is over (401, shift ended): back to the roster. */
  onSessionEnded: (reason: "unauthorised" | "switch" | "device") => void;
  /** Unlocked with the PIN: a new shift token, `me` is read again. */
  onSessionRenewed: () => void;
}) {
  const t = useTranslations("owner.guard");
  const { state, actions } = useDesk(me, () => onSessionEnded("unauthorised"), snapshot);
  const [form, setFormState] = useState<EntryForm>(EMPTY_FORM);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [result, setResult] = useState<EntryResult | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [locked, setLocked] = useState(false);
  const lastActivity = useRef(0);
  const lockAfter = autoLockMinutes(me);
  const hasBarrier = barrierOf(state.hardware) !== null;
  const offline = state.network === "offline";

  useWakeLock();

  const setForm = useCallback((update: (current: EntryForm) => EntryForm) => setFormState(update), []);

  // Inactivity → lock. Offline the PIN cannot be checked by the API, so the desk stays open until it can.
  useEffect(() => {
    const touch = () => {
      lastActivity.current = Date.now();
    };
    touch();
    window.addEventListener("pointerdown", touch, { passive: true });
    window.addEventListener("keydown", touch);
    const id = setInterval(() => {
      if (!locked && state.network === "online" && isIdle(lastActivity.current, Date.now(), lockAfter * 60_000)) {
        setDialog(null);
        setLocked(true);
      }
    }, 15_000);
    return () => {
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
      clearInterval(id);
    };
  }, [locked, state.network, lockAfter]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 6_000);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    if (!result) return;
    const id = setTimeout(() => setResult(null), 12_000);
    return () => clearTimeout(id);
  }, [result]);

  const fail = (outcome: GuardResult<unknown>) =>
    setNotice({ tone: "danger", text: problemText(outcome, t("problem.generic"), t("problem.offline")) });

  const openBarrier = async (body: Parameters<typeof actions.open>[0]) => {
    const outcome = await actions.open(body);
    if (outcome.ok) {
      setNotice({ tone: "info", text: t("open.sent") });
      return true;
    }
    if (outcome.status === 429)
      setNotice({ tone: "danger", text: t("open.tooSoon", { seconds: outcome.retryAfterS ?? 3 }) });
    else if (outcome.problem?.code === "gate.no_barrier") setNotice({ tone: "danger", text: t("open.noBarrier") });
    else fail(outcome);
    return false;
  };

  const letIn = async (visit: GuardVisit, reason?: string) => {
    setBusy(visit.id);
    const entered = await actions.enter(visit.id, reason);
    // Already entered elsewhere (another tablet): the barrier still opens for the car in front of the guard.
    const alreadyIn = !entered.ok && entered.status === 409;
    if (!entered.ok && !alreadyIn) {
      setBusy(null);
      fail(entered);
      return false;
    }
    if (hasBarrier) await openBarrier({ reason: "visit", visitId: visit.id });
    setBusy(null);
    return true;
  };

  const submit = async () => {
    setSubmitting(true);
    const input = toRecordInput(form);
    const outcome = await actions.record(input, offline);
    setSubmitting(false);
    const unit = input.unitNo ?? "—";
    if (outcome.kind === "queued") {
      setResult({ tone: "info", text: t("entry.result.queued") });
    } else if (outcome.kind === "conflict") {
      setResult({
        tone: "danger",
        text: `${t("entry.result.conflict")}: ${outcome.entry.problem?.detail ?? outcome.entry.problem?.title ?? t("problem.generic")}`,
      });
      return;
    } else if (outcome.visit.replayed) {
      setResult({ tone: "info", text: t("entry.result.replayed") });
    } else if (outcome.visit.state === "denied") {
      setResult({
        tone: "danger",
        text: outcome.visit.decisionReason === "blacklisted" ? t("entry.result.blacklisted") : t("entry.result.denied"),
      });
    } else if (outcome.visit.state === "entered") {
      setResult({ tone: "success", text: t("entry.result.entered", { unit }) });
    } else if (outcome.visit.state === "requested") {
      setResult({ tone: "info", text: t("entry.result.requested", { unit }) });
    } else {
      setResult({
        tone: "info",
        text: t(`entry.result.${outcome.visit.state === "approved" ? "approved" : "timed_out"}`, { unit }),
      });
    }
    if (form.photo) URL.revokeObjectURL(form.photo.previewUrl);
    setFormState(EMPTY_FORM);
  };

  const scanToken = useCallback(
    async (token: string): Promise<ScanOutcome> => {
      const plate = normalisePlate(form.plate);
      const outcome = await actions.scan(token, isPlateEmpty(plate) ? undefined : plate);
      if ("queued" in outcome) return { kind: "queued" };
      if (outcome.ok) return { kind: "ok", unitNo: outcome.data.unitNo, visitId: outcome.data.id };
      return { kind: "refused", message: problemText(outcome, t("problem.generic"), t("problem.offline")) };
    },
    [actions, form.plate, t],
  );

  const claim = async (detectionId: string) => {
    const detection = state.detections.find((candidate) => candidate.id === detectionId);
    if (!detection) return;
    setBusy(detection.id);
    const outcome = await actions.claim(detection.id);
    if (!outcome.ok) {
      setBusy(null);
      if (outcome.status === 409) setNotice({ tone: "danger", text: t("lpr.taken") });
      else fail(outcome);
      return;
    }
    let unit: GuardUnit | null = null;
    if (detection.unit) {
      const units = await guardFetch<GuardUnit[]>(
        `/v1/guard/units?limit=10&q=${encodeURIComponent(detection.unit.unitNo)}`,
      );
      unit = units.ok ? (units.data.find((candidate) => candidate.unitId === detection.unit!.id) ?? null) : null;
    }
    setBusy(null);
    setFormState((current) => ({
      ...current,
      plate: {
        category: detection.plate.category,
        number: detection.plate.number,
        province: detection.plate.province ?? "",
      },
      ...(unit ? { unit } : {}),
    }));
    setNotice({ tone: "info", text: t("lpr.claimed") });
  };

  const pending = pendingCount(state.queue);
  const conflicts = state.queue.filter((entry) => entry.state === "conflict");
  const queuedInside = state.queue.filter((entry) => entry.state === "pending");

  return (
    <div
      data-surface="gate"
      className="bg-bg text-fg flex min-h-dvh flex-col text-base lg:h-dvh lg:min-h-0"
      data-testid="gate-desk"
      data-locked={locked || undefined}
    >
      <div className="sticky top-0 z-30 shrink-0">
        <SosBanners
          incidents={state.incidents}
          busy={busy}
          onAcknowledge={async (incident) => {
            setBusy(incident.id);
            const outcome = await actions.acknowledge(incident.id);
            setBusy(null);
            if (!outcome.ok) fail(outcome);
          }}
          onResolve={(incident) => setDialog({ kind: "resolve", incident })}
        />
      </div>

      {locked ? (
        <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-10" data-testid="lock-screen">
          <p className="text-muted text-lg">{t("pin.lockedLede", { minutes: lockAfter })}</p>
          <PinStep
            guard={{ guardId: me.guardId, displayName: me.guardName }}
            title={t("pin.lockedScreen")}
            submitLabel={t("pin.unlock")}
            backLabel={t("pin.otherGuard")}
            onBack={() => setDialog({ kind: "switch" })}
            onSignedIn={() => {
              lastActivity.current = Date.now();
              setLocked(false);
              onSessionRenewed();
            }}
            onDeviceGone={() => onSessionEnded("device")}
          />
        </main>
      ) : (
        <>
          <DeskHeader
            me={me}
            network={state.network}
            stream={state.stream}
            pending={pending}
            hardware={state.hardware}
            onLock={() => setLocked(true)}
            onSwitchShift={() => setDialog({ kind: "switch" })}
          />
          <main className="grid flex-1 items-start gap-5 p-5 lg:min-h-0 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-rows-1 lg:items-stretch">
            <EntryCard
              me={me}
              form={form}
              setForm={setForm}
              network={state.network}
              hardware={state.hardware}
              result={result}
              submitting={submitting}
              onOpenPlate={(field) => setDialog({ kind: "plate", field })}
              onOpenDestination={() => setDialog({ kind: "destination" })}
              onSubmit={() => void submit()}
              onScan={() => setDialog({ kind: "scan" })}
            />
            <div className="flex min-w-0 flex-col gap-4 lg:min-h-0">
              <div className="relative flex flex-col gap-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pe-1">
                <LprCard
                  detections={state.detections}
                  busy={busy}
                  onClaim={(detection) => void claim(detection.id)}
                  onDismiss={async (detection) => {
                    const outcome = await actions.dismiss(detection.id);
                    if (!outcome.ok) fail(outcome);
                  }}
                />
                <WaitingCard
                  visits={state.waiting}
                  conflicts={conflicts}
                  hasBarrier={hasBarrier}
                  dismissed={dismissed}
                  onLetIn={(visit) => void letIn(visit)}
                  onManage={(visit) => setDialog({ kind: "manage", visit })}
                  onDismiss={(visit) => setDismissed((current) => [...current, visit.id])}
                  onRetry={(entry) => void actions.retryEntry(entry.id)}
                  onDiscard={(entry) => void actions.discardEntry(entry.id)}
                />
                <InsideCard
                  visits={state.inside}
                  queued={queuedInside}
                  overstayed={state.overstayed}
                  exiting={busy}
                  onExit={async (visit) => {
                    setBusy(visit.id);
                    const outcome = await actions.exit(visit.id);
                    setBusy(null);
                    if (!outcome.ok) fail(outcome);
                  }}
                />
              </div>
              <div className="flex shrink-0 gap-3">
                {hasBarrier ? (
                  <Button
                    variant="secondary"
                    size="xl"
                    className="h-16 flex-1 text-xl"
                    iconStart={IconUnlock}
                    onClick={() => setDialog({ kind: "open" })}
                    data-testid="open-barrier"
                  >
                    {t("header.openBarrier")}
                  </Button>
                ) : null}
                <Button
                  variant="destructive"
                  size="xl"
                  className="h-16 flex-1 border-2 text-xl"
                  iconStart={IconSiren}
                  onClick={() => setDialog({ kind: "sos" })}
                  data-testid="sos-button"
                >
                  {t("sos.button")}
                </Button>
              </div>
            </div>
          </main>
        </>
      )}

      <div
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-6 transition-opacity",
          notice ? "opacity-100" : "opacity-0",
        )}
      >
        {notice ? (
          <p
            className="rounded-card border-border-strong bg-surface shadow-overlay max-w-2xl border-2 px-6 py-4 text-lg font-medium"
            data-testid="notice"
            data-tone={notice.tone}
          >
            {notice.text}
          </p>
        ) : null}
      </div>

      {dialog?.kind === "plate" ? (
        <PlateSheet
          initial={form.plate}
          field={dialog.field}
          onClose={() => setDialog(null)}
          onDone={(plate) => {
            setFormState((current) => ({ ...current, plate }));
            setDialog(null);
          }}
        />
      ) : null}
      {dialog?.kind === "destination" ? (
        <DestinationPicker
          gateId={me.gateId}
          onClose={() => setDialog(null)}
          onChoose={(unit) => {
            setFormState((current) => ({ ...current, unit }));
            setDialog(null);
          }}
        />
      ) : null}
      {dialog?.kind === "scan" ? (
        <ScanDialog onClose={() => setDialog(null)} onToken={scanToken} plateNote={!isPlateEmpty(form.plate)} />
      ) : null}
      {dialog?.kind === "sos" ? (
        <SosDialog
          onClose={() => setDialog(null)}
          onSend={async (kind, note) => {
            const outcome = await actions.raise(kind, note || undefined);
            if (outcome.ok) setNotice({ tone: "info", text: t("sos.sent") });
            else fail(outcome);
            return outcome.ok;
          }}
        />
      ) : null}
      {dialog?.kind === "manage" ? (
        <ManageVisitDialog
          visit={dialog.visit}
          onClose={() => setDialog(null)}
          onOverride={(reason) => letIn(dialog.visit, reason)}
          onCancel={async (reason) => {
            const outcome = await actions.cancel(dialog.visit.id, reason || undefined);
            if (!outcome.ok) fail(outcome);
            return outcome.ok;
          }}
        />
      ) : null}
      {dialog?.kind === "open" ? (
        <OpenBarrierDialog
          onClose={() => setDialog(null)}
          onOpen={(reason, note) => openBarrier({ reason, ...(note ? { note } : {}) })}
        />
      ) : null}
      {dialog?.kind === "switch" ? (
        <NoteDialog
          title={t("header.switchConfirmTitle", { name: me.guardName })}
          lede={t("header.switchLede")}
          confirm={t("header.switchConfirm")}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await guardFetch("/session/sign-out", { method: "POST" });
            onSessionEnded("switch");
          }}
          testId="switch-shift"
        />
      ) : null}
      {dialog?.kind === "resolve" ? (
        <NoteDialog
          title={t("incident.resolveTitle")}
          noteLabel={t("incident.resolveNote")}
          confirm={t("incident.resolve")}
          onClose={() => setDialog(null)}
          onConfirm={async (note) => {
            const outcome = await actions.resolve(dialog.incident.id, note || undefined);
            if (!outcome.ok) fail(outcome);
            return outcome.ok;
          }}
          testId="resolve-incident"
        />
      ) : null}
    </div>
  );
}

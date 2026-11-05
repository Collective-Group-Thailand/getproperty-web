"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useReducer, useState } from "react";

import { KioskButton as Button, KioskAvatar } from "@/ui/components/Kiosk";
import { PinPad } from "@/ui/components/PinPad";
import { Icon } from "@/ui/icons";
import { IconBack } from "@/ui/icons/glyphs/back";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { cx as cn } from "@/ui/lib/cx";

import { guardFetch, type GuardProblem, type Roster } from "./lib/api";
import { canSubmit, INITIAL_PIN, PIN_MAX, pinReducer } from "./lib/pin";
import { formatStopwatch, lockoutSecondsLeft } from "./lib/timers";
import { useNow } from "./lib/useNow";

type Guard = Roster["guards"][number];

/** `POST /bff/guard/session/sign-in` and what the pad should say about the answer. */
export async function signIn(guardId: string, pin: string) {
  const result = await guardFetch<{ subject: unknown }>("/session/sign-in", { method: "POST", body: { guardId, pin } });
  if (result.ok) return { ok: true as const };
  const problem: GuardProblem | null = result.problem;
  if (result.status === 423)
    return { ok: false as const, error: "locked" as const, lockedUntil: problem?.lockedUntil ?? null };
  if (result.offline || result.status === 0 || result.status >= 500)
    return { ok: false as const, error: "unavailable" as const };
  if (problem?.code === "gate.device_unknown") return { ok: false as const, error: "device" as const };
  return { ok: false as const, error: "invalid" as const };
}

export function PinStep({
  guard,
  onSignedIn,
  onBack,
  backLabel,
  title,
  lede,
  submitLabel,
  onDeviceGone,
}: {
  guard: Pick<Guard, "guardId" | "displayName"> & { locked?: boolean };
  onSignedIn: () => void;
  onBack?: () => void;
  backLabel: string;
  title: string;
  lede?: string;
  submitLabel: string;
  onDeviceGone: () => void;
}) {
  const t = useTranslations("owner.guard.pin");
  const [state, dispatch] = useReducer(pinReducer, INITIAL_PIN);
  const now = useNow(1000);
  const lockLeft = lockoutSecondsLeft(state.lockedUntil, now);

  useEffect(() => {
    if (state.lockedUntil && lockLeft === 0) dispatch({ type: "unlockedByTime" });
  }, [lockLeft, state.lockedUntil]);

  const submit = useCallback(async () => {
    if (!canSubmit(state)) return;
    dispatch({ type: "submit" });
    const outcome = await signIn(guard.guardId, state.digits);
    if (outcome.ok) return onSignedIn();
    if (outcome.error === "device") return onDeviceGone();
    dispatch({
      type: "refused",
      error: outcome.error,
      lockedUntil: "lockedUntil" in outcome ? outcome.lockedUntil : null,
    });
  }, [guard.guardId, onDeviceGone, onSignedIn, state]);

  // A full PIN of the maximum length goes by itself; shorter PINs use the button.
  useEffect(() => {
    if (state.digits.length === PIN_MAX && !state.submitting) void submit();
  }, [state.digits, state.submitting, submit]);

  const message =
    lockLeft > 0
      ? t("locked", { time: formatStopwatch(lockLeft * 1000) })
      : state.error === "invalid"
        ? t("invalid")
        : state.error === "unavailable"
          ? t("unavailable")
          : state.submitting
            ? t("submitting")
            : (lede ?? "");

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6" data-testid="pin-step">
      <div className="flex flex-col items-center gap-3 text-center">
        <KioskAvatar name={guard.displayName} size="lg" />
        <h1 className="text-2xl font-semibold">{title}</h1>
      </div>
      <PinPad
        length={state.digits.length}
        maxLength={PIN_MAX}
        onDigit={(value) => dispatch({ type: "digit", value })}
        onBackspace={() => dispatch({ type: "backspace" })}
        disabled={state.submitting || lockLeft > 0}
        labels={{ backspace: t("backspace"), entered: t("entered", { count: state.digits.length }) }}
        message={message}
        messageTone={lockLeft > 0 ? "warning" : state.error ? "danger" : "neutral"}
      />
      <div className="flex w-full flex-col gap-3">
        <Button
          size="xl"
          block
          className="h-16"
          disabled={!canSubmit(state)}
          loading={state.submitting}
          onClick={() => void submit()}
          data-testid="pin-submit"
        >
          {submitLabel}
        </Button>
        {onBack ? (
          <Button variant="ghost" size="xl" block className="h-14" iconStart={IconBack} onClick={onBack}>
            {backLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Roster → PIN (D-320): the guards of this tablet's estate, a locked guard marked, then the pad. */
export function SignIn({ onSignedIn, onDeviceGone }: { onSignedIn: () => void; onDeviceGone: () => void }) {
  const t = useTranslations("owner.guard");
  const [roster, setRoster] = useState<Roster | null>(null);
  const [failed, setFailed] = useState(false);
  const [chosen, setChosen] = useState<Guard | null>(null);
  const [confirmForget, setConfirmForget] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const result = await guardFetch<Roster>("/session/roster", { method: "POST" });
    if (result.ok) return setRoster(result.data);
    if (result.status === 401) return onDeviceGone();
    setFailed(true);
  }, [onDeviceGone]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the roster arrives from the API after this effect
    void load();
  }, [load]);

  if (chosen) {
    return (
      <PinStep
        guard={chosen}
        title={t("pin.title", { name: chosen.displayName })}
        submitLabel={t("pin.submit")}
        backLabel={t("back")}
        onBack={() => setChosen(null)}
        onSignedIn={onSignedIn}
        onDeviceGone={onDeviceGone}
      />
    );
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-8" data-testid="roster">
      <div className="text-center">
        {roster ? (
          <p className="text-muted text-lg">
            {t("roster.where", { gate: roster.gateName, property: roster.propertyName })}
          </p>
        ) : null}
        <h1 className="text-3xl font-semibold">{t("roster.title")}</h1>
        <p className="text-muted mt-1 text-lg">{t("roster.lede")}</p>
      </div>
      {failed ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg">{t("pin.unavailable")}</p>
          <Button size="xl" variant="secondary" onClick={() => void load()}>
            {t("retry")}
          </Button>
        </div>
      ) : roster && roster.guards.length === 0 ? (
        <p className="text-muted text-center text-lg">{t("roster.empty")}</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
          {(roster?.guards ?? []).map((guard) => (
            <li key={guard.guardId}>
              <button
                type="button"
                onClick={() => setChosen(guard)}
                data-testid="roster-guard"
                className={cn(
                  "rounded-card border-border bg-surface flex min-h-20 w-full touch-manipulation items-center gap-4 border px-5 py-4 text-left",
                  "active:bg-bg-subtle",
                )}
              >
                <KioskAvatar name={guard.displayName} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-semibold">{guard.displayName}</span>
                  {guard.locked ? (
                    <span className="text-muted flex items-center gap-1.5 text-sm">
                      <Icon icon={IconLock} />
                      {t("roster.locked")}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-center">
        {confirmForget ? (
          <div className="rounded-card border-border bg-surface flex max-w-xl flex-col gap-4 border p-5">
            <p>{t("roster.forgetConfirm")}</p>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="secondary" size="lg" onClick={() => setConfirmForget(false)}>
                {t("cancel")}
              </Button>
              <Button
                variant="destructive"
                size="lg"
                onClick={async () => {
                  await guardFetch("/session/forget", { method: "POST" });
                  onDeviceGone();
                }}
              >
                {t("roster.forgetAction")}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" size="lg" onClick={() => setConfirmForget(true)}>
            {t("roster.forget")}
          </Button>
        )}
      </div>
    </div>
  );
}

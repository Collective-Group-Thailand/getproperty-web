"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import { Desk } from "./Desk";

// One phase at a time: a signed-in tablet never downloads enrolment or the roster (D-179, 180 KB).
const EnrolScreen = dynamic(() => import("./EnrolScreen").then((module) => module.EnrolScreen), { ssr: false });
const SignIn = dynamic(() => import("./SignIn").then((module) => module.SignIn), { ssr: false });
import { guardFetch, type GuardMe } from "./lib/api";
import { forgetGateTablet } from "./lib/queue";
import type { GateSnapshot } from "./server";

type Phase =
  { name: "enrol"; revoked: boolean } | { name: "sign-in" } | { name: "loading" } | { name: "desk"; me: GuardMe };

/**
 * The gate tablet (JW4, D-320): enrol once → who is on shift → PIN → the desk. The server tells the first phase from
 * the cookies it holds (it cannot read them from here); everything after is decided by the API's answers.
 */
export function GateApp({
  enrolled,
  locked = false,
  me: initialMe,
  snapshot,
}: {
  enrolled: boolean;
  /** The server holds the lock cookie (review W1): the desk opens on the PIN pad, a reload never skips it. */
  locked?: boolean;
  me: GuardMe | null;
  snapshot?: GateSnapshot | null;
}) {
  // Only until a PIN is entered: the next desk (a new shift token) opens unlocked.
  const [restoreLock, setRestoreLock] = useState(locked);
  const [phase, setPhase] = useState<Phase>(
    initialMe ? { name: "desk", me: initialMe } : enrolled ? { name: "loading" } : { name: "enrol", revoked: false },
  );

  const loadMe = useCallback(async () => {
    const result = await guardFetch<GuardMe>("/v1/guard/me");
    if (result.ok) setPhase({ name: "desk", me: result.data });
    else setPhase({ name: "sign-in" });
  }, []);

  // An enrolled tablet without a fresh access token may still hold a refresh token: the BFF refreshes on /me.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the phase changes when the API answers, not now
    if (phase.name === "loading") void loadMe();
  }, [phase.name, loadMe]);

  // Forgotten or revoked (review W4): the offline queue and the cached houses are deleted with the device.
  const deviceGone = useCallback(() => {
    setRestoreLock(false);
    void forgetGateTablet();
    setPhase({ name: "enrol", revoked: true });
  }, []);

  if (phase.name === "desk") {
    return (
      <Desk
        key={phase.me.shiftId}
        me={phase.me}
        snapshot={phase.me.shiftId === initialMe?.shiftId ? snapshot : null}
        onSessionEnded={(reason) => (reason === "device" ? deviceGone() : setPhase({ name: "sign-in" }))}
        initialLocked={restoreLock}
        onSessionRenewed={() => {
          setRestoreLock(false);
          void loadMe();
        }}
      />
    );
  }

  return (
    <div data-surface="gate" className="bg-bg text-fg flex min-h-dvh items-center justify-center px-6 py-10 text-base">
      {phase.name === "enrol" ? (
        <EnrolScreen revoked={phase.revoked} onEnrolled={() => setPhase({ name: "sign-in" })} />
      ) : phase.name === "sign-in" ? (
        <SignIn
          onSignedIn={() => {
            setRestoreLock(false);
            void loadMe();
          }}
          onDeviceGone={deviceGone}
        />
      ) : (
        <span className="sr-only" aria-live="polite" />
      )}
    </div>
  );
}

import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconLogIn } from "@/ui/icons/glyphs/log-in";
import { IconLogOut } from "@/ui/icons/glyphs/log-out";
import { IconSiren } from "@/ui/icons/glyphs/siren";
import { IconWarning } from "@/ui/icons/glyphs/warning";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/** `VisitState` (J4.1, D-315): asked → answered (or timed out) → in → out; cancelled by the gate. */
export const GATE_VISIT_STATUS = defineStatuses<Schemas["VisitState"]>("gateVisit", {
  requested: { tone: "neutral", icon: IconClock },
  approved: { tone: "success", icon: IconCheckCircle },
  denied: { tone: "danger", icon: IconXCircle },
  timed_out: { tone: "warning", icon: IconWarning },
  entered: { tone: "info", icon: IconLogIn },
  exited: { tone: "neutral", icon: IconLogOut },
  cancelled: { tone: "neutral", icon: IconXCircle },
});

/** `IncidentState` (J4.2, D-317): an open SOS is the only red on the gate pages. */
export const INCIDENT_STATUS = defineStatuses<Schemas["IncidentState"]>("incident", {
  open: { tone: "danger", icon: IconSiren },
  acknowledged: { tone: "warning", icon: IconClock },
  resolved: { tone: "success", icon: IconCheckCircle },
  cancelled: { tone: "neutral", icon: IconXCircle },
});

/** `VisitInviteState` (J4.1 §3): contractor invites wait for the office. */
export const GATE_INVITE_STATUS = defineStatuses<Schemas["VisitInviteState"]>("gateInvite", {
  pending_approval: { tone: "warning", icon: IconClock },
  active: { tone: "success", icon: IconCheckCircle },
  rejected: { tone: "neutral", icon: IconXCircle },
  revoked: { tone: "neutral", icon: IconXCircle },
});

/** `GateDeviceState` (J4.1 §1): a tablet is pending until it enrols with its code. */
export const GATE_DEVICE_STATUS = defineStatuses<Schemas["GateDeviceState"]>("gateDevice", {
  pending: { tone: "warning", icon: IconEdit },
  active: { tone: "success", icon: IconCheckCircle },
  revoked: { tone: "neutral", icon: IconXCircle },
});

/** A guard as the office sees it: active, locked by wrong PINs (`lockedUntil`), or revoked. */
export type GateGuardView = "active" | "locked" | "revoked";

export const GATE_GUARD_STATUS = defineStatuses<GateGuardView>("gateGuard", {
  active: { tone: "success", icon: IconCheckCircle },
  locked: { tone: "warning", icon: IconLock },
  revoked: { tone: "neutral", icon: IconXCircle },
});

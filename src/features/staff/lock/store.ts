import { hasPin, lastActivity, LOCK_AFTER_MINUTES, recordActivity } from "./pin";

/**
 * Lock state as an external store (read with `useSyncExternalStore`): the server renders unlocked, the
 * browser reads the PIN and the last activity from storage when the shell subscribes.
 */
export interface LockSnapshot {
  enabled: boolean;
  locked: boolean;
}

const SERVER: LockSnapshot = { enabled: false, locked: false };
let snapshot: LockSnapshot = SERVER;
let initialised = false;
const listeners = new Set<() => void>();

function emit(next: LockSnapshot) {
  if (next.enabled === snapshot.enabled && next.locked === snapshot.locked) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

function init() {
  initialised = true;
  const enabled = hasPin();
  const last = lastActivity();
  const locked = enabled && last !== null && Date.now() - last > LOCK_AFTER_MINUTES * 60_000;
  if (!locked) recordActivity();
  snapshot = { enabled, locked };
}

export const lockStore = {
  subscribe(listener: () => void) {
    if (!initialised) init();
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => snapshot,
  getServerSnapshot: () => SERVER,
  setEnabled: (enabled: boolean) => emit({ enabled, locked: enabled && snapshot.locked }),
  lock: () => emit({ ...snapshot, locked: snapshot.enabled }),
  unlock: () => emit({ ...snapshot, locked: false }),
};

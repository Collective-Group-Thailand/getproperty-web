import { replayQueue } from "./queue";

/**
 * Registers the staff service worker (`/sw.js`, scope `/`) and wires its messages: the worker asks the
 * page to replay the offline queue on Background Sync (where the browser has it); the page also
 * replays on `online`, on start and every 30 s while something is queued (ADR-0007).
 */
export async function registerStaffServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  navigator.serviceWorker.addEventListener("message", (event: MessageEvent<{ type?: string }>) => {
    if (event.data?.type === "gp:replay") void replayQueue();
  });
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return registration;
  } catch (error) {
    console.error("service worker registration failed", error);
    return null;
  }
}

/** Asks the worker for a Background Sync of the queue (Chromium); elsewhere the page's timers do it. */
export async function requestBackgroundSync(): Promise<void> {
  try {
    const registration = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      sync?: { register(tag: string): Promise<void> };
    };
    await registration.sync?.register("gp-offline-queue");
  } catch {
    // not supported — the page replays on its own
  }
}

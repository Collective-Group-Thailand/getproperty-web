import { CSRF_HEADER } from "@/lib/api/headers";
import type { Zone } from "@/lib/zones";

/**
 * Web push (VAPID) subscription — asked for only after a meaningful action (F1 1.3 §5), never on page
 * load. The browser's PushSubscription is registered with the API (`POST /v1/{zone}/push-subscriptions`
 * through the zone BFF); the API sends through its notification pipeline (D-063).
 *
 * The API's subscription id is remembered on the device so sign-out can remove it (review M4): `DELETE
 * /v1/{zone}/push-subscriptions/{id}` while the session still exists, then `PushSubscription.unsubscribe()` — the
 * next person on a shared phone never gets the previous one's notifications.
 */
export const PUSH_SUBSCRIPTION_KEY = "gp_push_subscription";

interface StoredSubscription {
  zone: Zone;
  id: string;
  endpoint: string;
}

function readStored(): StoredSubscription | null {
  try {
    const raw = window.localStorage.getItem(PUSH_SUBSCRIPTION_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<StoredSubscription>) : null;
    return parsed && typeof parsed.id === "string" && typeof parsed.endpoint === "string"
      ? (parsed as StoredSubscription)
      : null;
  } catch {
    return null;
  }
}

/** Whether this device holds a push subscription registered by the signed-in session. */
export function hasStoredPushSubscription(): boolean {
  return typeof window !== "undefined" && readStored() !== null;
}
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export type PushOutcome = "subscribed" | "denied" | "unsupported" | "failed";

export async function subscribeToPush(zone: Zone, vapidPublicKey: string | undefined): Promise<PushOutcome> {
  if (!pushSupported() || !vapidPublicKey) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }));
    const json = subscription.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
      expirationTime?: number | null;
    };
    const response = await fetch(`/bff/v1/${zone}/push-subscriptions`, {
      method: "POST",
      headers: { "content-type": "application/json", [CSRF_HEADER]: "1" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        ...(json.expirationTime ? { expiresAt: new Date(json.expirationTime).toISOString() } : {}),
      }),
    });
    if (!response.ok) return "failed";
    const created = (await response.json().catch(() => null)) as { id?: unknown } | null;
    if (typeof created?.id === "string" && json.endpoint) {
      try {
        window.localStorage.setItem(
          PUSH_SUBSCRIPTION_KEY,
          JSON.stringify({ zone, id: created.id, endpoint: json.endpoint } satisfies StoredSubscription),
        );
      } catch {
        // storage unavailable: sign-out still unsubscribes the browser
      }
    }
    return "subscribed";
  } catch {
    return "failed";
  }
}

/**
 * Removes this device's push subscription (sign-out, review M4): deletes it at the API through the zone BFF while
 * the session still exists (best effort), then unsubscribes the browser so the push service drops the endpoint
 * whatever the API did. Never throws.
 */
export async function unsubscribeFromPush(zone: Zone, fetchImpl: typeof fetch = fetch): Promise<void> {
  if (typeof window === "undefined") return;
  const stored = readStored();
  try {
    window.localStorage.removeItem(PUSH_SUBSCRIPTION_KEY);
  } catch {
    // ignore
  }
  if (stored && stored.zone === zone) {
    await fetchImpl(`/bff/v1/${zone}/push-subscriptions/${encodeURIComponent(stored.id)}`, {
      method: "DELETE",
      headers: { [CSRF_HEADER]: "1" },
    }).catch(() => undefined);
  }
  if (!pushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    await subscription?.unsubscribe();
  } catch {
    // no worker or no subscription: nothing to remove
  }
}

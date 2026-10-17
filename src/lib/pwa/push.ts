import { CSRF_HEADER } from "@/lib/api/headers";
import type { Zone } from "@/lib/zones";

/**
 * Web push (VAPID) subscription — asked for only after a meaningful action (F1 1.3 §5), never on page
 * load. The browser's PushSubscription is registered with the API (`POST /v1/{zone}/push-subscriptions`
 * through the zone BFF); the API sends through its notification pipeline (D-063).
 */
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
    return response.ok ? "subscribed" : "failed";
  } catch {
    return "failed";
  }
}

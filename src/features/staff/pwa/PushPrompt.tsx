"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { hasStoredPushSubscription, pushSupported, subscribeToPush } from "@/lib/pwa/push";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";

/** Set by a meaningful action (the first submission that reached the API) — never asked on page load. */
export const PUSH_PROMPT_KEY = "gp_push_prompt";
export const PUSH_PROMPT_DISMISSED_KEY = "gp_push_prompt_dismissed";

export function markMeaningfulAction(): void {
  try {
    window.localStorage.setItem(PUSH_PROMPT_KEY, "1");
    window.dispatchEvent(new Event(PUSH_PROMPT_KEY));
  } catch {
    // storage unavailable: no prompt
  }
}

/**
 * Asks for web push after a meaningful action (F1 1.3 §5): only when the browser can, a VAPID key exists, the staff
 * member has not said "later", and this sign-in has no subscription yet — permission still undecided, or already
 * granted to the browser by a previous person on a shared phone (their subscription was removed at sign-out,
 * review M4, so this person is asked for their own).
 */
export function PushPrompt({ vapidPublicKey }: { vapidPublicKey?: string }) {
  const t = useTranslations("staff.offline");
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const check = () => {
      try {
        setVisible(
          Boolean(vapidPublicKey) &&
            pushSupported() &&
            (Notification.permission === "default" ||
              (Notification.permission === "granted" && !hasStoredPushSubscription())) &&
            window.localStorage.getItem(PUSH_PROMPT_KEY) === "1" &&
            window.localStorage.getItem(PUSH_PROMPT_DISMISSED_KEY) !== "1",
        );
      } catch {
        setVisible(false);
      }
    };
    check();
    window.addEventListener(PUSH_PROMPT_KEY, check);
    return () => window.removeEventListener(PUSH_PROMPT_KEY, check);
  }, [vapidPublicKey]);

  if (!visible) return message ? <Callout tone="info">{message}</Callout> : null;
  return (
    <div className="pt-4" data-testid="push-prompt">
      <Callout
        tone="info"
        title={t("pushTitle")}
        action={
          <div className="flex gap-2">
            <Button
              size="md"
              onClick={async () => {
                const outcome = await subscribeToPush("staff", vapidPublicKey);
                setVisible(false);
                if (outcome === "denied") setMessage(t("pushDenied"));
              }}
            >
              {t("pushEnable")}
            </Button>
            <Button
              size="md"
              variant="ghost"
              onClick={() => {
                try {
                  window.localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, "1");
                } catch {
                  // ignore
                }
                setVisible(false);
              }}
            >
              {t("pushLater")}
            </Button>
          </div>
        }
      >
        {t("pushBody")}
      </Callout>
    </div>
  );
}

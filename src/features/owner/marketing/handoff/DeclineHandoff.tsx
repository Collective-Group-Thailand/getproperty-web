"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";

import { declineHandoff, type DeclineState } from "./actions";

/**
 * "Not now" on a getbuild rental invitation (G8, D-299): one more tap to confirm, then the Server Action tells the
 * API. The page re-reads the invitation afterwards, so the declined state is the API's own.
 */
export function DeclineHandoff({ token }: { token: string }) {
  const t = useTranslations("owner.marketing.handoff.decline");
  const [asking, setAsking] = useState(false);
  const [state, action, pending] = useActionState<DeclineState, FormData>(declineHandoff, { status: "idle" });

  if (state.status === "declined" || state.status === "closed") {
    return (
      <div data-testid="handoff-declined" role="status">
        <Callout tone="neutral" title={t(`${state.status}Title`)}>
          {t(`${state.status}Body`)}
        </Callout>
      </div>
    );
  }
  if (!asking) {
    return (
      <Button variant="ghost" onClick={() => setAsking(true)} data-testid="handoff-decline">
        {t("button")}
      </Button>
    );
  }
  return (
    <form
      action={action}
      className="border-border rounded-card flex flex-col gap-3 border p-4"
      data-testid="handoff-decline-confirm"
    >
      <input type="hidden" name="token" value={token} />
      <p className="m-0 font-semibold">{t("title")}</p>
      <p className="text-muted m-0 text-sm">{t("body")}</p>
      {state.status === "failed" ? (
        <div role="alert">
          <Callout tone="danger">{t("failed")}</Callout>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary" loading={pending} data-testid="handoff-decline-submit">
          {t("confirm")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setAsking(false)} disabled={pending}>
          {t("keep")}
        </Button>
      </div>
    </form>
  );
}

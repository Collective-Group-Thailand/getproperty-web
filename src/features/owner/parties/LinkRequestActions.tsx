"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";

/** The API answered that someone already decided the request (D-226): not an error for this person. */
const NOT_PENDING = "party.link_request_not_pending";
type Outcome = { stale: true } | Schemas["PartyLinkRequestDto"];

async function decide(call: () => Promise<Schemas["PartyLinkRequestDto"]>): Promise<Outcome> {
  try {
    return await call();
  } catch (error) {
    if (isApiError(error) && error.code === NOT_PENDING) return { stale: true };
    throw error;
  }
}

/**
 * Confirm or reject a phone sign-in that matched a party (D-226, `party.link.manage` — the Owner). Confirming
 * links the login (`linkedVia: admin`): from its next token refresh it sees the party's leases, bills and door
 * codes. Rejecting needs a reason. Each dialog sends its Idempotency-Key; a request another Owner decided in
 * the meantime (`409 party.link_request_not_pending`) is said so and the list re-read.
 */
export function LinkRequestActions({ request }: { request: Schemas["PartyLinkRequestDto"] }) {
  const t = useTranslations("owner.parties.linkRequests");
  const [reason, setReason] = useState("");
  const path = { requestId: request.id };
  const login = request.userDisplayName ?? t("unnamedLogin");
  const done = (message: string) => (result: unknown) =>
    "stale" in (result as Outcome) ? toast.info(t("alreadyDecided")) : toast.success(message);
  if (request.state !== "pending") return null;

  return (
    <div className="flex flex-wrap gap-2" data-testid="link-request-actions">
      <ConfirmAction
        label={t("confirm")}
        icon={IconCheck}
        size="sm"
        testId="link-confirm"
        title={t("confirmTitle", { party: request.partyDisplayName })}
        description={t("confirmBody", { login, party: request.partyDisplayName })}
        confirmLabel={t("confirm")}
        onDone={done(t("confirmed"))}
        onConfirm={(key) =>
          decide(() =>
            unwrap(
              browserApi().POST("/v1/owner/party-link-requests/{requestId}/actions/confirm", {
                params: { path, header: { "Idempotency-Key": key } },
              }),
            ),
          )
        }
      />
      <ConfirmAction
        label={t("reject")}
        icon={IconXCircle}
        size="sm"
        variant="secondary"
        tone="destructive"
        testId="link-reject"
        title={t("rejectTitle", { party: request.partyDisplayName })}
        description={t("rejectBody", { login, party: request.partyDisplayName })}
        confirmLabel={t("reject")}
        ready={reason.trim().length > 0}
        onDone={done(t("rejected"))}
        onConfirm={(key) =>
          decide(() =>
            unwrap(
              browserApi().POST("/v1/owner/party-link-requests/{requestId}/actions/reject", {
                params: { path, header: { "Idempotency-Key": key } },
                body: { reason: reason.trim() },
              }),
            ),
          )
        }
      >
        <Field label={t("rejectReason")} required>
          <Textarea
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            data-testid="link-reject-reason"
          />
        </Field>
      </ConfirmAction>
    </div>
  );
}

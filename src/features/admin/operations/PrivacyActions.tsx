"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";

const DSR_ACTIONS = ["verify", "start", "fulfil", "reject"] as const satisfies readonly Schemas["DsrAction"][];

/**
 * The next step of a request where Collective is the controller (`tenantId: null`, PDPA, D-214):
 * `POST /v1/admin/data-subject-requests/{id}/actions/{action}` — verify the person → start → fulfil (access /
 * portability: a JSON export of the login; erasure: contact data anonymised and the login disabled, refused
 * while the login still works for a tenant) or reject with the reason. Only what the API offers in
 * `nextActions` is shown; fulfil and reject are typed with the request's short id.
 */
export function PlatformDsrActions({ dsr }: { dsr: Schemas["DsrDto"] }) {
  const t = useTranslations("admin.operations.privacy");
  const [notes, setNotes] = useState("");
  const offered = DSR_ACTIONS.filter((action) => dsr.nextActions.includes(action));
  if (offered.length === 0) return null;
  const kind = t(`kind.${dsr.kind}`);
  return (
    <span className="flex flex-wrap gap-2" data-testid={`dsr-actions-${dsr.id}`}>
      {offered.map((action) => (
        <ConfirmAction
          key={action}
          label={t(`action.${action}`)}
          size="sm"
          variant={action === "reject" ? "destructive" : action === "fulfil" ? "primary" : "secondary"}
          tone={action === "reject" ? "destructive" : "primary"}
          testId={`dsr-${action}-${dsr.id}`}
          title={t(`confirm.${action}.title`)}
          description={t(`confirm.${action}.body`, { kind })}
          confirmLabel={t(`action.${action}`)}
          phrase={action === "fulfil" || action === "reject" ? dsr.id.slice(0, 8) : undefined}
          ready={action !== "reject" || notes.trim().length > 0}
          successMessage={t("done")}
          onConfirm={() =>
            unwrap(
              browserApi().POST("/v1/admin/data-subject-requests/{requestId}/actions/{action}", {
                params: { path: { requestId: dsr.id, action } },
                body: { notes: notes.trim() || null },
              }),
            )
          }
        >
          <Field label={t("notes")} hint={t("notesHint")} required={action === "reject"}>
            <Textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              data-testid={`dsr-notes-${dsr.id}`}
            />
          </Field>
        </ConfirmAction>
      ))}
    </span>
  );
}

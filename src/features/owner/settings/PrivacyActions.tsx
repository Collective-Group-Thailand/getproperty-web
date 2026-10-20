"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";

/**
 * The operator's own consents (PDPA, D-025): each purpose with its version; optional ones can be given
 * or withdrawn at any time (`POST /v1/owner/consents`), required ones are shown as accepted.
 */
export function ConsentSwitch({ purpose, language }: { purpose: Schemas["ConsentPurposeDto"]; language: string }) {
  const t = useTranslations("owner.settings.privacy");
  const [granted, setGranted] = useState(purpose.granted === true);
  const action = useApiAction();
  if (purpose.required) {
    // A required purpose cannot be withdrawn here (it ends with the account): stated, not a dead switch.
    return (
      <div
        className="flex items-start justify-between gap-4"
        data-testid={`consent-${purpose.key}`}
        data-granted={purpose.granted === true}
      >
        <div>
          <p className="text-base">{purpose.title}</p>
          <p className="text-muted text-sm">{t("required")}</p>
        </div>
        <Badge tone={purpose.granted ? "success" : "warning"}>
          {purpose.granted ? t("accepted") : t("notAccepted")}
        </Badge>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <Switch
        label={purpose.title}
        description={t("optional")}
        checked={granted}
        disabled={action.busy}
        data-testid={`consent-${purpose.key}`}
        onCheckedChange={(next) => {
          setGranted(next);
          void action.run(
            () =>
              unwrap(
                browserApi().POST("/v1/owner/consents", {
                  body: {
                    language: language as Schemas["Language"],
                    items: [{ purposeKey: purpose.key, version: purpose.version, granted: next }],
                  },
                }),
              ),
            () => {
              toast.success(next ? t("granted") : t("withdrawn"));
            },
          );
        }}
      />
      <ProblemNotice error={action.error} />
    </div>
  );
}

const DSR_ACTIONS = ["verify", "start", "fulfil", "reject"] as const;

/**
 * A data subject request's next step (`POST /v1/owner/data-subject-requests/{id}/actions/{action}`):
 * verify the person → start → fulfil (access / portability produce an export file; erasure anonymises
 * where no legal hold applies) or reject with the reason. Fulfil and reject are typed.
 */
export function DsrActions({ dsr }: { dsr: Schemas["DsrDto"] }) {
  const t = useTranslations("owner.settings.privacy.dsr");
  const [notes, setNotes] = useState("");
  const offered = DSR_ACTIONS.filter((action) => dsr.nextActions.includes(action));
  if (offered.length === 0) return null;
  const run = (action: (typeof DSR_ACTIONS)[number]) =>
    unwrap(
      browserApi().POST("/v1/owner/data-subject-requests/{requestId}/actions/{action}", {
        params: { path: { requestId: dsr.id, action } },
        body: { notes: notes.trim() || null },
      }),
    );
  const notesField = (
    <Field label={t("notes")} hint={t("notesHint")}>
      <Textarea
        rows={2}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        data-testid={`dsr-notes-${dsr.id}`}
      />
    </Field>
  );
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
          description={t(`confirm.${action}.body`, { kind: t(`kind.${dsr.kind}`) })}
          confirmLabel={t(`action.${action}`)}
          phrase={action === "fulfil" || action === "reject" ? dsr.id.slice(0, 8) : undefined}
          ready={action !== "reject" || notes.trim().length > 0}
          successMessage={t("done")}
          onConfirm={() => run(action)}
        >
          {notesField}
        </ConfirmAction>
      ))}
    </span>
  );
}

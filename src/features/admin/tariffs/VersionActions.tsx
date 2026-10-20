"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";

/**
 * The checker's steps (D-021a, two-person rule): **verify** — a different platform user confirms every
 * value against the published source (the API refuses the maker with `tariff.same_verifier`) — then
 * **publish**, which closes the version in force at its start. Only the actions the API offers
 * (`nextActions`) are shown.
 */
export function VersionActions({ version, label }: { version: Schemas["TariffVersionDto"]; label: string }) {
  const t = useTranslations("admin.tariffs.workflow");
  const [checked, setChecked] = useState(false);
  const [notes, setNotes] = useState("");
  const path = { params: { path: { versionId: version.id } } };
  return (
    <div className="flex flex-wrap gap-2">
      {version.nextActions.includes("verify") ? (
        <ConfirmAction
          label={t("verify")}
          icon={IconCheck}
          testId="verify-version"
          title={t("verifyTitle", { label })}
          description={t("verifyBody", { source: version.sourceUrl })}
          confirmLabel={t("verify")}
          ready={checked}
          onConfirm={() =>
            unwrap(
              browserApi().POST("/v1/admin/utility-tariffs/versions/{versionId}/actions/verify", {
                ...path,
                body: { notes: notes.trim() || null },
              }),
            )
          }
          successMessage={t("verified")}
        >
          <Checkbox
            label={t("checkedAgainstSource")}
            checked={checked}
            onCheckedChange={(value) => setChecked(value === true)}
          />
          <Field label={t("notes")}>
            <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        </ConfirmAction>
      ) : null}
      {version.nextActions.includes("publish") ? (
        <ConfirmAction
          label={t("publish")}
          icon={IconCheckCircle}
          testId="publish-version"
          title={t("publishTitle", { label })}
          description={t("publishBody", { date: version.effectiveFrom })}
          confirmLabel={t("publish")}
          phrase={version.effectiveFrom}
          onConfirm={() =>
            unwrap(browserApi().POST("/v1/admin/utility-tariffs/versions/{versionId}/actions/publish", path))
          }
          successMessage={t("published")}
        />
      ) : null}
    </div>
  );
}

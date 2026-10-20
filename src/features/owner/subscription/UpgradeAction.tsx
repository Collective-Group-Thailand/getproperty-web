"use client";

import { useTranslations } from "next-intl";

import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconForward } from "@/ui/icons/glyphs/forward";

/**
 * Starter → Smart (D-156): the upgrade starts with a site survey of one building (`POST
 * /v1/owner/subscription/upgrade`, Idempotency-Key) — a field engineer checks the meters and the
 * network; the plan changes once the hardware is installed. The survey then shows on this page.
 */
export function UpgradeToSmart({ buildings }: { buildings: { id: string; name: string }[] }) {
  const t = useTranslations("owner.subscription.upgrade");
  return (
    <FormDialog
      label={t("open")}
      icon={IconForward}
      variant="primary"
      testId="upgrade-smart"
      title={t("title")}
      description={t("hint")}
      submitLabel={t("submit")}
      successMessage={t("done")}
      disabled={buildings.length === 0}
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/owner/subscription/upgrade", {
            params: { header: { "Idempotency-Key": crypto.randomUUID() } },
            body: { buildingId: text(data, "buildingId") ?? "", notes: text(data, "notes") ?? null },
          }),
        )
      }
    >
      {(errors) => (
        <>
          <Field label={t("building")} required error={errors.buildingId}>
            <NativeSelect
              name="buildingId"
              options={buildings.map((building) => ({ value: building.id, label: building.name }))}
              data-testid="upgrade-building"
            />
          </Field>
          <Field label={t("notes")} hint={t("notesHint")} error={errors.notes}>
            <Textarea name="notes" rows={3} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

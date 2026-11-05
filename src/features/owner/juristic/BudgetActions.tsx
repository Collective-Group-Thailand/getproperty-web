"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";

/**
 * Approves a draft budget with an adopted resolution of its building (committee / owner, D-304, Idempotency-Key); an
 * earlier approved budget of the same year becomes superseded. Without an adopted resolution the dialog says where to
 * record one.
 */
export function ApproveBudgetButton({
  budget,
  resolutions,
}: {
  budget: Schemas["BudgetDto"];
  resolutions: { id: string; label: string }[];
}) {
  const t = useTranslations("owner.juristic.budget");
  const [resolutionId, setResolutionId] = useState(resolutions.length === 1 ? resolutions[0]!.id : "");
  return (
    <ConfirmAction
      label={t("approve")}
      icon={IconCheckCircle}
      block
      testId="budget-approve"
      title={t("approveTitle", { name: budget.name })}
      description={resolutions.length ? t("approveBody") : t("approveNoResolution")}
      confirmLabel={t("approve")}
      ready={Boolean(resolutionId)}
      successMessage={t("approved")}
      onConfirm={(idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/budgets/{budgetId}/actions/approve", {
            params: { path: { budgetId: budget.id }, header: { "Idempotency-Key": idempotencyKey } },
            body: { resolutionId },
          }),
        )
      }
    >
      {resolutions.length ? (
        <Field label={t("approveResolution")} required>
          <NativeSelect
            value={resolutionId}
            onChange={(event) => setResolutionId(event.target.value)}
            placeholder={t("approveResolutionPick")}
            options={resolutions.map((option) => ({ value: option.id, label: option.label }))}
            data-testid="budget-approve-resolution"
          />
        </Field>
      ) : null}
    </ConfirmAction>
  );
}

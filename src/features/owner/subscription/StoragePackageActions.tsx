"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";
import { IconAdd } from "@/ui/icons/glyphs/add";

/**
 * Orders a storage package (G1, D-285): the dialog restates what is bought — size, period and the price incl. VAT the
 * API quoted — and sends one Idempotency-Key per opening. The API issues the purchase invoice; the package starts when
 * it is paid.
 */
export function BuyStoragePackage({
  packageId,
  name,
  size,
  period,
  total,
  disabled,
}: {
  packageId: string;
  name: string;
  /** Formatted size ("20 GB"). */
  size: string;
  /** "ต่อเดือน" / "per year". */
  period: string;
  /** Formatted price incl. VAT from the API. */
  total: string;
  disabled?: boolean;
}) {
  const t = useTranslations("owner.subscription.storage.packages");
  const [autoRenew, setAutoRenew] = useState(false);
  return (
    <ConfirmAction
      label={t("buy")}
      icon={IconAdd}
      size="sm"
      disabled={disabled}
      testId="storage-buy"
      title={t("buyTitle", { name })}
      description={t("buyBody", { size, period, total })}
      confirmLabel={t("buy")}
      successMessage={t("bought")}
      onConfirm={(idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/owner/storage/packages", {
            params: { header: { "Idempotency-Key": idempotencyKey } },
            body: { packageId, autoRenew },
          }),
        )
      }
    >
      <Switch
        label={t("autoRenew")}
        description={t("autoRenewHint")}
        checked={autoRenew}
        onCheckedChange={setAutoRenew}
      />
    </ConfirmAction>
  );
}

/** Auto-renew of a bought package (D-292 (5)): reversible, saved at once. */
export function StorageAutoRenew({
  storagePackageId,
  autoRenew,
  disabled,
}: {
  storagePackageId: string;
  autoRenew: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("owner.subscription.storage.packages");
  const action = useApiAction();
  const [on, setOn] = useState(autoRenew);
  return (
    <div className="flex flex-col gap-2" data-testid="storage-auto-renew">
      <Switch
        label={t("autoRenew")}
        description={t("autoRenewHint")}
        checked={on}
        disabled={disabled || action.busy}
        onCheckedChange={(next) =>
          action.run(
            () =>
              unwrap(
                browserApi().POST("/v1/owner/storage/packages/{storagePackageId}/actions/auto-renew", {
                  params: { path: { storagePackageId } },
                  body: { autoRenew: next },
                }),
              ),
            () => {
              setOn(next);
              toast.success(t("saved"));
            },
          )
        }
      />
      <ProblemNotice error={action.error} />
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { IconBlock } from "@/ui/icons/glyphs/block";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";

type Vendor = Schemas["VendorDto"];

/**
 * Blocks a vendor with a reason (D-331): no new contracts, quotations or expense requests; contracts already running
 * continue. The reason is shown on the vendor's page and kept in the audit trail.
 */
export function BlockVendorButton({ vendor }: { vendor: Vendor }) {
  const t = useTranslations("owner.vendors.actions");
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label={t("block")}
      icon={IconBlock}
      variant="destructive"
      tone="destructive"
      block
      testId="vendor-block"
      title={t("blockTitle", { name: vendor.name })}
      description={t("blockBody", { contracts: vendor.activeContracts })}
      confirmLabel={t("block")}
      ready={reason.trim().length >= 3}
      successMessage={t("blocked")}
      onConfirm={() =>
        unwrap(
          browserApi().PATCH("/v1/owner/juristic/vendors/{vendorId}", {
            params: { path: { vendorId: vendor.id } },
            body: { state: "blocked", blockedReason: reason.trim(), version: vendor.version },
          }),
        )
      }
    >
      <Field label={t("reason")} hint={t("reasonHint")} required>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={1000}
          data-testid="vendor-block-reason"
        />
      </Field>
    </ConfirmAction>
  );
}

/** Lets a blocked vendor quote and contract again. */
export function UnblockVendorButton({ vendor }: { vendor: Vendor }) {
  const t = useTranslations("owner.vendors.actions");
  return (
    <ConfirmAction
      label={t("unblock")}
      icon={IconCheckCircle}
      variant="secondary"
      block
      testId="vendor-unblock"
      title={t("unblockTitle", { name: vendor.name })}
      description={t("unblockBody")}
      confirmLabel={t("unblock")}
      successMessage={t("unblocked")}
      onConfirm={() =>
        unwrap(
          browserApi().PATCH("/v1/owner/juristic/vendors/{vendorId}", {
            params: { path: { vendorId: vendor.id } },
            body: { state: "active", version: vendor.version },
          }),
        )
      }
    />
  );
}

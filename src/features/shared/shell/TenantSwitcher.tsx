"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { selectTenant } from "@/lib/auth/actions";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { toast } from "@/ui/components/Toast";
import { LazyDropdownMenu } from "@/ui/components/overlays";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconChevronsUpDown } from "@/ui/icons/glyphs/chevrons-up-down";

/**
 * Top-bar tenant switcher (contract §8), shown only to operators of several tenants. Choosing one
 * stores it in `__Host-gp_tenant` (validated server-side) and reloads, so every cached query of the
 * previous tenant is gone with the page.
 */
export function TenantSwitcher({
  zone,
  tenants,
  currentTenantId,
}: {
  zone: "owner" | "staff";
  tenants: Schemas["OperatorTenantDto"][];
  currentTenantId: string;
}) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const current = tenants.find((tenant) => tenant.id === currentTenantId);

  const choose = (tenantId: string) =>
    startTransition(async () => {
      const result = await selectTenant(zone, { tenantId });
      if (!result.ok) {
        toast.error(t("auth.errors.tenantNotInScope"));
        return;
      }
      window.location.reload();
    });

  return (
    <LazyDropdownMenu
      label={t("shell.tenantSwitcher.label")}
      align="start"
      trigger={
        <Button
          variant="secondary"
          size="sm"
          iconEnd={IconChevronsUpDown}
          loading={pending}
          data-testid="tenant-switcher"
          // Shrinks with the top bar (the name truncates) so a 360 px phone keeps every control apart.
          className="max-w-full min-w-0"
        >
          <span className="max-w-48 min-w-0 truncate">{current?.displayName}</span>
        </Button>
      }
      items={tenants.map((tenant) => ({
        id: tenant.id,
        label: tenant.displayName,
        icon: IconBuilding,
        selected: tenant.id === currentTenantId,
        disabled: tenant.status === "deactivated",
        onSelect: () => tenant.id !== currentTenantId && choose(tenant.id),
      }))}
    />
  );
}

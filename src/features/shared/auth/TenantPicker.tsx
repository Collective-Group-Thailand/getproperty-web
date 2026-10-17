"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { selectTenant, type ActionProblem } from "@/lib/auth/actions";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";

import { authProblemMessage } from "./problemMessage";

/**
 * Tenant choice for operators who belong to several tenants (contract §8). The choice is stored by a
 * Server Action in `__Host-gp_tenant` after checking membership, then the console reloads in that
 * tenant — every request from then on carries it as `X-Tenant-Id`.
 */
export function TenantPicker({
  zone,
  tenants,
  currentTenantId,
  consoleHref,
}: {
  zone: "owner" | "staff";
  tenants: Schemas["OperatorTenantDto"][];
  currentTenantId?: string;
  consoleHref: string;
}) {
  const t = useTranslations();
  const [problem, setProblem] = useState<ActionProblem | null>(null);
  const [pending, startTransition] = useTransition();
  const [choosing, setChoosing] = useState<string | null>(null);

  const choose = (tenantId: string) =>
    startTransition(async () => {
      setChoosing(tenantId);
      setProblem(null);
      const result = await selectTenant(zone, { tenantId });
      if (!result.ok) {
        setProblem(result.problem);
        setChoosing(null);
        return;
      }
      window.location.assign(consoleHref);
    });

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2" aria-label={t("auth.tenantPicker.title")}>
        {tenants.map((tenant) => (
          <li key={tenant.id}>
            <Button
              variant="secondary"
              size="lg"
              block
              className="h-auto justify-between py-3 text-start"
              disabled={tenant.status === "deactivated" || (pending && choosing !== tenant.id)}
              loading={pending && choosing === tenant.id}
              aria-label={t("auth.tenantPicker.choose", { name: tenant.displayName })}
              onClick={() => choose(tenant.id)}
              data-testid="tenant-option"
            >
              <span className="flex flex-col">
                <span className="font-semibold">{tenant.displayName}</span>
                <span className="text-muted text-sm font-normal">
                  {t(`glossary.tenantType.${tenant.type}`)} · {t(`glossary.tenantRole.${tenant.role}`)}
                </span>
              </span>
              {tenant.id === currentTenantId ? (
                <span className="text-primary text-sm">{t("auth.tenantPicker.current")}</span>
              ) : null}
            </Button>
          </li>
        ))}
      </ul>
      {problem ? <Callout tone="danger">{authProblemMessage(t as never, problem)}</Callout> : null}
    </div>
  );
}

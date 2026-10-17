import { useTranslations } from "next-intl";

import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";

/** The compliance checks the API evaluated on the lease (D-020): rule, outcome, acknowledgement. */
export function ComplianceChecks({ lease }: { lease: Pick<Schemas["LeaseDto"], "compliance"> }) {
  const t = useTranslations("owner.leases.compliance");
  if (!lease.compliance.checks.length) return null;
  return (
    <ul className="flex flex-col gap-1 text-sm" data-testid="compliance-checks">
      {lease.compliance.checks.map((check) => (
        <li
          key={check.ruleId}
          className="flex flex-wrap items-center gap-2"
          data-rule={check.ruleId}
          data-outcome={check.outcome}
        >
          <Badge
            tone={check.outcome === "pass" ? "success" : check.outcome === "warn" ? "warning" : "danger"}
            size="sm"
          >
            {t(`outcome.${check.outcome}`)}
          </Badge>
          <span className="font-mono text-xs">{check.ruleId}</span>
          {check.acknowledgementId ? <span className="text-muted">{t("acknowledged")}</span> : null}
        </li>
      ))}
    </ul>
  );
}

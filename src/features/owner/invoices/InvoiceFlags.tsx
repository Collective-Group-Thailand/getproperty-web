import { useTranslations } from "next-intl";

import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";

const TONE: Record<string, "neutral" | "warning" | "danger" | "info"> = {
  missing_reading: "danger",
  acknowledgement_required: "warning",
  above_cap: "danger",
  estimated: "warning",
  zero_usage: "info",
  pro_rata: "neutral",
  first_month: "neutral",
  last_month: "neutral",
};

/**
 * The review and compliance flags of a draft invoice as the API sets them (`missing_reading:<id>`,
 * `acknowledgement_required:tariff_cap`, `above_cap:electricity`…) plus its estimate / above-cap marks.
 * A flag this console has no label for is shown by its code rather than hidden.
 */
export function InvoiceFlags({
  invoice,
}: {
  invoice: Pick<Schemas["InvoiceSummaryDto"], "reviewFlags" | "complianceFlags" | "hasEstimate" | "hasAboveCapLine">;
}) {
  const t = useTranslations("owner.invoices.flag");
  const codes = new Set<string>();
  for (const flag of [...invoice.reviewFlags, ...invoice.complianceFlags]) codes.add(flag.split(":")[0]!);
  if (invoice.hasEstimate) codes.add("estimated");
  if (invoice.hasAboveCapLine) codes.add("above_cap");
  if (codes.size === 0) return null;
  return (
    <span className="flex flex-wrap gap-1" data-testid="invoice-flags">
      {[...codes].map((code) => (
        <span key={code} data-flag={code}>
          <Badge tone={TONE[code] ?? "neutral"} size="sm">
            {t.has(code as never) ? t(code as never) : code}
          </Badge>
        </span>
      ))}
    </span>
  );
}

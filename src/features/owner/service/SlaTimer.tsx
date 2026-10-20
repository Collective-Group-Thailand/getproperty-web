import { getTranslations } from "next-intl/server";

import { formatDateTime, formatRelativeTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { IconTimer } from "@/ui/icons/glyphs/timer";

/** The API warns two hours before the SLA ends (D-159, workflow `service_request` `warnBefore: PT2H`). */
const WARN_MS = 2 * 3_600_000;

/**
 * The SLA clock of a request as the API set it (D-159, D-210): time left until `slaDueAt`, amber within the
 * API's own two-hour warning, danger once `slaBreached` — the console never recomputes SLA hours. No clock
 * once the work is done, the request closed or referred to the developer's warranty.
 */
export async function SlaTimer({
  request,
  locale,
  now,
}: {
  request: Pick<Schemas["ServiceRequestDto"], "slaDueAt" | "slaBreached" | "slaHours" | "status" | "inWarranty">;
  locale: Locale;
  /** The page's "now" (`currentTime()`), so every timer of a list agrees. */
  now: number;
}) {
  const t = await getTranslations("owner.service.sla");
  if (!request.slaDueAt) {
    return <span className="text-muted text-sm">{request.inWarranty ? t("warranty") : t("none")}</span>;
  }
  const due = Date.parse(request.slaDueAt);
  const breached = request.slaBreached || due <= now;
  const tone = breached ? "danger" : due - now <= WARN_MS ? "warning" : "neutral";
  const relative = formatRelativeTime(request.slaDueAt, locale, now);
  return (
    <span
      className="inline-flex flex-col gap-0.5"
      data-testid="sla-timer"
      data-state={breached ? "breached" : tone === "warning" ? "warning" : "ok"}
    >
      <Badge tone={tone} size="sm" icon={IconTimer}>
        {breached ? t("overdue", { when: relative }) : t("left", { when: relative })}
      </Badge>
      <span className="text-muted text-xs">
        {t("due", { at: formatDateTime(request.slaDueAt, locale), hours: request.slaHours })}
      </span>
    </span>
  );
}

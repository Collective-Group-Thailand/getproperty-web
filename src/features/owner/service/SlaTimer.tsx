import { getTranslations } from "next-intl/server";

import { formatDateTime, formatDuration } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { Icon } from "@/ui/icons";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { IconTimer } from "@/ui/icons/glyphs/timer";
import { StatusText } from "@/ui/components/StatusText";

/** The API warns two hours before the SLA ends (D-159, workflow `service_request` `warnBefore: PT2H`). */
const WARN_MS = 2 * 3_600_000;

type SlaRequest = Pick<Schemas["ServiceRequestDto"], "slaDueAt" | "slaBreached" | "slaHours" | "status" | "inWarranty">;
export type SlaState = "breached" | "warning" | "ok" | "none";

/** Where a request stands against its SLA as the API set it (`slaDueAt`, `slaBreached`) at the page's "now". */
export function slaState(request: SlaRequest, now: number): SlaState {
  if (!request.slaDueAt) return "none";
  const due = Date.parse(request.slaDueAt);
  if (request.slaBreached || due <= now) return "breached";
  return due - now <= WARN_MS ? "warning" : "ok";
}

/**
 * The SLA clock of a request (D-159, D-210) as icon + words: "เกิน SLA 6 ชม." in red once breached, "เหลือ 45 นาที"
 * in amber within the API's own two-hour warning, a neutral clock otherwise — with the due time muted beneath. The
 * console never recomputes SLA hours; no clock once the request is referred to the developer's warranty.
 */
export async function SlaTimer({
  request,
  locale,
  now,
  size = "cell",
}: {
  request: SlaRequest;
  locale: Locale;
  /** The page's "now" (`currentTime()`), so every timer of a list agrees. */
  now: number;
  /** `cell`: a list cell; `panel`: the head of a record's next-steps panel. */
  size?: "cell" | "panel";
}) {
  const t = await getTranslations("owner.service.sla");
  const state = slaState(request, now);
  if (state === "none" || !request.slaDueAt) {
    return (
      <span className="text-muted inline-flex items-center gap-1.5 text-sm" data-testid="sla-timer" data-state="none">
        {request.inWarranty ? <Icon icon={IconShield} className="size-4" aria-hidden /> : null}
        {request.inWarranty ? t("warranty") : t("none")}
      </span>
    );
  }
  const span = formatDuration(Date.parse(request.slaDueAt) - now, locale);
  return (
    <StatusText
      tone={state === "breached" ? "danger" : state === "warning" ? "warning" : "neutral"}
      icon={state === "breached" ? IconAlert : IconTimer}
      size={size === "panel" ? "md" : "sm"}
      detail={t("due", { at: formatDateTime(request.slaDueAt, locale), hours: request.slaHours })}
      testId="sla-timer"
      state={state}
      className="whitespace-nowrap"
    >
      {state === "breached" ? t("overdueBy", { span }) : t("leftFor", { span })}
    </StatusText>
  );
}

import { getTranslations } from "next-intl/server";

import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconLock } from "@/ui/icons/glyphs/lock";

/**
 * "Not allowed" (403) for the owner and staff zones (redesign G0 revision): a page or section the member's role does
 * not cover is a calm card with a lock — what happened, who can change it, the way back — never a crash or the API's
 * raw refusal. The API's own localised detail, when it sends one, replaces the generic sentence; the request id stays
 * available for support.
 */
export async function ZoneForbidden({
  homeHref,
  detail,
  requestId,
  variant = "card",
  className,
}: {
  homeHref: string;
  /** The API's localised `detail` (e.g. why this role cannot see contracts). */
  detail?: string;
  requestId?: string;
  /** `card` as the page body; `plain` inside a section that already has a border. */
  variant?: "card" | "plain";
  className?: string;
}) {
  const t = await getTranslations("errors.forbidden");
  const common = await getTranslations("common");
  return (
    <div data-testid="forbidden" className={className}>
      <EmptyState
        variant={variant}
        icon={IconLock}
        title={t("title")}
        description={
          <>
            {detail || t("body")}
            {requestId ? (
              <span className="text-muted mt-2 block font-mono text-xs">
                {common("requestId")}: {requestId}
              </span>
            ) : null}
          </>
        }
        action={
          <Button asChild variant="secondary">
            <a href={homeHref}>{t("home")}</a>
          </Button>
        }
      />
    </div>
  );
}

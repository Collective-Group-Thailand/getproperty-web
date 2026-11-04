import { getTranslations } from "next-intl/server";

import { isApiError, NetworkError } from "@/lib/api/errors";
import { Callout } from "@/ui/components/Callout";
import { IconLock } from "@/ui/icons/glyphs/lock";

/**
 * A section of a server-rendered console page whose API read failed (`section()`): the API's own
 * localised title and detail with the request id — or "no connection" — while the rest of the page
 * still renders. Server-only markup; the error object never crosses into a client component.
 */
export async function SectionError({ error, className }: { error: unknown; className?: string }) {
  const t = await getTranslations("errors");
  const common = await getTranslations("common");
  const api = isApiError(error) ? error : null;
  const offline = error instanceof NetworkError;
  if (api?.status === 403) {
    // "Not allowed" (redesign G0 revision): a calm neutral notice with a lock, who can change it — never a red error.
    return (
      <div role="alert" data-testid="section-error" data-code={api.code} className={className}>
        <Callout tone="neutral" icon={IconLock} title={t("forbidden.sectionTitle")} legalRef={api.legalRef}>
          <p>{api.detail || t("forbidden.sectionBody")}</p>
          {api.requestId ? (
            <p className="text-muted mt-1 font-mono text-xs">
              {common("requestId")}: {api.requestId}
            </p>
          ) : null}
        </Callout>
      </div>
    );
  }
  return (
    <div role="alert" data-testid="section-error" data-code={api?.code ?? "unexpected"} className={className}>
      <Callout
        tone={api?.status === 404 ? "warning" : "danger"}
        title={api?.title || (offline ? t("offline.title") : t("unexpected.title"))}
        legalRef={api?.legalRef}
      >
        <p>{api?.detail || (offline ? t("offline.body") : t("unexpected.body"))}</p>
        {api?.requestId ? (
          <p className="mt-1 font-mono text-xs opacity-80">
            {common("requestId")}: {api.requestId}
          </p>
        ) : null}
      </Callout>
    </div>
  );
}

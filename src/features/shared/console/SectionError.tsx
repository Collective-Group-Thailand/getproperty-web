import { getTranslations } from "next-intl/server";

import Link from "next/link";

import { isApiError, NetworkError } from "@/lib/api/errors";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconLock } from "@/ui/icons/glyphs/lock";

/**
 * A section of a server-rendered console page whose API read failed (`section()`): the API's own
 * localised title and detail with the request id — or "no connection" — while the rest of the page
 * still renders. A refusal for the person's role (403) is not an error: a calm "not open to your role" card with the
 * way home, no request id. Server-only markup; the error object never crosses into a client component.
 */
export async function SectionError({ error, className }: { error: unknown; className?: string }) {
  const t = await getTranslations("errors");
  const common = await getTranslations("common");
  const api = isApiError(error) ? error : null;
  const offline = error instanceof NetworkError;
  if (api?.status === 403)
    return (
      <div data-testid="section-error" data-code={api.code} className={className}>
        <EmptyState
          variant="card"
          icon={IconLock}
          title={t("forbidden.title")}
          description={t("forbidden.body")}
          action={
            <Button asChild variant="secondary">
              <Link href="/">{t("forbidden.home")}</Link>
            </Button>
          }
        />
      </div>
    );
  return (
    <div role="alert" data-testid="section-error" data-code={api?.code ?? "unexpected"} className={className}>
      <Callout
        tone={api?.status === 403 || api?.status === 404 ? "warning" : "danger"}
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

"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/ui/components/Button";
import { ErrorState } from "@/ui/components/ErrorState";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";

/**
 * The error boundary body of every segment (`error.tsx`). It shows a recoverable message, a retry
 * and the id support needs to find the failure: the API's request id when the error carries one
 * (an `ApiError`), otherwise Next's digest of the server error. Nothing else from the error reaches
 * the screen — messages of server errors are never shown to users.
 */
export function ZoneError({
  error,
  reset,
}: {
  error: Error & { digest?: string; requestId?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");
  const common = useTranslations("common");

  useEffect(() => {
    // Reported by the observability layer (F1 1.3); the console keeps the stack for local debugging.
    console.error(error);
  }, [error]);

  const reference = error.requestId ?? error.digest;
  return (
    <ErrorState
      title={t("unexpected.title")}
      description={t("unexpected.body")}
      requestId={reference}
      requestIdLabel={common("requestId")}
      action={
        <Button variant="secondary" iconStart={IconRefresh} onClick={reset}>
          {common("retry")}
        </Button>
      }
    />
  );
}

"use client";

import { useTranslations } from "next-intl";

import { ComplianceNotice } from "@/features/shared/compliance/ComplianceNotice";
import { isApiError } from "@/lib/api/errors";
import { Button } from "@/ui/components/Button";
import { ErrorState } from "@/ui/components/ErrorState";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";

/**
 * The error state of a client query or mutation: compliance answers with their legal reference, API
 * problems with their localised detail, everything with the request id support needs.
 */
export function QueryErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useTranslations("errors");
  const common = useTranslations("common");
  if (isApiError(error) && error.isCompliance) {
    return (
      <ComplianceNotice problem={{ ...error.problem, code: error.code, title: error.title, detail: error.detail }} />
    );
  }
  const api = isApiError(error) ? error : null;
  return (
    <ErrorState
      title={api?.title || t("unexpected.title")}
      description={api?.detail || t("unexpected.body")}
      requestId={api?.requestId}
      requestIdLabel={common("requestId")}
      action={
        onRetry ? (
          <Button variant="secondary" iconStart={IconRefresh} onClick={onRetry}>
            {common("retry")}
          </Button>
        ) : undefined
      }
    />
  );
}

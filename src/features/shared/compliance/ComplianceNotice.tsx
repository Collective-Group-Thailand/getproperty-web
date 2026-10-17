"use client";

import { useTranslations } from "next-intl";

import type { Problem } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";

export type ComplianceProblem = Pick<Problem, "code" | "detail" | "title"> &
  Partial<Pick<Problem, "legalRef" | "ruleId" | "evaluationId" | "shown" | "requestId">>;

/**
 * A compliance answer from the API (contract §3): a refusal (`compliance.*`, 422) is shown with its
 * legal reference and nothing else to do — the UI never offers a way around it (CLAUDE.md). A warning
 * that needs an acknowledgement (`compliance.acknowledgement_required`, D-021a) shows the values the
 * API listed and lets the screen record the acknowledgement and repeat the request.
 */
export function ComplianceNotice({
  problem,
  onAcknowledge,
  acknowledging,
}: {
  problem: ComplianceProblem;
  onAcknowledge?: (evaluationId: string) => void;
  acknowledging?: boolean;
}) {
  const t = useTranslations("errors.compliance");
  const common = useTranslations("common");
  const warning = problem.code === "compliance.acknowledgement_required";
  const shown = problem.shown && typeof problem.shown === "object" ? Object.entries(problem.shown) : [];

  return (
    <Callout
      tone={warning ? "warning" : "danger"}
      title={problem.title || (warning ? t("warning") : t("refused"))}
      legalRef={problem.legalRef ? t("legalRef", { ref: problem.legalRef }) : undefined}
      action={
        warning && problem.evaluationId && onAcknowledge ? (
          <Button
            size="sm"
            variant="secondary"
            loading={acknowledging}
            onClick={() => onAcknowledge(problem.evaluationId!)}
          >
            {t("acknowledge")}
          </Button>
        ) : undefined
      }
    >
      <p data-testid="compliance-detail" data-code={problem.code}>
        {problem.detail}
      </p>
      {shown.length > 0 ? (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 text-xs" aria-label={t("shown")}>
          {shown.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="font-mono opacity-80">{key}</dt>
              <dd className="font-mono tabular-nums">{String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {problem.requestId ? (
        <p className="mt-1 font-mono text-xs opacity-80">
          {common("requestId")}: {problem.requestId}
        </p>
      ) : null}
    </Callout>
  );
}

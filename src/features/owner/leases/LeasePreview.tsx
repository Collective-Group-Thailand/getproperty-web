"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { formatDate, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Spinner } from "@/ui/components/Spinner";

/**
 * The lease's compliance checks **before** the draft exists (`POST /v1/owner/leases/compliance-preview`,
 * D-208): a dry run of the create with the same terms — each rule's outcome with its legal reference, the
 * problems the create would answer (a refusal is shown, never worked around) and the defaults the API
 * would apply (deposit, advance, end date). Nothing is written; the create itself stays the check.
 */
export function LeasePreview({ body }: { body: Schemas["LeaseCreateDto"] }) {
  const t = useTranslations("owner.leases.preview");
  const outcome = useTranslations("owner.leases.compliance.outcome");
  const locale = useLocale() as Locale;
  const key = JSON.stringify(body);
  const [result, setResult] = useState<{ key: string; preview: Schemas["LeaseCompliancePreviewDto"] | null }>();

  useEffect(() => {
    let alive = true;
    unwrap(browserApi().POST("/v1/owner/leases/compliance-preview", { body: JSON.parse(key) }))
      .then((preview) => alive && setResult({ key, preview }))
      .catch(() => alive && setResult({ key, preview: null }));
    return () => {
      alive = false;
    };
  }, [key]);

  if (!result || result.key !== key)
    return (
      <p className="text-muted flex items-center gap-2 text-sm">
        <Spinner size="sm" label={t("checking")} /> <span aria-hidden="true">{t("checking")}</span>
      </p>
    );
  const preview = result.preview;
  if (!preview) return <p className="text-muted text-sm">{t("unavailable")}</p>;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="lease-preview" data-testid="lease-preview">
      <h3 id="lease-preview" className="font-semibold">
        {t("title")}
      </h3>
      {preview.checks.length ? (
        <ul className="flex flex-col gap-2 text-sm">
          {preview.checks.map((check) => (
            <li
              key={check.ruleId}
              className="flex flex-wrap items-center gap-2"
              data-testid="preview-check"
              data-rule={check.ruleId}
              data-outcome={check.outcome}
            >
              <Badge
                tone={check.outcome === "pass" ? "success" : check.outcome === "warn" ? "warning" : "danger"}
                size="sm"
              >
                {outcome(check.outcome)}
              </Badge>
              <span className="font-mono text-xs">{check.ruleId}</span>
              <span className="text-muted text-xs">{check.legalRef}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted text-sm">{preview.inScope ? t("noChecks") : t("outOfScope")}</p>
      )}
      {preview.problems.map((problem) => (
        <Callout
          key={`${problem.code}-${problem.ruleId ?? ""}`}
          tone={problem.status === 422 ? "danger" : "warning"}
          title={t("problem", { code: problem.code })}
          legalRef={problem.legalRef ?? undefined}
        >
          {problem.errors.length ? (
            <ul className="list-disc ps-5 text-sm">
              {problem.errors.map((error) => (
                <li key={`${error.path}-${error.code}`}>
                  <span className="font-mono">{error.path}</span> — {error.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm">{t("problemHint")}</p>
          )}
        </Callout>
      ))}
      {preview.defaults ? (
        <DescriptionList
          columns={3}
          items={[
            { id: "deposit", term: t("deposit"), description: formatTHB(preview.defaults.depositAmount, locale) },
            { id: "advance", term: t("advance"), description: formatTHB(preview.defaults.advanceRentAmount, locale) },
            { id: "end", term: t("endDate"), description: formatDate(preview.defaults.endDate, locale) },
          ]}
        />
      ) : null}
    </section>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ProblemNotice, useApiAction, useIdempotencyKey } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { Button } from "@/ui/components/Button";
import { IconBill } from "@/ui/icons/glyphs/bill";

import { DocumentButton } from "../shared/DocumentButton";

/** Makes the PDF summary of one unit and year (B7.5) and then offers to open it. */
export function IncomeSummaryButton({ year, unitId, unitNo }: { year: number; unitId: string; unitNo: string }) {
  const t = useTranslations("owner.income");
  const action = useApiAction<{ documentId: string; number: string }>({ refresh: false });
  const idempotency = useIdempotencyKey();
  const [made, setMade] = useState<{ documentId: string; number: string } | null>(null);
  return (
    <div className="flex flex-col items-start gap-2">
      {made ? (
        <DocumentButton
          document={{ kind: "file", id: made.documentId }}
          label={t("openPdf")}
          title={t("pdfTitle", { unit: unitNo, number: made.number })}
          testId="income-open"
        />
      ) : (
        <Button
          variant="secondary"
          size="sm"
          iconStart={IconBill}
          loading={action.busy}
          data-testid="income-make"
          onClick={() =>
            action.run(
              () =>
                unwrap(
                  browserApi().POST("/v1/owner/income-summaries", {
                    params: { header: { "Idempotency-Key": idempotency.key } },
                    body: { year, unitId },
                  }),
                ),
              (result) => setMade(result),
            )
          }
        >
          {t("makePdf")}
        </Button>
      )}
      <ProblemNotice error={action.error} />
    </div>
  );
}

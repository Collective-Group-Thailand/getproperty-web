"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";

interface Skipped {
  invoiceId?: string;
  unitNo?: string | null;
  reason?: string;
}

/**
 * The billing cycle's actions, as the API offers them (`nextActions`): compute (and request the missing
 * readings), issue every ready draft — a typed confirmation that restates the property, the period,
 * the number of drafts and their total, one Idempotency-Key per dialog, the tariff-cap acknowledgement
 * when a line is above the cap — and close. Drafts the API skipped are listed with their reason.
 */
export function CycleActions({
  cycle,
  periodLabel,
  draftCount,
  totalLabel,
}: {
  cycle: Pick<Schemas["BillingCycleDto"], "id" | "nextActions" | "propertyName" | "periodKey">;
  periodLabel: string;
  draftCount: number;
  totalLabel: string;
}) {
  const t = useTranslations("owner.billing.actions");
  const reasons = useTranslations("owner.invoices.flag");
  const compute = useApiAction();
  const [skipped, setSkipped] = useState<Skipped[] | null>(null);
  const can = (name: string) => cycle.nextActions.includes(name);
  const path = { billingCycleId: cycle.id };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2" data-testid="cycle-actions">
        {can("compute") ? (
          <Button
            variant="secondary"
            iconStart={IconRefresh}
            loading={compute.busy}
            onClick={() =>
              void compute.run(() =>
                unwrap(
                  browserApi().POST("/v1/owner/billing-cycles/{billingCycleId}/actions/compute", { params: { path } }),
                ),
              )
            }
            data-testid="cycle-compute"
          >
            {t("compute")}
          </Button>
        ) : null}
        {can("issue") ? (
          <ConfirmAction
            label={t("issueAll")}
            icon={IconBill}
            testId="cycle-issue"
            title={t("issueTitle")}
            description={t("issueBody", {
              property: cycle.propertyName,
              period: periodLabel,
              count: draftCount,
              total: totalLabel,
            })}
            confirmLabel={t("issueConfirm", { count: draftCount })}
            phrase={cycle.periodKey}
            successMessage={t("issued")}
            onConfirm={(key, acknowledgementIds) =>
              unwrap(
                browserApi().POST("/v1/owner/billing-cycles/{billingCycleId}/actions/issue", {
                  params: { path, header: { "Idempotency-Key": key } },
                  body: { acknowledgementIds: acknowledgementIds.length ? acknowledgementIds : undefined },
                }),
              )
            }
            onDone={(result) => {
              const list = (result as Schemas["BillingCycleIssueResultDto"]).skipped as unknown;
              setSkipped(Array.isArray(list) ? (list as Skipped[]) : []);
            }}
          />
        ) : null}
        {can("close") ? (
          <ConfirmAction
            label={t("close")}
            icon={IconCheck}
            variant="secondary"
            testId="cycle-close"
            title={t("closeTitle")}
            description={t("closeBody", { property: cycle.propertyName, period: periodLabel })}
            confirmLabel={t("close")}
            onConfirm={() =>
              unwrap(browserApi().POST("/v1/owner/billing-cycles/{billingCycleId}/actions/close", { params: { path } }))
            }
          />
        ) : null}
      </div>
      <ProblemNotice error={compute.error} />
      {skipped && skipped.length > 0 ? (
        <div data-testid="issue-skipped" className="w-full">
          <Callout tone="warning" title={t("skippedTitle", { count: skipped.length })}>
            <ul className="list-disc ps-5">
              {skipped.map((item, index) => (
                <li key={item.invoiceId ?? index}>
                  {t("skippedItem", {
                    unit: item.unitNo ?? "—",
                    reason:
                      item.reason && reasons.has(item.reason as never)
                        ? reasons(item.reason as never)
                        : (item.reason ?? "—"),
                  })}
                </li>
              ))}
            </ul>
          </Callout>
        </div>
      ) : null}
    </div>
  );
}

/** `POST /v1/owner/billing-cycles` — opens this month's cycle of a property when none exists yet. */
export function OpenCycleButton({ propertyId }: { propertyId: string }) {
  const t = useTranslations("owner.billing.actions");
  const action = useApiAction();
  return (
    <div className="flex flex-col gap-2">
      <Button
        loading={action.busy}
        onClick={() =>
          void action.run(() => unwrap(browserApi().POST("/v1/owner/billing-cycles", { body: { propertyId } })))
        }
        data-testid="cycle-open"
      >
        {t("open")}
      </Button>
      <ProblemNotice error={action.error} />
    </div>
  );
}

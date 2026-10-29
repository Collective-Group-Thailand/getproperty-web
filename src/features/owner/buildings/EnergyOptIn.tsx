"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { ProblemNotice, useApiAction, useIdempotencyKey } from "@/features/shared/console/useApiAction";
import { formatDate, formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";

type Insight = Schemas["EnergyInsightDto"];

/**
 * Sharing a building's energy figures with getenergy (G9, D-301, O-036): nothing leaves before the building's owner
 * reads the consent text the API sends and ticks the box (never pre-ticked); the opt-in carries that text's version
 * and an Idempotency-Key. Only aggregates go (no names, contacts, units or residents). Opting out stops it and asks
 * getenergy to delete what it had.
 */
export function EnergyOptIn({ insight }: { insight: Insight }) {
  const t = useTranslations("owner.insight.energy.share");
  const locale = useLocale() as Locale;
  const action = useApiAction();
  const idempotency = useIdempotencyKey();
  const [agreed, setAgreed] = useState(false);
  const optin = insight.optin;
  const path = { params: { path: { buildingId: insight.buildingId } } };

  if (!insight.canOptIn) {
    return (
      <p className="text-muted m-0 text-sm" data-testid="energy-owner-only">
        {t("ownerOnly")}
      </p>
    );
  }

  if (optin?.state === "opted_in") {
    return (
      <div className="flex flex-col gap-3" data-testid="energy-opted-in">
        <Callout tone="success" title={t("onTitle")}>
          <p className="m-0">
            {t("onBody", { date: formatDate(optin.optedInAt, locale) })}
            {optin.lastSharedAt
              ? ` ${t("lastShared", { date: formatDateTime(optin.lastSharedAt, locale), score: optin.lastScore ?? "—" })}`
              : ` ${t("notSentYet")}`}
          </p>
        </Callout>
        <ConfirmAction
          label={t("stop")}
          variant="secondary"
          size="sm"
          testId="energy-opt-out"
          title={t("stopTitle")}
          description={t("stopBody")}
          confirmLabel={t("stop")}
          successMessage={t("stopped")}
          onConfirm={() =>
            unwrap(browserApi().POST("/v1/owner/buildings/{buildingId}/energy-insight/actions/opt-out", path))
          }
        />
      </div>
    );
  }

  const consent = insight.consent;
  return (
    <div className="flex flex-col gap-3" data-testid="energy-opt-in">
      {optin?.state === "opted_out" && optin.optedOutAt ? (
        <p className="text-muted m-0 text-sm" data-testid="energy-opted-out">
          {t("offSince", { date: formatDate(optin.optedOutAt, locale) })}
        </p>
      ) : null}
      {consent ? (
        <>
          <div className="border-border rounded-card flex flex-col gap-2 border p-3" data-testid="energy-consent">
            <p className="m-0 text-sm font-semibold">{consent.title}</p>
            <p className="text-muted m-0 text-sm whitespace-pre-wrap">{consent.bodyMarkdown}</p>
            <p className="text-muted m-0 text-xs">{t("version", { version: consent.version })}</p>
          </div>
          <Checkbox
            checked={agreed}
            onCheckedChange={(value) => setAgreed(value === true)}
            label={t("agree")}
            data-testid="energy-agree"
          />
          <div>
            <Button
              disabled={!agreed}
              loading={action.busy}
              onClick={() =>
                action.run(
                  () =>
                    unwrap(
                      browserApi().POST("/v1/owner/buildings/{buildingId}/energy-insight/actions/opt-in", {
                        params: {
                          path: { buildingId: insight.buildingId },
                          header: { "Idempotency-Key": idempotency.key },
                        },
                        body: { consentVersion: consent.version },
                      }),
                    ),
                  () => {
                    idempotency.renew();
                    setAgreed(false);
                  },
                )
              }
              data-testid="energy-opt-in-submit"
            >
              {t("start")}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-muted m-0 text-sm">{t("noText")}</p>
      )}
      <ProblemNotice error={action.error} />
    </div>
  );
}

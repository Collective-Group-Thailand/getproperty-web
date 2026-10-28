"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconMail } from "@/ui/icons/glyphs/mail";
import { IconUndo } from "@/ui/icons/glyphs/undo";

import { LANGUAGES } from "./labels";

/**
 * Offer a renewal (G3, D-294): the API's suggestion — the k ≥ 5 `rent_per_m2` benchmark when the tenant shares
 * anonymised analytics (give to get, D-217), else the listing's comparables, else the current rent — with its source
 * and basis, the other candidates one tap away, and the owner's own figure; months, letter language and a message.
 * The B7.5 renewal letter goes out in the same request (Idempotency-Key); the resident answers in LINE.
 */
export function OfferRenewal({
  leaseId,
  unitNo,
  months,
  language,
  suggestion,
}: {
  leaseId: string;
  unitNo: string;
  months: number;
  language: Schemas["Language"];
  suggestion: Schemas["RenewalSuggestionDto"] | null;
}) {
  const t = useTranslations("owner.contracts.renewals");
  const c = useTranslations("owner.contracts");
  const locale = useLocale() as Locale;
  const [rent, setRent] = useState(suggestion?.suggested.rent ?? "");
  return (
    <FormDialog
      label={t("offer")}
      icon={IconMail}
      variant="primary"
      size="sm"
      size_="lg"
      testId="renewal-offer"
      title={t("offerTitle", { unitNo })}
      description={t("offerBody")}
      submitLabel={t("offerSubmit")}
      successMessage={t("offered")}
      onSubmit={(data, _ack, idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/owner/leases/{leaseId}/renewal-offers", {
            params: { path: { leaseId }, header: { "Idempotency-Key": idempotencyKey } },
            body: {
              rent: rent.replace(/,/g, "").trim() || undefined,
              months: Number(text(data, "months")) || undefined,
              language: text(data, "language") as Schemas["Language"] | undefined,
              message: text(data, "message") ?? null,
            },
          }),
        )
      }
    >
      {(errors) => (
        <div className="flex flex-col gap-4">
          {suggestion ? (
            <div className="bg-bg-subtle rounded-card flex flex-col gap-2 p-3 text-sm" data-testid="renewal-suggestion">
              <p>{t("current", { rent: formatTHB(suggestion.currentRent, locale) })}</p>
              <p className="font-semibold" data-source={suggestion.suggested.source}>
                {t("suggested", {
                  rent: formatTHB(suggestion.suggested.rent, locale),
                  source: c(`rentSource.${suggestion.suggested.source}`),
                })}
              </p>
              <p className="text-muted font-mono text-xs break-all" data-testid="renewal-basis">
                {suggestion.suggested.basis}
              </p>
              {suggestion.candidates.length > 1 ? (
                <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                  {suggestion.candidates.map((candidate) => (
                    <li key={candidate.source}>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setRent(candidate.rent)}
                        data-testid="renewal-candidate"
                        data-source={candidate.source}
                      >
                        {t("useCandidate", {
                          rent: formatTHB(candidate.rent, locale),
                          source: c(`rentSource.${candidate.source}`),
                        })}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="text-muted text-sm">{t("noSuggestion")}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("rent")} required hint={t("rentHint")} error={errors.rent}>
              <Input
                value={rent}
                onChange={(event) => setRent(event.target.value)}
                inputMode="decimal"
                className="tabular-nums"
                data-testid="renewal-rent"
              />
            </Field>
            <Field label={t("months")} required error={errors.months}>
              <Input name="months" type="number" min={1} max={36} defaultValue={months} data-testid="renewal-months" />
            </Field>
            <Field label={t("language")} error={errors.language}>
              <NativeSelect
                name="language"
                defaultValue={language}
                options={LANGUAGES.map((value) => ({ value, label: c(`language.${value}`) }))}
              />
            </Field>
          </div>
          <Field label={t("message")} hint={t("messageHint")} error={errors.message}>
            <Textarea name="message" rows={2} />
          </Field>
        </div>
      )}
    </FormDialog>
  );
}

/** Withdraw an open offer (G3): the resident can no longer accept it; the letter already sent stays on file. */
export function WithdrawOffer({ offerId, unitNo }: { offerId: string; unitNo: string }) {
  const t = useTranslations("owner.contracts.renewals");
  return (
    <ConfirmAction
      label={t("withdraw")}
      icon={IconUndo}
      size="sm"
      variant="secondary"
      tone="destructive"
      testId="renewal-withdraw"
      title={t("withdrawTitle", { unitNo })}
      description={t("withdrawBody")}
      confirmLabel={t("withdraw")}
      successMessage={t("withdrawn")}
      onConfirm={() =>
        unwrap(
          browserApi().POST("/v1/owner/renewal-offers/{offerId}/actions/withdraw", { params: { path: { offerId } } }),
        )
      }
    />
  );
}

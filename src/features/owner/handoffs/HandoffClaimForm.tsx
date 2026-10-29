"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { fieldErrors } from "@/features/shared/console/FormDialog";
import { ProblemNotice, useApiAction, useSubmissionKey } from "@/features/shared/console/useApiAction";
import { handoffNeedsAddress, type HandoffFacts } from "@/features/shared/growth/handoff";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput } from "@/ui/components/Input";

import { ownerPath } from "../shared/links";

const RENT = /^\d{1,12}(\.\d{1,2})?$/;
const trimmed = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

/**
 * Claim a getbuild handoff (G8, D-299): the rent (typed by the owner — getbuild sends no price), the headline in
 * Thai (prefilled from getbuild's facts, editable) and English, and the address only when getbuild could not tell
 * it. One Idempotency-Key per claim as typed: a retry of the same claim after a lost answer is recognised, an edited
 * claim is a new request with a new key (review L10). On success the listing draft opens —
 * photos and publishing as any listing. Refusals that are states of the invitation get the screen's own words.
 */
export function HandoffClaimForm({
  token,
  facts,
  suggestedTitle,
}: {
  token: string;
  facts: HandoffFacts;
  suggestedTitle: string;
}) {
  const t = useTranslations("owner.network.claim");
  const locale = useLocale() as Locale;
  const action = useApiAction<Schemas["RentalHandoffDto"]>({ refresh: false });
  const submission = useSubmissionKey();
  const errors = fieldErrors(action.error);
  const [rentError, setRentError] = useState<string | null>(null);
  const askAddress = handoffNeedsAddress(facts) || Object.keys(errors).some((key) => key.startsWith("address"));
  const code = isApiError(action.error) ? action.error.code : null;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rent = trimmed(form, "rent").replace(/,/g, "");
    if (!RENT.test(rent)) {
      setRentError(t("rentInvalid"));
      return;
    }
    setRentError(null);
    const titleEn = trimmed(form, "titleEn");
    const address = askAddress
      ? {
          line1: trimmed(form, "line1"),
          subdistrict: trimmed(form, "subdistrict"),
          district: trimmed(form, "district"),
          province: trimmed(form, "province"),
          postcode: trimmed(form, "postcode"),
        }
      : undefined;
    const body = {
      token,
      rent,
      titleTh: trimmed(form, "titleTh") || undefined,
      titleEn: titleEn || null,
      ...(address ? { address } : {}),
    };
    const key = submission.for(body);
    void action.run(
      () =>
        unwrap(
          browserApi().POST("/v1/owner/rental-handoffs/actions/claim", {
            params: { header: { "Idempotency-Key": key } },
            body,
          }),
        ),
      (handoff) => {
        submission.answered();
        window.location.assign(
          handoff.listingId
            ? ownerPath(locale, `/listings/${handoff.listingId}?from=getbuild`)
            : ownerPath(locale, "/listings/handoffs"),
        );
      },
    );
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={submit} noValidate data-testid="handoff-claim-form">
      <div className="grid gap-4 md:grid-cols-[minmax(0,14rem)_1fr]">
        <Field label={t("rent")} hint={t("rentHint")} error={rentError ?? errors.rent} required>
          <NumberInput name="rent" inputMode="decimal" unit={t("rentUnit")} data-testid="handoff-rent" />
        </Field>
        <Field label={t("titleTh")} hint={t("titleHint")} error={errors.titleTh}>
          <Input name="titleTh" defaultValue={suggestedTitle} maxLength={120} data-testid="handoff-title-th" />
        </Field>
      </div>
      <Field label={t("titleEn")} hint={t("titleEnHint")} error={errors.titleEn}>
        <Input name="titleEn" maxLength={120} />
      </Field>
      {askAddress ? (
        <fieldset className="border-border rounded-card flex flex-col gap-4 border p-4" data-testid="handoff-address">
          <legend className="px-1 text-sm font-semibold">{t("address.title")}</legend>
          <p className="text-muted m-0 text-sm">{t("address.why")}</p>
          <Field label={t("address.line1")} error={errors["address.line1"]} required>
            <Input name="line1" maxLength={200} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("address.subdistrict")} error={errors["address.subdistrict"]} required>
              <Input name="subdistrict" maxLength={100} required />
            </Field>
            <Field label={t("address.district")} error={errors["address.district"]} required>
              <Input name="district" defaultValue={facts.district ?? ""} maxLength={100} required />
            </Field>
            <Field label={t("address.province")} error={errors["address.province"]} required>
              <Input name="province" defaultValue={facts.province ?? ""} maxLength={100} required />
            </Field>
            <Field label={t("address.postcode")} error={errors["address.postcode"]} required>
              <Input name="postcode" inputMode="numeric" maxLength={5} required />
            </Field>
          </div>
        </fieldset>
      ) : null}

      {code === "handoff.landlord_required" ? (
        <div data-testid="handoff-landlord-required">
          <Callout
            tone="warning"
            title={t("landlordRequired.title")}
            action={
              <Button asChild size="sm" variant="secondary">
                <a href={ownerPath(locale, "/select-tenant")}>{t("landlordRequired.switch")}</a>
              </Button>
            }
          >
            {t("landlordRequired.body")}
          </Callout>
        </div>
      ) : code === "handoff.invalid_state" ? (
        <div data-testid="handoff-invalid-state">
          <Callout tone="warning" title={t("invalidState.title")}>
            {t("invalidState.body")}
          </Callout>
        </div>
      ) : (
        <ProblemNotice error={action.error} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" loading={action.busy} data-testid="handoff-claim-submit">
          {t("submit")}
        </Button>
        <span className="text-muted text-sm">{t("after")}</span>
      </div>
    </form>
  );
}

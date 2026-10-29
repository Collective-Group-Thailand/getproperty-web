"use client";

import { useTranslations } from "next-intl";

import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { bangkokInstant } from "@/features/shared/console/time";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { IconRules } from "@/ui/icons/glyphs/rules";

/**
 * Publishes a new `platform.recommendations` consent text (G6, D-300, D-025): Thai and English title and Markdown
 * text (prefilled with the version in force), from now or a later Bangkok time — never backdated. Once in force every
 * earlier grant counts as not granted, so the dialog says how many people will be asked again. Legal review first
 * (⚖ O-023). Idempotency-Key per opening.
 */
export function PublishConsentText({
  current,
  consentingCount,
}: {
  current: { th: Schemas["ConsentTextDto"]; en: Schemas["ConsentTextDto"] } | null;
  /** People consenting now (a total). */
  consentingCount: number;
}) {
  const t = useTranslations("admin.broadcast.consent");
  return (
    <FormDialog
      label={t("publish")}
      icon={IconRules}
      testId="consent-publish"
      size_="lg"
      title={t("publishTitle")}
      description={t("publishBody")}
      submitLabel={t("submit")}
      successMessage={t("published")}
      onSubmit={(data, _ack, idempotencyKey) => {
        const from = text(data, "effectiveFrom");
        return unwrap(
          browserApi().POST("/v1/admin/broadcast/consent-texts", {
            params: { header: { "Idempotency-Key": idempotencyKey } },
            body: {
              th: { title: text(data, "th.title") ?? "", bodyMarkdown: text(data, "th.bodyMarkdown") ?? "" },
              en: { title: text(data, "en.title") ?? "", bodyMarkdown: text(data, "en.bodyMarkdown") ?? "" },
              effectiveFrom: from ? (bangkokInstant(from) ?? null) : null,
            },
          }),
        );
      }}
    >
      {(errors) => (
        <div className="flex flex-col gap-4">
          <Callout tone="warning" title={t("publishWarning", { count: consentingCount })}>
            {t("legal")}
          </Callout>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4" lang="th">
              <Field label={t("titleTh")} error={errors["th.title"]} required>
                <Input name="th.title" defaultValue={current?.th.title ?? ""} data-testid="consent-th-title" />
              </Field>
              <Field label={t("bodyTh")} hint={t("bodyHint")} error={errors["th.bodyMarkdown"]} required>
                <Textarea
                  name="th.bodyMarkdown"
                  rows={8}
                  defaultValue={current?.th.bodyMarkdown ?? ""}
                  data-testid="consent-th-body"
                />
              </Field>
            </div>
            <div className="flex flex-col gap-4" lang="en">
              <Field label={t("titleEn")} error={errors["en.title"]} required>
                <Input name="en.title" defaultValue={current?.en.title ?? ""} data-testid="consent-en-title" />
              </Field>
              <Field label={t("bodyEn")} hint={t("bodyHint")} error={errors["en.bodyMarkdown"]} required>
                <Textarea
                  name="en.bodyMarkdown"
                  rows={8}
                  defaultValue={current?.en.bodyMarkdown ?? ""}
                  data-testid="consent-en-body"
                />
              </Field>
            </div>
          </div>
          <Field label={t("effectiveFrom")} hint={t("effectiveFromHint")} error={errors.effectiveFrom}>
            <Input type="datetime-local" name="effectiveFrom" className="max-w-xs" data-testid="consent-from" />
          </Field>
        </div>
      )}
    </FormDialog>
  );
}

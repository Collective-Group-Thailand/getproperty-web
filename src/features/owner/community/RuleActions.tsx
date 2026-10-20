"use client";

import { useTranslations } from "next-intl";

import { DateField } from "@/features/shared/console/DateField";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { bangkokToday } from "@/features/shared/console/time";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { IconRules } from "@/ui/icons/glyphs/rules";

const TRANSLATED = ["en", "my", "km", "lo", "zh"] as const;

/**
 * Publishes a new version of the building's rules (D-212): in force from a date that is never in the past;
 * residents acknowledge the version in force in their app (and with the lease signature).
 */
export function NewRuleVersion({ buildingId, latest }: { buildingId: string; latest?: Schemas["BuildingRuleDto"] }) {
  const t = useTranslations("owner.community.rules");
  const languages = useTranslations("owner.community.compose.languages");
  return (
    <FormDialog
      label={t("add")}
      icon={IconRules}
      variant="primary"
      testId="rule-add"
      title={t("addTitle")}
      description={t("addBody")}
      submitLabel={t("publish")}
      successMessage={t("published")}
      size_="lg"
      onSubmit={(data) => {
        const translations = Object.fromEntries(
          TRANSLATED.map((language) => [language, text(data, `body-${language}`)])
            .filter(([, body]) => body)
            .map(([language, body]) => [language, { body: body! }]),
        ) as Schemas["TranslationsDto"];
        return unwrap(
          browserApi().POST("/v1/owner/buildings/{buildingId}/rules", {
            params: { path: { buildingId } },
            body: {
              title: text(data, "title") ?? "",
              bodyTh: text(data, "bodyTh") ?? "",
              effectiveFrom: text(data, "effectiveFrom") ?? "",
              translations,
            },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <Field label={t("ruleTitle")} required error={errors.title}>
            <Input name="title" required defaultValue={latest?.title} data-testid="rule-title" />
          </Field>
          <Field label={t("body")} required error={errors.bodyTh}>
            <Textarea name="bodyTh" rows={8} required defaultValue={latest?.bodyTh} data-testid="rule-body" />
          </Field>
          <Field label={t("effectiveFrom")} hint={t("effectiveHint")} required error={errors.effectiveFrom}>
            <DateField name="effectiveFrom" defaultValue={bangkokToday(1)} min={bangkokToday()} />
          </Field>
          <details className="flex flex-col gap-3">
            <summary className="cursor-pointer font-medium">{t("translations")}</summary>
            {TRANSLATED.map((language) => (
              <Field key={language} label={languages(language)} error={errors[`translations.${language}.body`]}>
                <Textarea
                  name={`body-${language}`}
                  rows={3}
                  defaultValue={latest?.translations[language]?.body ?? ""}
                />
              </Field>
            ))}
          </details>
        </>
      )}
    </FormDialog>
  );
}

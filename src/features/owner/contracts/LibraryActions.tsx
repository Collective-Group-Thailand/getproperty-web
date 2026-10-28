"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { FormDialog, text } from "@/features/shared/console/FormDialog";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconCopy } from "@/ui/icons/glyphs/copy";

import { ownerPath } from "../shared/links";

/**
 * Copy a published version into my templates (G3, D-294: `derivedFromVersionId`): the version by language and an
 * optional name; the API answers the new template, which opens in the editor. The copy is still a draft pending legal
 * review — the dialog says so.
 */
export function CopyTemplate({ name, versions }: { name: string; versions: { id: string; label: string }[] }) {
  const t = useTranslations("owner.contracts.copy");
  const router = useRouter();
  const locale = useLocale() as Locale;
  return (
    <FormDialog
      label={t("label")}
      icon={IconCopy}
      size="sm"
      testId="library-copy"
      title={t("title", { name })}
      description={t("body")}
      submitLabel={t("submit")}
      successMessage={t("done")}
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/owner/contract-templates", {
            body: { derivedFromVersionId: text(data, "versionId") ?? "", name: text(data, "name") },
          }),
        )
      }
      onDone={(result) =>
        router.push(ownerPath(locale, `/contracts/templates/${(result as Schemas["ContractTemplateDetailDto"]).id}`))
      }
    >
      {(errors) => (
        <div className="flex flex-col gap-4">
          <Field label={t("version")} required error={errors.derivedFromVersionId}>
            <NativeSelect
              name="versionId"
              options={versions.map((version) => ({ value: version.id, label: version.label }))}
              data-testid="copy-version"
            />
          </Field>
          <Field label={t("name")} hint={t("nameHint")} error={errors.name}>
            <Input name="name" maxLength={200} data-testid="copy-name" />
          </Field>
        </div>
      )}
    </FormDialog>
  );
}

import { getTranslations } from "next-intl/server";

import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";

/**
 * The code box: a plain GET form (works without JavaScript) to `/rent-record?code=`, which redirects to
 * `/rent-record/{CODE}`.
 */
export async function RentRecordCheck({ locale }: { locale: Locale }) {
  const t = await getTranslations("owner.rentRecord.check");
  return (
    <form
      method="get"
      action={getPathname({ href: "/rent-record", locale })}
      className="border-border bg-surface rounded-card flex flex-col gap-3 border p-5 sm:flex-row sm:items-end"
      data-testid="rent-record-check"
    >
      <div className="flex-1">
        <Field label={t("codeLabel")} hint={t("codeHint")}>
          <Input name="code" autoComplete="off" autoCapitalize="characters" maxLength={14} required />
        </Field>
      </div>
      <Button type="submit">{t("submit")}</Button>
    </form>
  );
}

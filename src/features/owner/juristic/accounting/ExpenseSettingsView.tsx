import { getTranslations } from "next-intl/server";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { formatDateTime } from "@/i18n/format";
import { Callout } from "@/ui/components/Callout";

import { SettingsCard } from "../../settings/SettingsNav";
import { SettingRows } from "../../settings/SettingsView";
import { readOnly, type OwnerContext } from "../../shared/server";
import { parseBands } from "./bands";
import { expenseSettings } from "./ExpensesView";
import { ExpensesNav } from "./parts";
import { BandsEditor, WhtRatesEditor } from "./SettingsEditors";
import { anyUnverified, parseWhtRates } from "./wht";

/**
 * Approval limits and withholding tax of the office (D-311, D-329, ⚖ O-041): the bands as rows, the WHT rates as data,
 * the bank matching window through the shared setting row. Every value is the API's setting in force; a change is a
 * new version with a reason.
 */
export async function ExpenseSettingsView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.accounting.expenseSettings");
  const { locale, me } = context;
  const { settings } = await expenseSettings(context);
  const find = (key: string) => settings.find((setting) => setting.key === key);
  const bands = find("juristic.approval_bands");
  const rates = find("juristic.wht_rates");
  const match = find("juristic.bank_match_days");
  const editable = (setting: typeof bands) =>
    Boolean(setting?.editable && setting.scopeAllowed.includes("tenant") && !readOnly(me));
  const since = (setting: typeof bands) =>
    setting
      ? t(setting.scope === "tenant" ? "sinceTenant" : "sincePlatform", {
          date: formatDateTime(setting.effectiveFrom, locale),
        })
      : undefined;
  const rateList = parseWhtRates(rates?.value);
  return (
    <OwnerPage testId="juristic-expense-settings">
      <PageHeader title={t("title")} description={t("lede")} />
      <ExpensesNav current="settings" locale={locale} />
      <SettingsCard number={1} id="bands-title" title={t("bands")} description={since(bands) ?? t("bandsHint")} flush>
        {bands ? (
          <BandsEditor bands={parseBands(bands.value)} editable={editable(bands)} />
        ) : (
          <p className="text-muted m-0 px-6 py-5 text-sm">{t("missing")}</p>
        )}
      </SettingsCard>
      <SettingsCard number={2} id="wht-title" title={t("wht")} description={since(rates) ?? t("whtHint")} flush>
        {anyUnverified(rateList) ? (
          <div className="px-5 pt-5 md:px-6" data-testid="wht-settings-unverified">
            <Callout tone="warning" title={t("unverifiedTitle")}>
              {t("unverifiedBody")}
            </Callout>
          </div>
        ) : null}
        {rates ? (
          <WhtRatesEditor rates={rateList} editable={editable(rates)} />
        ) : (
          <p className="text-muted m-0 px-6 py-5 text-sm">{t("missing")}</p>
        )}
      </SettingsCard>
      {match ? (
        <SettingsCard number={3} id="match-title" title={t("matching")} description={t("matchingHint")} flush>
          <SettingRows settings={[match]} context={context} testId="settings-bank-match" />
        </SettingsCard>
      ) : null}
    </OwnerPage>
  );
}

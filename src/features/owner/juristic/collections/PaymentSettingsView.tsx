import { getTranslations } from "next-intl/server";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { unwrap } from "@/lib/api/client";

import { SettingsCard } from "../../settings/SettingsNav";
import { SettingRows } from "../../settings/SettingsView";
import { section, type OwnerContext } from "../../shared/server";
import { CollectionsNav } from "./CollectionsNav";

/** The settings a juristic office decides about payments, plans and certificates (D-308, D-306) — from the API only. */
export const JURISTIC_PAYMENT_KEYS = [
  "payments.allocation_policy",
  "payments.allow_partial",
  "payments.slip_max_age_days",
  "juristic.plan_default_days",
  "juristic.plan_max_instalments",
  "juristic.debt_clearance.fee",
  "juristic.debt_clearance.validity_days",
] as const;

/**
 * Juristic payment rules (JW1b): how a payment is spread (allocation policy), partial payments, the slip date window,
 * when a plan defaults and how many instalments it may have, the debt clearance fee and validity — each the value in
 * force with where it comes from, changed as a new effective-dated version with a reason (ADR-0004). Nothing here is a
 * default of the UI.
 */
export async function PaymentSettingsView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.collections.paymentSettings");
  const { api, locale } = context;
  const settings = await section(unwrap(api.GET("/v1/owner/settings", { params: { query: {} } })));
  const pick = (keys: readonly string[]) =>
    keys.flatMap((key) => settings.data?.find((setting) => setting.key === key) ?? []);
  return (
    <OwnerPage testId="juristic-payment-settings">
      <PageHeader title={t("title")} description={t("lede")} />
      <CollectionsNav current="payments" locale={locale} />
      {!settings.data ? (
        <SectionError error={settings.error} />
      ) : (
        <>
          <SettingsCard number={1} id="payments-title" title={t("payments")} description={t("paymentsHint")} flush>
            <SettingRows
              settings={pick(JURISTIC_PAYMENT_KEYS.slice(0, 3))}
              context={context}
              testId="settings-payments"
            />
          </SettingsCard>
          <SettingsCard number={2} id="plans-title" title={t("plans")} description={t("plansHint")} flush>
            <SettingRows settings={pick(JURISTIC_PAYMENT_KEYS.slice(3, 5))} context={context} testId="settings-plans" />
          </SettingsCard>
          <SettingsCard number={3} id="clearance-title" title={t("clearance")} description={t("clearanceHint")} flush>
            <SettingRows
              settings={pick(JURISTIC_PAYMENT_KEYS.slice(5))}
              context={context}
              testId="settings-clearance"
            />
          </SettingsCard>
        </>
      )}
    </OwnerPage>
  );
}

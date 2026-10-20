import { getTranslations } from "next-intl/server";

import { BANK_ACCOUNT_STATUS } from "@/domain/status/bankAccount";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { AddBankAccount, ConfirmPendingAccount, RemoveBankAccount } from "./BankAccountActions";
import { SettingsNav } from "./SettingsNav";

/**
 * Receiving bank accounts (F2 2.6, D-042): the accounts residents pay into (masked), their provider
 * for Thai QR, the buildings they serve and their state; adding or changing one needs the SMS OTP
 * sent to the Owner.
 */
export async function BankAccountsView({
  context,
}: {
  context: OwnerContext;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.settings.bank");
  const { api, locale, me, buildings } = context;
  const accounts = await section(unwrap(api.GET("/v1/owner/bank-accounts")));
  const manage = ownerCan(me, "tenant.bank_account.manage") && !readOnly(me);
  const name = (id: string) => buildings.find((building) => building.id === id)?.name ?? id.slice(0, 8);
  return (
    <OwnerPage testId="bank-accounts">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          manage ? (
            <AddBankAccount buildings={buildings.map((building) => ({ id: building.id, name: building.name }))} />
          ) : null
        }
      />
      <SettingsNav me={me} current="/settings/bank-accounts" locale={locale} />
      {!accounts.data ? (
        <SectionError error={accounts.error} />
      ) : accounts.data.filter((account) => account.state !== "removed").length === 0 ? (
        <Card>
          <EmptyState title={t("empty")} description={t("emptyHint")} />
        </Card>
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="bank-table"
          minWidth="52rem"
          columns={[
            { key: "account", header: t("col.account") },
            { key: "provider", header: t("col.provider") },
            { key: "buildings", header: t("col.buildings") },
            { key: "state", header: t("col.state") },
            { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
          ]}
          rows={accounts.data
            .filter((account) => account.state !== "removed")
            .map((account) => ({
              key: account.id,
              testId: "bank-row",
              data: { state: account.state },
              cells: {
                account: (
                  <span className="flex flex-col">
                    <span className="font-semibold">{account.bankNameTh}</span>
                    <span className="font-mono">{account.accountNoMasked}</span>
                    <span className="text-muted text-xs">{account.accountName}</span>
                    {account.isDefault ? (
                      <Badge size="sm" tone="primary">
                        {t("default")}
                      </Badge>
                    ) : null}
                  </span>
                ),
                provider: t(`providerName.${account.paymentProvider}`),
                buildings: account.buildingIds.length ? account.buildingIds.map(name).join(", ") : t("allBuildings"),
                state: (
                  <span className="flex flex-col gap-1">
                    <StatusBadgeOf map={BANK_ACCOUNT_STATUS} value={account.state} size="sm" />
                    {account.confirmedAt ? (
                      <span className="text-muted text-xs">
                        {t("confirmedAt", { date: formatDateTime(account.confirmedAt, locale) })}
                      </span>
                    ) : null}
                  </span>
                ),
                actions: manage ? (
                  <span className="flex flex-wrap gap-2">
                    {account.state === "pending_otp" &&
                    (account.nextActions.includes("confirm") || account.nextActions.includes("resend-otp")) ? (
                      <ConfirmPendingAccount account={account} />
                    ) : null}
                    {account.nextActions.includes("remove") ? <RemoveBankAccount account={account} /> : null}
                  </span>
                ) : null,
              },
            }))}
        />
      )}
    </OwnerPage>
  );
}

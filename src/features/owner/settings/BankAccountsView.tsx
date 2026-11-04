import { getTranslations } from "next-intl/server";

import { BANK_ACCOUNT_STATUS } from "@/domain/status/bankAccount";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconBank } from "@/ui/icons/glyphs/bank";

import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { AddBankAccount, BankAccountMenu, ConfirmPendingAccount } from "./BankAccountActions";
import { SettingsCard, SettingsFrame } from "./SettingsNav";

/**
 * Settings › Bank accounts (F2 2.6, D-042; redesign G6): the accounts residents pay into (masked), the Thai QR provider,
 * the buildings each serves and its state; a pending account's OTP step as the row's one visible action, removal in
 * its "⋯". Adding one ("เพิ่มบัญชี", the section's filled action) needs the SMS code sent to the Owner, in a side sheet.
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
  const options = buildings.map((building) => ({ id: building.id, name: building.name }));
  const name = (id: string) => buildings.find((building) => building.id === id)?.name;
  const rows = (accounts.data ?? []).filter((account) => account.state !== "removed");
  return (
    <SettingsFrame
      me={me}
      locale={locale}
      current="/settings/bank-accounts"
      title={t("title")}
      description={t("description")}
      actions={manage ? <AddBankAccount buildings={options} /> : null}
      testId="bank-accounts"
    >
      {!accounts.data ? (
        <SectionError error={accounts.error} />
      ) : rows.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconBank}
          title={t("empty")}
          description={t("emptyHint")}
          action={manage ? <AddBankAccount buildings={options} testId="add-bank-account-empty" secondary /> : null}
        />
      ) : (
        <SettingsCard id="bank-list" title={t("listTitle")} description={t("listHint")} flush>
          <SimpleTable
            caption={t("title")}
            testId="bank-table"
            minWidth="46rem"
            stackOnPhones
            className="rounded-none border-0 shadow-none"
            columns={[
              { key: "account", header: t("col.account"), phone: "title" },
              { key: "provider", header: t("col.provider"), phone: "meta" },
              { key: "buildings", header: t("col.buildings"), phone: "meta" },
              { key: "state", header: t("col.state"), className: "whitespace-nowrap", phone: "status" },
              {
                key: "actions",
                header: <span className="sr-only">{t("col.actions")}</span>,
                align: "end",
                phone: "figure",
              },
            ]}
            rows={rows.map((account) => ({
              key: account.id,
              testId: "bank-row",
              data: { state: account.state },
              cells: {
                account: (
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{account.bankNameTh}</span>
                      {account.isDefault ? (
                        <Badge size="sm" tone="primary">
                          {t("default")}
                        </Badge>
                      ) : null}
                    </span>
                    <span className="font-mono text-sm tabular-nums">{account.accountNoMasked}</span>
                    <span className="text-muted text-sm">{account.accountName}</span>
                  </span>
                ),
                provider: t(`providerName.${account.paymentProvider}`),
                buildings: account.buildingIds.length
                  ? account.buildingIds.map(name).filter(Boolean).join(", ") || t("allBuildings")
                  : t("allBuildings"),
                state: (
                  <span className="flex flex-col items-start gap-1">
                    <StatusBadgeOf map={BANK_ACCOUNT_STATUS} value={account.state} size="sm" />
                    {account.confirmedAt ? (
                      <span className="text-muted text-sm">
                        {t("confirmedAt", { date: formatDate(account.confirmedAt, locale) })}
                      </span>
                    ) : null}
                  </span>
                ),
                actions: manage ? (
                  <span className="flex items-center justify-end gap-2">
                    {account.state === "pending_otp" &&
                    (account.nextActions.includes("confirm") || account.nextActions.includes("resend-otp")) ? (
                      <ConfirmPendingAccount account={account} />
                    ) : null}
                    {account.nextActions.includes("remove") ? <BankAccountMenu account={account} /> : null}
                  </span>
                ) : (
                  ""
                ),
              },
            }))}
          />
        </SettingsCard>
      )}
    </SettingsFrame>
  );
}

import { getTranslations } from "next-intl/server";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Card, CardHeader } from "@/ui/components/Card";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconBank } from "@/ui/icons/glyphs/bank";
import { IconLock } from "@/ui/icons/glyphs/lock";

import { ownerCan, readOnly, section, type OwnerContext } from "../../shared/server";
import { AccountRowActions, NewAccountButton } from "./AccountActions";
import { groupAccounts } from "./accounts";
import { AccountingNav } from "./parts";

/**
 * The chart of accounts (J2.1 §1, D-329): the template of the office's legal form, copied once and then its own —
 * grouped by type in statement order, by code. System accounts carry the role the posting rules use and cannot be
 * deactivated; codes and types never change. Owners, managers and accountants add accounts, rename them, link an
 * asset account to a bank account, deactivate what they added.
 */
export async function AccountsView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.accounting.accounts");
  const types = await getTranslations("owner.accounting.accountType");
  const { api, locale, me } = context;
  const [chart, banks] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/juristic/accounts", { params: { query: {} } }))),
    section(unwrap(api.GET("/v1/owner/bank-accounts"))),
  ]);
  const canManage = !readOnly(me) && ownerCan(me, "juristic.accounting.manage");
  const bankList = (banks.data ?? []).map((bank) => ({
    id: bank.id,
    label: `${bank.bankNameTh} ${bank.accountNoMasked}`,
  }));
  const bankName = (id: string | null) => bankList.find((bank) => bank.id === id)?.label ?? null;
  return (
    <OwnerPage testId="juristic-accounts">
      <PageHeader
        title={t("title")}
        description={t("lede")}
        actions={canManage ? <NewAccountButton banks={bankList} /> : undefined}
      />
      <AccountingNav current="accounts" locale={locale} />
      {!chart.data ? (
        <SectionError error={chart.error} />
      ) : (
        groupAccounts(chart.data.data).map((group) => (
          <Card
            key={group.type}
            as="section"
            aria-labelledby={`chart-${group.type}`}
            className="flex flex-col gap-4"
            data-testid={`chart-group-${group.type}`}
          >
            <CardHeader
              title={<span id={`chart-${group.type}`}>{types(group.type)}</span>}
              description={t("count", { count: group.accounts.length })}
            />
            <SimpleTable
              caption={types(group.type)}
              minWidth="44rem"
              stackOnPhones
              columns={[
                { key: "code", header: t("code"), phone: "meta" },
                { key: "name", header: t("name"), phone: "title" },
                { key: "about", header: t("about"), phone: "meta" },
                { key: "state", header: t("state"), phone: "status" },
                ...(canManage
                  ? [
                      {
                        key: "actions",
                        header: <span className="sr-only">{t("actions")}</span>,
                        align: "end" as const,
                        phone: "hidden" as const,
                      },
                    ]
                  : []),
              ]}
              rows={group.accounts.map((account) => ({
                key: account.id,
                testId: "chart-account",
                data: { code: account.code },
                cells: {
                  code: <span className="font-mono text-sm tabular-nums">{account.code}</span>,
                  name: (
                    <span className="flex flex-col">
                      <span>{locale === "th" ? account.nameTh : account.nameEn}</span>
                      <span className="text-muted text-sm">{locale === "th" ? account.nameEn : account.nameTh}</span>
                    </span>
                  ),
                  about: <AccountAbout account={account} bank={bankName(account.bankAccountId)} />,
                  state: account.isActive ? (
                    <span className="text-muted text-sm">{account.used ? t("inUse") : t("notUsed")}</span>
                  ) : (
                    <Badge size="sm" tone="neutral">
                      {t("inactive")}
                    </Badge>
                  ),
                  ...(canManage ? { actions: <AccountRowActions account={account} banks={bankList} /> } : {}),
                },
              }))}
            />
          </Card>
        ))
      )}
    </OwnerPage>
  );
}

async function AccountAbout({ account, bank }: { account: Schemas["AccountDto"]; bank: string | null }) {
  const t = await getTranslations("owner.accounting.accounts");
  const roles = await getTranslations("owner.accounting.role");
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {account.isSystem ? (
        <Badge size="sm" tone="neutral" icon={IconLock}>
          {account.role && roles.has(account.role) ? roles(account.role) : t("system")}
        </Badge>
      ) : (
        <span className="text-muted text-sm">{t("added")}</span>
      )}
      {bank ? (
        <Badge size="sm" tone="info" icon={IconBank}>
          {bank}
        </Badge>
      ) : null}
    </span>
  );
}

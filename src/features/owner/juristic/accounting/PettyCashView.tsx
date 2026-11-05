import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { currentTime } from "@/features/shared/console/time";
import { formatDate, formatIsoDate, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { EmptyState } from "@/ui/components/EmptyState";
import { ProgressLine } from "@/ui/components/ProgressLine";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusText } from "@/ui/components/StatusText";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconCoins } from "@/ui/icons/glyphs/coins";
import { IconWarning } from "@/ui/icons/glyphs/warning";

import { DocumentButton } from "../../shared/DocumentButton";
import { ownerPath } from "../../shared/links";
import { focusedBuilding, ownerCan, readOnly, section, type OwnerContext } from "../../shared/server";
import { accountLabel, expenseAccounts } from "./accounts";
import { decimalSatang, isZero } from "./money";
import { FundsNav, memberName } from "./parts";
import { CountButton, NewPettyCashButton, SpendButton, TopUpButton } from "./PettyCashActions";
import { chartOfAccounts, officeMembers } from "./shared";

/** The balance's share of the float, for the thin line only (two API figures compared, nothing summed). */
function floatShare(balance: string, float: string): number {
  const b = decimalSatang(balance);
  const f = decimalSatang(float);
  return b !== null && f !== null && f > 0n ? Number((b * 1000n) / f) / 1000 : 0;
}

/**
 * Petty cash floats (D-329): what each float should hold, what the book says it holds (a thin line of the float),
 * the custodian and the last count with its difference. Staff reach this page from the funds entry.
 */
export async function PettyCashListView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.accounting.petty");
  const common = await getTranslations("owner.accounting.common");
  const { api, locale, me } = context;
  const building = focusedBuilding(context);
  const [list, members] = await Promise.all([
    section(
      unwrap(
        api.GET("/v1/owner/juristic/petty-cash", { params: { query: building ? { buildingId: building.id } : {} } }),
      ),
    ),
    officeMembers(api),
  ]);
  const canManage = !readOnly(me) && ownerCan(me, "juristic.fund.manage");
  const custodians = members
    .filter((member) => member.status === "active" && ["owner", "manager", "staff", "accountant"].includes(member.role))
    .map((member) => ({ id: member.userId, label: member.displayName }));
  const money = (value: string) => formatTHB(value, locale);
  return (
    <OwnerPage testId="juristic-petty-cash">
      <PageHeader
        title={t("title")}
        description={t("lede")}
        actions={
          canManage && custodians.length ? (
            <NewPettyCashButton
              buildings={context.buildings.map((b) => ({ id: b.id, label: b.name }))}
              custodians={custodians}
            />
          ) : undefined
        }
      />
      <FundsNav current="petty" locale={locale} funds={ownerCan(me, "juristic.accounting.read")} />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconCoins}
          title={t("empty.title")}
          description={t("empty.body")}
          action={
            canManage && custodians.length ? (
              <NewPettyCashButton
                buildings={context.buildings.map((b) => ({ id: b.id, label: b.name }))}
                custodians={custodians}
              />
            ) : (
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/juristic/expenses")}>{t("toExpenses")}</a>
              </Button>
            )
          }
        />
      ) : (
        <ul className="m-0 grid list-none gap-4 p-0 lg:grid-cols-2" data-testid="petty-cards">
          {list.data.data.map((petty) => (
            <li key={petty.id}>
              <Card as="article" interactive className="relative flex h-full flex-col gap-4" data-testid="petty-card">
                <div className="flex flex-col">
                  <a
                    href={ownerPath(locale, `/juristic/petty-cash/${petty.id}`)}
                    className="text-lg font-semibold after:absolute after:inset-0"
                  >
                    {petty.name}
                  </a>
                  <span className="text-muted text-sm">
                    {t("custodian", { name: memberName(members, petty.custodianUserId, common("unknownMember")) })}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xl font-semibold tabular-nums">{money(petty.balance)}</span>
                    <span className="text-muted text-sm">{t("ofFloat", { float: money(petty.floatAmount) })}</span>
                  </div>
                  <ProgressLine
                    share={floatShare(petty.balance, petty.floatAmount)}
                    label={t("ofFloat", { float: money(petty.floatAmount) })}
                  />
                </div>
                <LastCount last={petty.lastCount} lang={locale} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </OwnerPage>
  );
}

async function LastCount({ last, lang }: { last: Schemas["PettyCashLastCountDto"] | null; lang: Locale }) {
  const t = await getTranslations("owner.accounting.petty");
  if (!last) return <p className="text-muted m-0 mt-auto text-sm">{t("neverCounted")}</p>;
  const date = formatDate(last.countedOn, lang);
  return isZero(last.difference) ? (
    <StatusText tone="success" icon={IconCheckCircle} className="mt-auto">
      {t("countMatched", { date })}
    </StatusText>
  ) : (
    <StatusText tone="warning" icon={IconWarning} className="mt-auto">
      {t("countDiffered", { date, amount: formatTHB(last.difference, lang) })}
    </StatusText>
  );
}

/** One float: the entries (top-ups, spends with receipts, count differences) and the counts; spend / count / top up. */
export async function PettyCashView({ context, pettyCashId }: { context: OwnerContext; pettyCashId: string }) {
  const t = await getTranslations("owner.accounting.petty");
  const common = await getTranslations("owner.accounting.common");
  const { api, locale, me } = context;
  let petty: Schemas["PettyCashDetailDto"];
  try {
    petty = await unwrap(api.GET("/v1/owner/juristic/petty-cash/{pettyCashId}", { params: { path: { pettyCashId } } }));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const [members, accounts] = await Promise.all([officeMembers(api), chartOfAccounts(api)]);
  const money = (value: string) => formatTHB(value, locale);
  const today = formatIsoDate(currentTime());
  const isCustodian = petty.custodianUserId === me.user.id;
  // Staff spend only from a float they hold (the API: `petty_cash.not_custodian`); owners and managers from any.
  const staffOnly = me.roles.every((role) => role === "staff");
  const canSpend = !readOnly(me) && ownerCan(me, "juristic.petty_cash.spend") && (isCustodian || !staffOnly);
  const canManage = !readOnly(me) && ownerCan(me, "juristic.fund.manage");
  const canRequest = !readOnly(me) && ownerCan(me, "juristic.expense.request");
  const spendAccounts = expenseAccounts(accounts).map((a) => ({ id: a.id, label: accountLabel(a, locale) }));
  return (
    <OwnerPage testId="juristic-petty">
      <PageHeader
        title={petty.name}
        description={t("recordLede", { name: memberName(members, petty.custodianUserId, common("unknownMember")) })}
        back={{ label: t("title"), href: ownerPath(locale, "/juristic/petty-cash") }}
      />
      <DetailLayout
        panel={
          <ActionPanel
            testId="petty-panel"
            summary={
              <div className="flex flex-col gap-1.5">
                <span className="text-muted text-sm">{t("balance")}</span>
                <span className="text-2xl font-semibold tracking-tight tabular-nums" data-testid="petty-balance">
                  {money(petty.balance)}
                </span>
                <ProgressLine
                  share={floatShare(petty.balance, petty.floatAmount)}
                  label={t("ofFloat", { float: money(petty.floatAmount) })}
                />
                <span className="text-muted text-sm">{t("ofFloat", { float: money(petty.floatAmount) })}</span>
              </div>
            }
            title={t("panelTitle")}
            description={spendAccounts.length || !canSpend ? t("panelBody") : t("noAccounts")}
            primary={
              canSpend && spendAccounts.length ? (
                <SpendButton petty={petty} accounts={spendAccounts} today={today} />
              ) : undefined
            }
            secondary={
              <>
                {canManage ? <CountButton petty={petty} today={today} /> : null}
                {canRequest ? <TopUpButton petty={petty} /> : null}
              </>
            }
          />
        }
      >
        <Card as="section" aria-labelledby="petty-entries" className="flex flex-col gap-4">
          <CardHeader title={<span id="petty-entries">{t("entries")}</span>} description={t("entriesHint")} />
          {petty.entries.length === 0 ? (
            <p className="text-muted m-0 text-sm">{t("noEntries")}</p>
          ) : (
            <SimpleTable
              caption={t("entries")}
              minWidth="44rem"
              stackOnPhones
              testId="petty-entries"
              columns={[
                { key: "date", header: t("col.date"), phone: "meta" },
                { key: "what", header: t("col.what"), phone: "title" },
                { key: "receipt", header: t("col.receipt"), phone: "status" },
                { key: "amount", header: t("col.amount"), align: "end", phone: "figure" },
              ]}
              rows={petty.entries.map((entry) => ({
                key: entry.id,
                testId: "petty-entry",
                data: { kind: entry.kind },
                cells: {
                  date: <span className="whitespace-nowrap">{formatDate(entry.entryOn, locale)}</span>,
                  what: (
                    <span className="flex flex-col">
                      <span>{entry.description}</span>
                      <span className="text-muted text-sm">{t(`kind.${entry.kind}`)}</span>
                    </span>
                  ),
                  receipt: entry.receiptDocumentId ? (
                    <DocumentButton
                      document={{ kind: "file", id: entry.receiptDocumentId }}
                      label={t("receipt")}
                      title={entry.description}
                      size="sm"
                    />
                  ) : entry.expenseRequestId ? (
                    <a
                      className="text-primary text-sm underline-offset-4 hover:underline"
                      href={ownerPath(locale, `/juristic/expenses/${entry.expenseRequestId}`)}
                    >
                      {t("request")}
                    </a>
                  ) : (
                    <span className="text-muted text-sm">—</span>
                  ),
                  amount: <span className="font-medium tabular-nums">{money(entry.amount)}</span>,
                },
              }))}
            />
          )}
        </Card>
        <Card as="section" aria-labelledby="petty-counts" className="flex flex-col gap-4">
          <CardHeader title={<span id="petty-counts">{t("counts")}</span>} description={t("countsHint")} />
          {petty.counts.length === 0 ? (
            <p className="text-muted m-0 text-sm">{t("neverCounted")}</p>
          ) : (
            <SimpleTable
              caption={t("counts")}
              minWidth="40rem"
              testId="petty-counts"
              columns={[
                { key: "date", header: t("col.date") },
                { key: "counted", header: t("col.counted"), align: "end" },
                { key: "book", header: t("col.book"), align: "end" },
                { key: "difference", header: t("col.difference"), align: "end" },
              ]}
              rows={petty.counts.map((count) => ({
                key: count.id,
                cells: {
                  date: (
                    <span className="flex flex-col">
                      <span>{formatDate(count.countedOn, locale)}</span>
                      {count.note ? <span className="text-muted text-sm">{count.note}</span> : null}
                    </span>
                  ),
                  counted: <span className="tabular-nums">{money(count.countedAmount)}</span>,
                  book: <span className="tabular-nums">{money(count.bookBalance)}</span>,
                  difference: isZero(count.difference) ? (
                    <Badge size="sm" tone="success">
                      {t("matched")}
                    </Badge>
                  ) : (
                    <StatusText tone="warning" icon={IconWarning}>
                      {money(count.difference)}
                    </StatusText>
                  ),
                },
              }))}
            />
          )}
        </Card>
      </DetailLayout>
    </OwnerPage>
  );
}

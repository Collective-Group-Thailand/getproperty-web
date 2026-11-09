import { getTranslations } from "next-intl/server";

import { PAYMENT_MANDATE_STATUS } from "@/domain/status";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { enumParam } from "@/features/shared/console/params";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconRepeat } from "@/ui/icons/glyphs/repeat";

import { ownerPath, withQuery } from "../../shared/links";
import { ownerCan, pageParam, readOnly, section, type OwnerContext } from "../../shared/server";
import { RevokeMandateButton } from "./MandateActions";

type SearchParams = Record<string, string | string[] | undefined>;
const STATES: Schemas["PaymentMandateState"][] = ["active", "pending", "revoked", "failed"];

/**
 * Auto-pay mandates residents set up in the app (D-308, O-020): direct debit or a card, charged once per advance
 * invoice (or every invoice). Only the masked account is ever shown; the office can stop one with a reason.
 */
export async function MandatesView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.collections.mandates");
  const { api, locale, me } = context;
  const state = enumParam(searchParams.state, STATES);
  const page = pageParam(searchParams.page);
  const base = ownerPath(locale, "/juristic/payment-mandates");
  const list = await section(
    unwrap(
      api.GET("/v1/owner/payment-mandates", { params: { query: { page, perPage: 50, ...(state ? { state } : {}) } } }),
    ),
  );
  const canRevoke = !readOnly(me) && ownerCan(me, "juristic.collections.manage");
  const tabHref = (value: string | undefined) => withQuery(base, { state: value });
  const rows = list.data?.data ?? [];
  return (
    <OwnerPage testId="juristic-mandates">
      <PageHeader title={t("title")} description={t("lede")} />
      <LinkTabs
        label={t("show")}
        current={tabHref(state)}
        tabs={[
          { href: tabHref(undefined), label: t("tab.all") },
          ...STATES.map((value) => ({
            href: tabHref(value),
            label: t(`tab.${value}`),
            testId: `mandates-tab-${value}`,
          })),
        ]}
      />
      <Callout tone="neutral" size="sm">
        {t("privacy")}
      </Callout>
      {!list.data ? (
        <SectionError error={list.error} />
      ) : rows.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconRepeat}
          title={t("empty.title")}
          description={t("empty.body")}
          action={
            <Button asChild variant="secondary">
              <a href={ownerPath(locale, "/juristic/receivables")}>{t("empty.action")}</a>
            </Button>
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="mandate-rows"
          stackOnPhones
          minWidth="48rem"
          columns={[
            { key: "unit", header: t("col.unit"), phone: "title" },
            { key: "method", header: t("col.method") },
            { key: "scope", header: t("col.scope") },
            { key: "since", header: t("col.since") },
            { key: "state", header: t("col.state"), phone: "status" },
            {
              key: "action",
              header: <span className="sr-only">{t("col.action")}</span>,
              align: "end",
              phone: "figure",
            },
          ]}
          rows={rows.map((mandate) => ({
            key: mandate.id,
            testId: "mandate-row",
            data: { state: mandate.state },
            cells: {
              unit: (
                <span className="flex min-w-0 flex-col">
                  <span className="font-mono font-medium">{mandate.unitNo}</span>
                  {mandate.partyName ? <span className="text-muted text-sm">{mandate.partyName}</span> : null}
                </span>
              ),
              method: (
                <span className="flex flex-col">
                  <span>{t(`method.${mandate.method}`)}</span>
                  <span className="text-muted font-mono text-sm">{mandate.masked ?? "—"}</span>
                </span>
              ),
              scope: t(`scope.${mandate.scope}`),
              since: (
                <span className="flex flex-col">
                  <span>{formatDate(mandate.activatedAt ?? mandate.createdAt, locale)}</span>
                  {mandate.endReason ? <span className="text-muted text-sm">{mandate.endReason}</span> : null}
                </span>
              ),
              state: <StatusBadgeOf map={PAYMENT_MANDATE_STATUS} value={mandate.state} size="sm" />,
              action:
                canRevoke && (mandate.state === "active" || mandate.state === "pending") ? (
                  <RevokeMandateButton mandate={mandate} />
                ) : null,
            },
          }))}
        />
      )}
      {list.data && list.data.meta.total > list.data.meta.perPage ? (
        <ListPagination meta={list.data.meta} path={base} searchParams={searchParams} locale={locale} />
      ) : null}
    </OwnerPage>
  );
}

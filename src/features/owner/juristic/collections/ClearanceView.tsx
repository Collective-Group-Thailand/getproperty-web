import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { DEBT_CLEARANCE_STATUS } from "@/domain/status";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { enumParam } from "@/features/shared/console/params";
import { currentTime } from "@/features/shared/console/time";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatIsoDate, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { ListToolbar } from "@/ui/components/ListToolbar";
import { Paper, PaperFoot, PaperHead, PaperParties, PaperSection } from "@/ui/components/Paper";
import { RowList } from "@/ui/components/RowList";
import { IconReceipt } from "@/ui/icons/glyphs/receipt";

import { DocumentButton } from "../../shared/DocumentButton";
import { ownerPath, withQuery } from "../../shared/links";
import { ownerCan, pageParam, param, readOnly, section, type OwnerContext } from "../../shared/server";
import {
  IssueClearanceButton,
  NewClearanceButton,
  RefuseClearanceButton,
  type ClearanceOwner,
} from "./ClearanceActions";

type SearchParams = Record<string, string | string[] | undefined>;
const STATES: Schemas["DebtClearanceState"][] = ["requested", "issued", "refused"];

/** Co-owners today, unit by unit, from the register of every building the office runs (first 100 units each). */
async function currentOwners(context: OwnerContext): Promise<ClearanceOwner[]> {
  const pages = await Promise.all(
    context.buildings.map((building) =>
      unwrap(
        context.api.GET("/v1/owner/juristic/register", {
          params: { query: { buildingId: building.id, perPage: 100 } },
        }),
      ).catch(() => null),
    ),
  );
  return pages.flatMap((page) =>
    (page?.data ?? []).flatMap((unit) =>
      unit.owners.map((owner) => ({
        unitId: unit.unitId,
        unitNo: unit.unitNo,
        partyId: owner.party.id,
        partyName: owner.party.displayName,
        building: unit.buildingName,
      })),
    ),
  );
}

/**
 * Debt clearance (JW1b, D-306): requests waiting first — issue once the fee is paid and nothing is owed, or refuse with
 * a reason — then the certificates issued. Each certificate carries a QR to the public check page.
 */
export async function ClearancesView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.collections.clearance");
  const { api, locale, me } = context;
  const state = enumParam(searchParams.state, STATES);
  const q = param(searchParams.q);
  const page = pageParam(searchParams.page);
  const base = ownerPath(locale, "/juristic/debt-clearance");
  const canManage = !readOnly(me) && ownerCan(me, "juristic.collections.manage");
  const [list, requested, owners] = await Promise.all([
    section(
      unwrap(
        api.GET("/v1/owner/juristic/debt-clearances", {
          params: { query: { page, perPage: 25, ...(state ? { state } : {}), ...(q ? { q } : {}) } },
        }),
      ),
    ),
    section(
      unwrap(
        api.GET("/v1/owner/juristic/debt-clearances", { params: { query: { state: "requested", perPage: 1 } } }),
      ).then((result) => result.meta.total),
    ),
    canManage ? currentOwners(context) : Promise.resolve([]),
  ]);
  const tabHref = (value: string | undefined) => withQuery(base, { state: value, q });
  return (
    <OwnerPage testId="juristic-clearances">
      <PageHeader
        title={t("title")}
        description={t("lede")}
        actions={canManage ? <NewClearanceButton owners={owners} today={formatIsoDate(currentTime())} /> : undefined}
      />
      <ListToolbar
        tabs={
          <LinkTabs
            label={t("show")}
            current={tabHref(state)}
            tabs={[
              { href: tabHref(undefined), label: t("tab.all"), testId: "clearances-tab-all" },
              ...STATES.map((value) => ({
                href: tabHref(value),
                label: t(`tab.${value}`),
                count: value === "requested" ? (requested.data ?? undefined) : undefined,
                testId: `clearances-tab-${value}`,
              })),
            ]}
          />
        }
        filters={
          <FilterBar
            variant="toolbar"
            fields={[{ name: "q", label: t("search"), type: "search", placeholder: t("searchPlaceholder") }]}
          />
        }
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : (
        <RowList
          label={t("title")}
          testId="clearance-rows"
          empty={
            <EmptyState
              variant="card"
              icon={IconReceipt}
              title={state || q ? t("empty.filteredTitle") : t("empty.title")}
              description={state || q ? t("empty.filtered") : t("empty.body")}
              action={
                state || q ? (
                  <Button asChild variant="secondary">
                    <a href={base}>{t("empty.clear")}</a>
                  </Button>
                ) : undefined
              }
            />
          }
          items={list.data.data.map((row) => ({
            key: row.id,
            href: ownerPath(locale, `/juristic/debt-clearance/${row.id}`),
            lead: <span className="font-mono">{row.unitNo}</span>,
            title: row.partyName,
            meta: t("rowMeta", {
              via: t(`via.${row.requestedVia}`),
              asOf: formatDate(row.asOf, locale),
              number: row.number ?? t("noNumber"),
            }),
            status: <StatusBadgeOf map={DEBT_CLEARANCE_STATUS} value={row.state} size="sm" />,
            figure:
              row.state === "issued" && row.validUntil ? (
                <span className="text-muted text-sm">
                  {t("validUntil", { date: formatDate(row.validUntil, locale) })}
                </span>
              ) : undefined,
            testId: "clearance-row",
          }))}
        />
      )}
      {list.data && list.data.meta.total > list.data.meta.perPage ? (
        <ListPagination meta={list.data.meta} path={base} searchParams={searchParams} locale={locale} />
      ) : null}
    </OwnerPage>
  );
}

/**
 * One request or certificate (D-306) as paper: the issuer, the co-owner and the unit, the day it speaks for, its
 * validity — the wording itself is the PDF counsel approved. The verification code is shown once when issued; later
 * only its last characters.
 */
export async function ClearanceView({ context, clearanceId }: { context: OwnerContext; clearanceId: string }) {
  const t = await getTranslations("owner.collections.clearance");
  const { api, locale, me } = context;
  let clearance: Schemas["DebtClearanceDto"];
  try {
    clearance = await unwrap(
      api.GET("/v1/owner/juristic/debt-clearances/{debtClearanceId}", {
        params: { path: { debtClearanceId: clearanceId } },
      }),
    );
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const canManage = !readOnly(me) && ownerCan(me, "juristic.collections.manage");
  const next = new Set(clearance.nextActions);
  const issued = clearance.state === "issued";
  const title =
    issued && clearance.number
      ? t("recordTitle", { number: clearance.number })
      : t("requestTitle", { unit: clearance.unitNo });

  return (
    <OwnerPage testId="juristic-clearance">
      <PageHeader
        title={title}
        status={<StatusBadgeOf map={DEBT_CLEARANCE_STATUS} value={clearance.state} />}
        description={t("recordLede", { owner: clearance.partyName, unit: clearance.unitNo })}
        back={{ label: t("title"), href: ownerPath(locale, "/juristic/debt-clearance") }}
      />
      <DetailLayout
        panel={
          <ActionPanel
            testId="clearance-panel"
            title={t("panelTitle")}
            status={<StatusBadgeOf map={DEBT_CLEARANCE_STATUS} value={clearance.state} size="sm" />}
            description={t(`panel.${clearance.state}`)}
            facts={[
              { key: "asOf", label: t("asOf"), value: formatDate(clearance.asOf, locale) },
              { key: "fee", label: t("fee"), value: formatTHB(clearance.fee, locale) },
              { key: "via", label: t("requestedVia"), value: t(`via.${clearance.requestedVia}`) },
              ...(clearance.verifyCodeHint
                ? [
                    {
                      key: "code",
                      label: t("codeHint"),
                      value: <span className="font-mono">{clearance.verifyCodeHint}</span>,
                    },
                  ]
                : []),
            ]}
            primary={
              canManage && next.has("issue") ? (
                <IssueClearanceButton clearance={clearance} />
              ) : issued ? (
                <DocumentButton
                  document={{ kind: "debtClearance", id: clearance.id }}
                  label={t("pdf")}
                  title={title}
                  variant="primary"
                  size="md"
                  testId="clearance-pdf"
                />
              ) : undefined
            }
            secondary={
              <Button asChild variant="secondary" block>
                <a href={withQuery(ownerPath(locale, "/juristic/receivables"), { q: clearance.unitNo })}>
                  {t("openReceivable")}
                </a>
              </Button>
            }
            destructive={canManage && next.has("refuse") ? <RefuseClearanceButton clearance={clearance} /> : undefined}
          />
        }
      >
        {clearance.state === "refused" && clearance.refuseReason ? (
          <Callout tone="neutral" title={t("refusedBecause")}>
            {clearance.refuseReason}
          </Callout>
        ) : null}
        <Paper label={title} testId="clearance-paper">
          <PaperHead
            kind={t("paperKind")}
            number={clearance.number ?? t("noNumber")}
            facts={[
              { key: "asOf", label: t("asOf"), value: formatDate(clearance.asOf, locale, { style: "long" }) },
              ...(clearance.issuedAt
                ? [{ key: "issued", label: t("issuedAt"), value: formatDateTime(clearance.issuedAt, locale) }]
                : []),
              ...(clearance.validUntil
                ? [
                    {
                      key: "valid",
                      label: t("validUntilLabel"),
                      value: formatDate(clearance.validUntil, locale, { style: "long" }),
                    },
                  ]
                : []),
            ]}
          />
          <PaperParties
            items={[
              { key: "issuer", label: t("issuer"), value: me.currentTenant?.displayName ?? "" },
              { key: "owner", label: t("owner"), value: clearance.partyName },
              { key: "unit", label: t("unit"), value: <span className="font-mono">{clearance.unitNo}</span> },
            ]}
          />
          <PaperSection title={t("what")}>
            <p className="m-0 leading-relaxed">{issued ? t("whatIssued") : t("whatRequested")}</p>
          </PaperSection>
          <PaperFoot>
            <span>{issued ? t("footIssued") : t("footRequested")}</span>
          </PaperFoot>
        </Paper>
      </DetailLayout>
    </OwnerPage>
  );
}

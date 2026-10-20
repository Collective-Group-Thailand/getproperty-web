import { getTranslations } from "next-intl/server";

import { DSR_STATUS, DSR_VALUES } from "@/domain/status/dsr";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { enumParam, section, tenantLabel, tenantNames, type AdminContext } from "../shared/server";

const OPEN: Schemas["DsrState"][] = ["received", "verifying", "in_progress"];

/** A request still open past its legal deadline (PDPA s.30: 30 days, `dueAt` from the API). */
export function isOverdue(dsr: Schemas["DsrDto"], now = Date.now()): boolean {
  return OPEN.includes(dsr.state) && new Date(dsr.dueAt).getTime() < now;
}

/**
 * DSR console (F5 5.2, PDPA, D-148): every data subject request across tenants with its kind, state and
 * legal due date — overdue ones first. Each tenant is the controller of its residents' data and moves
 * its requests in the owner console (privacy); the platform watches the deadlines here. The contract
 * has no platform-side action on a request, so this console renders none.
 */
export async function PrivacyView({
  context,
  searchParams,
}: {
  context: AdminContext;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("admin.operations.privacy");
  const { api, locale } = context;
  const state = enumParam(searchParams.state, DSR_VALUES);
  const [dsrs, names] = await Promise.all([
    section(unwrap(api.GET("/v1/admin/data-subject-requests", { params: { query: { state } } }))),
    tenantNames(),
  ]);
  const rows = [...(dsrs.data ?? [])].sort(
    (a, b) => Number(isOverdue(b)) - Number(isOverdue(a)) || a.dueAt.localeCompare(b.dueAt),
  );
  const overdue = rows.filter((dsr) => isOverdue(dsr)).length;
  return (
    <ConsolePage testId="privacy">
      <PageHeader title={t("title")} description={t("description")} />
      <FilterBar
        fields={[
          {
            name: "state",
            label: t("state"),
            type: "select",
            placeholder: t("allStates"),
            options: DSR_VALUES.map((value) => ({ value, label: t(`stateName.${value}`) })),
          },
        ]}
      />
      {overdue > 0 ? (
        <Callout tone="danger" title={t("overdueTitle", { count: overdue })}>
          <span data-testid="dsr-overdue">{t("overdueBody")}</span>
        </Callout>
      ) : null}
      {!dsrs.data ? (
        <SectionError error={dsrs.error} />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState title={t("empty")} description={t("emptyHint")} />
        </Card>
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="dsr-table"
          minWidth="56rem"
          columns={[
            { key: "received", header: t("col.received") },
            { key: "tenant", header: t("col.tenant") },
            { key: "kind", header: t("col.kind") },
            { key: "state", header: t("col.state") },
            { key: "due", header: t("col.due") },
            { key: "notes", header: t("col.notes") },
          ]}
          rows={rows.map((dsr) => {
            const late = isOverdue(dsr);
            return {
              key: dsr.id,
              testId: "dsr-row",
              data: { state: dsr.state, overdue: late },
              tone: late ? "danger" : "default",
              cells: {
                received: formatDateTime(dsr.receivedAt, locale),
                tenant: tenantLabel(names, dsr.tenantId, t("platformController")),
                kind: t(`kind.${dsr.kind}`),
                state: <StatusBadgeOf map={DSR_STATUS} value={dsr.state} size="sm" />,
                due: (
                  <span className="flex flex-col gap-1">
                    <span>{formatDate(dsr.dueAt, locale)}</span>
                    {late ? (
                      <Badge size="sm" tone="danger">
                        {t("late")}
                      </Badge>
                    ) : dsr.fulfilledAt ? (
                      <span className="text-muted text-xs">
                        {t("fulfilled", { date: formatDate(dsr.fulfilledAt, locale) })}
                      </span>
                    ) : null}
                  </span>
                ),
                notes: dsr.notes ?? "—",
              },
            };
          })}
        />
      )}
    </ConsolePage>
  );
}

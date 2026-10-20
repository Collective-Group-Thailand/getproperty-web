import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { INTEGRATION_STATUS, INTEGRATION_VALUES } from "@/domain/status/integration";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatNumber } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { enumParam, pageParam, param, section, tenantLabel, tenantNames, type AdminContext } from "../shared/server";
import { GetFilters } from "./GetFilters";

const SYSTEMS: Schemas["IntegrationSystem"][] = ["getbuild", "getpack"];
const DIRECTIONS: Schemas["IntegrationDirection"][] = ["inbound", "outbound"];

/**
 * Integration events (`bridge.integration_event`, D-205, D-214): what the bridge received from and sent to the
 * other Collective products — type, subject, tenant, state, attempts and last error — filterable by state,
 * system, direction and a search (type prefix, idempotency key or event id). The API never lists payloads.
 * Failed deliveries are replayed from the event outbox.
 */
export async function IntegrationEventsView({
  context,
  searchParams,
}: {
  context: AdminContext;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("admin.operations.integration");
  const statuses = await getTranslations("status.integration");
  const { api, locale } = context;
  const state = enumParam(searchParams.state, INTEGRATION_VALUES);
  const system = enumParam(searchParams.system, SYSTEMS);
  const direction = enumParam(searchParams.direction, DIRECTIONS);
  const q = param(searchParams.q)?.trim() || undefined;
  const [list, names] = await Promise.all([
    section(
      unwrap(
        api.GET("/v1/admin/integration-events", {
          params: {
            query: { page: pageParam(searchParams.page), perPage: 50, state, system, direction, q },
          },
        }),
      ),
    ),
    tenantNames(),
  ]);
  return (
    <ConsolePage testId="integration-events">
      <PageHeader title={t("title")} description={t("description")} />
      <GetFilters
        label={t("filters")}
        submitLabel={t("apply")}
        testId="integration-filters"
        fields={[
          {
            name: "q",
            label: t("search"),
            type: "text",
            value: q,
            placeholder: t("searchPlaceholder"),
            width: "18rem",
          },
          {
            name: "state",
            label: t("state"),
            type: "select",
            value: state,
            options: [
              { value: "", label: t("anyState") },
              ...INTEGRATION_VALUES.map((value) => ({ value, label: statuses(value) })),
            ],
          },
          {
            name: "system",
            label: t("system"),
            type: "select",
            value: system,
            options: [{ value: "", label: t("anySystem") }, ...SYSTEMS.map((value) => ({ value, label: value }))],
          },
          {
            name: "direction",
            label: t("direction"),
            type: "select",
            value: direction,
            options: [
              { value: "", label: t("anyDirection") },
              ...DIRECTIONS.map((value) => ({ value, label: t(`directionValue.${value}`) })),
            ],
          },
        ]}
      />
      <p className="text-muted text-sm">
        {t("outboxHint")}{" "}
        <Link href="/outbox" className="text-primary underline underline-offset-4">
          {t("outbox")}
        </Link>
      </p>
      {!list.data ? (
        <SectionError error={list.error} />
      ) : list.data.data.length === 0 ? (
        <Card>
          <EmptyState title={t("empty")} description={t("emptyBody")} />
        </Card>
      ) : (
        <>
          <SimpleTable
            caption={t("title")}
            testId="integration-events-table"
            minWidth="52rem"
            columns={[
              { key: "event", header: t("col.event") },
              { key: "system", header: t("col.system") },
              { key: "tenant", header: t("col.tenant") },
              { key: "occurred", header: t("col.occurred") },
              { key: "attempts", header: t("col.attempts"), align: "end" },
              { key: "error", header: t("col.error") },
              { key: "state", header: t("col.state") },
            ]}
            rows={list.data.data.map((event) => ({
              key: event.id,
              testId: "integration-event",
              data: { state: event.state, system: event.system, direction: event.direction },
              tone:
                event.state === "dead" || event.state === "failed" || event.state === "rejected" ? "danger" : "default",
              cells: {
                event: (
                  <span className="flex flex-col">
                    <span className="font-mono text-xs">{event.type}</span>
                    <span className="text-muted font-mono text-xs">
                      {t("subject", { subject: event.aggregateRef ?? event.id, version: event.contractVersion })}
                    </span>
                  </span>
                ),
                system: (
                  <span className="flex flex-col">
                    <span className="font-mono text-xs">{event.system}</span>
                    <span className="text-muted text-xs">{t(`directionValue.${event.direction}`)}</span>
                  </span>
                ),
                tenant: tenantLabel(names, event.tenantId, t("platform")),
                occurred: formatDateTime(event.occurredAt, locale),
                attempts: formatNumber(event.attempts, locale),
                error: event.lastError ? (
                  <span className="font-mono text-xs break-all">
                    {event.lastError.length > 160 ? `${event.lastError.slice(0, 160)}…` : event.lastError}
                  </span>
                ) : (
                  "—"
                ),
                state: (
                  <span className="flex flex-col gap-1">
                    <StatusBadgeOf map={INTEGRATION_STATUS} value={event.state} size="sm" />
                    {event.ackedAt ? (
                      <span className="text-muted text-xs">
                        {t("acked", { at: formatDateTime(event.ackedAt, locale) })}
                      </span>
                    ) : null}
                  </span>
                ),
              },
            }))}
          />
          <ListPagination
            meta={list.data.meta}
            path="/integration-events"
            searchParams={searchParams}
            locale={locale}
          />
        </>
      )}
    </ConsolePage>
  );
}

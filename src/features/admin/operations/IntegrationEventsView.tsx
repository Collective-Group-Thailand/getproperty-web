import { getTranslations } from "next-intl/server";

import { INTEGRATION_STATUS, INTEGRATION_VALUES } from "@/domain/status/integration";
import { DetailDrawer } from "@/features/shared/console/DetailDrawer";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatNumber } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconLink } from "@/ui/icons/glyphs/link";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { enumParam, pageParam, param, section, tenantLabel, tenantNames, type AdminContext } from "../shared/server";
import { eventTypeLabel } from "./auditLabels";
import { GetFilters } from "./GetFilters";
import { EventDetails } from "./OutboxView";

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
  const ops = await getTranslations("admin.operations");
  const filtered = Boolean(state || system || direction || q);
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
        clear={filtered ? { label: t("clear"), href: "/integration-events" } : null}
        fields={[
          {
            name: "q",
            label: t("search"),
            type: "text",
            value: q,
            placeholder: t("searchPlaceholder"),
            width: "w-64",
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
      {!list.data ? (
        <SectionError error={list.error} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconLink}
          title={filtered ? t("emptyFiltered") : t("empty")}
          description={filtered ? undefined : t("emptyBody")}
          action={
            <Button asChild variant="secondary">
              <a href={filtered ? "/integration-events" : "/outbox"}>{filtered ? t("clear") : t("outbox")}</a>
            </Button>
          }
        />
      ) : (
        <>
          <SimpleTable
            caption={t("title")}
            testId="integration-events-table"
            stackOnPhones
            minWidth="64rem"
            columns={[
              { key: "event", header: t("col.event"), phone: "title" },
              { key: "system", header: t("col.system"), phone: "meta" },
              { key: "tenant", header: t("col.tenant"), phone: "meta" },
              { key: "occurred", header: t("col.occurred"), phone: "hidden" },
              { key: "attempts", header: t("col.attempts"), align: "end", phone: "hidden" },
              { key: "error", header: t("col.error"), phone: "meta" },
              { key: "state", header: t("col.state"), phone: "status" },
              { key: "details", header: <span className="sr-only">{t("details")}</span>, phone: "meta", align: "end" },
            ]}
            rows={list.data.data.map((event) => ({
              key: event.id,
              testId: "integration-event",
              data: { state: event.state, system: event.system, direction: event.direction },
              cells: {
                event: (
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">{eventTypeLabel(ops, event.type) ?? event.type}</span>
                    <span className="text-muted font-mono text-xs">{event.type}</span>
                  </span>
                ),
                system: (
                  <span className="flex flex-col">
                    <span>{event.system}</span>
                    <span className="text-muted text-sm">{t(`directionValue.${event.direction}`)}</span>
                  </span>
                ),
                tenant: (
                  <span className="md:whitespace-nowrap">{tenantLabel(names, event.tenantId, t("platform"))}</span>
                ),
                occurred: <span className="whitespace-nowrap">{formatDateTime(event.occurredAt, locale)}</span>,
                attempts: formatNumber(event.attempts, locale),
                error: event.lastError ? (
                  <span className="line-clamp-2 font-mono text-xs break-words" title={event.lastError}>
                    {event.lastError}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                ),
                details: (
                  <DetailDrawer
                    label={t("details")}
                    title={eventTypeLabel(ops, event.type) ?? event.type}
                    description={formatDateTime(event.occurredAt, locale)}
                  >
                    <EventDetails
                      error={event.lastError}
                      attempts={event.attempts}
                      ids={[
                        { label: t("eventId"), value: event.id },
                        ...(event.aggregateRef ? [{ label: t("subjectRef"), value: event.aggregateRef }] : []),
                      ]}
                      facts={[
                        { label: t("col.event"), value: event.type },
                        { label: t("contract"), value: event.contractVersion },
                      ]}
                    />
                  </DetailDrawer>
                ),
                state: (
                  <span className="flex flex-col items-start gap-1 max-md:items-end">
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

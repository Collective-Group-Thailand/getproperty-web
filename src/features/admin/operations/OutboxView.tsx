import { getTranslations } from "next-intl/server";

import { CONSUMPTION_STATUS, CONSUMPTION_VALUES } from "@/domain/status/consumption";
import { OUTBOX_STATUS, OUTBOX_VALUES } from "@/domain/status/outbox";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatNumber } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { enumParam, section, tenantLabel, tenantNames, type AdminContext } from "../shared/server";
import { GetFilters } from "./GetFilters";
import { ReplayButton } from "./OperationsActions";

function ErrorText({ text }: { text: string | null }) {
  if (!text) return <span>—</span>;
  return <span className="font-mono text-xs break-all">{text.length > 160 ? `${text.slice(0, 160)}…` : text}</span>;
}

/**
 * Event outbox (F5 5.2, D-180): outbox messages that failed to relay (`failed` / `dead`, filterable) and
 * subscriber deliveries that failed, each with its last error and a replay — the event is published
 * again as stored; subscribers deduplicate by event id.
 */
export async function OutboxView({
  context,
  searchParams,
}: {
  context: AdminContext;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("admin.operations.outbox");
  const { api, locale } = context;
  const messageState = enumParam(searchParams.state, OUTBOX_VALUES);
  const consumptionState = enumParam(searchParams.delivery, CONSUMPTION_VALUES);
  const [messages, consumptions, names] = await Promise.all([
    section(unwrap(api.GET("/v1/admin/outbox/messages", { params: { query: { state: messageState } } }))),
    section(unwrap(api.GET("/v1/admin/outbox/dead-letters", { params: { query: { state: consumptionState } } }))),
    tenantNames(),
  ]);
  return (
    <ConsolePage testId="outbox">
      <PageHeader title={t("title")} description={t("description")} />
      <GetFilters
        label={t("filters")}
        submitLabel={t("apply")}
        fields={[
          {
            name: "state",
            label: t("messageState"),
            type: "select",
            value: messageState,
            options: [
              { value: "", label: t("notRelayed") },
              ...OUTBOX_VALUES.map((value) => ({ value, label: t(`outboxState.${value}`) })),
            ],
          },
          {
            name: "delivery",
            label: t("deliveryState"),
            type: "select",
            value: consumptionState,
            options: [
              { value: "", label: t("notDelivered") },
              ...CONSUMPTION_VALUES.map((value) => ({ value, label: t(`consumptionState.${value}`) })),
            ],
          },
        ]}
      />
      <Card as="section" aria-labelledby="outbox-messages">
        <CardHeader title={<span id="outbox-messages">{t("messages")}</span>} description={t("messagesHint")} />
        {!messages.data ? (
          <SectionError error={messages.error} />
        ) : messages.data.length === 0 ? (
          <EmptyState title={t("noMessages")} />
        ) : (
          <SimpleTable
            caption={t("messages")}
            testId="outbox-messages"
            minWidth="60rem"
            columns={[
              { key: "event", header: t("col.event") },
              { key: "tenant", header: t("col.tenant") },
              { key: "created", header: t("col.created") },
              { key: "attempts", header: t("col.attempts"), align: "end" },
              { key: "error", header: t("col.error") },
              { key: "state", header: t("col.state") },
              { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
            ]}
            rows={messages.data.map((message) => ({
              key: message.id,
              testId: "outbox-message",
              data: { state: message.state, type: message.eventType },
              cells: {
                event: (
                  <span className="flex flex-col">
                    <span className="font-mono text-xs">{message.eventType}</span>
                    <span className="text-muted font-mono text-xs">{message.topic}</span>
                  </span>
                ),
                tenant: tenantLabel(names, message.tenantId, t("platform")),
                created: formatDateTime(message.createdAt, locale),
                attempts: formatNumber(message.attempts, locale),
                error: <ErrorText text={message.lastError} />,
                state: <StatusBadgeOf map={OUTBOX_STATUS} value={message.state} size="sm" />,
                actions:
                  message.state === "dead" || message.state === "failed" ? (
                    <ReplayButton kind="message" id={message.id} eventType={message.eventType} />
                  ) : null,
              },
            }))}
          />
        )}
      </Card>
      <Card as="section" aria-labelledby="outbox-deliveries">
        <CardHeader title={<span id="outbox-deliveries">{t("deliveries")}</span>} description={t("deliveriesHint")} />
        {!consumptions.data ? (
          <SectionError error={consumptions.error} />
        ) : consumptions.data.length === 0 ? (
          <EmptyState title={t("noDeliveries")} />
        ) : (
          <SimpleTable
            caption={t("deliveries")}
            testId="outbox-deliveries"
            minWidth="56rem"
            columns={[
              { key: "event", header: t("col.event") },
              { key: "subscriber", header: t("col.subscriber") },
              { key: "attempts", header: t("col.attempts"), align: "end" },
              { key: "error", header: t("col.error") },
              { key: "state", header: t("col.state") },
              { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
            ]}
            rows={consumptions.data.map((row) => ({
              key: row.id,
              testId: "outbox-delivery",
              data: { state: row.state, subscriber: row.subscriber },
              cells: {
                event: <span className="font-mono text-xs">{row.eventType}</span>,
                subscriber: <span className="font-mono text-xs">{row.subscriber}</span>,
                attempts: formatNumber(row.attempts, locale),
                error: <ErrorText text={row.lastError} />,
                state: (
                  <span className="flex flex-col gap-1">
                    <StatusBadgeOf map={CONSUMPTION_STATUS} value={row.state} size="sm" />
                    {row.replayedAt ? (
                      <span className="text-muted text-xs">
                        {t("replayedAt", { date: formatDateTime(row.replayedAt, locale) })}
                      </span>
                    ) : null}
                  </span>
                ),
                actions:
                  row.state !== "processed" ? (
                    <ReplayButton kind="consumption" id={row.id} eventType={row.eventType} />
                  ) : null,
              },
            }))}
          />
        )}
      </Card>
    </ConsolePage>
  );
}

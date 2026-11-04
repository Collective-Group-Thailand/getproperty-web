import { getTranslations } from "next-intl/server";

import { CONSUMPTION_STATUS, CONSUMPTION_VALUES } from "@/domain/status/consumption";
import { OUTBOX_STATUS, OUTBOX_VALUES } from "@/domain/status/outbox";
import { ActionMenu } from "@/features/shared/console/ActionMenu";
import { CopyValue, DetailDrawer } from "@/features/shared/console/DetailDrawer";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatNumber } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { enumParam, section, tenantLabel, tenantNames, type AdminContext } from "../shared/server";
import { eventTypeLabel } from "./auditLabels";
import { GetFilters } from "./GetFilters";
import { ReplayButton } from "./OperationsActions";

function ErrorText({ text }: { text: string | null }) {
  if (!text) return <span className="text-muted">—</span>;
  return (
    <span className="line-clamp-2 font-mono text-xs break-words" title={text}>
      {text}
    </span>
  );
}

/** An event's name in words with its code under it, muted (never the code alone when the name is known). */
function EventName({ label, code, sub }: { label: string | null; code: string; sub?: string }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-medium">{label ?? code}</span>
      <span className="text-muted font-mono text-xs">
        {label ? code : null}
        {sub ? `${label ? " · " : ""}${sub}` : null}
      </span>
    </span>
  );
}

/**
 * Event outbox (F5 5.2, D-180, redesign G8): outbox messages that failed to relay (`failed` / `dead`, filterable) and
 * subscriber deliveries that failed — one toolbar, two dense tables with the event in words, the customer, attempts
 * and the last error; "details" opens the full error and the ids in a drawer, and the replay sits in the row's "⋯".
 * The event is published again as stored; subscribers deduplicate by event id.
 */
export async function OutboxView({
  context,
  searchParams,
}: {
  context: AdminContext;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("admin.operations.outbox");
  const ops = await getTranslations("admin.operations");
  const { api, locale } = context;
  const messageState = enumParam(searchParams.state, OUTBOX_VALUES);
  const consumptionState = enumParam(searchParams.delivery, CONSUMPTION_VALUES);
  const [messages, consumptions, names] = await Promise.all([
    section(unwrap(api.GET("/v1/admin/outbox/messages", { params: { query: { state: messageState } } }))),
    section(unwrap(api.GET("/v1/admin/outbox/dead-letters", { params: { query: { state: consumptionState } } }))),
    tenantNames(),
  ]);
  const filtered = Boolean(messageState || consumptionState);
  const clear = (
    <Button asChild variant="secondary">
      <a href={filtered ? "/outbox" : "/integration-events"}>{filtered ? t("clear") : t("openAll")}</a>
    </Button>
  );
  return (
    <ConsolePage testId="outbox">
      <PageHeader title={t("title")} description={t("description")} />
      <GetFilters
        label={t("filters")}
        submitLabel={t("apply")}
        clear={filtered ? { label: t("clear"), href: "/outbox" } : null}
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
      <section aria-labelledby="outbox-messages" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="outbox-messages" className="text-lg font-semibold">
            {t("messages")}
          </h2>
          <p className="text-muted text-sm">{t("messagesHint")}</p>
        </div>
        {!messages.data ? (
          <SectionError error={messages.error} />
        ) : messages.data.length === 0 ? (
          <EmptyState variant="card" icon={IconCheckCircle} title={t("noMessages")} action={clear} />
        ) : (
          <SimpleTable
            caption={t("messages")}
            testId="outbox-messages"
            stackOnPhones
            minWidth="64rem"
            columns={[
              { key: "event", header: t("col.event"), phone: "title" },
              { key: "tenant", header: t("col.tenant"), phone: "meta" },
              { key: "created", header: t("col.created"), phone: "hidden" },
              { key: "attempts", header: t("col.attempts"), align: "end", phone: "hidden" },
              { key: "error", header: t("col.error"), phone: "meta" },
              { key: "state", header: t("col.state"), phone: "status" },
              {
                key: "actions",
                header: <span className="sr-only">{t("col.actions")}</span>,
                phone: "meta",
                align: "end",
              },
            ]}
            rows={messages.data.map((message) => ({
              key: message.id,
              testId: "outbox-message",
              data: { state: message.state, type: message.eventType },
              cells: {
                event: <EventName label={eventTypeLabel(ops, message.eventType)} code={message.eventType} />,
                tenant: tenantLabel(names, message.tenantId, t("platform")),
                created: <span className="whitespace-nowrap">{formatDateTime(message.createdAt, locale)}</span>,
                attempts: formatNumber(message.attempts, locale),
                error: <ErrorText text={message.lastError} />,
                state: <StatusBadgeOf map={OUTBOX_STATUS} value={message.state} size="sm" />,
                actions: (
                  <span className="flex items-center justify-end gap-1">
                    <DetailDrawer
                      label={t("details")}
                      title={eventTypeLabel(ops, message.eventType) ?? message.eventType}
                      description={formatDateTime(message.createdAt, locale)}
                    >
                      <EventDetails
                        error={message.lastError}
                        attempts={message.attempts}
                        ids={[
                          { label: t("eventId"), value: message.eventId },
                          { label: t("messageId"), value: message.id },
                        ]}
                        facts={[
                          { label: t("col.event"), value: message.eventType },
                          { label: t("topic"), value: message.topic },
                        ]}
                      />
                    </DetailDrawer>
                    {message.state === "dead" || message.state === "failed" ? (
                      <ActionMenu label={t("more")}>
                        <ReplayButton kind="message" id={message.id} eventType={message.eventType} />
                      </ActionMenu>
                    ) : null}
                  </span>
                ),
              },
            }))}
          />
        )}
      </section>
      <section aria-labelledby="outbox-deliveries" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="outbox-deliveries" className="text-lg font-semibold">
            {t("deliveries")}
          </h2>
          <p className="text-muted text-sm">{t("deliveriesHint")}</p>
        </div>
        {!consumptions.data ? (
          <SectionError error={consumptions.error} />
        ) : consumptions.data.length === 0 ? (
          <EmptyState variant="card" icon={IconCheckCircle} title={t("noDeliveries")} action={clear} />
        ) : (
          <SimpleTable
            caption={t("deliveries")}
            testId="outbox-deliveries"
            stackOnPhones
            minWidth="60rem"
            columns={[
              { key: "event", header: t("col.event"), phone: "title" },
              { key: "subscriber", header: t("col.subscriber"), phone: "meta" },
              { key: "attempts", header: t("col.attempts"), align: "end", phone: "hidden" },
              { key: "error", header: t("col.error"), phone: "meta" },
              { key: "state", header: t("col.state"), phone: "status" },
              {
                key: "actions",
                header: <span className="sr-only">{t("col.actions")}</span>,
                phone: "meta",
                align: "end",
              },
            ]}
            rows={consumptions.data.map((row) => ({
              key: row.id,
              testId: "outbox-delivery",
              data: { state: row.state, subscriber: row.subscriber },
              cells: {
                event: <EventName label={eventTypeLabel(ops, row.eventType)} code={row.eventType} />,
                subscriber: <span className="font-mono text-sm">{row.subscriber}</span>,
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
                actions: (
                  <span className="flex items-center justify-end gap-1">
                    <DetailDrawer label={t("details")} title={eventTypeLabel(ops, row.eventType) ?? row.eventType}>
                      <EventDetails
                        error={row.lastError}
                        attempts={row.attempts}
                        ids={[
                          { label: t("eventId"), value: row.eventId },
                          { label: t("deliveryId"), value: row.id },
                        ]}
                        facts={[
                          { label: t("col.event"), value: row.eventType },
                          { label: t("col.subscriber"), value: row.subscriber },
                        ]}
                      />
                    </DetailDrawer>
                    {row.state !== "processed" ? (
                      <ActionMenu label={t("more")}>
                        <ReplayButton kind="consumption" id={row.id} eventType={row.eventType} />
                      </ActionMenu>
                    ) : null}
                  </span>
                ),
              },
            }))}
          />
        )}
      </section>
    </ConsolePage>
  );
}

/** The drawer body of an event row: the full last error, attempts, codes and copyable ids (no payloads: the API keeps them). */
export async function EventDetails({
  error,
  attempts,
  ids,
  facts,
}: {
  error: string | null;
  attempts: number;
  ids: { label: string; value: string }[];
  facts: { label: string; value: string }[];
}) {
  const t = await getTranslations("admin.operations.outbox");
  return (
    <>
      <section className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold">{t("col.error")}</h3>
        {error ? (
          <pre className="bg-bg-subtle rounded-control relative m-0 max-h-72 overflow-auto p-3 font-mono text-xs whitespace-pre-wrap">
            {error}
          </pre>
        ) : (
          <p className="text-muted m-0 text-sm">{t("noError")}</p>
        )}
        <p className="text-muted m-0 text-sm">{t("attemptsLine", { count: attempts })}</p>
      </section>
      <dl className="flex flex-col gap-2 text-sm">
        {facts.map((fact) => (
          <div key={fact.label} className="flex flex-col gap-0.5">
            <dt className="text-muted">{fact.label}</dt>
            <dd className="font-mono break-all">{fact.value}</dd>
          </div>
        ))}
        {ids.map((id) => (
          <div key={id.label} className="flex flex-col gap-0.5">
            <dt className="text-muted">{id.label}</dt>
            <dd>
              <CopyValue value={id.value} label={id.label} />
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

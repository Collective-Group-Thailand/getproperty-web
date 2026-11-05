import { getTranslations } from "next-intl/server";

import { GATE_VISIT_STATUS, INCIDENT_STATUS } from "@/domain/status";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { enumParam, pageParam, param } from "@/features/shared/console/params";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { FactGrid } from "@/ui/components/FactGrid";
import { Input } from "@/ui/components/Input";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { Timeline } from "@/ui/components/Timeline";
import { Icon } from "@/ui/icons";
import { IconHistory } from "@/ui/icons/glyphs/history";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconSiren } from "@/ui/icons/glyphs/siren";

import { ownerPath, withQuery } from "../shared/links";
import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { IncidentDecisionButtons } from "./GateAdminActions";

type SearchParams = Record<string, string | string[] | undefined>;
const VISIT_STATES: Schemas["VisitState"][] = [
  "requested",
  "approved",
  "denied",
  "timed_out",
  "entered",
  "exited",
  "cancelled",
];
const INCIDENT_STATES: Schemas["IncidentState"][] = ["open", "acknowledged", "resolved", "cancelled"];

const plateText = (plate: { category: string; number: string } | null) =>
  plate ? `${plate.category} ${plate.number}` : "—";

/**
 * The reason asked before a log opens (D-315 / J4.1 §4: every read of the visitor or incident log is audited with its
 * reason, 5–500 characters). A plain GET form: it works before any script and the reason travels with each read.
 */
export async function ReasonGate({
  kind,
  hidden,
  action,
}: {
  kind: "visits" | "incidents";
  hidden: Record<string, string | undefined>;
  action?: string;
}) {
  const t = await getTranslations("owner.gate.reason");
  return (
    <Card className="flex max-w-2xl flex-col gap-4" data-testid={`reason-gate-${kind}`}>
      <div className="flex items-start gap-3">
        <IconLockMark />
        <div>
          <h2 className="text-lg font-semibold">{t(`title.${kind}`)}</h2>
          <p className="text-muted">{t("lede")}</p>
        </div>
      </div>
      <form method="get" action={action} className="flex flex-col gap-3">
        {Object.entries(hidden).map(([name, value]) =>
          value ? <input key={name} type="hidden" name={name} value={value} /> : null,
        )}
        <label htmlFor={`reason-${kind}`} className="font-medium">
          {t("label")}
        </label>
        <Input
          id={`reason-${kind}`}
          name="reason"
          required
          minLength={5}
          maxLength={500}
          aria-describedby={`reason-${kind}-hint`}
          placeholder={t("placeholder")}
          data-testid="log-reason"
        />
        <p id={`reason-${kind}-hint`} className="text-muted text-sm">
          {t("hint")}
        </p>
        <div>
          <Button type="submit" data-testid="log-open">
            {t("open")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function IconLockMark() {
  return (
    <span className="rounded-control bg-primary-subtle text-primary-subtle-fg flex size-10 shrink-0 items-center justify-center">
      <Icon icon={IconLock} size={20} />
    </span>
  );
}

async function ReasonLine({ reason, changeHref }: { reason: string; changeHref: string }) {
  const t = await getTranslations("owner.gate.reason");
  return (
    <Callout tone="neutral" size="sm">
      <span data-testid="log-reason-line">
        {t("using", { reason })}{" "}
        <a href={changeHref} className="text-primary font-medium underline underline-offset-4">
          {t("change")}
        </a>
      </span>
    </Callout>
  );
}

/** The visitor log (J4.1 §4): newest first, filters as URL parameters, each row opens the record (same reason). */
export async function VisitLog({
  context,
  propertyId,
  searchParams,
  gates,
}: {
  context: OwnerContext;
  propertyId: string;
  searchParams: SearchParams;
  gates: Schemas["GateDto"][];
}) {
  const t = await getTranslations("owner.gate");
  const { api, locale } = context;
  const reason = param(searchParams.reason)!;
  const state = enumParam(searchParams.state, VISIT_STATES);
  const gateId = gates.find((gate) => gate.id === param(searchParams.gate))?.id;
  const q = param(searchParams.q);
  const from = param(searchParams.from);
  const to = param(searchParams.to);
  const page = pageParam(searchParams.page);
  const list = await section(
    unwrap(
      api.GET("/v1/owner/gate-visits", {
        params: {
          query: {
            reason,
            propertyId,
            page,
            perPage: 25,
            ...(state ? { state } : {}),
            ...(gateId ? { gateId } : {}),
            ...(q ? { q } : {}),
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
          },
        },
      }),
    ),
  );
  const path = ownerPath(locale, "/juristic/gate");
  const recordHref = (visitId: string) => withQuery(ownerPath(locale, `/juristic/gate/visits/${visitId}`), { reason });
  return (
    <div className="flex flex-col gap-4" data-testid="gate-visit-log">
      <ReasonLine reason={reason} changeHref={withQuery(path, { tab: "visits" })} />
      <FilterBar
        fields={[
          { name: "q", label: t("log.search"), type: "search", placeholder: t("log.searchHint") },
          {
            name: "state",
            label: t("col.state"),
            type: "select",
            placeholder: t("log.anyState"),
            options: VISIT_STATES.map((value) => ({ value, label: t(`log.state.${value}`) })),
          },
          ...(gates.length > 1
            ? [
                {
                  name: "gate",
                  label: t("col.gate"),
                  type: "select" as const,
                  placeholder: t("log.anyGate"),
                  options: gates.map((gate) => ({ value: gate.id, label: gate.name })),
                },
              ]
            : []),
          { name: "from", label: t("log.from"), type: "date" },
          { name: "to", label: t("log.to"), type: "date" },
        ]}
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconHistory}
          title={t("log.empty.title")}
          description={t("log.empty.body")}
          action={
            <Button asChild variant="secondary">
              <a href={withQuery(path, { tab: "visits", reason })}>{t("log.clear")}</a>
            </Button>
          }
        />
      ) : (
        <>
          <SimpleTable
            caption={t("tab.visits")}
            stackOnPhones
            testId="visit-log-rows"
            columns={[
              { key: "plate", header: t("col.plate"), phone: "title" },
              { key: "unit", header: t("col.unit"), phone: "figure" },
              { key: "kind", header: t("col.kind") },
              { key: "when", header: t("col.when") },
              { key: "state", header: t("col.state"), phone: "status" },
            ]}
            rows={list.data.data.map((visit) => ({
              key: visit.id,
              href: recordHref(visit.id),
              testId: "visit-log-row",
              data: { state: visit.state },
              cells: {
                plate: <span className="font-mono font-semibold">{plateText(visit.plate)}</span>,
                unit: <span className="font-mono">{visit.unitNo ?? "—"}</span>,
                kind: (
                  <span className="flex flex-col">
                    <span>{t(`log.kind.${visit.kind}`)}</span>
                    {visit.visitorName ? <span className="text-muted text-sm">{visit.visitorName}</span> : null}
                  </span>
                ),
                when: (
                  <span className="flex flex-col">
                    <span>{formatDateTime(visit.createdAt, locale)}</span>
                    <span className="text-muted text-sm">
                      {[visit.gateName, visit.entryBasis ? t(`log.basis.${visit.entryBasis}`) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                ),
                state: <StatusBadgeOf map={GATE_VISIT_STATUS} value={visit.state} size="sm" />,
              },
            }))}
          />
          <ListPagination meta={list.data.meta} path={path} searchParams={searchParams} locale={locale} />
        </>
      )}
    </div>
  );
}

/** The incident log (J4.2 §5): open ones first by the API's order, each row opens its record (same reason). */
export async function IncidentLog({
  context,
  propertyId,
  searchParams,
}: {
  context: OwnerContext;
  propertyId: string;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("owner.gate");
  const { api, locale } = context;
  const reason = param(searchParams.reason)!;
  const state = enumParam(searchParams.state, INCIDENT_STATES);
  const page = pageParam(searchParams.page);
  const list = await section(
    unwrap(
      api.GET("/v1/owner/incidents", {
        params: { query: { reason, propertyId, page, perPage: 25, ...(state ? { state } : {}) } },
      }),
    ),
  );
  const path = ownerPath(locale, "/juristic/gate");
  return (
    <div className="flex flex-col gap-4" data-testid="gate-incident-log">
      <ReasonLine reason={reason} changeHref={withQuery(path, { tab: "incidents" })} />
      <FilterBar
        fields={[
          {
            name: "state",
            label: t("col.state"),
            type: "select",
            placeholder: t("log.anyState"),
            options: INCIDENT_STATES.map((value) => ({ value, label: t(`incident.state.${value}`) })),
          },
        ]}
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconSiren}
          title={t("incident.empty.title")}
          description={t("incident.empty.body")}
          action={
            <Button asChild variant="secondary">
              <a href={withQuery(path, { tab: "incidents", reason })}>{t("log.clear")}</a>
            </Button>
          }
        />
      ) : (
        <>
          <SimpleTable
            caption={t("tab.incidents")}
            stackOnPhones
            testId="incident-rows"
            columns={[
              { key: "kind", header: t("col.kind"), phone: "title" },
              { key: "where", header: t("col.where") },
              { key: "when", header: t("col.when"), phone: "figure" },
              { key: "state", header: t("col.state"), phone: "status" },
            ]}
            rows={list.data.data.map((incident) => ({
              key: incident.id,
              href: withQuery(ownerPath(locale, `/juristic/gate/incidents/${incident.id}`), { reason }),
              testId: "incident-row",
              data: { state: incident.state },
              cells: {
                kind: (
                  <span className="flex flex-col">
                    <span className="font-medium">{t(`incident.kind.${incident.kind}`)}</span>
                    <span className="text-muted text-sm">{t(`incident.source.${incident.source}`)}</span>
                  </span>
                ),
                where:
                  [incident.unit ? t("incident.unit", { unit: incident.unit.unitNo }) : null, incident.gate?.name]
                    .filter(Boolean)
                    .join(" · ") || "—",
                when: formatDateTime(incident.createdAt, locale),
                state: <StatusBadgeOf map={INCIDENT_STATUS} value={incident.state} size="sm" />,
              },
            }))}
          />
          <ListPagination meta={list.data.meta} path={path} searchParams={searchParams} locale={locale} />
        </>
      )}
    </div>
  );
}

const VISIT_EVENT_TONE: Partial<Record<Schemas["VisitEventKind"], "primary" | "success" | "warning" | "danger">> = {
  answered: "primary",
  entered: "success",
  overstayed: "warning",
  gate_opened: "primary",
};

/** `/juristic/gate/visits/[visitId]`: one visit as the API recorded it — facts and its append-only timeline. */
export async function VisitRecordView({
  context,
  visitId,
  reason,
}: {
  context: OwnerContext;
  visitId: string;
  reason: string | undefined;
}) {
  const t = await getTranslations("owner.gate");
  const { api, locale } = context;
  const back = {
    label: t("log.back"),
    href: withQuery(ownerPath(locale, "/juristic/gate"), { tab: "visits", reason }),
  };
  if (!reason) {
    return (
      <OwnerPage testId="gate-visit-record">
        <PageHeader title={t("log.recordTitle")} back={back} />
        <ReasonGate kind="visits" hidden={{}} />
      </OwnerPage>
    );
  }
  const visit = await section(
    unwrap(api.GET("/v1/owner/gate-visits/{visitId}", { params: { path: { visitId }, query: { reason } } })),
  );
  if (!visit.data) {
    return (
      <OwnerPage testId="gate-visit-record">
        <PageHeader title={t("log.recordTitle")} back={back} />
        <SectionError error={visit.error} />
      </OwnerPage>
    );
  }
  const v = visit.data;
  return (
    <OwnerPage testId="gate-visit-record">
      <PageHeader
        title={<span className="font-mono">{plateText(v.plate)}</span>}
        status={<StatusBadgeOf map={GATE_VISIT_STATUS} value={v.state} />}
        description={[v.plate?.province, v.unitNo ? t("incident.unit", { unit: v.unitNo }) : null, v.gateName]
          .filter(Boolean)
          .join(" · ")}
        back={back}
      />
      <ReasonLine reason={reason} changeHref={withQuery(ownerPath(locale, "/juristic/gate"), { tab: "visits" })} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Card className="flex flex-col gap-4">
          <FactGrid
            label={t("log.facts")}
            columns={2}
            facts={[
              { key: "kind", label: t("col.kind"), value: t(`log.kind.${v.kind}`) },
              { key: "basis", label: t("log.entryBasis"), value: v.entryBasis ? t(`log.basis.${v.entryBasis}`) : "—" },
              { key: "name", label: t("log.visitorName"), value: v.visitorName ?? "—" },
              {
                key: "id4",
                label: t("log.idLast4"),
                value: v.idLast4 ? <span className="font-mono">{v.idLast4}</span> : "—",
              },
              { key: "created", label: t("log.created"), value: formatDateTime(v.createdAt, locale) },
              {
                key: "entered",
                label: t("log.entered"),
                value: v.enteredAt ? formatDateTime(v.enteredAt, locale) : "—",
              },
              { key: "exited", label: t("log.exited"), value: v.exitedAt ? formatDateTime(v.exitedAt, locale) : "—" },
              { key: "photo", label: t("log.photo"), value: v.hasPhoto ? t("log.photoKept") : t("log.noPhoto") },
              ...(v.decisionReason ? [{ key: "reason", label: t("log.decisionReason"), value: v.decisionReason }] : []),
              ...(v.note ? [{ key: "note", label: t("log.note"), value: v.note }] : []),
            ]}
          />
        </Card>
        <Card className="flex flex-col gap-4">
          <h2 className="font-semibold">{t("log.timeline")}</h2>
          <Timeline
            events={[...v.events].reverse().map((event) => ({
              id: event.id,
              title: t(`log.event.${event.kind}`),
              time: formatDateTime(event.occurredAt, locale),
              actor: t(`log.actor.${event.actorKind}`),
              tone: VISIT_EVENT_TONE[event.kind] ?? "neutral",
            }))}
          />
        </Card>
      </div>
    </OwnerPage>
  );
}

/** `/juristic/gate/incidents/[incidentId]`: an SOS — facts, timeline, cars inside at the time, acknowledge / resolve. */
export async function IncidentRecordView({
  context,
  incidentId,
  reason,
}: {
  context: OwnerContext;
  incidentId: string;
  reason: string | undefined;
}) {
  const t = await getTranslations("owner.gate");
  const { api, locale, me } = context;
  const back = {
    label: t("incident.back"),
    href: withQuery(ownerPath(locale, "/juristic/gate"), { tab: "incidents", reason }),
  };
  if (!reason) {
    return (
      <OwnerPage testId="gate-incident-record">
        <PageHeader title={t("incident.recordTitle")} back={back} />
        <ReasonGate kind="incidents" hidden={{}} />
      </OwnerPage>
    );
  }
  const incident = await section(
    unwrap(api.GET("/v1/owner/incidents/{incidentId}", { params: { path: { incidentId }, query: { reason } } })),
  );
  if (!incident.data) {
    return (
      <OwnerPage testId="gate-incident-record">
        <PageHeader title={t("incident.recordTitle")} back={back} />
        <SectionError error={incident.error} />
      </OwnerPage>
    );
  }
  const i = incident.data;
  const canManage = !readOnly(me) && ownerCan(me, "gate.incident.manage");
  return (
    <OwnerPage testId="gate-incident-record">
      <PageHeader
        title={t(`incident.kind.${i.kind}`)}
        status={<StatusBadgeOf map={INCIDENT_STATUS} value={i.state} />}
        description={[
          t(`incident.source.${i.source}`),
          i.unit ? t("incident.unit", { unit: i.unit.unitNo }) : null,
          i.gate?.name,
          formatDateTime(i.createdAt, locale),
        ]
          .filter(Boolean)
          .join(" · ")}
        back={back}
        actions={
          canManage && (i.state === "open" || i.state === "acknowledged") ? (
            <IncidentDecisionButtons incident={i} />
          ) : undefined
        }
      />
      <ReasonLine reason={reason} changeHref={withQuery(ownerPath(locale, "/juristic/gate"), { tab: "incidents" })} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex flex-col gap-6">
          {i.note ? (
            <Card>
              <h2 className="mb-1 font-semibold">{t("incident.note")}</h2>
              <p>{i.note}</p>
            </Card>
          ) : null}
          <Card className="flex flex-col gap-3 p-0">
            <h2 className="px-6 pt-5 font-semibold">{t("incident.visits", { count: i.visits.length })}</h2>
            <p className="text-muted px-6 text-sm">{t("incident.visitsLede")}</p>
            {i.visits.length === 0 ? (
              <p className="text-muted px-6 pb-5">{t("incident.noVisits")}</p>
            ) : (
              <SimpleTable
                caption={t("incident.visits", { count: i.visits.length })}
                stackOnPhones
                testId="incident-visits"
                columns={[
                  { key: "plate", header: t("col.plate"), phone: "title" },
                  { key: "unit", header: t("col.unit"), phone: "figure" },
                  { key: "in", header: t("log.entered") },
                  { key: "out", header: t("log.exited") },
                ]}
                rows={i.visits.map((visit) => ({
                  key: visit.id,
                  href: withQuery(ownerPath(locale, `/juristic/gate/visits/${visit.id}`), { reason }),
                  cells: {
                    plate: (
                      <span className="flex flex-col">
                        <span className="font-mono font-semibold">{visit.plate ?? "—"}</span>
                        <span className="text-muted text-sm">
                          {[t(`log.kind.${visit.kind}`), visit.visitorName].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    ),
                    unit: <span className="font-mono">{visit.unitNo ?? "—"}</span>,
                    in: visit.enteredAt ? formatDateTime(visit.enteredAt, locale) : "—",
                    out: visit.exitedAt ? formatDateTime(visit.exitedAt, locale) : t("incident.stillInside"),
                  },
                }))}
              />
            )}
          </Card>
        </div>
        <Card className="flex flex-col gap-4">
          <h2 className="font-semibold">{t("log.timeline")}</h2>
          <Timeline
            events={[...i.events].reverse().map((event) => ({
              id: event.id,
              title: t(`incident.event.${event.kind}`),
              time: formatDateTime(event.occurredAt, locale),
              actor: t(`log.actor.${event.actorKind}`),
              tone:
                event.kind === "raised"
                  ? "danger"
                  : event.kind === "resolved"
                    ? "success"
                    : event.kind === "acknowledged"
                      ? "warning"
                      : "neutral",
            }))}
          />
        </Card>
      </div>
    </OwnerPage>
  );
}

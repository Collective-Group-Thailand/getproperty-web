import { getTranslations } from "next-intl/server";

import { GATE_DEVICE_STATUS, GATE_GUARD_STATUS, GATE_INVITE_STATUS } from "@/domain/status";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { enumParam, param } from "@/features/shared/console/params";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconCar } from "@/ui/icons/glyphs/car";
import { IconShield } from "@/ui/icons/glyphs/shield";

import { SettingRows } from "../settings/SettingsView";
import { ownerPath, withQuery } from "../shared/links";
import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import {
  AddGuardButton,
  AttachEdgeButton,
  BlacklistAddButton,
  BlacklistRevokeButton,
  DetachEdgeButton,
  EditGateButton,
  GuardActions,
  InviteDecisionButtons,
  NewGateButton,
  NewTabletButton,
  PolicyForm,
  RevokeTabletButton,
} from "./GateAdminActions";
import { IncidentLog, ReasonGate, VisitLog } from "./GateLogs";

export const GATE_TABS = [
  "gates",
  "guards",
  "policies",
  "blacklist",
  "invites",
  "visits",
  "incidents",
  "vehicles",
  "settings",
] as const;
export type GateTab = (typeof GATE_TABS)[number];

type SearchParams = Record<string, string | string[] | undefined>;

/** The units of a property: one page of 100 per building (the units list filters by building, not property). */
async function propertyUnits(context: OwnerContext, propertyId: string) {
  const buildings = context.buildings.filter((building) => building.propertyId === propertyId);
  return section(
    Promise.all(
      buildings.map((building) =>
        unwrap(context.api.GET("/v1/owner/units", { params: { query: { buildingId: building.id, perPage: 100 } } })),
      ),
    ).then((pages) => ({ data: pages.flatMap((page) => page.data) })),
  );
}

const plateText = (plate: { category: string; number: string; province?: string | null } | null) =>
  plate ? `${plate.category} ${plate.number}` : "—";

/** The office's gate settings (J4.1 / J4.2): values from the API, changed as effective-dated versions. */
export const GATE_SETTING_KEYS = {
  visitors: [
    "gate.policy.timeout_seconds",
    "gate.policy.action",
    "gate.delivery_drop_point",
    "gate.remember_days",
    "gate.invite_max_days",
    "gate.open_visit_alert_hours",
  ],
  tablet: ["gate.offline_max_hours", "gate.device_enrol_hours", "gate.pin_max_attempts", "gate.pin_lock_minutes"],
  hardware: [
    "gate.lpr.min_confidence",
    "gate.lpr.pending_minutes",
    "gate.lpr.repeat_seconds",
    "gate.auto_open_known_plates",
    "gate.open.min_interval_seconds",
    "gate.barrier.pulse_ms",
    "gate.resident_open.enabled",
    "gate.resident_open.require_geofence",
    "gate.resident_open.radius_m",
    "gate.resident_open.max_per_hour",
  ],
  sos: ["gate.sos.cancel_seconds", "gate.sos.max_per_hour", "gate.incident.visit_window_minutes"],
} as const;

/**
 * `/juristic/gate` (JW4): the office's side of the gate — gates and their tablets / barrier / LPR camera, guards and
 * PINs, house policies, the blacklist, contractor invites, the visitor and incident logs (each read with a reason, D-315),
 * registered cars and the gate settings. One page, a tab per job, each tab its own URL.
 */
export async function GateAdminView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.gate");
  const { api, locale, me, properties } = context;
  const tab: GateTab = enumParam(searchParams.tab, GATE_TABS) ?? "gates";
  const gatesAll = await section(unwrap(api.GET("/v1/owner/gates", { params: { query: {} } })));
  const withGates = new Set((gatesAll.data ?? []).map((gate) => gate.propertyId));
  const property =
    properties.find((candidate) => candidate.id === param(searchParams.property)) ??
    properties.find((candidate) => withGates.has(candidate.id)) ??
    properties[0];
  const base = ownerPath(locale, "/juristic/gate");
  const href = (next: GateTab, extra: Record<string, string | undefined> = {}) =>
    withQuery(base, {
      tab: next === "gates" ? undefined : next,
      property: property && properties.length > 1 ? property.id : undefined,
      ...extra,
    });
  const canManage = !readOnly(me) && ownerCan(me, "gate.manage");
  const canGuards = !readOnly(me) && ownerCan(me, "gate.guard.manage");

  return (
    <OwnerPage testId="juristic-gate">
      <PageHeader
        title={t("title")}
        description={t("lede")}
        actions={
          properties.length > 1 ? (
            <nav aria-label={t("property")} className="flex flex-wrap gap-2" data-testid="gate-property">
              {properties.map((candidate) => (
                <Button
                  key={candidate.id}
                  asChild
                  size="sm"
                  variant={candidate.id === property?.id ? "secondary" : "ghost"}
                >
                  <a
                    href={withQuery(base, { tab: tab === "gates" ? undefined : tab, property: candidate.id })}
                    aria-current={candidate.id === property?.id ? "page" : undefined}
                  >
                    {candidate.name}
                  </a>
                </Button>
              ))}
            </nav>
          ) : undefined
        }
      />
      <LinkTabs
        label={t("sections")}
        current={href(tab)}
        tabs={GATE_TABS.map((value) => ({ href: href(value), label: t(`tab.${value}`), testId: `gate-tab-${value}` }))}
      />
      {!property ? (
        <EmptyState
          variant="card"
          icon={IconShield}
          title={t("noProperty.title")}
          description={t("noProperty.body")}
          action={
            <Button asChild variant="secondary">
              <a href={ownerPath(locale, "/buildings")}>{t("noProperty.action")}</a>
            </Button>
          }
        />
      ) : tab === "gates" ? (
        <GatesTab
          context={context}
          gates={(gatesAll.data ?? []).filter((gate) => gate.propertyId === property.id)}
          error={gatesAll.error}
          propertyId={property.id}
          canManage={canManage}
        />
      ) : tab === "guards" ? (
        <GuardsTab context={context} propertyId={property.id} canManage={canGuards} />
      ) : tab === "policies" ? (
        <PoliciesTab
          context={context}
          propertyId={property.id}
          unitId={param(searchParams.unit)}
          canManage={canManage}
        />
      ) : tab === "blacklist" ? (
        <BlacklistTab context={context} propertyId={property.id} canManage={canManage} />
      ) : tab === "invites" ? (
        <InvitesTab
          context={context}
          canDecide={!readOnly(me) && ownerCan(me, "gate.invite.approve")}
          state={param(searchParams.state)}
          tabHref={(state) => href("invites", { state })}
        />
      ) : tab === "visits" ? (
        param(searchParams.reason) ? (
          <VisitLog
            context={context}
            propertyId={property.id}
            searchParams={searchParams}
            gates={gatesAll.data ?? []}
          />
        ) : (
          <ReasonGate
            kind="visits"
            hidden={{ tab: "visits", property: properties.length > 1 ? property.id : undefined }}
          />
        )
      ) : tab === "incidents" ? (
        param(searchParams.reason) ? (
          <IncidentLog context={context} propertyId={property.id} searchParams={searchParams} />
        ) : (
          <ReasonGate
            kind="incidents"
            hidden={{ tab: "incidents", property: properties.length > 1 ? property.id : undefined }}
          />
        )
      ) : tab === "vehicles" ? (
        <VehiclesTab context={context} propertyId={property.id} />
      ) : (
        <SettingsTab context={context} propertyId={property.id} />
      )}
    </OwnerPage>
  );
}

async function GatesTab({
  context,
  gates,
  error,
  propertyId,
  canManage,
}: {
  context: OwnerContext;
  gates: Schemas["GateDto"][];
  error: unknown;
  propertyId: string;
  canManage: boolean;
}) {
  const t = await getTranslations("owner.gate");
  const { api, locale } = context;
  if (error) return <SectionError error={error} />;
  const [devices, gateways] = await Promise.all([
    Promise.all(
      gates.map((gate) =>
        section(unwrap(api.GET("/v1/owner/gates/{gateId}/devices", { params: { path: { gateId: gate.id } } }))),
      ),
    ),
    canManage
      ? section(unwrap(api.GET("/v1/owner/devices", { params: { query: { kind: "gateway", perPage: 100 } } })))
      : Promise.resolve({ data: null, error: null }),
  ]);
  const edgeOptions = (gateways.data?.data ?? [])
    .filter((device) => device.status !== "retired")
    .map((device) => ({ value: device.id, label: `${device.serial} · ${device.model}` }));
  const edgeName = new Map((gateways.data?.data ?? []).map((device) => [device.id, device.serial]));
  return (
    <div className="flex flex-col gap-6" data-testid="gate-gates">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted max-w-2xl">{t("gates.lede")}</p>
        {canManage ? <NewGateButton propertyId={propertyId} /> : null}
      </div>
      {gates.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconShield}
          title={t("gates.empty.title")}
          description={t("gates.empty.body")}
          action={
            canManage ? (
              <NewGateButton propertyId={propertyId} />
            ) : (
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/juristic")}>{t("backToday")}</a>
              </Button>
            )
          }
        />
      ) : (
        gates.map((gate, index) => {
          const list = devices[index]!;
          const rows = (list.data ?? []).filter((device) => device.state !== "revoked");
          const tablets = rows.filter((device) => device.kind === "guard_tablet");
          const hardware = rows.filter((device) => device.kind !== "guard_tablet");
          return (
            <Card key={gate.id} className="flex flex-col gap-0 p-0" data-testid="gate-card">
              <header className="border-border flex flex-wrap items-center gap-3 border-b px-6 py-4">
                <h2 className="text-lg font-semibold">{gate.name}</h2>
                <Badge tone="neutral">{t(`gates.kind.${gate.kind}`)}</Badge>
                {gate.state === "inactive" ? <Badge tone="warning">{t("gates.inactive")}</Badge> : null}
                <span className="text-muted text-sm">
                  {[gate.barrier ? t("gates.hasBarrier") : null, gate.lpr ? t("gates.hasLpr") : null]
                    .filter(Boolean)
                    .join(" · ") || t("gates.noHardware")}
                </span>
                {canManage ? (
                  <span className="ms-auto flex flex-wrap gap-2">
                    <EditGateButton gate={gate} />
                    <NewTabletButton gate={gate} />
                  </span>
                ) : null}
              </header>
              {!list.data ? (
                <div className="p-6">
                  <SectionError error={list.error} />
                </div>
              ) : (
                <div className="flex flex-col gap-6 p-6">
                  <section className="flex flex-col gap-3">
                    <h3 className="font-semibold">{t("gates.tablets")}</h3>
                    {tablets.length === 0 ? (
                      <p className="text-muted">{t("gates.noTablets")}</p>
                    ) : (
                      <SimpleTable
                        caption={t("gates.tablets")}
                        stackOnPhones
                        testId="gate-tablets"
                        columns={[
                          { key: "name", header: t("col.name"), phone: "title" },
                          { key: "state", header: t("col.state"), phone: "status" },
                          { key: "seen", header: t("col.lastSeen") },
                          {
                            key: "action",
                            header: <span className="sr-only">{t("col.action")}</span>,
                            align: "end",
                            phone: "figure",
                          },
                        ]}
                        rows={tablets.map((device) => ({
                          key: device.id,
                          testId: "gate-tablet-row",
                          cells: {
                            name: device.name,
                            state: <StatusBadgeOf map={GATE_DEVICE_STATUS} value={device.state} size="sm" />,
                            seen:
                              device.state === "pending" && device.enrolExpiresAt
                                ? t("gates.codeUntil", { date: formatDateTime(device.enrolExpiresAt, locale) })
                                : device.lastSeenAt
                                  ? formatDateTime(device.lastSeenAt, locale)
                                  : "—",
                            action: canManage ? <RevokeTabletButton gateId={gate.id} device={device} /> : null,
                          },
                        }))}
                      />
                    )}
                  </section>
                  <section className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-semibold">{t("gates.hardware")}</h3>
                      {canManage ? <AttachEdgeButton gateId={gate.id} edgeOptions={edgeOptions} /> : null}
                    </div>
                    {hardware.length === 0 ? (
                      <p className="text-muted">{t("gates.noHardwareLede")}</p>
                    ) : (
                      <SimpleTable
                        caption={t("gates.hardware")}
                        stackOnPhones
                        testId="gate-hardware"
                        columns={[
                          { key: "name", header: t("col.name"), phone: "title" },
                          { key: "kind", header: t("col.kind") },
                          { key: "edge", header: t("col.edge") },
                          { key: "state", header: t("col.hwState"), phone: "status" },
                          {
                            key: "action",
                            header: <span className="sr-only">{t("col.action")}</span>,
                            align: "end",
                            phone: "figure",
                          },
                        ]}
                        rows={hardware.map((device) => ({
                          key: device.id,
                          testId: "gate-hardware-row",
                          cells: {
                            name: device.name,
                            kind: t(`gates.hardwareKind.${device.kind as "barrier" | "lpr"}`),
                            edge: (
                              <span className="text-sm">
                                {t("gates.edgeChannel", {
                                  gateway: edgeName.get(device.edgeDeviceId ?? "") ?? t("gates.edgeGateway"),
                                  channel: device.channel ?? "—",
                                })}
                                {device.pulseMs ? ` · ${t("gates.pulse", { ms: device.pulseMs })}` : ""}
                              </span>
                            ),
                            state: device.hwState ? (
                              <Badge tone={device.hwState === "fault" ? "danger" : "neutral"}>
                                {t(`gates.hw.${device.hwState}`)}
                              </Badge>
                            ) : (
                              <span className="text-muted">{t("gates.hw.none")}</span>
                            ),
                            action: canManage ? <DetachEdgeButton gateId={gate.id} device={device} /> : null,
                          },
                        }))}
                      />
                    )}
                  </section>
                  <p className="text-muted text-sm">{t("gates.tabletHint", { url: "/gate" })}</p>
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}

async function GuardsTab({
  context,
  propertyId,
  canManage,
}: {
  context: OwnerContext;
  propertyId: string;
  canManage: boolean;
}) {
  const t = await getTranslations("owner.gate");
  const { api, locale } = context;
  const guards = await section(unwrap(api.GET("/v1/owner/gate-guards", { params: { query: { propertyId } } })));
  if (!guards.data) return <SectionError error={guards.error} />;
  const now = new Date().getTime();
  const view = (guard: Schemas["GateGuardDto"]) =>
    guard.state === "revoked"
      ? "revoked"
      : guard.lockedUntil && Date.parse(guard.lockedUntil) > now
        ? "locked"
        : "active";
  return (
    <div className="flex flex-col gap-4" data-testid="gate-guards">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted max-w-2xl">{t("guards.lede")}</p>
        {canManage ? <AddGuardButton propertyId={propertyId} /> : null}
      </div>
      {guards.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconShield}
          title={t("guards.empty.title")}
          description={t("guards.empty.body")}
          action={
            canManage ? (
              <AddGuardButton propertyId={propertyId} />
            ) : (
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/juristic")}>{t("backToday")}</a>
              </Button>
            )
          }
        />
      ) : (
        <SimpleTable
          caption={t("tab.guards")}
          stackOnPhones
          testId="guard-rows"
          columns={[
            { key: "name", header: t("col.name"), phone: "title" },
            { key: "state", header: t("col.state"), phone: "status" },
            { key: "shift", header: t("col.shift") },
            { key: "pin", header: t("col.pinSet") },
            {
              key: "action",
              header: <span className="sr-only">{t("col.action")}</span>,
              align: "end",
              phone: "figure",
            },
          ]}
          rows={guards.data.map((guard) => ({
            key: guard.id,
            testId: "guard-row",
            data: { state: view(guard) },
            cells: {
              name: guard.displayName,
              state: (
                <span className="flex flex-col gap-0.5">
                  <StatusBadgeOf map={GATE_GUARD_STATUS} value={view(guard)} size="sm" />
                  {view(guard) === "locked" ? (
                    <span className="text-muted text-sm">
                      {t("guards.lockedUntil", { time: formatDateTime(guard.lockedUntil!, locale) })}
                    </span>
                  ) : null}
                </span>
              ),
              shift: guard.onShiftAtGateId ? t("guards.onShift") : "—",
              pin: formatDate(guard.pinSetAt, locale),
              action: canManage && guard.state === "active" ? <GuardActions guard={guard} /> : null,
            },
          }))}
        />
      )}
    </div>
  );
}

async function PoliciesTab({
  context,
  propertyId,
  unitId,
  canManage,
}: {
  context: OwnerContext;
  propertyId: string;
  unitId: string | undefined;
  canManage: boolean;
}) {
  const t = await getTranslations("owner.gate");
  const { api, locale } = context;
  const units = await propertyUnits(context, propertyId);
  if (!units.data) return <SectionError error={units.error} />;
  const rows = units.data.data;
  const chosen = rows.find((unit) => unit.id === unitId) ?? null;
  const policy = chosen
    ? await section(
        unwrap(api.GET("/v1/owner/gate-policies/units/{unitId}", { params: { path: { unitId: chosen.id } } })),
      )
    : null;
  const base = ownerPath(locale, "/juristic/gate");
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]" data-testid="gate-policies">
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("policies.pick")}</h2>
        <p className="text-muted text-sm">{t("policies.lede")}</p>
        <ul className="relative flex max-h-[28rem] flex-col overflow-y-auto">
          {rows.map((unit) => (
            <li key={unit.id}>
              <a
                href={withQuery(base, { tab: "policies", property: propertyId, unit: unit.id })}
                aria-current={unit.id === chosen?.id ? "page" : undefined}
                data-testid="policy-unit"
                className="rounded-control hover:bg-bg-subtle aria-[current=page]:bg-primary-subtle aria-[current=page]:text-primary-subtle-fg flex h-10 items-center px-3 font-mono"
              >
                {unit.unitNo}
              </a>
            </li>
          ))}
        </ul>
      </Card>
      {!chosen ? (
        <EmptyState
          variant="card"
          icon={IconShield}
          title={t("policies.none.title")}
          description={t("policies.none.body")}
          action={
            <Button asChild variant="secondary">
              <a href={withQuery(base, { tab: "policies", property: propertyId, unit: rows[0]?.id })}>
                {t("policies.none.action")}
              </a>
            </Button>
          }
        />
      ) : !policy?.data ? (
        <SectionError error={policy?.error} />
      ) : (
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-mono text-xl font-semibold">{chosen.unitNo}</h2>
            <Badge tone={policy.data.custom ? "primary" : "neutral"}>
              {policy.data.custom ? t("policies.custom") : t("policies.default")}
            </Badge>
          </div>
          <PolicyForm unitId={chosen.id} policy={policy.data} disabled={!canManage} />
        </Card>
      )}
    </div>
  );
}

async function BlacklistTab({
  context,
  propertyId,
  canManage,
}: {
  context: OwnerContext;
  propertyId: string;
  canManage: boolean;
}) {
  const t = await getTranslations("owner.gate");
  const { api, locale } = context;
  const list = await section(unwrap(api.GET("/v1/owner/gate-blacklist", { params: { query: { propertyId } } })));
  if (!list.data) return <SectionError error={list.error} />;
  return (
    <div className="flex flex-col gap-4" data-testid="gate-blacklist">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted max-w-2xl">{t("blacklist.lede")}</p>
        {canManage ? <BlacklistAddButton propertyId={propertyId} /> : null}
      </div>
      {list.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconCar}
          title={t("blacklist.empty.title")}
          description={t("blacklist.empty.body")}
          action={
            canManage ? (
              <BlacklistAddButton propertyId={propertyId} />
            ) : (
              <Button asChild variant="secondary">
                <a href={withQuery(ownerPath(locale, "/juristic/gate"), { tab: "visits" })}>{t("toVisits")}</a>
              </Button>
            )
          }
        />
      ) : (
        <SimpleTable
          caption={t("tab.blacklist")}
          stackOnPhones
          testId="blacklist-rows"
          columns={[
            { key: "plate", header: t("col.plate"), phone: "title" },
            { key: "reason", header: t("col.reason") },
            { key: "since", header: t("col.since") },
            {
              key: "action",
              header: <span className="sr-only">{t("col.action")}</span>,
              align: "end",
              phone: "figure",
            },
          ]}
          rows={list.data.map((entry) => ({
            key: entry.id,
            testId: "blacklist-row",
            cells: {
              plate: (
                <span className="flex flex-col">
                  <span className="font-mono font-semibold">{plateText(entry.plate)}</span>
                  <span className="text-muted text-sm">{entry.plate.province}</span>
                </span>
              ),
              reason: entry.reason,
              since: entry.revokedAt
                ? t("blacklist.revokedOn", { date: formatDate(entry.revokedAt, locale) })
                : formatDate(entry.createdAt, locale),
              action: canManage && !entry.revokedAt ? <BlacklistRevokeButton entry={entry} /> : null,
            },
          }))}
        />
      )}
    </div>
  );
}

async function InvitesTab({
  context,
  canDecide,
  state,
  tabHref,
}: {
  context: OwnerContext;
  canDecide: boolean;
  state: string | undefined;
  tabHref: (state: string | undefined) => string;
}) {
  const t = await getTranslations("owner.gate");
  const { api, locale } = context;
  const filter = (state === "all" ? undefined : (state ?? "pending_approval")) as
    Schemas["VisitInviteState"] | undefined;
  const list = await section(
    unwrap(api.GET("/v1/owner/gate-invites", { params: { query: filter ? { state: filter } : {} } })),
  );
  return (
    <div className="flex flex-col gap-4" data-testid="gate-invites">
      <p className="text-muted max-w-2xl">{t("invites.lede")}</p>
      <LinkTabs
        label={t("invites.show")}
        current={tabHref(state ?? undefined)}
        tabs={[
          { href: tabHref(undefined), label: t("invites.waiting") },
          { href: tabHref("all"), label: t("invites.all") },
        ]}
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : list.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconShield}
          title={t("invites.empty.title")}
          description={t("invites.empty.body")}
          action={
            <Button asChild variant="secondary">
              <a href={tabHref("all")}>{t("invites.all")}</a>
            </Button>
          }
        />
      ) : (
        <SimpleTable
          caption={t("tab.invites")}
          stackOnPhones
          testId="invite-rows"
          columns={[
            { key: "unit", header: t("col.unit"), phone: "title" },
            { key: "who", header: t("col.visitor") },
            { key: "window", header: t("col.window") },
            { key: "state", header: t("col.state"), phone: "status" },
            {
              key: "action",
              header: <span className="sr-only">{t("col.action")}</span>,
              align: "end",
              phone: "figure",
            },
          ]}
          rows={list.data.map((invite) => ({
            key: invite.id,
            testId: "invite-row",
            cells: {
              unit: <span className="font-mono font-medium">{invite.unitNo ?? "—"}</span>,
              who: (
                <span className="flex flex-col">
                  <span>{invite.visitorName ?? t(`invites.kind.${invite.visitorKind}`)}</span>
                  <span className="text-muted text-sm">
                    {[
                      t(`invites.kind.${invite.visitorKind}`),
                      invite.plate ? plateText(invite.plate) : null,
                      invite.note,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              ),
              window: (
                <span className="flex flex-col">
                  <span>
                    {t("invites.range", {
                      from: formatDate(invite.validFrom, locale),
                      to: formatDate(invite.validTo, locale),
                    })}
                  </span>
                  <span className="text-muted text-sm">
                    {t("invites.uses", { uses: invite.uses, max: invite.maxUses })}
                  </span>
                </span>
              ),
              state: <StatusBadgeOf map={GATE_INVITE_STATUS} value={invite.state} size="sm" />,
              action:
                canDecide && invite.state === "pending_approval" ? <InviteDecisionButtons invite={invite} /> : null,
            },
          }))}
        />
      )}
    </div>
  );
}

async function VehiclesTab({ context, propertyId }: { context: OwnerContext; propertyId: string }) {
  const t = await getTranslations("owner.gate");
  const { api, locale } = context;
  const [list, units] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/gate-vehicles", { params: { query: { propertyId } } }))),
    propertyUnits(context, propertyId),
  ]);
  if (!list.data) return <SectionError error={list.error} />;
  const unitNo = new Map((units.data?.data ?? []).map((unit) => [unit.id, unit.unitNo]));
  return (
    <div className="flex flex-col gap-4" data-testid="gate-vehicles">
      <Callout tone="neutral" size="sm">
        {t("vehicles.lede")}
      </Callout>
      {list.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconCar}
          title={t("vehicles.empty.title")}
          description={t("vehicles.empty.body")}
          action={
            <Button asChild variant="secondary">
              <a href={withQuery(ownerPath(locale, "/juristic/gate"), { tab: "visits" })}>{t("toVisits")}</a>
            </Button>
          }
        />
      ) : (
        <SimpleTable
          caption={t("tab.vehicles")}
          stackOnPhones
          testId="vehicle-rows"
          columns={[
            { key: "plate", header: t("col.plate"), phone: "title" },
            { key: "unit", header: t("col.unit"), phone: "figure" },
            { key: "label", header: t("col.label") },
            { key: "since", header: t("col.since") },
          ]}
          rows={list.data.map((vehicle) => ({
            key: vehicle.id,
            cells: {
              plate: (
                <span className="flex flex-col">
                  <span className="font-mono font-semibold">{plateText(vehicle.plate)}</span>
                  <span className="text-muted text-sm">{vehicle.plate.province}</span>
                </span>
              ),
              unit: <span className="font-mono">{unitNo.get(vehicle.unitId) ?? "—"}</span>,
              label: vehicle.label ?? "—",
              since: formatDate(vehicle.createdAt, locale),
            },
          }))}
        />
      )}
    </div>
  );
}

async function SettingsTab({ context, propertyId }: { context: OwnerContext; propertyId: string }) {
  const t = await getTranslations("owner.gate");
  const tc = await getTranslations("owner.common.setting");
  const { api, locale } = context;
  const settings = await section(unwrap(api.GET("/v1/owner/settings", { params: { query: { propertyId } } })));
  if (!settings.data) return <SectionError error={settings.error} />;
  const pick = (keys: readonly string[]) =>
    keys.flatMap((key) => settings.data!.find((setting) => setting.key === key) ?? []);
  const retention = settings.data.find((setting) => setting.key === "gate.retention_days");
  return (
    <div className="flex flex-col gap-6" data-testid="gate-settings">
      {retention ? (
        <Card className="flex flex-col gap-1" data-testid="gate-retention">
          <h2 className="font-semibold">{t("settings.retention")}</h2>
          <p className="text-lg font-semibold">{tc("days", { count: Number(retention.value) })}</p>
          <p className="text-muted text-sm">
            {t("settings.retentionHint", { since: formatDate(retention.effectiveFrom, locale) })}
          </p>
        </Card>
      ) : null}
      {(["visitors", "tablet", "hardware", "sos"] as const).map((group) => (
        <Card key={group} className="flex flex-col gap-0 p-0">
          <header className="border-border border-b px-6 py-4">
            <h2 className="font-semibold">{t(`settings.group.${group}`)}</h2>
          </header>
          <SettingRows
            settings={pick(GATE_SETTING_KEYS[group])}
            context={context}
            propertyId={propertyId}
            testId={`gate-settings-${group}`}
          />
        </Card>
      ))}
    </div>
  );
}

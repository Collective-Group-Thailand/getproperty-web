import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { DEPOSIT_STATUS } from "@/domain/status/deposit";
import { INSPECTION_STATUS } from "@/domain/status/inspection";
import { INVITATION_STATUS } from "@/domain/status/invitation";
import { LEASE_STATUS } from "@/domain/status/lease";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Timeline, type TimelineEvent } from "@/ui/components/Timeline";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconLease } from "@/ui/icons/glyphs/lease";
import { IconSign } from "@/ui/icons/glyphs/sign";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { DocumentButton } from "../shared/DocumentButton";
import { ownerPath } from "../shared/links";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { ownerCan, section, type OwnerContext } from "../shared/server";
import { ComplianceChecks } from "./ComplianceChecks";
import { LeaseActions } from "./LeaseActions";
import { LeaseInviteButton } from "./LeaseInvite";

const EVENT_TYPES = new Set([
  "drafted",
  "updated",
  "sent_for_signature",
  "invitation_created",
  "invitation_accepted",
  "signed",
  "activated",
  "moved_in",
  "notice_given",
  "move_out_started",
  "ended",
  "terminated",
  "cancelled",
  "renewed",
]);
const EVENT_TONE: Record<string, TimelineEvent["tone"]> = {
  signed: "primary",
  activated: "success",
  moved_in: "success",
  notice_given: "warning",
  move_out_started: "warning",
  terminated: "danger",
  cancelled: "neutral",
};
const EVENT_ICON: Record<string, TimelineEvent["icon"]> = {
  signed: IconSign,
  activated: IconCheckCircle,
  terminated: IconXCircle,
  notice_given: IconClock,
};
const LIVE = new Set<Schemas["LeaseStatus"]>(["draft", "pending_signature", "active", "notice_given", "ending"]);

/**
 * One lease (F2 2.2): terms and amounts, parties and their signatures, the compliance checks the API
 * evaluated, lines and addendum, the contract (preview while a draft, the signed PDF after), the
 * timeline of lease events, invitations to the resident app, inspections and the deposit — and the
 * actions the API offers now (`nextActions`).
 */
export async function LeaseDetail({ context, leaseId }: { context: OwnerContext; leaseId: string }) {
  const t = await getTranslations("owner.leases.detail");
  const roles = await getTranslations("owner.leases.role");
  const events = await getTranslations("owner.leases.event");
  const kinds = await getTranslations("owner.common.lineKind");
  const clauses = await getTranslations("owner.leases.clause");
  const reasons = await getTranslations("owner.leases.reason");
  const wizard = await getTranslations("owner.leases.wizard");
  const { api, locale } = context;
  let lease: Schemas["LeaseDto"];
  try {
    lease = await unwrap(api.GET("/v1/owner/leases/{leaseId}", { params: { path: { leaseId } } }));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const [timeline, invitations, inspections, deposits] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/leases/{leaseId}/events", { params: { path: { leaseId } } }))),
    section(unwrap(api.GET("/v1/owner/leases/{leaseId}/invitations", { params: { path: { leaseId } } }))),
    section(unwrap(api.GET("/v1/owner/inspections", { params: { query: { leaseId, perPage: 10 } } }))),
    section(unwrap(api.GET("/v1/owner/deposits", { params: { query: { leaseId, perPage: 5 } } }))),
  ]);
  const signedBy = new Map(lease.signatures.map((signature) => [signature.partyId ?? signature.signerRole, signature]));
  const lessorSigned = lease.signatures.find((signature) => signature.signerRole === "lessor");
  const eventList = timeline.data ?? [];
  // The stored contract carries the lessee's full ID / passport number: only `party.pii.decrypt` holders
  // (Owner, Manager) may download it; Staff and Accountant get 403 from the API (D-172, D-222).
  const canOpenContract = ownerCan(context.me, "party.pii.decrypt");

  return (
    <OwnerPage testId="lease-detail">
      <PageHeader
        title={t("title", { unit: lease.unitNo })}
        testId="lease-title"
        description={[lease.number, lease.buildingName].filter(Boolean).join(" · ") || undefined}
        crumbs={[{ label: lease.number ?? lease.unitNo }]}
        status={<StatusBadgeOf map={LEASE_STATUS} value={lease.status} />}
        actions={<LeaseActions lease={lease} />}
      />

      {lease.notice ? (
        <Card data-testid="lease-notice-card">
          <p className="font-medium">
            {t("noticeSummary", {
              by: t(`noticeBy.${lease.notice.by}`),
              date: formatDate(lease.notice.givenAt, locale),
              effective: lease.notice.effectiveDate ? formatDate(lease.notice.effectiveDate, locale) : "—",
            })}
          </p>
          {lease.notice.reasonCode ? <p className="text-muted text-sm">{reasons(lease.notice.reasonCode)}</p> : null}
          {lease.status === "notice_given" ? (
            <p className="mt-2 text-sm" data-testid="lease-notice-access">
              {t("noticeAccess", {
                effective: lease.notice.effectiveDate ? formatDate(lease.notice.effectiveDate, locale) : "—",
              })}
            </p>
          ) : null}
        </Card>
      ) : null}
      {lease.status === "ending" ? (
        <div data-testid="lease-ending-card">
          <Callout tone="info" title={t("endingTitle")}>
            {lease.nextActions.includes("complete-move-out") ? t("endingBody") : t("endingBodyNoAction")}
          </Callout>
        </div>
      ) : null}
      {lease.termination ? (
        <Card data-testid="lease-termination-card">
          <p className="font-medium">
            {t("terminatedSummary", {
              date: formatDate(lease.termination.terminatedAt, locale),
              reason: reasons(lease.termination.reasonCode),
            })}
          </p>
          {lease.termination.notes ? <p className="text-muted text-sm">{lease.termination.notes}</p> : null}
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card as="section" aria-labelledby="lease-terms" data-testid="lease-terms">
          <CardHeader title={<span id="lease-terms">{t("terms")}</span>} />
          <DescriptionList
            items={[
              {
                id: "unit",
                term: t("unit"),
                description: (
                  <a className="underline-offset-4 hover:underline" href={ownerPath(locale, `/units/${lease.unitId}`)}>
                    {lease.unitNo}
                  </a>
                ),
              },
              {
                id: "period",
                term: t("period"),
                description: `${formatDate(lease.startDate, locale)} – ${formatDate(lease.endDate, locale)}`,
              },
              { id: "months", term: wizard("months"), description: String(lease.months) },
              { id: "rent", term: wizard("rent"), description: formatTHB(lease.rent, locale) },
              { id: "deposit", term: wizard("deposit"), description: formatTHB(lease.depositAmount, locale) },
              { id: "advance", term: wizard("advance"), description: formatTHB(lease.advanceRentAmount, locale) },
              {
                id: "billingDay",
                term: wizard("billingDay"),
                description: lease.billingDay ? String(lease.billingDay) : t("billingDayDefault"),
              },
              { id: "utilities", term: wizard("utilities"), description: wizard(lease.utilityBillingMode) },
              { id: "keys", term: wizard("keys"), description: String(lease.keysCount) },
              { id: "parking", term: wizard("parking"), description: String(lease.parkingSlots) },
              {
                id: "moveIn",
                term: t("moveIn"),
                description: lease.moveInAt ? formatDateTime(lease.moveInAt, locale) : null,
              },
              {
                id: "moveOut",
                term: t("moveOut"),
                description: lease.moveOutAt ? formatDateTime(lease.moveOutAt, locale) : null,
              },
              ...(lease.renewedFromLeaseId
                ? [
                    {
                      id: "renewed",
                      term: t("renewedFrom"),
                      description: (
                        <a
                          className="underline-offset-4 hover:underline"
                          href={ownerPath(locale, `/leases/${lease.renewedFromLeaseId}`)}
                        >
                          {t("previousLease")}
                        </a>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </Card>

        <Card as="section" aria-labelledby="lease-parties" data-testid="lease-parties">
          <CardHeader
            title={<span id="lease-parties">{t("parties")}</span>}
            action={
              LIVE.has(lease.status) ? (
                <LeaseInviteButton
                  leaseId={lease.id}
                  parties={lease.parties.filter((party) => party.isSigner || party.role === "occupant")}
                />
              ) : null
            }
          />
          <ul className="flex flex-col gap-2">
            {lease.parties.map((party) => {
              const signature = signedBy.get(party.partyId);
              return (
                <li
                  key={party.partyId}
                  className="flex flex-wrap items-center justify-between gap-2"
                  data-testid="lease-party"
                >
                  <span className="flex flex-col">
                    <a
                      className="font-medium underline-offset-4 hover:underline"
                      href={ownerPath(locale, `/parties/${party.partyId}`)}
                    >
                      {party.displayName ?? "—"}
                    </a>
                    <span className="text-muted text-sm">{roles(party.role)}</span>
                  </span>
                  {party.isSigner ? (
                    party.signedAt || signature ? (
                      <span data-testid="party-signed">
                        <Badge tone="success" size="sm" icon={IconSign}>
                          {t("signedAt", { date: formatDateTime(party.signedAt ?? signature!.signedAt, locale) })}
                        </Badge>
                      </span>
                    ) : (
                      <Badge tone="neutral" size="sm">
                        {t("notSigned")}
                      </Badge>
                    )
                  ) : null}
                </li>
              );
            })}
            <li className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-col">
                <span className="font-medium">{t("lessor")}</span>
                <span className="text-muted text-sm">{roles("lessor")}</span>
              </span>
              {lessorSigned ? (
                <span data-testid="lessor-signed">
                  <Badge tone="success" size="sm" icon={IconSign}>
                    {t("signedAt", { date: formatDateTime(lessorSigned.signedAt, locale) })}
                  </Badge>
                </span>
              ) : (
                <Badge tone="neutral" size="sm">
                  {t("notSigned")}
                </Badge>
              )}
            </li>
          </ul>
        </Card>

        <Card as="section" aria-labelledby="lease-contract" data-testid="lease-contract">
          <CardHeader
            title={<span id="lease-contract">{t("contract")}</span>}
            description={lease.compliance.inScope ? t("inScope") : t("outOfScope")}
          />
          <ComplianceChecks lease={lease} />
          <div className="mt-3 flex flex-wrap gap-2">
            {lease.contract && !canOpenContract ? (
              <div className="flex flex-col gap-1" data-testid="lease-contract-restricted">
                <Button variant="secondary" size="sm" iconStart={IconBill} disabled aria-describedby="contract-pii">
                  {lease.contract.signed ? t("signedContract") : t("contractPdf")}
                </Button>
                <p id="contract-pii" className="text-muted text-sm">
                  {t("contractPiiOnly")}
                </p>
              </div>
            ) : lease.contract ? (
              <DocumentButton
                document={{ kind: "leaseContract", id: lease.id }}
                label={lease.contract.signed ? t("signedContract") : t("contractPdf")}
                title={t("contractTitle", { unit: lease.unitNo })}
                testId="lease-contract-pdf"
              />
            ) : (
              <DocumentButton
                document={{ kind: "leasePreview", id: lease.id }}
                label={wizard("preview")}
                title={wizard("previewTitle", { unit: lease.unitNo })}
                testId="contract-preview"
              />
            )}
          </div>
          {!lease.contract && !canOpenContract ? (
            <p className="text-muted mt-2 text-sm" data-testid="contract-preview-masked">
              {t("previewMasked")}
            </p>
          ) : null}
          {lease.contract ? (
            <p className="text-muted mt-2 font-mono text-xs break-all">{t("sha", { sha: lease.contract.sha256 })}</p>
          ) : null}
        </Card>

        <Card as="section" aria-labelledby="lease-lines" data-testid="lease-lines">
          <CardHeader title={<span id="lease-lines">{wizard("linesTitle")}</span>} />
          {lease.lines.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {lease.lines.map((line) => (
                <li key={line.id} className="flex justify-between gap-2">
                  <span>
                    {line.description} <span className="text-muted">{t("inParens", { value: kinds(line.kind) })}</span>
                  </span>
                  <span className="tabular-nums">{formatTHB(line.amount, locale)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted text-sm">{t("noLines")}</p>
          )}
          {lease.addendum.length ? (
            <>
              <h3 className="mt-4 font-semibold">{wizard("addendumTitle")}</h3>
              <ul className="flex flex-col gap-2 text-sm">
                {lease.addendum.map((clause, index) => (
                  <li key={index}>
                    <span className="font-medium">{clause.title}</span>{" "}
                    <span className="text-muted">{t("inParens", { value: clauses(clause.type) })}</span>
                    <p>{clause.text}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Card>

        <Card as="section" aria-labelledby="lease-timeline" data-testid="lease-timeline">
          <CardHeader title={<span id="lease-timeline">{t("timeline")}</span>} />
          {eventList.length ? (
            <Timeline
              events={[...eventList]
                .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
                .map((event) => ({
                  id: event.id,
                  title: EVENT_TYPES.has(event.type) ? events(event.type) : event.type,
                  time: formatDateTime(event.occurredAt, locale),
                  timeTitle: event.occurredAt,
                  actor: t(
                    `actor.${event.actorType === "resident" || event.actorType === "system" ? event.actorType : "user"}`,
                  ),
                  tone: EVENT_TONE[event.type] ?? "neutral",
                  icon: EVENT_ICON[event.type] ?? IconLease,
                }))}
            />
          ) : (
            <p className="text-muted text-sm">{t("noEvents")}</p>
          )}
        </Card>

        <Card as="section" aria-labelledby="lease-related" data-testid="lease-related">
          <CardHeader title={<span id="lease-related">{t("related")}</span>} />
          <h3 className="font-semibold">{t("invitations")}</h3>
          {invitations.data && invitations.data.length ? (
            <ul className="mb-4 flex flex-col gap-1 text-sm" data-testid="lease-invitations">
              {invitations.data.map((invitation) => (
                <li key={invitation.id} className="flex flex-wrap items-center gap-2">
                  <StatusBadgeOf map={INVITATION_STATUS} value={invitation.state} size="sm" />
                  <span>{lease.parties.find((party) => party.partyId === invitation.partyId)?.displayName ?? "—"}</span>
                  <span className="text-muted">
                    {t("invitationAt", { date: formatDateTime(invitation.createdAt, locale) })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted mb-4 text-sm">{t("noInvitations")}</p>
          )}
          <h3 className="font-semibold">{t("inspections")}</h3>
          {inspections.data && inspections.data.data.length ? (
            <ul className="mb-4 flex flex-col gap-2 text-sm">
              {inspections.data.data.map((inspection) => (
                <li key={inspection.id} className="flex flex-wrap items-center gap-2">
                  <span>{t(`inspection.${inspection.type}`)}</span>
                  <StatusBadgeOf map={INSPECTION_STATUS} value={inspection.status} size="sm" />
                  {inspection.status === "completed" ? (
                    <DocumentButton
                      document={{ kind: "inspectionReport", id: inspection.id }}
                      label={t("report")}
                      title={t("reportTitle", { unit: lease.unitNo })}
                      size="sm"
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted mb-4 text-sm">{t("noInspections")}</p>
          )}
          <h3 className="font-semibold">{t("deposit")}</h3>
          {deposits.data && deposits.data.data.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {deposits.data.data.map((deposit) => (
                <li key={deposit.id} className="flex flex-wrap items-center gap-2">
                  <a
                    className="underline-offset-4 hover:underline"
                    href={ownerPath(locale, `/deposits/${deposit.id}`)}
                    data-testid="lease-deposit"
                  >
                    {formatTHB(deposit.amountSecurity, locale)}
                  </a>
                  <StatusBadgeOf map={DEPOSIT_STATUS} value={deposit.status} size="sm" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted text-sm">{t("noDeposit")}</p>
          )}
        </Card>
      </div>
    </OwnerPage>
  );
}

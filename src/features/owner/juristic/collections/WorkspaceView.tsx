import { getTranslations } from "next-intl/server";

import { INVOICE_STATUS, WORKSPACE_LINK_STATUS } from "@/domain/status";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatNumber, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconLink } from "@/ui/icons/glyphs/link";
import { IconMail } from "@/ui/icons/glyphs/mail";

import { ownerPath } from "../../shared/links";
import { ownerCan, readOnly, section, type OwnerContext } from "../../shared/server";
import { BillLandlordButton, InviteOfficeButton, RevokeOfficeButton, type StubBuilding } from "./WorkspaceActions";

/**
 * The D-270 workspace of a juristic office (JW1b): units of condos the office does not run on getproperty, linked by
 * their landlords — each with the landlord as the billed party — and the common-fee bills sent to them. Nothing else
 * of the landlord is visible here (no leases, no rent).
 */
export async function WorkspaceView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.collections.workspace");
  const { api, locale, me } = context;
  const [units, invoices] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/juristic/workspace/units"))),
    section(unwrap(api.GET("/v1/owner/juristic/workspace/invoices", { params: { query: { perPage: 50 } } }))),
  ]);
  const canBill = !readOnly(me) && ownerCan(me, "invoice.issue");
  return (
    <OwnerPage testId="juristic-workspace">
      <PageHeader title={t("title")} description={t("lede")} />
      <Callout tone="neutral" size="sm">
        {t("privacy")}
      </Callout>
      <Card as="section" aria-labelledby="units-title" className="flex flex-col gap-4">
        <CardHeader title={<span id="units-title">{t("units")}</span>} description={t("unitsHint")} />
        {!units.data ? (
          <SectionError error={units.error} />
        ) : units.data.items.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={IconLink}
            title={t("emptyTitle")}
            description={t("empty")}
            action={
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/juristic/register")}>{t("emptyAction")}</a>
              </Button>
            }
          />
        ) : (
          <SimpleTable
            caption={t("units")}
            testId="workspace-units"
            stackOnPhones
            minWidth="44rem"
            columns={[
              { key: "unit", header: t("col.unit"), phone: "title" },
              { key: "building", header: t("col.building") },
              { key: "landlord", header: t("col.landlord") },
              { key: "since", header: t("col.since") },
              {
                key: "action",
                header: <span className="sr-only">{t("col.action")}</span>,
                align: "end",
                phone: "figure",
              },
            ]}
            rows={units.data.items.map((unit) => ({
              key: unit.unitId,
              testId: "workspace-unit",
              cells: {
                unit: <span className="font-mono font-medium">{unit.unitNo}</span>,
                building: unit.buildingName,
                landlord: unit.landlordName,
                since: formatDate(unit.linkedAt, locale),
                action: canBill ? <BillLandlordButton unit={unit} /> : null,
              },
            }))}
          />
        )}
      </Card>
      <Card as="section" aria-labelledby="bills-title" className="flex flex-col gap-4">
        <CardHeader title={<span id="bills-title">{t("bills")}</span>} description={t("billsHint")} />
        {!invoices.data ? (
          <SectionError error={invoices.error} />
        ) : invoices.data.data.length === 0 ? (
          <p className="text-muted m-0 text-sm">{t("noBills")}</p>
        ) : (
          <SimpleTable
            caption={t("bills")}
            testId="workspace-invoices"
            stackOnPhones
            minWidth="48rem"
            columns={[
              { key: "number", header: t("col.number"), phone: "title" },
              { key: "unit", header: t("col.unit") },
              { key: "landlord", header: t("col.landlord") },
              { key: "period", header: t("col.period") },
              { key: "status", header: t("col.status"), phone: "status" },
              { key: "total", header: t("col.total"), align: "end", phone: "figure" },
            ]}
            rows={invoices.data.data.map((invoice) => ({
              key: invoice.id,
              cells: {
                number: <span className="font-mono">{invoice.number ?? "—"}</span>,
                unit: <span className="font-mono">{invoice.unitNo ?? "—"}</span>,
                landlord: invoice.billedPartyName,
                period: `${formatDate(invoice.periodStart, locale)} – ${formatDate(invoice.periodEnd, locale)}`,
                status: <StatusBadgeOf map={INVOICE_STATUS} value={invoice.status} size="sm" />,
                total: formatTHB(invoice.total, locale),
              },
            }))}
          />
        )}
      </Card>
    </OwnerPage>
  );
}

/**
 * The landlord's side of D-270 (JW1b): invite the juristic office of a condo that is not on getproperty for its own
 * units there; see who accepted; withdraw or end a link. Only stub buildings (not run on getproperty) can be offered.
 */
export async function OfficeInvitationsView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.collections.office");
  const { api, locale, me } = context;
  const [list, portfolio] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/juristic-workspace-invitations"))),
    section(unwrap(api.GET("/v1/owner/portfolio"))),
  ]);
  const stubs = new Map<string, StubBuilding>();
  for (const unit of portfolio.data?.units ?? []) {
    if (!unit.building.external) continue;
    const entry = stubs.get(unit.building.id) ?? { id: unit.building.id, name: unit.building.name, units: [] };
    entry.units.push({ id: unit.unitId, unitNo: unit.unitNo });
    stubs.set(unit.building.id, entry);
  }
  const buildings = [...stubs.values()];
  const canInvite = !readOnly(me) && ownerCan(me, "tenant.grant.manage");
  const buildingName = (id: string) => stubs.get(id)?.name ?? "—";
  const items = list.data?.items ?? [];
  return (
    <OwnerPage testId="juristic-office">
      <PageHeader
        title={t("title")}
        description={t("lede")}
        actions={canInvite ? <InviteOfficeButton buildings={buildings} /> : undefined}
      />
      {buildings.length === 0 && portfolio.data ? (
        <Callout tone="neutral" size="sm">
          {t("noStub")}
        </Callout>
      ) : null}
      {!list.data ? (
        <SectionError error={list.error} />
      ) : items.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconMail}
          title={t("emptyTitle")}
          description={t("empty")}
          action={
            <Button asChild variant="secondary">
              <a href={ownerPath(locale, "/portfolio")}>{t("backToPortfolio")}</a>
            </Button>
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="office-invitations"
          stackOnPhones
          minWidth="52rem"
          columns={[
            { key: "office", header: t("col.office"), phone: "title" },
            { key: "building", header: t("col.building") },
            { key: "units", header: t("col.units"), align: "end" },
            { key: "when", header: t("col.when") },
            { key: "state", header: t("col.state"), phone: "status" },
            {
              key: "action",
              header: <span className="sr-only">{t("col.action")}</span>,
              align: "end",
              phone: "figure",
            },
          ]}
          rows={items.map((invitation) => ({
            key: invitation.id,
            testId: "office-invitation",
            data: { state: invitation.state },
            cells: {
              office: (
                <span className="flex flex-col">
                  <span className="font-medium">{invitation.officeName}</span>
                  <span className="text-muted font-mono text-sm">{invitation.codeHint}</span>
                </span>
              ),
              building: buildingName(invitation.buildingId),
              units: formatNumber(invitation.unitIds.length, locale),
              when:
                invitation.state === "active" && invitation.acceptedAt
                  ? t("acceptedOn", { date: formatDate(invitation.acceptedAt, locale) })
                  : invitation.state === "revoked" && invitation.revokedAt
                    ? t("revokedOn", { date: formatDate(invitation.revokedAt, locale) })
                    : t("expiresOn", { date: formatDate(invitation.expiresAt, locale) }),
              state: <StatusBadgeOf map={WORKSPACE_LINK_STATUS} value={invitation.state} size="sm" />,
              action:
                canInvite && invitation.state !== "revoked" ? <RevokeOfficeButton invitation={invitation} /> : null,
            },
          }))}
        />
      )}
      <p className="text-muted m-0 text-sm">
        <a className="text-primary underline-offset-4 hover:underline" href={ownerPath(locale, "/portfolio")}>
          {t("backToPortfolio")}
        </a>
      </p>
    </OwnerPage>
  );
}

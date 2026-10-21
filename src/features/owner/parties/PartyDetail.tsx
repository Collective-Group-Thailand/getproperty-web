import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { LEASE_STATUS } from "@/domain/status/lease";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatPhone } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconLease } from "@/ui/icons/glyphs/lease";

import { LeaseInviteButton } from "../leases/LeaseInvite";
import { ownerPath } from "../shared/links";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { LinkRequestRow } from "./LinkRequestsView";
import { IdDocuments, PartyLinks, RevealPii } from "./PartyPrivacy";

const LIVE = new Set<Schemas["LeaseStatus"]>(["draft", "pending_signature", "active", "notice_given", "ending"]);

/**
 * One party (F2 2.2): contact data, occupancy per unit (lessee / co-resident / occupant through its
 * leases), the LINE link state and linked logins, invitations to the resident app, and — for Owner and
 * Manager — sealed data and ID documents revealed with an audited purpose (D-148, D-172).
 */
export async function PartyDetail({ context, partyId }: { context: OwnerContext; partyId: string }) {
  const t = await getTranslations("owner.parties.detail");
  const roles = await getTranslations("owner.leases.role");
  const { api, locale } = context;
  let party: Schemas["PartyDto"];
  try {
    party = await unwrap(api.GET("/v1/owner/parties/{partyId}", { params: { path: { partyId } } }));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const role = context.me.currentTenant?.role;
  const privileged = role === "owner" || role === "manager";
  const [leases, links, documents, requests] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/leases", { params: { query: { partyId, perPage: 50 } } }))),
    section(unwrap(api.GET("/v1/owner/parties/{partyId}/links", { params: { path: { partyId } } }))),
    privileged
      ? section(unwrap(api.GET("/v1/owner/parties/{partyId}/id-documents", { params: { path: { partyId } } })))
      : Promise.resolve({ data: null, error: null }),
    section(
      unwrap(
        api.GET("/v1/owner/party-link-requests", { params: { query: { partyId, state: "pending", perPage: 10 } } }),
      ),
    ),
  ]);

  return (
    <OwnerPage testId="party-detail">
      <PageHeader
        title={party.displayName}
        testId="party-title"
        crumbs={[{ label: party.displayName }]}
        description={t(`type.${party.type}`)}
        status={
          party.lineLinked ? (
            <Badge tone="success" size="sm" icon={IconChat}>
              {t("lineLinked")}
            </Badge>
          ) : (
            <Badge tone="neutral" size="sm">
              {t("lineNotLinked")}
            </Badge>
          )
        }
        actions={
          <Button asChild iconStart={IconLease}>
            <a href={ownerPath(locale, `/leases/new?party=${party.id}`)} data-testid="party-new-lease">
              {t("newLease")}
            </a>
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card as="section" aria-labelledby="party-contact">
          <CardHeader title={<span id="party-contact">{t("contact")}</span>} />
          <DescriptionList
            items={[
              { id: "phone", term: t("phone"), description: party.phone ? formatPhone(party.phone) : null },
              { id: "email", term: t("email"), description: party.email },
              {
                id: "language",
                term: t("language"),
                description: t(`languages.${party.language === "en" ? "en" : "th"}`),
              },
              { id: "nationality", term: t("nationality"), description: party.nationality },
              ...(party.type === "company" ? [{ id: "tax", term: t("taxId"), description: party.taxId }] : []),
              {
                id: "id",
                term: t("idNumber"),
                description: party.idNumberOnFile ? t("sealed") : t("idMissing"),
              },
              {
                id: "emergency",
                term: t("emergency"),
                description: party.emergencyContact
                  ? `${party.emergencyContact.name} (${party.emergencyContact.relation})${party.emergencyContact.phoneOnFile ? ` · ${t("sealed")}` : ""}`
                  : null,
              },
            ]}
          />
          {privileged ? (
            <div className="mt-4">
              <RevealPii party={party} />
            </div>
          ) : null}
        </Card>

        <Card as="section" aria-labelledby="party-occupancy" data-testid="party-occupancy">
          <CardHeader title={<span id="party-occupancy">{t("occupancy")}</span>} />
          {leases.data && leases.data.data.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {leases.data.data.map((lease) => {
                const me = lease.parties.find((candidate) => candidate.partyId === party.id);
                return (
                  <li
                    key={lease.id}
                    className="rounded-control border-border flex flex-col gap-2 border p-3"
                    data-testid="party-lease"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <a
                        className="font-medium underline-offset-4 hover:underline"
                        href={ownerPath(locale, `/leases/${lease.id}`)}
                      >
                        {t("unitLease", { unit: lease.unitNo, building: lease.buildingName ?? "" })}
                      </a>
                      <StatusBadgeOf map={LEASE_STATUS} value={lease.status} size="sm" />
                    </div>
                    <p className="text-muted text-sm">
                      {me ? roles(me.role) : ""} · {formatDate(lease.startDate, locale)} –{" "}
                      {formatDate(lease.endDate, locale)}
                    </p>
                    {LIVE.has(lease.status) ? (
                      <div>
                        <LeaseInviteButton
                          leaseId={lease.id}
                          parties={lease.parties.filter((candidate) => candidate.partyId === party.id)}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted text-sm">{t("noLeases")}</p>
          )}
        </Card>

        <Card as="section" aria-labelledby="party-links" data-testid="party-links">
          <CardHeader title={<span id="party-links">{t("links")}</span>} description={t("linksHint")} />
          <PartyLinks partyId={party.id} links={links.data ?? []} canUnlink={role === "owner"} />
          {requests.data?.data.length ? (
            <div className="mt-4" data-testid="party-link-requests">
              <h3 className="font-semibold">{t("linkRequests")}</h3>
              <p className="text-muted text-sm">{t("linkRequestsHint")}</p>
              <ul className="divide-border divide-y">
                {requests.data.data.map((request) => (
                  <li key={request.id}>
                    <LinkRequestRow
                      request={request}
                      locale={locale}
                      canDecide={ownerCan(context.me, "party.link.manage") && !readOnly(context.me)}
                      showParty={false}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        {privileged ? (
          <Card as="section" aria-labelledby="party-documents" data-testid="party-documents">
            <CardHeader title={<span id="party-documents">{t("documents")}</span>} description={t("documentsHint")} />
            <IdDocuments partyId={party.id} documents={documents.data ?? []} />
          </Card>
        ) : null}
      </div>
    </OwnerPage>
  );
}

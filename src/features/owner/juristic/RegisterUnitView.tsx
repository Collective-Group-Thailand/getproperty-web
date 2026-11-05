import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { kindOf, KIND_TRAITS, vocabularyKeys } from "@/domain/juristic/vocabulary";
import { INVITATION_STATUS, REGISTER_STATUS } from "@/domain/status";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDecimal, formatNumber } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { ShareBar } from "@/ui/components/ShareBar";
import { Timeline, type TimelineEvent } from "@/ui/components/Timeline";
import { IconSwap } from "@/ui/icons/glyphs/swap";
import { IconResident } from "@/ui/icons/glyphs/resident";

import { DocumentButton } from "../shared/DocumentButton";
import { ownerPath } from "../shared/links";
import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import {
  AddOwnerButton,
  BillToButton,
  EditUnitFactsButton,
  EndBillToButton,
  InviteResidentButton,
  type PartyOption,
} from "./RegisterActions";
import { formatShare, parseShare, shareString, WHOLE } from "./shares";

/**
 * One unit of the register (JW1a, D-307, D-309, D-323): its current owners with their shares (and what is missing to
 * 100 %), who receives the bill, how each owner can be reached and their resident invite codes, the ownership history
 * with transfers, and the unit's own facts by the property's kind. Next steps in the panel: transfer the whole unit,
 * add a co-owner, invite, edit the facts.
 */
export async function RegisterUnitView({ context, unitId }: { context: OwnerContext; unitId: string }) {
  const t = await getTranslations("owner.juristic");
  const { api, locale, me } = context;
  let unit: Schemas["RegisterUnitDetailDto"];
  try {
    unit = await unwrap(api.GET("/v1/owner/juristic/register/units/{unitId}", { params: { path: { unitId } } }));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const building = context.buildings.find((candidate) => candidate.id === unit.buildingId);
  const property = context.properties.find((candidate) => candidate.id === building?.propertyId);
  const kind = kindOf(property);
  const words = vocabularyKeys(kind);
  const traits = KIND_TRAITS[kind];
  const canManage = !readOnly(me) && ownerCan(me, "juristic.register.manage");
  const [invites, parties] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/units/{unitId}/resident-invites", { params: { path: { unitId } } }))),
    canManage
      ? section(unwrap(api.GET("/v1/owner/parties", { params: { query: { perPage: 100 } } })))
      : Promise.resolve(null),
  ]);
  const partyOptions: PartyOption[] = (parties?.data?.data ?? []).map((party) => ({
    id: party.id,
    name: party.displayName,
    type: party.type,
  }));
  const ownerName = new Map(
    [...unit.history, ...unit.owners].map((owner) => [owner.party.id, owner.party.displayName] as const),
  );
  const total = parseShare(unit.sharesTotal) ?? 0;
  const missing = Math.max(0, WHOLE - total);
  const unitWord = t(words.unit);
  const title = t("unit.title", { unit: unitWord, no: unit.unitNo });
  const share = (value: string) => t("shares.pct", { value: formatShare(value) });

  // The history as people read it: each ownership's start and end, and each transfer, newest first.
  const events: TimelineEvent[] = [
    ...unit.transfers.map((transfer) => ({
      id: `transfer-${transfer.id}`,
      icon: IconSwap,
      tone: "primary" as const,
      title: t("unit.history.transfer"),
      actor: [
        t(`transfer.policy.${transfer.policy}`),
        transfer.creditNoteIds.length ? t("transfer.creditNotes", { count: transfer.creditNoteIds.length }) : null,
        transfer.chargeIds.length ? t("transfer.charges", { count: transfer.chargeIds.length }) : null,
        transfer.note,
      ]
        .filter(Boolean)
        .join(" · "),
      time: formatDate(transfer.transferDate, locale),
      sort: transfer.transferDate,
    })),
    ...unit.history.map((row) => ({
      id: `own-${row.ownershipId}`,
      icon: IconResident,
      tone: row.validTo ? ("neutral" as const) : ("success" as const),
      title: row.validTo
        ? t("unit.history.ownedUntil", {
            name: row.party.displayName,
            share: share(row.sharePct),
            to: formatDate(row.validTo, locale),
          })
        : t("unit.history.ownsSince", { name: row.party.displayName, share: share(row.sharePct) }),
      time: formatDate(row.validFrom, locale),
      sort: row.validFrom,
    })),
  ]
    .sort((a, b) => b.sort.localeCompare(a.sort))
    .map(({ sort: _sort, ...event }) => event);

  const facts = [
    { id: "building", term: t(words.group), description: unit.buildingName },
    ...(unit.legalForm
      ? [{ id: "legal", term: t("unit.legalForm"), description: t(`legalForm.${unit.legalForm}`) }]
      : []),
    ...(traits.layout === "plots"
      ? [
          { id: "plot", term: t("plot.plotNo"), description: unit.plotNo },
          {
            id: "land",
            term: t(words.size),
            description: unit.landAreaSqwa
              ? t("unitOf.sqwa", { value: formatDecimal(unit.landAreaSqwa, locale, 2) })
              : null,
          },
        ]
      : [
          {
            id: "area",
            term: t(words.size),
            description: unit.areaSqm ? t("unitOf.sqm", { value: formatDecimal(unit.areaSqm, locale, 2) }) : null,
          },
          ...(traits.ratio
            ? [
                {
                  id: "ratio",
                  term: t(words.share),
                  description: unit.ownershipRatio ? <span className="font-mono">{unit.ownershipRatio}</span> : null,
                },
              ]
            : []),
        ]),
    { id: "deed", term: t("facts.titleDeed"), description: unit.titleDeedNo },
  ];

  return (
    <OwnerPage testId="juristic-register-unit">
      <PageHeader
        title={title}
        status={<StatusBadgeOf map={REGISTER_STATUS} value={unit.incomplete ? "incomplete" : "complete"} />}
        description={t("unit.lede", { group: unit.buildingName, count: unit.owners.length })}
        back={{ label: t("register.title"), href: ownerPath(locale, `/juristic/register?building=${unit.buildingId}`) }}
      />

      <DetailLayout
        panel={
          <ActionPanel
            title={title}
            status={
              <StatusBadgeOf map={REGISTER_STATUS} value={unit.incomplete ? "incomplete" : "complete"} size="sm" />
            }
            facts={[
              { key: "shares", label: t("unit.sharesTotal"), value: share(unit.sharesTotal) },
              { key: "owners", label: t("unit.owners"), value: formatNumber(unit.owners.length, locale) },
              {
                key: "billTo",
                label: t("unit.billTo"),
                value: unit.billTo[0]?.billToParty.displayName ?? t("unit.billToOwners"),
              },
            ]}
            primary={
              canManage && unit.owners.length > 0 ? (
                <Button asChild block iconStart={IconSwap}>
                  <a
                    href={ownerPath(locale, `/juristic/register/${unit.unitId}/transfer`)}
                    data-testid="transfer-start"
                  >
                    {t("transfer.start")}
                  </a>
                </Button>
              ) : undefined
            }
            secondary={
              canManage ? (
                <>
                  <AddOwnerButton unit={unit} parties={partyOptions} />
                  <InviteResidentButton unit={unit} />
                  <EditUnitFactsButton unit={unit} kind={kind} />
                </>
              ) : undefined
            }
          />
        }
      >
        <Card as="section" aria-labelledby="owners-title" className="flex flex-col gap-4" data-testid="unit-owners">
          <CardHeader
            title={<span id="owners-title">{t("unit.ownersTitle")}</span>}
            description={t("unit.ownersHint")}
          />
          <ShareBar
            label={t("shares.barLabel", { unit: unit.unitNo })}
            segments={unit.owners.map((owner) => {
              const part = parseShare(owner.sharePct) ?? 0;
              return {
                key: owner.ownershipId,
                label: owner.party.displayName,
                share: formatShare(owner.sharePct),
                fraction: part / WHOLE,
              };
            })}
            missing={missing > 0 ? t("shares.missing", { value: shareString(missing) }) : undefined}
          />
          {unit.owners.length === 0 ? (
            <p className="text-muted m-0 text-sm">{t("unit.noOwners")}</p>
          ) : (
            <ul className="divide-border m-0 list-none divide-y p-0" data-testid="owner-rows">
              {unit.owners.map((owner) => (
                <li
                  key={owner.ownershipId}
                  className="flex flex-wrap items-start justify-between gap-3 py-3"
                  data-testid="owner-row"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-medium">{owner.party.displayName}</span>
                    <span className="text-muted text-sm">
                      {t("unit.ownerSince", {
                        type: t(`party.type.${owner.party.type}`),
                        date: formatDate(owner.validFrom, locale),
                      })}
                    </span>
                    <ContactLine party={owner.party} />
                  </div>
                  <span className="text-base font-semibold tabular-nums">{share(owner.sharePct)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card as="section" aria-labelledby="bill-to-title" className="flex flex-col gap-3" data-testid="unit-bill-to">
          <CardHeader
            title={<span id="bill-to-title">{t("billTo.title")}</span>}
            description={t("billTo.hint")}
            action={canManage ? <BillToButton unit={unit} parties={partyOptions} /> : undefined}
          />
          {unit.billTo.length === 0 ? (
            <p className="text-muted m-0 text-sm">{t("billTo.none")}</p>
          ) : (
            <ul className="divide-border m-0 list-none divide-y p-0">
              {unit.billTo.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                  data-testid="bill-to-row"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {row.billToParty.displayName}
                      <Badge size="sm" tone="neutral">
                        {t(`billTo.kindName.${row.kind}`)}
                      </Badge>
                    </span>
                    <span className="text-muted text-sm">
                      {t("billTo.forOwner", {
                        owner: ownerName.get(row.ownerPartyId) ?? "—",
                        date: formatDate(row.validFrom, locale),
                      })}
                    </span>
                    {row.consentNote ? <span className="text-muted text-sm">{row.consentNote}</span> : null}
                  </div>
                  <span className="flex flex-wrap items-center gap-2">
                    <DocumentButton
                      document={{ kind: "file", id: row.consentDocumentId }}
                      label={t("billTo.consentOpen")}
                      title={t("billTo.consentTitle", { unit: unit.unitNo })}
                      variant="ghost"
                      testId="bill-to-consent-open"
                    />
                    {canManage ? <EndBillToButton unit={unit} billTo={row} /> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card as="section" aria-labelledby="invites-title" className="flex flex-col gap-3" data-testid="unit-invites">
          <CardHeader title={<span id="invites-title">{t("invite.title")}</span>} description={t("invite.hint")} />
          {!invites.data ? (
            <SectionError error={invites.error} />
          ) : invites.data.length === 0 ? (
            <p className="text-muted m-0 text-sm">{t("invite.none")}</p>
          ) : (
            <ul className="divide-border m-0 list-none divide-y p-0">
              {invites.data.map((invite) => (
                <li
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm"
                  data-testid="invite-row"
                >
                  <span className="flex flex-col">
                    <span>{ownerName.get(invite.partyId) ?? "—"}</span>
                    <span className="text-muted">
                      {t("invite.sent", {
                        channel: t(`invite.channelName.${invite.channel === "email" ? "link" : invite.channel}`),
                        date: formatDate(invite.createdAt, locale),
                        expires: formatDate(invite.expiresAt, locale),
                      })}
                    </span>
                  </span>
                  <StatusBadgeOf map={INVITATION_STATUS} value={invite.state} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card as="section" aria-labelledby="facts-title" className="flex flex-col gap-3" data-testid="unit-facts">
          <CardHeader title={<span id="facts-title">{t("facts.title", { unit: unitWord })}</span>} />
          <DescriptionList items={facts} />
        </Card>

        <Card as="section" aria-labelledby="history-title" className="flex flex-col gap-4" data-testid="unit-history">
          <CardHeader title={<span id="history-title">{t("unit.historyTitle")}</span>} />
          {events.length ? (
            <Timeline events={events} />
          ) : (
            <p className="text-muted m-0 flex items-center gap-2 text-sm">{t("unit.noHistory")}</p>
          )}
        </Card>
      </DetailLayout>
    </OwnerPage>
  );
}

/** One owner's channels in words (masked phone, e-mail, LINE, the LINE Mini App link). */
async function ContactLine({ party }: { party: Schemas["RegisterPartyDto"] }) {
  const t = await getTranslations("owner.juristic.channel");
  const parts = [
    party.phoneMasked ? (
      <span key="phone" className="font-mono">
        {party.phoneMasked}
      </span>
    ) : null,
    party.email ? <span key="email">{party.email}</span> : null,
    party.lineLinked ? <span key="line">{t("line")}</span> : null,
    party.residentLinked ? <span key="app">{t("app")}</span> : null,
  ].filter(Boolean);
  if (parts.length === 0) return <span className="text-muted text-sm">{t("letterOnly")}</span>;
  return <span className="text-muted flex flex-wrap gap-x-3 gap-y-1 text-sm">{parts}</span>;
}

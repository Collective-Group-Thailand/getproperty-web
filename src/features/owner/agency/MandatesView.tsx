import { getTranslations } from "next-intl/server";

import { MANDATE_STATUS } from "@/domain/status/mandate";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatPercent, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconInfo } from "@/ui/icons/glyphs/info";
import { IconSign } from "@/ui/icons/glyphs/sign";

import { ownerPath } from "../shared/links";
import { ownerCan, param, readOnly, section, type OwnerContext } from "../shared/server";
import { AnswerMandate, InviteAgency, StopMandate } from "./MandateActions";
import { RequestCard } from "./RequestCard";

type Mandate = Schemas["MandateDto"];
type Tab = "active" | "past";
const TAB_STATES: Record<Tab, Mandate["state"][]> = {
  active: ["accepted", "active"],
  past: ["ended", "revoked"],
};

type T = Awaited<ReturnType<typeof getTranslations<"owner.agency">>>;

/** "ค่านายหน้า 15,000 บาท" / "% of one month's rent" / none — the API's numbers, formatted (recorded only, D-293). */
export function commissionText(t: T, mandate: Pick<Mandate, "commissionAmount" | "commissionPercent">, locale: Locale) {
  if (mandate.commissionAmount) return t("commission.amount", { amount: formatTHB(mandate.commissionAmount, locale) });
  if (mandate.commissionPercent)
    return t("commission.percent", { percent: formatPercent(mandate.commissionPercent, locale) });
  return t("commission.none");
}

export function validityText(t: T, from: string, to: string | null, locale: Locale) {
  return to
    ? t("validity.range", { from: formatDate(from, locale), to: formatDate(to, locale) })
    : t("validity.open", { from: formatDate(from, locale) });
}

/**
 * Mandates (G2, D-293; G5). An **owner** (landlord) sees the mandates on its units, invites an agency to a unit and
 * revokes with the unit number typed; an **agency** answers invitations and ends mandates it holds. Invitations that
 * wait for an answer come first as request cards; the mandates in force and the ended ones follow as a table. The
 * off-platform commission rule is said once. Access, listings and exclusivity are decided by the API.
 */
export async function MandatesView({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.agency");
  const { api, locale, me } = context;
  const isAgency = me.currentTenant?.type === "agency";
  const role = isAgency ? "agency" : "owner";
  const canManage = !readOnly(me) && ownerCan(me, isAgency ? "listing.manage" : "tenant.grant.manage");
  const [mandates, portfolio] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/mandates", { params: { query: { role } } }))),
    isAgency ? Promise.resolve(null) : section(unwrap(api.GET("/v1/owner/portfolio"))),
  ]);
  const all = mandates.data?.data ?? [];
  const requested = param(searchParams.view);
  const tab: Tab = requested === "past" ? "past" : "active";
  const invited = all.filter((m) => m.state === "invited");
  const shown = all.filter((m) => TAB_STATES[tab].includes(m.state));
  const base = ownerPath(locale, "/mandates");
  const units = (portfolio?.data?.units ?? []).map((u) => ({
    id: u.unitId,
    label: u.kind === "house" || u.kind === "townhouse" ? u.building.name : `${u.building.name} · ${u.unitNo}`,
  }));
  const invite = param(searchParams.invite);
  const party = (mandate: Mandate) => (isAgency ? mandate.ownerName : mandate.agencyName);

  return (
    <OwnerPage testId="mandates">
      <PageHeader
        title={t("mandates.title")}
        description={isAgency ? t("mandates.agencyDescription") : t("mandates.ownerDescription")}
        actions={
          !isAgency && canManage && units.length ? (
            <InviteAgency units={units} defaultUnitId={units.some((u) => u.id === invite) ? invite : undefined} />
          ) : null
        }
      />
      <Callout tone="neutral" icon={IconInfo}>
        {t("outsideMoney")}
      </Callout>
      {!mandates.data ? (
        <SectionError error={mandates.error} />
      ) : (
        <>
          {invited.length ? (
            <section aria-labelledby="mandates-invited" className="flex flex-col gap-3">
              <h2 id="mandates-invited" className="text-lg font-semibold">
                {isAgency ? t("mandates.pendingAgency") : t("mandates.pendingOwner")}
              </h2>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {invited.map((mandate) => {
                  const commission = commissionText(t, mandate, locale);
                  return (
                    <RequestCard
                      key={mandate.id}
                      testId="mandate-row"
                      data={{ state: mandate.state, "unit-no": mandate.unitNo }}
                      title={t("mandates.unit", { unitNo: mandate.unitNo })}
                      subtitle={mandate.buildingName}
                      status={<StatusBadgeOf map={MANDATE_STATUS} value={mandate.state} size="sm" />}
                      facts={[
                        {
                          key: "party",
                          label: isAgency ? t("deals.owner") : t("mandates.fields.agency"),
                          value: party(mandate),
                        },
                        {
                          key: "scope",
                          label: t("mandates.fields.scope"),
                          value: `${t(`scope.${mandate.scope}`)} · ${mandate.exclusive ? t("exclusive") : t("nonExclusive")}`,
                        },
                        {
                          key: "commission",
                          label: t("columns.commission"),
                          value: mandate.commissionTerms ? `${commission} · ${mandate.commissionTerms}` : commission,
                        },
                        {
                          key: "validity",
                          label: t("columns.validity"),
                          value: validityText(t, mandate.validFrom, mandate.validTo, locale),
                        },
                      ]}
                      actions={
                        canManage ? (
                          isAgency ? (
                            <AnswerMandate
                              stacked
                              mandate={mandate}
                              summary={t("mandates.acceptBody", {
                                scope: t(`scope.${mandate.scope}`),
                                exclusive: mandate.exclusive ? t("exclusive") : t("nonExclusive"),
                                commission,
                                owner: mandate.ownerName,
                              })}
                            />
                          ) : (
                            <StopMandate mandate={mandate} mode="revoke" />
                          )
                        ) : null
                      }
                    />
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="mandates-list" className="flex flex-col gap-3">
            <h2 id="mandates-list" className="sr-only">
              {t("mandates.title")}
            </h2>
            <ListToolbar
              tabs={
                <ViewTabs
                  label={t("mandates.title")}
                  current={tab}
                  tabs={(["active", "past"] as const).map((key) => ({
                    key,
                    href: `${base}?view=${key}`,
                    label: t(`mandates.tabs.${key}`),
                    count: key === "past" ? undefined : shownCount(all, key),
                    testId: `mandates-tab-${key}`,
                  }))}
                />
              }
            />
            {shown.length === 0 ? (
              <EmptyState
                variant="card"
                icon={IconSign}
                title={t(`mandates.empty.${tab}`)}
                description={!isAgency && tab === "active" ? t("mandates.emptyOwnerHint") : undefined}
                action={
                  tab === "past" ? (
                    <Button asChild variant="secondary">
                      <a href={`${base}?view=active`}>{t("mandates.toActive")}</a>
                    </Button>
                  ) : isAgency ? (
                    <Button asChild variant="secondary">
                      <a href={ownerPath(locale, "/mandated-units")}>{t("units.title")}</a>
                    </Button>
                  ) : (
                    <Button asChild variant="secondary">
                      <a href={ownerPath(locale, "/portfolio")}>{t("mandates.toPortfolio")}</a>
                    </Button>
                  )
                }
              />
            ) : (
              <SimpleTable
                caption={t(`mandates.tabs.${tab}`)}
                testId="mandate-rows"
                stackOnPhones
                minWidth="56rem"
                columns={[
                  { key: "unit", header: t("columns.unit"), phone: "title" },
                  { key: "party", header: isAgency ? t("deals.owner") : t("mandates.fields.agency"), phone: "meta" },
                  { key: "scope", header: t("mandates.fields.scope"), phone: "hidden" },
                  { key: "commission", header: t("columns.commission"), align: "end", phone: "figure" },
                  { key: "validity", header: t("columns.validity"), phone: "meta" },
                  { key: "state", header: t("columns.state"), phone: "status" },
                  { key: "actions", header: <span className="sr-only">{t("columns.actions")}</span>, align: "end" },
                ]}
                rows={shown.map((mandate) => ({
                  key: mandate.id,
                  testId: "mandate-row",
                  data: { state: mandate.state, "unit-no": mandate.unitNo },
                  cells: {
                    unit: (
                      <span className="flex flex-col">
                        <span className="font-medium">{t("mandates.unit", { unitNo: mandate.unitNo })}</span>
                        <span className="text-muted text-sm">{mandate.buildingName}</span>
                      </span>
                    ),
                    party: party(mandate),
                    scope: (
                      <span className="flex flex-wrap items-center gap-1.5">
                        {t(`scope.${mandate.scope}`)}
                        {mandate.exclusive ? (
                          <Badge tone="primary" size="sm">
                            {t("exclusive")}
                          </Badge>
                        ) : null}
                      </span>
                    ),
                    commission: mandate.commissionAmount
                      ? formatTHB(mandate.commissionAmount, locale)
                      : mandate.commissionPercent
                        ? t("commission.percentShort", { percent: formatPercent(mandate.commissionPercent, locale) })
                        : t("commission.noneShort"),
                    validity: (
                      <span className="flex flex-col">
                        {validityText(t, mandate.validFrom, mandate.validTo, locale)}
                        {mandate.endReason ? (
                          <span className="text-muted text-sm">
                            {t("mandates.reasonShown", { reason: mandate.endReason })}
                          </span>
                        ) : null}
                      </span>
                    ),
                    state: <StatusBadgeOf map={MANDATE_STATUS} value={mandate.state} size="sm" />,
                    actions: canManage ? (
                      <MandateRowActions mandate={mandate} t={t} locale={locale} isAgency={isAgency} />
                    ) : null,
                  },
                }))}
              />
            )}
          </section>
        </>
      )}
    </OwnerPage>
  );
}

function shownCount(all: Mandate[], tab: Tab) {
  return all.filter((m) => TAB_STATES[tab].includes(m.state)).length;
}

function MandateRowActions({
  mandate,
  t,
  locale,
  isAgency,
}: {
  mandate: Mandate;
  t: T;
  locale: Locale;
  isAgency: boolean;
}) {
  const held = mandate.state === "accepted" || mandate.state === "active";
  return (
    <span className="flex justify-end gap-2">
      {mandate.contractDocumentId ? (
        <Button asChild variant="secondary" size="sm" iconStart={IconSign}>
          <a
            href={ownerPath(locale, `/contracts/documents/${mandate.contractDocumentId}`)}
            data-testid="mandate-contract"
          >
            {t("contract.open")}
          </a>
        </Button>
      ) : !isAgency && held ? (
        <Button asChild variant="secondary" size="sm" iconStart={IconSign}>
          <a
            href={ownerPath(locale, `/contracts/documents?new=brokerage_mandate&mandate=${mandate.id}`)}
            data-testid="mandate-write-contract"
          >
            {t("contract.writeMandate")}
          </a>
        </Button>
      ) : null}
      {!isAgency && held ? <StopMandate mandate={mandate} mode="revoke" /> : null}
      {isAgency && held ? <StopMandate mandate={mandate} mode="end" /> : null}
    </span>
  );
}

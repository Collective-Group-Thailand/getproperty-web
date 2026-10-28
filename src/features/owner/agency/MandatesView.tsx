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
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { IconSign } from "@/ui/icons/glyphs/sign";

import { ownerPath } from "../shared/links";
import { ownerCan, param, readOnly, section, type OwnerContext } from "../shared/server";
import { AnswerMandate, InviteAgency, StopMandate } from "./MandateActions";

type Mandate = Schemas["MandateDto"];
type Tab = "invited" | "active" | "past";
const TAB_STATES: Record<Tab, Mandate["state"][]> = {
  invited: ["invited"],
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
 * Mandates (G2, D-293). An **owner** (landlord) sees the mandates on its units, invites an agency to a unit and revokes
 * with the unit number typed; an **agency** answers invitations and ends mandates it holds. Access, listings and
 * exclusivity are decided by the API; the page shows its states and refusals.
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
  const tab: Tab =
    requested === "invited" || requested === "active" || requested === "past"
      ? requested
      : isAgency && all.some((m) => m.state === "invited")
        ? "invited"
        : "active";
  const shown = all.filter((m) => TAB_STATES[tab].includes(m.state));
  const base = ownerPath(locale, "/mandates");
  const units = (portfolio?.data?.units ?? []).map((u) => ({
    id: u.unitId,
    label: u.kind === "house" || u.kind === "townhouse" ? u.building.name : `${u.building.name} · ${u.unitNo}`,
  }));
  const invite = param(searchParams.invite);

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
      <Callout tone="info">{t("outsideMoney")}</Callout>
      <LinkTabs
        label={t("mandates.title")}
        current={`${base}?view=${tab}`}
        tabs={(["invited", "active", "past"] as const).map((key) => ({
          href: `${base}?view=${key}`,
          label: t(`mandates.tabs.${key}`),
          count: key === "past" ? undefined : all.filter((m) => TAB_STATES[key].includes(m.state)).length,
          testId: `mandates-tab-${key}`,
        }))}
      />
      {!mandates.data ? (
        <SectionError error={mandates.error} />
      ) : shown.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={IconSign}
            title={t(`mandates.empty.${tab}`)}
            description={!isAgency && tab === "active" ? t("mandates.emptyOwnerHint") : undefined}
          />
        </Card>
      ) : (
        <Card padding="none">
          <ul className="divide-border m-0 list-none divide-y p-0" data-testid="mandate-rows">
            {shown.map((mandate) => (
              <MandateRow
                key={mandate.id}
                mandate={mandate}
                t={t}
                locale={locale}
                isAgency={isAgency}
                canManage={canManage}
              />
            ))}
          </ul>
        </Card>
      )}
    </OwnerPage>
  );
}

function MandateRow({
  mandate,
  t,
  locale,
  isAgency,
  canManage,
}: {
  mandate: Mandate;
  t: T;
  locale: Locale;
  isAgency: boolean;
  canManage: boolean;
}) {
  const commission = commissionText(t, mandate, locale);
  const exclusive = mandate.exclusive ? t("exclusive") : t("nonExclusive");
  const held = mandate.state === "accepted" || mandate.state === "active";
  return (
    <li
      className="flex flex-wrap items-start justify-between gap-4 px-4 py-4 md:px-5"
      data-testid="mandate-row"
      data-state={mandate.state}
      data-unit-no={mandate.unitNo}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{t("mandates.unit", { unitNo: mandate.unitNo })}</span>
          <span className="text-muted text-sm">{mandate.buildingName}</span>
          <StatusBadgeOf map={MANDATE_STATUS} value={mandate.state} size="sm" />
          {mandate.exclusive ? (
            <Badge tone="primary" size="sm">
              {t("exclusive")}
            </Badge>
          ) : null}
        </span>
        <span className="text-sm">
          {isAgency
            ? t("mandates.owner", { name: mandate.ownerName })
            : t("mandates.agency", { name: mandate.agencyName })}
          {" · "}
          {t(`scope.${mandate.scope}`)}
        </span>
        <span className="text-muted text-sm">
          {commission}
          {mandate.commissionTerms ? ` · ${mandate.commissionTerms}` : ""}
        </span>
        <span className="text-muted text-sm">{validityText(t, mandate.validFrom, mandate.validTo, locale)}</span>
        {mandate.endReason ? (
          <span className="text-muted text-sm">{t("mandates.reasonShown", { reason: mandate.endReason })}</span>
        ) : null}
      </div>
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          {isAgency && mandate.state === "invited" ? (
            <AnswerMandate
              mandate={mandate}
              summary={t("mandates.acceptBody", {
                scope: t(`scope.${mandate.scope}`),
                exclusive,
                commission,
                owner: mandate.ownerName,
              })}
            />
          ) : null}
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
          {!isAgency && (held || mandate.state === "invited") ? <StopMandate mandate={mandate} mode="revoke" /> : null}
          {isAgency && held ? <StopMandate mandate={mandate} mode="end" /> : null}
        </div>
      ) : null}
    </li>
  );
}

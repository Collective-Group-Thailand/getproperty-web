import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { UNIT_STATUS } from "@/domain/status/unit";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatNumber, formatPercent, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconRoom } from "@/ui/icons/glyphs/room";
import { IconSettings } from "@/ui/icons/glyphs/settings";
import { IconTag } from "@/ui/icons/glyphs/tag";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";
import { IconUpload } from "@/ui/icons/glyphs/upload";
import { IconStar } from "@/ui/icons/glyphs/star";

import { ownerPath } from "../shared/links";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { section, type OwnerContext } from "../shared/server";
import { SettingValue } from "../shared/SettingValue";
import { EnergyInsightCard } from "./EnergyInsightCard";
import { NewFloorButton, NewUtilityAccountButton, RemoveUtilityAccountButton } from "./forms";

/** Billing-cycle and reading-policy settings shown on a building (their editor is F2 2.6). */
const BUILDING_SETTINGS = [
  "billing.cutoff",
  "billing.reading_grace_hours",
  "billing.estimate_policy",
  "billing.auto_issue",
  "billing.default_due_day",
  "readings.require_photo",
] as const;

/** One building (F2 2.1): its address, floors, utility accounts, billing settings, VAT status and unit types. */
export async function BuildingDetail({ context, buildingId }: { context: OwnerContext; buildingId: string }) {
  const t = await getTranslations("owner.buildings.detail");
  const types = await getTranslations("owner.buildings");
  const provider = await getTranslations("owner.common.provider");
  const { api, locale } = context;
  let building: Schemas["BuildingDto"];
  try {
    building = await unwrap(api.GET("/v1/owner/buildings/{buildingId}", { params: { path: { buildingId } } }));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const path = { params: { path: { buildingId } } };
  const [board, floors, accounts, profiles, settings, tenant] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/buildings/{buildingId}/board", path))),
    section(unwrap(api.GET("/v1/owner/buildings/{buildingId}/floors", path))),
    section(unwrap(api.GET("/v1/owner/buildings/{buildingId}/utility-accounts", path))),
    section(unwrap(api.GET("/v1/owner/buildings/{buildingId}/unit-profiles", path))),
    section(unwrap(api.GET("/v1/owner/settings", { params: { query: { propertyId: building.propertyId } } }))),
    section(unwrap(api.GET("/v1/owner/tenant"))),
  ]);
  const property = context.properties.find((candidate) => candidate.id === building.propertyId);
  const address = property?.address;
  const readOnly = building.access === "grant";
  const href = (suffix: string) => ownerPath(locale, `/buildings/${building.id}${suffix}`);
  const summary = board.data?.summary;

  return (
    <OwnerPage testId="building-detail">
      <PageHeader
        title={building.name}
        testId="building-title"
        crumbs={[{ label: building.name }]}
        description={[property?.name, types(`type.${building.type}`), building.code].filter(Boolean).join(" · ")}
        status={
          building.access !== "operator" ? (
            <Badge tone="info" size="sm">
              {types(`access.${building.access}`)}
            </Badge>
          ) : undefined
        }
        actions={
          <>
            <Button asChild iconStart={IconRoom}>
              <a href={ownerPath(locale, `/units?building=${building.id}`)} data-testid="open-board">
                {t("board")}
              </a>
            </Button>
            {readOnly ? null : (
              <>
                {/* G5 (D-297): the building boost — every public listing of this tenant in the building. */}
                <Button asChild variant="secondary" iconStart={IconMegaphone}>
                  <a href={ownerPath(locale, "/promote#building-boost")} data-testid="open-promote">
                    {t("promote")}
                  </a>
                </Button>
                {/* G9 (D-301): verified reviews of this building (reply / report). */}
                <Button asChild variant="secondary" iconStart={IconStar}>
                  <a href={ownerPath(locale, `/reviews?building=${building.id}`)} data-testid="open-reviews">
                    {t("reviews")}
                  </a>
                </Button>
                <Button asChild variant="secondary" iconStart={IconUpload}>
                  <a href={href("/import")} data-testid="open-import">
                    {t("import")}
                  </a>
                </Button>
                <Button asChild variant="secondary" iconStart={IconAdd}>
                  <a href={href("/units/new")} data-testid="open-bulk">
                    {t("bulk")}
                  </a>
                </Button>
              </>
            )}
          </>
        }
      />

      {summary ? (
        <section aria-label={t("summary")} className="flex flex-wrap gap-2" data-testid="building-summary">
          <Badge tone="neutral">{t("units", { count: summary.total })}</Badge>
          {(["occupied", "vacant", "reserved", "maintenance", "inactive"] as const).map((status) =>
            summary[status] > 0 ? (
              <span key={status} className="inline-flex items-center gap-1">
                <StatusBadgeOf map={UNIT_STATUS} value={status} size="sm" />
                <span className="tabular-nums">{formatNumber(summary[status], locale)}</span>
              </span>
            ) : null,
          )}
          <Badge tone="primary">{t("occupancy", { pct: formatPercent(summary.occupancyPct, locale, 1) })}</Badge>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card as="section" aria-labelledby="b-address">
          <CardHeader title={<span id="b-address">{t("address")}</span>} />
          <DescriptionList
            items={[
              {
                id: "address",
                term: t("address"),
                wide: true,
                description: address
                  ? [
                      address.line1,
                      address.line2,
                      address.subdistrict,
                      address.district,
                      address.province,
                      address.postcode,
                    ]
                      .filter(Boolean)
                      .join(" ")
                  : null,
              },
              { id: "type", term: t("type"), description: types(`type.${building.type}`) },
              { id: "floors", term: t("floorsCount"), description: building.floorsCount ?? null },
              {
                id: "vat",
                term: t("vat"),
                description: tenant.data ? (
                  <span data-testid="vat-status">{tenant.data.vatRegistered ? t("vatYes") : t("vatNo")}</span>
                ) : null,
              },
              { id: "access", term: t("access"), description: types(`access.${building.access}`) },
            ]}
          />
        </Card>

        <Card as="section" aria-labelledby="b-settings" data-testid="building-settings">
          <CardHeader
            title={<span id="b-settings">{t("settings")}</span>}
            description={t("settingsHint")}
            action={
              <Button asChild size="sm" variant="secondary" iconStart={IconSettings}>
                <a href={ownerPath(locale, `/settings?property=${building.propertyId}`)}>{t("changeSettings")}</a>
              </Button>
            }
          />
          {settings.data ? (
            <DescriptionList
              columns={1}
              items={BUILDING_SETTINGS.flatMap((key) => {
                const setting = settings.data!.find((candidate) => candidate.key === key);
                return setting
                  ? [
                      {
                        id: key,
                        term: t(`setting.${key.replace(/\./g, "_")}`),
                        description: <SettingValue setting={setting} locale={locale} />,
                      },
                    ]
                  : [];
              })}
            />
          ) : (
            <p className="text-muted text-sm">{t("settingsUnavailable")}</p>
          )}
        </Card>

        <Card as="section" aria-labelledby="b-floors" data-testid="building-floors">
          <CardHeader
            title={<span id="b-floors">{t("floors")}</span>}
            action={readOnly ? undefined : <NewFloorButton buildingId={building.id} />}
          />
          {floors.data && floors.data.length > 0 ? (
            <ul className="divide-border divide-y">
              {floors.data.map((floor) => (
                <li key={floor.id} className="flex items-center justify-between py-2" data-testid="floor-row">
                  <span>{floor.name}</span>
                  <span className="text-muted text-sm tabular-nums">{t("units", { count: floor.unitCount })}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted text-sm">{t("noFloors")}</p>
          )}
        </Card>

        <Card as="section" aria-labelledby="b-accounts" data-testid="utility-accounts">
          <CardHeader
            title={<span id="b-accounts">{t("accounts")}</span>}
            description={t("accountsHint")}
            action={readOnly ? undefined : <NewUtilityAccountButton buildingId={building.id} />}
          />
          {accounts.data && accounts.data.length > 0 ? (
            <ul className="divide-border divide-y">
              {accounts.data.map((account) => (
                <li
                  key={account.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                  data-testid="account-row"
                >
                  <span className="flex flex-col">
                    <span className="font-medium">{account.label}</span>
                    <span className="text-muted text-sm">
                      {provider(account.provider)} · <span className="font-mono">{account.customerNo}</span>
                      {account.meterNo ? ` · ${account.meterNo}` : ""}
                    </span>
                  </span>
                  {readOnly ? null : <RemoveUtilityAccountButton account={account} />}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted text-sm">{t("noAccounts")}</p>
          )}
        </Card>

        <Card as="section" aria-labelledby="b-profiles" className="lg:col-span-2" data-testid="building-profiles">
          <CardHeader
            title={<span id="b-profiles">{t("profiles")}</span>}
            description={t("profilesHint")}
            action={
              <Button asChild size="sm" variant="secondary" iconStart={IconTag}>
                <a href={href("/unit-profiles")} data-testid="open-profiles">
                  {t("editProfiles")}
                </a>
              </Button>
            }
          />
          {profiles.data && profiles.data.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {profiles.data.map((profile) => (
                <li key={profile.id} className="rounded-control border-border border p-3">
                  <p className="font-medium">{profile.name}</p>
                  <p className="text-muted text-sm tabular-nums">
                    {t("profileRent", { rent: formatTHB(profile.defaultRent, locale) })}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted text-sm">{t("noProfiles")}</p>
          )}
        </Card>
      </div>

      {/* G9 (D-301): the building's energy score and the owner's choice to share it with getenergy. */}
      <EnergyInsightCard api={api} buildingId={building.id} locale={locale} />
    </OwnerPage>
  );
}

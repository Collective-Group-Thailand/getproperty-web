import { getTranslations } from "next-intl/server";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { unwrap, unwrapWithETag } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { ownerPath } from "../shared/links";
import { PhotoThumb } from "../shared/PhotoThumb";
import { ownerCan, param, readOnly, section, type OwnerContext } from "../shared/server";
import { SettingValue } from "../shared/SettingValue";
import { EditCompany, LogoUpload } from "./CompanyActions";
import { OwnerSettingEditor } from "./OwnerSettingEditor";
import { SettingHistory } from "./SettingHistory";
import { SettingsNav } from "./SettingsNav";

/** Sections of the tenant's settings, by key prefix, in the order an operator sets a building up. */
const GROUPS: { id: string; prefixes: string[] }[] = [
  { id: "billing", prefixes: ["billing.", "invoice."] },
  { id: "collections", prefixes: ["reminders.", "payments.", "late_fee."] },
  { id: "notifications", prefixes: ["notifications."] },
  { id: "readings", prefixes: ["readings.", "health."] },
  { id: "deposits", prefixes: ["deposit."] },
  { id: "access", prefixes: ["access."] },
  { id: "compliance", prefixes: ["compliance.", "tenant.", "tax.", "etax.", "tm30."] },
];
/** Property-level settings the building page links to (D-031: billing cycle, cut-off, grace). */
const PROPERTY_FIRST = [
  "billing.cutoff",
  "billing.reading_grace_hours",
  "billing.estimate_policy",
  "billing.auto_issue",
];

function groupOf(key: string): string {
  return GROUPS.find((group) => group.prefixes.some((prefix) => key.startsWith(prefix)))?.id ?? "other";
}

async function SettingsTable({
  settings,
  context,
  propertyId,
  testId,
}: {
  settings: Schemas["SettingDto"][];
  context: OwnerContext;
  propertyId?: string;
  testId: string;
}) {
  const t = await getTranslations("owner.settings");
  const { locale, me } = context;
  const label = (key: string) => {
    const id = `key.${key.replaceAll(".", "_")}`;
    return t.has(id) ? t(id) : key;
  };
  const scope: Schemas["SettingScope"] = propertyId ? "property" : "tenant";
  return (
    <SimpleTable
      caption={t("general.title")}
      testId={testId}
      minWidth="44rem"
      columns={[
        { key: "setting", header: t("col.setting") },
        { key: "value", header: t("col.value") },
        { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
      ]}
      rows={settings.map((setting) => ({
        key: setting.key,
        testId: "setting-row",
        data: { key: setting.key, scope: setting.scope },
        cells: {
          setting: (
            <span className="flex max-w-md flex-col">
              <span className="font-medium">{label(setting.key)}</span>
              <span className="text-muted text-xs">{setting.description}</span>
            </span>
          ),
          value: (
            <span className="flex flex-col gap-1">
              <SettingValue setting={setting} locale={locale} />
              {propertyId && setting.scope !== "property" ? <Badge size="sm">{t("inherited")}</Badge> : null}
            </span>
          ),
          actions: (
            <span className="flex flex-wrap justify-end gap-1">
              <SettingHistory setting={setting} label={label(setting.key)} propertyId={propertyId} />
              {setting.editable && setting.scopeAllowed.includes(scope) && !readOnly(me) ? (
                <OwnerSettingEditor setting={setting} label={label(setting.key)} propertyId={propertyId} />
              ) : null}
            </span>
          ),
        },
      }))}
    />
  );
}

/**
 * Settings (F2 2.6, ADR-0004): the company data printed on documents with the logo and the VAT flag,
 * the tenant's settings in force — billing, reminders and partial payments, quiet hours, readings and
 * their photo rule, deposits and compliance — each with its scope and the date it took effect, and
 * the building (property) settings — billing cycle, cut-off, grace — for `?property=`. Every change is
 * a new effective-dated version with a reason; nothing here is a default of the UI.
 */
export async function SettingsView({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.settings");
  const { api, locale, me, properties } = context;
  const propertyId =
    properties.find((property) => property.id === param(searchParams.property))?.id ?? properties[0]?.id;
  const [tenant, settings, propertySettings] = await Promise.all([
    section(unwrapWithETag(api.GET("/v1/owner/tenant"))),
    section(unwrap(api.GET("/v1/owner/settings"))),
    propertyId
      ? section(unwrap(api.GET("/v1/owner/settings", { params: { query: { propertyId } } })))
      : Promise.resolve(null),
  ]);
  const canEditCompany = ownerCan(me, "tenant.update") && !readOnly(me);
  const profile = tenant.data?.data ?? null;
  const address = profile?.address
    ? [
        profile.address.line1,
        profile.address.line2,
        profile.address.subdistrict,
        profile.address.district,
        profile.address.province,
        profile.address.postcode,
      ]
        .filter(Boolean)
        .join(" ")
    : null;
  const grouped = new Map<string, Schemas["SettingDto"][]>();
  for (const setting of settings.data ?? [])
    grouped.set(groupOf(setting.key), [...(grouped.get(groupOf(setting.key)) ?? []), setting]);
  const propertyRows = (propertySettings?.data ?? [])
    .filter((setting) => setting.scopeAllowed.includes("property"))
    .sort((a, b) => {
      const ia = PROPERTY_FIRST.indexOf(a.key);
      const ib = PROPERTY_FIRST.indexOf(b.key);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.key.localeCompare(b.key);
    });

  return (
    <OwnerPage testId="settings">
      <PageHeader title={t("general.title")} description={t("general.description")} />
      <SettingsNav me={me} current="/settings" locale={locale} />

      <Card as="section" aria-labelledby="settings-company" data-testid="company">
        <CardHeader
          title={<span id="settings-company">{t("company.title")}</span>}
          description={t("company.description")}
          action={
            profile && canEditCompany ? <EditCompany tenant={profile} etag={tenant.data?.etag ?? null} /> : undefined
          }
        />
        {!profile ? (
          <SectionError error={tenant.error} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
            <DescriptionList
              columns={2}
              items={[
                { id: "displayName", term: t("company.displayName"), description: profile.displayName },
                { id: "legalName", term: t("company.legalName"), description: profile.legalName },
                { id: "legalForm", term: t("company.legalForm"), description: t(`company.form.${profile.legalForm}`) },
                { id: "taxId", term: t("company.taxId"), description: profile.taxId },
                {
                  id: "vat",
                  term: t("company.vat"),
                  description: (
                    <span data-testid="company-vat-value">
                      {profile.vatRegistered ? t("company.vatYes") : t("company.vatNo")}
                    </span>
                  ),
                },
                {
                  id: "language",
                  term: t("company.language"),
                  description: t(`company.languageName.${profile.defaultLanguage === "en" ? "en" : "th"}`),
                },
                { id: "address", term: t("company.address"), description: address, wide: true },
              ]}
            />
            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium">{t("company.logo")}</span>
              {profile.logoDocumentId ? (
                <PhotoThumb
                  fileId={profile.logoDocumentId}
                  alt={t("company.logoAlt", { name: profile.displayName })}
                  size="lg"
                />
              ) : (
                <p className="text-muted text-sm" data-testid="no-logo">
                  {t("company.noLogo")}
                </p>
              )}
              {canEditCompany ? <LogoUpload etag={tenant.data?.etag ?? null} /> : null}
            </div>
          </div>
        )}
      </Card>

      {readOnly(me) ? (
        <Callout tone="warning" title={t("readOnlyTitle")}>
          {t("readOnlyBody")}
        </Callout>
      ) : null}

      {!settings.data ? (
        <SectionError error={settings.error} />
      ) : (
        [...GROUPS.map((group) => group.id), "other"]
          .filter((id) => grouped.has(id))
          .map((id) => (
            <section
              key={id}
              aria-labelledby={`settings-${id}`}
              className="flex flex-col gap-3"
              data-testid={`settings-${id}`}
            >
              <h2 id={`settings-${id}`} className="text-lg font-semibold">
                {t(`group.${id}`)}
              </h2>
              <SettingsTable settings={grouped.get(id)!} context={context} testId={`settings-table-${id}`} />
            </section>
          ))
      )}

      <Card as="section" aria-labelledby="settings-property" data-testid="property-settings">
        <CardHeader
          title={<span id="settings-property">{t("property.title")}</span>}
          description={t("property.description")}
        />
        {properties.length === 0 ? (
          <p className="text-muted">{t("property.none")}</p>
        ) : (
          <>
            {properties.length > 1 ? (
              <nav aria-label={t("property.pick")} className="mb-4 flex flex-wrap gap-2">
                {properties.map((property) => (
                  <a
                    key={property.id}
                    href={ownerPath(locale, `/settings?property=${property.id}`)}
                    aria-current={property.id === propertyId ? "page" : undefined}
                    className="border-border rounded-control aria-[current=page]:border-primary aria-[current=page]:bg-primary-subtle border px-3 py-1 text-sm"
                    data-testid="property-pick"
                  >
                    {property.name}
                  </a>
                ))}
              </nav>
            ) : null}
            {!propertySettings?.data ? (
              <SectionError error={propertySettings?.error} />
            ) : (
              <SettingsTable
                settings={propertyRows}
                context={context}
                propertyId={propertyId}
                testId="settings-table-property"
              />
            )}
          </>
        )}
      </Card>
    </OwnerPage>
  );
}

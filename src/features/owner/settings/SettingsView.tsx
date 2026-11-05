import { getTranslations } from "next-intl/server";

import { SectionError } from "@/features/shared/console/SectionError";
import { unwrap, unwrapWithETag } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { EmptyState } from "@/ui/components/EmptyState";
import { ViewTabs } from "@/ui/components/ListToolbar";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";

import { ownerPath } from "../shared/links";
import { PhotoThumb } from "../shared/PhotoThumb";
import { ownerCan, param, readOnly, section, type OwnerContext } from "../shared/server";
import { SettingSource, SettingValue } from "../shared/SettingValue";
import { EditCompany, LogoUpload } from "./CompanyActions";
import { OwnerSettingEditor } from "./OwnerSettingEditor";
import { SettingHistory } from "./SettingHistory";
import { SettingsCard, SettingsFrame } from "./SettingsNav";

/** Sections of the tenant's settings, by key prefix, in the order an operator sets a building up. */
const GROUPS: { id: string; prefixes: string[] }[] = [
  { id: "billing", prefixes: ["billing.", "invoice."] },
  { id: "collections", prefixes: ["reminders.", "payments.", "late_fee."] },
  { id: "notifications", prefixes: ["notifications.", "analytics."] },
  { id: "readings", prefixes: ["readings.", "health."] },
  { id: "deposits", prefixes: ["deposit."] },
  { id: "access", prefixes: ["access.", "viewing."] },
  { id: "gate", prefixes: ["gate."] },
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

/** The message id of a setting's name / explanation (`billing.cutoff` → `key.billing_cutoff`). */
const messageId = (prefix: "key" | "desc", key: string) => `${prefix}.${key.replaceAll(".", "_")}`;

/**
 * The rules of one card: each row its name, what it does, where the value comes from and since when, the value in
 * words with its unit, then "เปลี่ยน" (a new effective-dated version with a reason) and its history. A key this page
 * has no name for is left out rather than shown as a code.
 */
export async function SettingRows({
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
  const scope: Schemas["SettingScope"] = propertyId ? "property" : "tenant";
  const named = settings.filter((setting) => t.has(messageId("key", setting.key)));
  return (
    <ul className="divide-border divide-y" data-testid={testId}>
      {named.map((setting) => {
        const label = t(messageId("key", setting.key) as never);
        const editable = setting.editable && setting.scopeAllowed.includes(scope) && !readOnly(me);
        return (
          <li
            key={setting.key}
            className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-start md:justify-between md:gap-8 md:px-6"
            data-testid="setting-row"
            data-key={setting.key}
            data-scope={setting.scope}
          >
            <div className="flex max-w-md min-w-0 flex-col gap-0.5">
              <span className="font-medium">{label}</span>
              {t.has(messageId("desc", setting.key)) ? (
                <span className="text-muted text-sm text-pretty">{t(messageId("desc", setting.key) as never)}</span>
              ) : null}
              <span className="text-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <SettingSource setting={setting} locale={locale} className="" />
                {propertyId && setting.scope !== "property" ? <Badge size="sm">{t("inherited")}</Badge> : null}
                {!setting.editable ? <span>· {t("platformOnly")}</span> : null}
              </span>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 md:justify-end">
              <span className="font-semibold tabular-nums md:text-end">
                <SettingValue setting={setting} locale={locale} withSource={false} />
              </span>
              <span className="flex items-center gap-1">
                {editable ? <OwnerSettingEditor setting={setting} label={label} propertyId={propertyId} /> : null}
                <SettingHistory setting={setting} label={label} propertyId={propertyId} />
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Settings › General (F2 2.6, ADR-0004; redesign G6): the company data printed on documents with the logo and the VAT
 * flag, then the tenant's rules in numbered cards — billing, reminders and payments, quiet hours, readings, deposits,
 * doors, tax — each with where its value comes from and since when, and the building (property) rules for `?property=`.
 * Every change is a new effective-dated version with a reason; nothing here is a default of the UI.
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
  const groups = [...GROUPS.map((group) => group.id), "other"].filter((id) => grouped.has(id));
  const propertyRows = (propertySettings?.data ?? [])
    .filter((setting) => setting.scopeAllowed.includes("property"))
    .sort((a, b) => {
      const ia = PROPERTY_FIRST.indexOf(a.key);
      const ib = PROPERTY_FIRST.indexOf(b.key);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.key.localeCompare(b.key);
    });
  const nav = await getTranslations("owner.settings.nav");

  return (
    <SettingsFrame
      me={me}
      locale={locale}
      current="/settings"
      title={nav("settings")}
      description={t("general.description")}
      index={param(searchParams.section) !== "general" && !param(searchParams.property)}
      testId="settings"
    >
      {readOnly(me) ? (
        <Callout tone="warning" title={t("readOnlyTitle")}>
          {t("readOnlyBody")}
        </Callout>
      ) : null}

      <SettingsCard
        number={1}
        id="settings-company"
        testId="company"
        title={t("company.title")}
        description={t("company.description")}
        action={
          profile && canEditCompany ? <EditCompany tenant={profile} etag={tenant.data?.etag ?? null} /> : undefined
        }
      >
        {!profile ? (
          <SectionError error={tenant.error} />
        ) : (
          <div className="flex flex-col gap-5">
            <DescriptionList
              layout="rows"
              items={[
                { id: "displayName", term: t("company.displayName"), description: profile.displayName },
                { id: "legalName", term: t("company.legalName"), description: profile.legalName },
                { id: "legalForm", term: t("company.legalForm"), description: t(`company.form.${profile.legalForm}`) },
                {
                  id: "taxId",
                  term: t("company.taxId"),
                  description: <span className="tabular-nums">{profile.taxId}</span>,
                },
                {
                  id: "vat",
                  term: t("company.vat"),
                  description: profile.vatRegistered ? (
                    <Badge tone="success" icon={IconCheckCircle}>
                      <span data-testid="company-vat-value">{t("company.vatYes")}</span>
                    </Badge>
                  ) : (
                    <span data-testid="company-vat-value">{t("company.vatNo")}</span>
                  ),
                },
                {
                  id: "language",
                  term: t("company.language"),
                  description: t(`company.languageName.${profile.defaultLanguage === "en" ? "en" : "th"}`),
                },
                { id: "address", term: t("company.address"), description: address },
              ]}
            />
            <div className="border-border flex flex-col gap-3 border-t pt-5 sm:grid sm:grid-cols-[minmax(9rem,14rem)_minmax(0,1fr)] sm:gap-6">
              <span className="text-muted text-sm sm:text-base">{t("company.logo")}</span>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                {profile.logoDocumentId ? (
                  <PhotoThumb
                    fileId={profile.logoDocumentId}
                    alt={t("company.logoAlt", { name: profile.displayName })}
                    size="lg"
                  />
                ) : (
                  <p className="text-muted text-sm sm:hidden" data-testid="no-logo">
                    {t("company.noLogo")}
                  </p>
                )}
                {canEditCompany ? (
                  <div className="w-full max-w-sm">
                    <LogoUpload etag={tenant.data?.etag ?? null} />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </SettingsCard>

      {!settings.data ? (
        <SectionError error={settings.error} />
      ) : (
        groups.map((id, index) => (
          <SettingsCard
            key={id}
            number={index + 2}
            id={`settings-${id}-title`}
            testId={`settings-${id}`}
            title={t(`group.${id}` as never)}
            description={t.has(`groupHint.${id}`) ? t(`groupHint.${id}` as never) : undefined}
            flush
          >
            <SettingRows settings={grouped.get(id)!} context={context} testId={`settings-table-${id}`} />
          </SettingsCard>
        ))
      )}

      <SettingsCard
        number={groups.length + 2}
        id="settings-property"
        testId="property-settings"
        title={t("property.title")}
        description={t("property.description")}
        flush
      >
        {properties.length === 0 ? (
          <div className="p-5 md:p-6">
            <EmptyState
              icon={IconBuilding}
              title={t("property.none")}
              description={t("property.noneHint")}
              action={
                <Button asChild variant="secondary">
                  <a href={ownerPath(locale, "/buildings")}>{t("property.add")}</a>
                </Button>
              }
            />
          </div>
        ) : (
          <>
            {properties.length > 1 ? (
              <div className="border-border border-b px-5 py-3 md:px-6">
                <ViewTabs
                  label={t("property.pick")}
                  current={propertyId ?? ""}
                  tabs={properties.map((property) => ({
                    key: property.id,
                    href: ownerPath(locale, `/settings?property=${property.id}#settings-property`),
                    label: property.name,
                    testId: "property-pick",
                  }))}
                />
              </div>
            ) : null}
            {!propertySettings?.data ? (
              <div className="p-5 md:p-6">
                <SectionError error={propertySettings?.error} />
              </div>
            ) : (
              <SettingRows
                settings={propertyRows}
                context={context}
                propertyId={propertyId}
                testId="settings-table-property"
              />
            )}
          </>
        )}
      </SettingsCard>
    </SettingsFrame>
  );
}

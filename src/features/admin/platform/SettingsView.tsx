import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import type { SettingValueType } from "@/features/shared/console/SettingEditor";
import { formatDate, formatDecimal } from "@/i18n/format";
import { messageKey } from "@/i18n/keys";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Input } from "@/ui/components/Input";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";
import { IconSettings } from "@/ui/icons/glyphs/settings";

import { can, param, section, type AdminContext } from "../shared/server";
import { PlatformSettingEditor } from "./PlatformSettingEditor";
import { settingShape } from "./settingShape";

/** The sections of the page, in reading order; a key's area (its first segment) decides where it goes. */
const SECTIONS = ["storage", "subscription", "support", "messages", "money", "ai", "other"] as const;
type Section = (typeof SECTIONS)[number];
const AREA: Record<string, Section> = {
  storage: "storage",
  subscription: "subscription",
  support: "support",
  reminders: "messages",
  notifications: "messages",
  messaging: "messages",
  line: "messages",
  payments: "money",
  etax: "money",
  compliance: "money",
  billing: "money",
  ai: "ai",
};

/** Settings that have a page of their own (a list of packages is managed there, not as a value). */
const MANAGED_AT: Record<string, string> = {
  "storage.packs": "/subscriptions/storage",
};

/**
 * Platform settings (F5 5.2, ADR-0004, redesign G8): every catalogue key in words — its name, what it does, its value
 * in force with units (never raw JSON) and since when — grouped in sections with a section list beside them. "เปลี่ยน"
 * opens typed controls (numbers with units per customer type, lists you add to) with the effective date and the reason
 * the audit keeps. Filter by key or words (`?q=subscription.`).
 */
export async function SettingsView({
  context,
  searchParams,
}: {
  context: AdminContext;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("admin.platform.settings");
  const types = await getTranslations("glossary.tenantType");
  const { api, locale, me } = context;
  const settings = await section(unwrap(api.GET("/v1/admin/settings")));
  const q = param(searchParams.q)?.toLowerCase();
  const permissions = new Set(me.permissions);

  const catalog = (key: string, field: "name" | "help" | "unit") => {
    const path = `catalog.${messageKey(key)}.${field}`;
    return t.has(path) ? t(path as Parameters<typeof t>[0]) : null;
  };
  const mapLabel = (key: string) =>
    types.has(key)
      ? types(key as Parameters<typeof types>[0])
      : t.has(`mapKey.${key}`)
        ? t(`mapKey.${key}` as Parameters<typeof t>[0])
        : key;
  const labelsOf = (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.keys(value).map((key) => [key, mapLabel(key)]))
      : undefined;

  type Setting = NonNullable<typeof settings.data>[number];
  const shown = (setting: Setting): React.ReactNode => {
    const unit = catalog(setting.key, "unit");
    const number = (value: unknown) =>
      typeof value === "number"
        ? formatDecimal(String(value), locale, 0)
        : typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)
          ? formatDecimal(value, locale, value.includes(".") ? 2 : 0)
          : String(value);
    const shape = settingShape(setting.value, setting.valueType);
    const testId = `setting-value-${setting.key}`;
    if (setting.value === null)
      return (
        <span className="text-muted" data-testid={testId}>
          —
        </span>
      );
    if (typeof setting.value === "boolean")
      return (
        <Badge size="sm" tone={setting.value ? "success" : "neutral"}>
          <span data-testid={testId}>{setting.value ? t("on") : t("off")}</span>
        </Badge>
      );
    if (shape.kind === "scalar")
      return (
        <span className="font-medium tabular-nums">
          <span data-testid={testId}>
            {t.has(`enumValue.${String(setting.value)}`)
              ? t(`enumValue.${String(setting.value)}` as Parameters<typeof t>[0])
              : number(setting.value)}
          </span>
          {unit ? <span className="text-muted font-normal"> {unit}</span> : null}
        </span>
      );
    if (shape.kind === "list")
      return (
        <span className="font-medium tabular-nums" data-testid={testId}>
          {(setting.value as unknown[]).map(number).join(", ")}
          {unit ? <span className="text-muted font-normal"> {unit}</span> : null}
        </span>
      );
    if (shape.kind === "map")
      return (
        <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm" data-testid={testId}>
          {Object.entries(setting.value as Record<string, unknown>).map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-muted">{mapLabel(key)}</dt>
              <dd className="font-medium tabular-nums">
                {value === null
                  ? t("notCharged")
                  : typeof value === "boolean"
                    ? value
                      ? t("on")
                      : t("off")
                    : `${number(value)}${unit ? ` ${unit}` : ""}`}
              </dd>
            </div>
          ))}
        </dl>
      );
    return (
      <span className="text-muted text-sm" data-testid={testId}>
        {Array.isArray(setting.value) ? t("items", { count: setting.value.length }) : t("structured")}
      </span>
    );
  };

  /** The API's description without its decision codes ("D-082: …") — those stay in the docs, not on screen. */
  const plain = (text: string) =>
    text.replace(/^(?:[DO]-\d+[a-z]?(?:\s*\/\s*[DO]-\d+[a-z]?)*\s*(?:⚖\s*\([^)]*\))?\s*:\s*)/u, "");

  const rows = (settings.data ?? []).filter((setting) => {
    if (!q) return true;
    const name = catalog(setting.key, "name") ?? "";
    return (
      setting.key.toLowerCase().includes(q) ||
      setting.description.toLowerCase().includes(q) ||
      name.toLowerCase().includes(q)
    );
  });
  const grouped = SECTIONS.map((key) => ({
    key,
    settings: rows.filter((setting) => (AREA[setting.key.split(".")[0] ?? ""] ?? "other") === key),
  })).filter((group) => group.settings.length > 0);

  return (
    <ConsolePage testId="platform-settings">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <>
            {/* G6 (D-300): sponsored LINE broadcasts have their own page (switch, caps, consent text). */}
            <Button asChild variant="secondary" iconStart={IconMegaphone}>
              <Link href="/settings/broadcast" data-testid="broadcast-settings-link">
                {t("broadcastLink")}
              </Link>
            </Button>
            {can(me, "admin.provider_credential.manage") ? (
              <Button asChild variant="secondary" iconStart={IconKey}>
                <Link href="/provider-credentials" data-testid="provider-credentials-link">
                  {t("credentialsLink")}
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      {!settings.data ? (
        <SectionError error={settings.error} />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
          <nav aria-label={t("sectionsLabel")} className="flex flex-col gap-4 lg:sticky lg:top-8">
            <form method="get" role="search">
              <label>
                <span className="sr-only">{t("filter")}</span>
                <Input
                  name="q"
                  type="search"
                  inputSize="sm"
                  defaultValue={param(searchParams.q) ?? ""}
                  placeholder={t("filterPlaceholder")}
                />
              </label>
            </form>
            <ul className="hidden flex-col gap-0.5 lg:flex">
              {grouped.map((group) => (
                <li key={group.key}>
                  <a
                    href={`#settings-${group.key}`}
                    className="text-muted hover:bg-bg-subtle hover:text-fg rounded-control flex h-9 items-center justify-between px-3 text-sm font-medium"
                  >
                    {t(`section.${group.key}`)}
                    <span className="text-xs tabular-nums">{group.settings.length}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex min-w-0 flex-col gap-8">
            {grouped.length === 0 ? (
              <EmptyState
                variant="card"
                icon={IconSettings}
                title={t("noMatch")}
                action={
                  <Button asChild variant="secondary">
                    <Link href="/settings">{t("clear")}</Link>
                  </Button>
                }
              />
            ) : null}
            {grouped.map((group) => (
              <section
                key={group.key}
                id={`settings-${group.key}`}
                aria-labelledby={`settings-${group.key}-title`}
                className="flex scroll-mt-8 flex-col gap-3"
              >
                <h2 id={`settings-${group.key}-title`} className="text-lg font-semibold">
                  {t(`section.${group.key}`)}
                </h2>
                <ul
                  className="border-border bg-surface rounded-card shadow-card divide-border divide-y border"
                  data-testid="settings-table"
                >
                  {group.settings.map((setting) => {
                    const editable =
                      setting.scopeAllowed.includes("platform") &&
                      (setting.editableBy.some((permission) => permissions.has(permission)) ||
                        can(me, "admin.setting.manage"));
                    const name = catalog(setting.key, "name");
                    const help = catalog(setting.key, "help");
                    const managed = MANAGED_AT[setting.key];
                    return (
                      <li
                        key={setting.key}
                        className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)_auto] md:items-start md:gap-6"
                        data-testid="setting-row"
                        data-key={setting.key}
                      >
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="font-medium">{name ?? setting.key}</span>
                          <span className="text-muted text-sm text-pretty">{help ?? plain(setting.description)}</span>
                          <span className="text-muted text-xs">
                            {setting.effectiveFrom
                              ? t("provenance", { date: formatDate(setting.effectiveFrom, locale) })
                              : t("provenanceNone")}
                            {setting.scopeAllowed.includes("tenant") ? ` · ${t("tenantMayOverride")}` : ""}
                            {name ? <span className="font-mono"> · {setting.key}</span> : null}
                          </span>
                        </div>
                        <div className="min-w-0">{shown(setting)}</div>
                        <div className="md:justify-self-end">
                          {managed ? (
                            <Button asChild size="sm" variant="secondary">
                              <a href={managed}>{t("manageThere")}</a>
                            </Button>
                          ) : editable ? (
                            <PlatformSettingEditor
                              settingKey={setting.key}
                              description={help ?? plain(setting.description)}
                              valueType={setting.valueType as SettingValueType}
                              value={setting.value}
                              name={name ?? undefined}
                              unit={catalog(setting.key, "unit") ?? undefined}
                              labels={labelsOf(setting.value)}
                            />
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </ConsolePage>
  );
}

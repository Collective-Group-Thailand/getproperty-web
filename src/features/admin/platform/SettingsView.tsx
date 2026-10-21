import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { SimpleTable } from "@/ui/components/SimpleTable";
import type { SettingValueType } from "@/features/shared/console/SettingEditor";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { IconKey } from "@/ui/icons/glyphs/key";
import { Input } from "@/ui/components/Input";

import { can, param, section, type AdminContext } from "../shared/server";
import { PlatformSettingEditor } from "./PlatformSettingEditor";

/** A setting value as text: the API's JSON exactly (pretty-printed), never reinterpreted. */
function shown(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Platform settings (F5 5.2, ADR-0004): every catalogue key with the platform value in force and since
 * when, which scopes may override it and who may edit it; a new effective-dated version (now or later,
 * never backdated) with a reason. Filter by key prefix (`?q=subscription.`).
 */
export async function SettingsView({
  context,
  searchParams,
}: {
  context: AdminContext;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("admin.platform.settings");
  const { api, locale, me } = context;
  const settings = await section(unwrap(api.GET("/v1/admin/settings")));
  const q = param(searchParams.q)?.toLowerCase();
  const permissions = new Set(me.permissions);
  return (
    <ConsolePage testId="platform-settings">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          can(me, "admin.provider_credential.manage") ? (
            <Button asChild variant="secondary" iconStart={IconKey}>
              <Link href="/provider-credentials" data-testid="provider-credentials-link">
                {t("credentialsLink")}
              </Link>
            </Button>
          ) : null
        }
      />
      <form method="get" className="flex flex-wrap items-end gap-2" role="search">
        <label className="flex flex-col gap-1 text-sm">
          {t("filter")}
          <Input
            name="q"
            type="search"
            inputSize="sm"
            defaultValue={param(searchParams.q) ?? ""}
            placeholder={t("filterPlaceholder")}
            className="w-72"
          />
        </label>
      </form>
      {!settings.data ? (
        <SectionError error={settings.error} />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="settings-table"
          minWidth="60rem"
          columns={[
            { key: "key", header: t("col.key") },
            { key: "value", header: t("col.value") },
            { key: "since", header: t("col.since") },
            { key: "scopes", header: t("col.scopes") },
            { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
          ]}
          rows={settings.data
            .filter(
              (setting) => !q || setting.key.toLowerCase().includes(q) || setting.description.toLowerCase().includes(q),
            )
            .map((setting) => {
              const editable =
                setting.scopeAllowed.includes("platform") &&
                (setting.editableBy.some((permission) => permissions.has(permission)) ||
                  can(me, "admin.setting.manage"));
              return {
                key: setting.key,
                testId: "setting-row",
                data: { key: setting.key },
                cells: {
                  key: (
                    <span className="flex max-w-md flex-col">
                      <span className="font-mono">{setting.key}</span>
                      <span className="text-muted text-xs">{setting.description}</span>
                    </span>
                  ),
                  value: (
                    <code
                      className="bg-bg-subtle rounded px-1 text-xs break-all"
                      data-testid={`setting-value-${setting.key}`}
                    >
                      {shown(setting.value)}
                    </code>
                  ),
                  since: setting.effectiveFrom ? formatDateTime(setting.effectiveFrom, locale) : "—",
                  scopes: (
                    <span className="flex flex-wrap gap-1">
                      {setting.scopeAllowed.map((scope) => (
                        <Badge key={scope} size="sm">
                          {t(`scope.${scope}`)}
                        </Badge>
                      ))}
                    </span>
                  ),
                  actions: editable ? (
                    <PlatformSettingEditor
                      settingKey={setting.key}
                      description={setting.description}
                      valueType={setting.valueType as SettingValueType}
                      value={setting.value}
                    />
                  ) : null,
                },
              };
            })}
        />
      )}
    </ConsolePage>
  );
}

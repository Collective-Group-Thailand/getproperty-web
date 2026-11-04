import { getTranslations } from "next-intl/server";

import { ActionMenu } from "@/features/shared/console/ActionMenu";
import { messageKey } from "@/i18n/keys";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";

import { can, section, type AdminContext } from "../shared/server";
import { FlagDefault, FlagOverride } from "./FlagActions";

/**
 * Feature flags (F5 5.2): each flag's platform default and rollout percentage, and the tenants that
 * override it (with the reason) — each override editable here, or from the tenant's own flags tab.
 */
export async function FlagsView({ context }: { context: AdminContext }) {
  const t = await getTranslations("admin.platform.flags");
  const { api, me } = context;
  const [flags, tenants] = await Promise.all([
    section(unwrap(api.GET("/v1/admin/feature-flags"))),
    section(unwrap(api.GET("/v1/admin/tenants", { params: { query: { perPage: 100 } } }))),
  ]);
  const names = new Map((tenants.data?.data ?? []).map((tenant) => [tenant.id, tenant.displayName]));
  const manage = can(me, "admin.feature_flag.manage");
  return (
    <ConsolePage testId="feature-flags">
      <PageHeader title={t("title")} description={t("description")} />
      {!flags.data ? (
        <SectionError error={flags.error} />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="flags-table"
          stackOnPhones
          minWidth="56rem"
          columns={[
            { key: "key", header: t("col.key"), phone: "title" },
            { key: "default", header: t("col.default"), phone: "status" },
            { key: "rollout", header: t("col.rollout"), align: "end", phone: "meta", phoneLabel: true },
            { key: "overrides", header: t("col.overrides"), phone: "meta", phoneLabel: true },
            ...(manage
              ? [
                  {
                    key: "actions",
                    header: <span className="sr-only">{t("col.actions")}</span>,
                    phone: "figure" as const,
                    className: "w-14",
                  },
                ]
              : []),
          ]}
          rows={flags.data.map((flag) => ({
            key: flag.key,
            testId: "flag-row",
            data: { key: flag.key, default: String(flag.defaultEnabled) },
            cells: {
              key: (
                <span className="flex max-w-md flex-col">
                  <span className="font-medium">
                    {t.has(`name.${messageKey(flag.key)}`)
                      ? t(`name.${messageKey(flag.key)}` as Parameters<typeof t>[0])
                      : flag.description}
                  </span>
                  <span className="text-muted font-mono text-xs">{flag.key}</span>
                </span>
              ),
              default: (
                <Badge size="sm" tone={flag.defaultEnabled ? "success" : "neutral"}>
                  {flag.defaultEnabled ? t("on") : t("off")}
                </Badge>
              ),
              rollout: <span className="tabular-nums">{t("rolloutValue", { pct: flag.rolloutPct })}</span>,
              overrides:
                flag.overrides.length === 0 ? (
                  <span className="text-muted">{t("overrideCount", { count: 0 })}</span>
                ) : (
                  <ul className="flex flex-col gap-1 text-sm">
                    {flag.overrides.map((override) => (
                      <li
                        key={override.tenantId}
                        className="flex flex-wrap items-center gap-2"
                        data-testid="flag-override"
                      >
                        <a href={`/tenants/${override.tenantId}/flags`} className="hover:underline">
                          {names.get(override.tenantId) ?? override.tenantId.slice(0, 8)}
                        </a>
                        <Badge size="sm" tone={override.enabled ? "success" : "neutral"}>
                          {override.enabled ? t("on") : t("off")}
                        </Badge>
                        <span className="text-muted text-xs">{override.reason}</span>
                      </li>
                    ))}
                  </ul>
                ),
              actions: manage ? (
                <ActionMenu label={t("more", { key: flag.key })}>
                  <FlagDefault flagKey={flag.key} enabled={flag.defaultEnabled} rolloutPct={flag.rolloutPct} />
                  {flag.overrides.map((override) => (
                    <FlagOverride
                      key={override.tenantId}
                      flagKey={flag.key}
                      tenantId={override.tenantId}
                      override={override.enabled}
                      label={t("overrideFor", { name: names.get(override.tenantId) ?? t("aCustomer") })}
                    />
                  ))}
                </ActionMenu>
              ) : null,
            },
          }))}
        />
      )}
    </ConsolePage>
  );
}

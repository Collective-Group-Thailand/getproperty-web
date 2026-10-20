import { getTranslations } from "next-intl/server";

import { SectionError } from "@/features/shared/console/SectionError";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";

import { FlagOverride } from "../platform/FlagActions";
import { can, section, type AdminContext } from "../shared/server";

/**
 * Feature flags of one tenant (F5 5.2): each flag as it resolves for the tenant (override, rollout or
 * default — the API's answer), whether that comes from a tenant override, and the override control.
 */
export async function TenantFlags({ context, tenant }: { context: AdminContext; tenant: Schemas["TenantProfileDto"] }) {
  const t = await getTranslations("admin.platform.flags");
  const { api, me } = context;
  const manage = can(me, "admin.feature_flag.manage");
  const [resolved, flags] = await Promise.all([
    section(
      unwrap(api.GET("/v1/admin/tenants/{tenantId}/feature-flags", { params: { path: { tenantId: tenant.id } } })),
    ),
    manage ? section(unwrap(api.GET("/v1/admin/feature-flags"))) : { data: null, error: null },
  ]);
  if (!resolved.data) return <SectionError error={resolved.error} />;
  const values = resolved.data.flags as Record<string, boolean>;
  const definitions = new Map((flags.data ?? []).map((flag) => [flag.key, flag]));
  const keys = [...new Set([...Object.keys(values), ...definitions.keys()])].sort();
  return (
    <SimpleTable
      caption={t("tenantTitle")}
      testId="tenant-flags"
      columns={[
        { key: "key", header: t("col.key") },
        { key: "value", header: t("col.value") },
        { key: "source", header: t("col.source") },
        ...(manage ? [{ key: "actions", header: <span className="sr-only">{t("col.actions")}</span> }] : []),
      ]}
      rows={keys.map((key) => {
        const override = definitions.get(key)?.overrides.find((o) => o.tenantId === tenant.id) ?? null;
        return {
          key,
          testId: "tenant-flag",
          data: { key, value: String(values[key] ?? false) },
          cells: {
            key: (
              <span className="flex flex-col">
                <span className="font-mono">{key}</span>
                {definitions.get(key)?.description ? (
                  <span className="text-muted text-xs">{definitions.get(key)!.description}</span>
                ) : null}
              </span>
            ),
            value: (
              <Badge size="sm" tone={values[key] ? "success" : "neutral"}>
                {values[key] ? t("on") : t("off")}
              </Badge>
            ),
            source: override ? t("overridden", { reason: override.reason }) : t("inherited"),
            actions: manage ? (
              <FlagOverride flagKey={key} tenantId={tenant.id} override={override ? override.enabled : null} />
            ) : null,
          },
        };
      })}
    />
  );
}

import type { AdminMe } from "@/lib/api/types";

import type { AdminPermission } from "../shared/permissions";

export type TenantTab =
  | "overview"
  | "subscription"
  | "invoices"
  | "hardware"
  | "field-work"
  | "pilot"
  | "ai-usage"
  | "flags"
  | "credentials"
  | "support"
  | "view";

const has = (me: Pick<AdminMe, "permissions">, permission: AdminPermission) => me.permissions.includes(permission);

/**
 * The sections of a tenant record a platform user may open (docs/rbac.md) — the record's own menu in the navigation
 * column (redesign G8: the tabs folded into the column). The API refuses the rest anyway.
 */
export function tenantSections(me: Pick<AdminMe, "permissions">): TenantTab[] {
  const tabs: TenantTab[] = ["overview"];
  const business = has(me, "admin.subscription.manage");
  if (business) tabs.push("subscription", "invoices");
  if (business || has(me, "admin.device.manage")) tabs.push("hardware", "field-work");
  if (business) tabs.push("pilot");
  if (has(me, "admin.ai_usage.read")) tabs.push("ai-usage");
  tabs.push("flags");
  if (has(me, "admin.provider_credential.manage")) tabs.push("credentials");
  if (has(me, "admin.support_grant.request") || has(me, "admin.support_grant.approve_incident")) tabs.push("support");
  tabs.push("view");
  return tabs;
}

export const tenantSectionHref = (tenantId: string, tab: TenantTab) =>
  tab === "overview" ? `/tenants/${tenantId}` : `/tenants/${tenantId}/${tab}`;

import type { AdminMe } from "@/lib/api/types";

/**
 * Admin permissions (docs/rbac.md, D-090) as `/v1/admin/me` lists them. The console hides what the
 * user cannot do; the API stays the enforcement point. Prefer an aggregate's `nextActions` where the
 * contract has them — this is for create buttons and pages without an aggregate.
 */
export type AdminPermission =
  | "admin.tenant.read"
  | "admin.tenant.manage"
  | "admin.user.manage"
  | "admin.setting.manage"
  | "admin.compliance.manage"
  | "admin.utility_tariff.enter"
  | "admin.utility_tariff.verify"
  | "admin.support_grant.request"
  | "admin.support_grant.approve_incident"
  | "admin.audit.read"
  | "admin.dsr.manage"
  | "admin.device.manage"
  | "admin.provider_credential.manage"
  | "admin.subscription.manage"
  | "admin.platform_invoice.issue"
  | "admin.platform_credit_note.approve"
  | "admin.integration_event.read"
  | "admin.ai_usage.read"
  | "admin.outbox.manage"
  | "admin.notification_template.manage"
  | "admin.feature_flag.manage"
  | "admin.building.manage"
  | "admin.listing.moderate"
  | "admin.listing.verify";

export function can(me: AdminMe, permission: AdminPermission): boolean {
  return me.permissions.includes(permission);
}

import "server-only";

import { getLocale } from "next-intl/server";
import { cache } from "react";

import { getPlatformActor } from "@/lib/auth/actor";
import { requirePlatform } from "@/lib/auth/guards";
import { unwrap, type ApiClient } from "@/lib/api/client";
import { serverApi } from "@/lib/api/server";
import type { AdminMe } from "@/lib/api/types";
import type { Locale } from "@/i18n/routing";

export { enumParam, pageParam, param, section, withQuery } from "@/features/shared/console/params";

export interface AdminContext {
  api: ApiClient;
  me: AdminMe;
  locale: Locale;
}

/**
 * What every admin page starts from (F5): the API client of this request (platform token from the
 * admin host's cookie), `/v1/admin/me` and the page language. Cached per request so the shell, the
 * page and its sections share one round trip.
 */
export const adminContext = cache(async (): Promise<AdminContext> => {
  const [api, actor, locale] = await Promise.all([serverApi("admin"), getPlatformActor(), getLocale()]);
  // Signed out while the page renders next to the layout's guard: redirect like the guard instead of throwing (a
  // throw logged a server error for every signed-out visit).
  if (!actor) {
    const signedIn = await requirePlatform("/login");
    return { api, me: signedIn.me, locale: locale as Locale };
  }
  return { api, me: actor.me, locale: locale as Locale };
});

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

/**
 * Tenant names by id for back-office lists that carry only `tenantId` (DSRs, outbox, fleet): the first
 * 100 tenants (the API's page limit) — a row whose tenant is not among them shows its short id.
 */
export const tenantNames = cache(async (): Promise<Map<string, string>> => {
  const { api } = await adminContext();
  try {
    const list = await unwrap(api.GET("/v1/admin/tenants", { params: { query: { perPage: 100 } } }));
    return new Map(list.data.map((tenant) => [tenant.id, tenant.displayName]));
  } catch {
    return new Map();
  }
});

export function tenantLabel(names: Map<string, string>, tenantId: string | null | undefined, none: string): string {
  if (!tenantId) return none;
  return names.get(tenantId) ?? tenantId.slice(0, 8);
}

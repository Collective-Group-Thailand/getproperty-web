import "server-only";

import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { TENANT_STATUS } from "@/domain/status/tenant";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";

import { RailRecord } from "../shell/recordRail";
import type { AdminContext } from "../shared/server";
import { tenantSectionHref, type TenantTab } from "./sections";

export type { TenantTab } from "./sections";

/** The tenant of a detail page, or the not-found page (404 from the API, cross-check by id). */
export async function loadTenant(context: AdminContext, tenantId: string): Promise<Schemas["TenantProfileDto"]> {
  try {
    return await unwrap(context.api.GET("/v1/admin/tenants/{tenantId}", { params: { path: { tenantId } } }));
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 422)) notFound();
    throw error;
  }
}

/**
 * A tenant's pages (F5 5.1, redesign G8): the record's sections live in the navigation column (`RecordNav`), so the
 * page carries no tab row. The overview's head is the tenant (name, status, type · VAT); a section's head is the
 * section, with the tenant named in the column (and in the way back on phones).
 */
export async function TenantFrame({
  tenant,
  current,
  children,
  actions,
}: {
  context?: AdminContext;
  tenant: Schemas["TenantProfileDto"];
  current: TenantTab;
  children: React.ReactNode;
  /** At most one filled primary action of the section. */
  actions?: React.ReactNode;
}) {
  const t = await getTranslations("admin.tenants");
  const types = await getTranslations("glossary.tenantType");
  const overview = current === "overview";
  return (
    <ConsolePage testId={`tenant-${current}`}>
      <RailRecord id={tenant.id} name={tenant.displayName} slug={tenant.slug} />
      <PageHeader
        title={overview ? tenant.displayName : t(`tab.${current}`)}
        testId={overview ? "tenant-title" : "tenant-section-title"}
        backOnPhonesOnly
        back={
          overview
            ? { label: t("backToList"), href: "/tenants" }
            : { label: tenant.displayName, href: tenantSectionHref(tenant.id, "overview") }
        }
        description={
          overview ? (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-muted font-mono text-sm md:hidden">{tenant.slug}</span>
              <span aria-hidden="true" className="md:hidden">
                ·
              </span>
              <span>{types(tenant.type)}</span>
              {tenant.vatRegistered ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{t("vatRegistered")}</span>
                </>
              ) : null}
            </span>
          ) : (
            t(`lede.${current}`)
          )
        }
        status={overview ? <StatusBadgeOf map={TENANT_STATUS} value={tenant.status} /> : undefined}
        actions={actions}
      />
      {children}
    </ConsolePage>
  );
}

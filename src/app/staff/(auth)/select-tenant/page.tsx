import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AuthFrame } from "@/features/shared/auth/AuthFrame";
import { TenantPicker } from "@/features/shared/auth/TenantPicker";
import { getOperatorActor } from "@/lib/auth/actor";

export async function generateMetadata() {
  const t = await getTranslations("auth.tenantPicker");
  return { title: t("title") };
}

export default async function StaffSelectTenant() {
  const actor = await getOperatorActor("staff");
  if (!actor) redirect("/login");
  const t = await getTranslations("auth.tenantPicker");
  return (
    <AuthFrame zone="staff" title={t("title")}>
      <p className="text-muted mb-4 text-sm">{t("body")}</p>
      <TenantPicker
        zone="staff"
        tenants={actor.me.tenants}
        currentTenantId={actor.me.currentTenant?.id}
        consoleHref="/"
      />
    </AuthFrame>
  );
}

import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { AuthFrame } from "@/features/shared/auth/AuthFrame";
import { TenantPicker } from "@/features/shared/auth/TenantPicker";
import { getOperatorActor } from "@/lib/auth/actor";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("auth.tenantPicker");
  return { title: t("title") };
}

/** The tenant picker for operators of several tenants (contract §8). */
export default async function OwnerSelectTenant({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await getOperatorActor("owner");
  if (!actor) redirect(getPathname({ href: "/login", locale }));
  const t = await getTranslations("auth.tenantPicker");
  return (
    <AuthFrame zone="owner" title={t("title")}>
      <p className="text-muted mb-4 text-sm">{t("body")}</p>
      <TenantPicker
        zone="owner"
        tenants={actor.me.tenants}
        currentTenantId={actor.me.currentTenant?.id}
        consoleHref={getPathname({ href: "/dashboard", locale })}
      />
    </AuthFrame>
  );
}

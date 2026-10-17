import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/domain/forms/safe-next";
import { AuthFrame } from "@/features/shared/auth/AuthFrame";
import { OperatorSignIn } from "@/features/shared/auth/OperatorSignIn";
import { getOperatorActor } from "@/lib/auth/actor";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("auth.signIn");
  return { title: t("title") };
}

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ next?: string; invitation?: string }> };

/** Owner sign-in: phone OTP first, email + password + TOTP as the alternative (F1 1.2). */
export default async function OwnerLogin({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next, invitation } = await searchParams;
  const consoleHref = safeNextPath(next) ?? getPathname({ href: "/dashboard", locale });
  const selectTenantHref = getPathname({ href: "/select-tenant", locale });

  const actor = await getOperatorActor("owner");
  if (actor?.me.currentTenant) redirect(consoleHref);

  const t = await getTranslations("auth.signIn");
  return (
    <AuthFrame zone="owner" title={t("title")}>
      <OperatorSignIn
        zone="owner"
        consoleHref={consoleHref}
        selectTenantHref={selectTenantHref}
        invitationCode={invitation?.slice(0, 64)}
      />
    </AuthFrame>
  );
}

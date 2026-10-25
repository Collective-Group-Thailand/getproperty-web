import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/domain/forms/safe-next";
import { AuthFrame } from "@/features/shared/auth/AuthFrame";
import { OAuthButtons } from "@/features/shared/auth/OAuthButtons";
import { OAuthError } from "@/features/shared/auth/OAuthError";
import { OperatorSignIn } from "@/features/shared/auth/OperatorSignIn";
import { getOperatorActor } from "@/lib/auth/actor";
import { oauthProviders } from "@/lib/auth/oauth/enabled";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("auth.signIn");
  return { title: t("title") };
}

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ next?: string; invitation?: string; oauthError?: string }>;
};

/**
 * Owner sign-in: phone OTP first, email + password + TOTP as the alternative (F1 1.2); Google, Apple and LINE for
 * accounts that linked them (D-255, D-283) — not with an invitation, which is accepted by phone.
 */
export default async function OwnerLogin({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next, invitation, oauthError } = await searchParams;
  const consoleHref = safeNextPath(next) ?? getPathname({ href: "/dashboard", locale });
  const selectTenantHref = getPathname({ href: "/select-tenant", locale });

  const actor = await getOperatorActor("owner");
  if (actor?.me.currentTenant) redirect(consoleHref);

  const t = await getTranslations("auth.signIn");
  return (
    <AuthFrame
      zone="owner"
      title={t("title")}
      footer={
        invitation ? undefined : (
          <p>
            {t("newHere")}{" "}
            <a
              className="text-primary font-semibold"
              href={getPathname({ href: "/signup", locale })}
              data-testid="login-to-signup"
            >
              {t("createAccount")}
            </a>
          </p>
        )
      }
    >
      <div className="flex flex-col gap-6">
        <OAuthError code={oauthError?.slice(0, 64)} />
        <OperatorSignIn
          zone="owner"
          consoleHref={consoleHref}
          selectTenantHref={selectTenantHref}
          invitationCode={invitation?.slice(0, 64)}
        />
        {invitation ? null : (
          <OAuthButtons providers={oauthProviders()} intent="signin" locale={locale} next={safeNextPath(next)} />
        )}
      </div>
    </AuthFrame>
  );
}

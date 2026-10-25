import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { AuthFrame } from "@/features/shared/auth/AuthFrame";
import { LandlordSignUp } from "@/features/shared/auth/LandlordSignUp";
import { getOperatorActor } from "@/lib/auth/actor";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("auth.signUp");
  return { title: t("title") };
}

/**
 * Self sign-up for owners of a house or condo unit (B7.1, F6.1, D-251): free (D-250), no invitation. Signed-in
 * operators go straight to their console. Google, Apple and LINE join with B7.8 on the web.
 */
export default async function LandlordSignUpPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await getOperatorActor("owner");
  if (actor?.me.currentTenant) redirect(getPathname({ href: "/dashboard", locale }));

  const t = await getTranslations("auth.signUp");
  const href = (path: string) => getPathname({ href: path, locale });
  return (
    <AuthFrame
      zone="owner"
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <div className="flex flex-col gap-3">
          <p>
            {t.rich("terms", {
              terms: (chunks) => (
                <a className="text-fg underline underline-offset-4" href={href("/legal/terms")}>
                  {chunks}
                </a>
              ),
              privacy: (chunks) => (
                <a className="text-fg underline underline-offset-4" href={href("/legal/privacy")}>
                  {chunks}
                </a>
              ),
            })}
          </p>
          <p>
            {t("haveAccount")}{" "}
            <a className="text-primary font-semibold" href={href("/login")} data-testid="signup-to-login">
              {t("signIn")}
            </a>
          </p>
        </div>
      }
    >
      <LandlordSignUp portfolioHref={href("/portfolio")} />
    </AuthFrame>
  );
}

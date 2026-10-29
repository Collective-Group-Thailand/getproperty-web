import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/domain/forms/safe-next";
import { AuthFrame } from "@/features/shared/auth/AuthFrame";
import { LandlordSignUp } from "@/features/shared/auth/LandlordSignUp";
import { getOperatorActor } from "@/lib/auth/actor";
import { oauthProviders } from "@/lib/auth/oauth/enabled";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("auth.signUp");
  return { title: t("title") };
}

/**
 * Self sign-up for owners of a house or condo unit (B7.1, F6.1, D-251): free (D-250), no invitation. Signed-in
 * operators go straight to their console. Phone, or Google / Apple / LINE (D-255, D-283). `?as=agency`: an estate
 * agency signs up the same way (G2, D-284 free and unlimited, D-293) and starts at its mandated units.
 */
export default async function LandlordSignUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ oauthError?: string; as?: string; next?: string }>;
}) {
  const { locale } = await params;
  const { oauthError, as, next } = await searchParams;
  const agency = as === "agency";
  // G8 (D-299): a buyer arriving from a getbuild invitation comes back to its claim page once signed up.
  const nextHref = agency ? undefined : (safeNextPath(next) ?? undefined);
  setRequestLocale(locale);
  const actor = await getOperatorActor("owner");
  if (actor?.me.currentTenant) redirect(nextHref ?? getPathname({ href: "/dashboard", locale }));

  const t = await getTranslations("auth.signUp");
  const a = await getTranslations("owner.agency.signUp");
  const href = (path: string) => getPathname({ href: path, locale });
  return (
    <AuthFrame
      zone="owner"
      title={agency ? a("title") : t("title")}
      subtitle={agency ? a("subtitle") : t("subtitle")}
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
            <a
              className="text-primary font-semibold"
              href={agency ? href("/signup") : `${href("/signup")}?as=agency`}
              data-testid="signup-switch-kind"
            >
              {agency ? a("asLandlord") : a("asAgency")}
            </a>
          </p>
          <p>
            {t("haveAccount")}{" "}
            <a
              className="text-primary font-semibold"
              href={nextHref ? `${href("/login")}?next=${encodeURIComponent(nextHref)}` : href("/login")}
              data-testid="signup-to-login"
            >
              {t("signIn")}
            </a>
          </p>
        </div>
      }
    >
      <LandlordSignUp
        kind={agency ? "agency" : "landlord"}
        nameLabels={agency ? { label: a("name"), hint: a("nameHint") } : undefined}
        portfolioHref={href(agency ? "/mandated-units" : "/portfolio")}
        locale={locale}
        providers={oauthProviders()}
        oauthError={oauthError?.slice(0, 64)}
        nextHref={nextHref}
      />
    </AuthFrame>
  );
}

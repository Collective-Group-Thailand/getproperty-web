import { getTranslations } from "next-intl/server";

import { OAuthError } from "@/features/shared/auth/OAuthError";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { oauthProviders } from "@/lib/auth/oauth/enabled";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";

import { param, section, type OwnerContext } from "../shared/server";
import { SettingsNav } from "./SettingsNav";
import { AddSignInMethod, RemoveSignInMethod } from "./SignInMethodActions";

type Provider = "google" | "apple" | "line";
const API_PROVIDER: Record<Provider, string> = { google: "firebase_google", apple: "firebase_apple", line: "line" };

/**
 * My ways to sign in (D-255, D-283) — personal, so every member sees it: the verified phone, whether a password is
 * set, and Google / Apple / LINE. Adding one goes through the provider and comes back here; Google and Apple can be
 * removed while another way remains; LINE stays (it carries my LINE notifications).
 */
export async function SignInMethodsView({
  context,
  searchParams = {},
}: {
  context: OwnerContext;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.settings.signIn");
  const { api, locale, me } = context;
  const methods = await section(unwrap(api.GET("/v1/owner/me/identities")));
  const linked = param(searchParams.linked);
  const error = param(searchParams.oauthError);
  const offered = oauthProviders();
  return (
    <OwnerPage testId="sign-in-methods">
      <PageHeader title={t("title")} description={t("description")} />
      <SettingsNav me={me} current="/settings/sign-in" locale={locale} />
      <OAuthError code={error?.slice(0, 64)} />
      {linked && (["google", "apple", "line"] as const).includes(linked as Provider) ? (
        <div data-testid="sign-in-linked">
          <Callout tone="success">{t("linked", { provider: t(`providers.${linked}`) })}</Callout>
        </div>
      ) : null}
      {!methods.data ? (
        <SectionError error={methods.error} />
      ) : (
        <Card padding="none">
          <ul className="divide-border m-0 flex list-none flex-col divide-y p-0">
            <li className="flex min-h-16 items-center justify-between gap-4 px-4 py-3" data-testid="sign-in-phone">
              <span className="flex flex-col">
                <span className="font-medium">{t("phone")}</span>
                <span className="text-muted text-sm">{methods.data.phoneMasked ?? t("phoneNone")}</span>
              </span>
              {methods.data.phoneMasked ? <Badge tone="success">{t("verified")}</Badge> : null}
            </li>
            <li className="flex min-h-16 items-center justify-between gap-4 px-4 py-3">
              <span className="flex flex-col">
                <span className="font-medium">{t("password")}</span>
                <span className="text-muted text-sm">
                  {methods.data.hasPassword ? t("passwordSet") : t("passwordNone")}
                </span>
              </span>
            </li>
            {(["google", "apple", "line"] as const).map((provider) => {
              const identity = methods.data!.identities.find((row) => row.provider === API_PROVIDER[provider]);
              if (!identity && !offered.includes(provider)) return null;
              return (
                <li
                  key={provider}
                  className="flex min-h-16 flex-wrap items-center justify-between gap-4 px-4 py-3"
                  data-testid={`sign-in-${provider}`}
                  data-linked={identity ? "true" : "false"}
                >
                  <span className="flex flex-col">
                    <span className="font-medium">{t(`providers.${provider}`)}</span>
                    <span className="text-muted text-sm">
                      {identity
                        ? [
                            identity.email ?? identity.displayName,
                            t("since", { date: formatDateTime(identity.linkedAt, locale) }),
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : t("notLinked")}
                    </span>
                  </span>
                  {identity ? (
                    identity.removable ? (
                      <RemoveSignInMethod identityId={identity.id} provider={provider} />
                    ) : (
                      <span className="text-muted text-sm">{t("kept")}</span>
                    )
                  ) : (
                    <AddSignInMethod provider={provider} locale={locale} />
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <p className="text-muted text-sm">{t("footnote")}</p>
    </OwnerPage>
  );
}

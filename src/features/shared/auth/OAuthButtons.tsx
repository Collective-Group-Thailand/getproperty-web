"use client";

import { useTranslations } from "next-intl";

import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";

export type OAuthProviderKey = "google" | "apple" | "line";
export type OAuthIntentKey = "signin" | "signup" | "link";

/** The start URL of an attempt (route `src/app/bff/oauth/[provider]/start`). */
export function oauthStartHref(
  provider: OAuthProviderKey,
  intent: OAuthIntentKey,
  locale: Locale,
  extra: { next?: string; name?: string; as?: "agency" } = {},
): string {
  const query = new URLSearchParams({ intent, locale });
  if (extra.next) query.set("next", extra.next);
  if (extra.name) query.set("name", extra.name);
  if (extra.as) query.set("as", extra.as);
  return `/bff/oauth/${provider}/start?${query.toString()}`;
}

/**
 * "Continue with Google / Apple / LINE" (D-255, D-283): one plain link per provider the server offers — the
 * redirect runs on this app's server, so no provider script loads in the page. `beforeNavigate` lets a form stop
 * the navigation (sign-up needs the name first) or add to the URL.
 */
export function OAuthButtons({
  providers,
  intent,
  locale,
  next,
  signUpAs,
  beforeNavigate,
  divider = true,
}: {
  providers: readonly OAuthProviderKey[];
  intent: OAuthIntentKey;
  locale: Locale;
  next?: string;
  /** Sign-up of an estate agency (G2) instead of a landlord. */
  signUpAs?: "agency";
  /** Returns the name to carry (sign-up), or `false` to stay on the page. */
  beforeNavigate?: () => string | false | undefined;
  divider?: boolean;
}) {
  const t = useTranslations("auth.oauth");
  if (providers.length === 0) return null;
  return (
    <div className="flex flex-col gap-3" data-testid="oauth-buttons">
      {divider ? (
        <div className="text-muted flex items-center gap-3 text-sm" aria-hidden="true">
          <span className="bg-border h-px flex-1" />
          <span>{t("or")}</span>
          <span className="bg-border h-px flex-1" />
        </div>
      ) : null}
      {providers.map((provider) => (
        <Button key={provider} asChild variant="secondary" size="lg" block>
          <a
            href={oauthStartHref(provider, intent, locale, { next, as: signUpAs })}
            data-testid={`oauth-${provider}`}
            onClick={(event) => {
              if (!beforeNavigate) return;
              const name = beforeNavigate();
              event.preventDefault();
              if (name === false) return;
              window.location.assign(
                oauthStartHref(provider, intent, locale, { next, name: name || undefined, as: signUpAs }),
              );
            }}
          >
            {t(`continueWith.${provider}`)}
          </a>
        </Button>
      ))}
    </div>
  );
}

/** The sentence for `?oauthError=<code>` on the sign-in, sign-up and sign-in settings pages. */
export function useOAuthErrorMessage(): (code: string) => string {
  const t = useTranslations("auth.oauth.errors");
  return (code) => {
    const key = OAUTH_ERROR_KEYS[code];
    return t(key ?? "failed");
  };
}

const OAUTH_ERROR_KEYS: Record<string, string> = {
  "oauth.cancelled": "cancelled",
  "oauth.expired": "expired",
  "oauth.state_mismatch": "expired",
  "oauth.unavailable": "unavailable",
  "oauth.exchange_failed": "failed",
  "auth.identity_not_linked": "notLinked",
  "auth.identity_token_invalid": "failed",
  "auth.line_token_invalid": "failed",
  "auth.identity_email_in_use": "emailInUse",
  "auth.identity_contact_required": "contactRequired",
  "auth.identity_in_use": "inUse",
  "auth.no_access": "noAccess",
  "auth.account_disabled": "disabled",
  "auth.unauthenticated": "signInAgain",
  "service.unavailable": "unavailable",
  "provider.unavailable": "unavailable",
};

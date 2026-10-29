import "server-only";

import { cookies } from "next/headers";

import { safeNextPath } from "@/domain/forms/safe-next";
import { getPathname } from "@/i18n/navigation";
import { isLocale, type Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { serverApi } from "@/lib/api/server";
import { serverEnv } from "@/lib/env/server";
import { publicOrigin } from "@/lib/zones";

import { afterOperatorSignIn, authApiClient } from "../operator-session";
import { writeSession, writeTenant } from "../session";
import {
  ATTEMPT_COOKIE,
  ATTEMPT_MAX_AGE,
  attemptCookieOptions,
  decodeAttempt,
  encodeAttempt,
  sameState,
  type OAuthAttempt,
  type OAuthIntent,
} from "./attempt";
import {
  authorizeUrl,
  enabledProviders,
  exchangeCode,
  newAttempt,
  OAuthExchangeError,
  type OAuthProvider,
  type ProviderIdentity,
} from "./providers";

/** The owner host's public origin (redirect URIs registered with each provider). */
export function ownerOrigin(): string {
  return publicOrigin(serverEnv().OWNER_HOST);
}

export const callbackUri = (provider: OAuthProvider) => `${ownerOrigin()}/bff/oauth/${provider}/callback`;

const path = (href: string, locale: Locale) => `${ownerOrigin()}${getPathname({ href, locale })}`;

/** The page an attempt came from — where a refusal is shown (`?oauthError=<code>`). */
function origin(intent: OAuthIntent, locale: Locale): string {
  return path(intent === "signin" ? "/login" : intent === "signup" ? "/signup" : "/settings/sign-in", locale);
}

export function failureUrl(intent: OAuthIntent, locale: Locale, code: string, signUpAs?: "agency"): string {
  const url = new URL(origin(intent, locale));
  if (intent === "signup" && signUpAs) url.searchParams.set("as", signUpAs);
  url.searchParams.set("oauthError", code);
  return url.toString();
}

/** Start: remember the attempt in its cookie and send the browser to the provider (or the fake page). */
export async function startAttempt(input: {
  provider: OAuthProvider;
  intent: OAuthIntent;
  locale: Locale;
  next?: string;
  displayName?: string;
  signUpAs?: "agency";
}): Promise<string> {
  const env = serverEnv();
  if (!enabledProviders(env).includes(input.provider))
    return failureUrl(input.intent, input.locale, "oauth.unavailable", input.signUpAs);
  const values = newAttempt();
  const attempt: OAuthAttempt = {
    ...values,
    provider: input.provider,
    intent: input.intent,
    locale: input.locale,
    next: safeNextPath(input.next),
    displayName: input.displayName?.trim().slice(0, 200) || undefined,
    signUpAs: input.signUpAs,
  };
  (await cookies()).set(ATTEMPT_COOKIE, encodeAttempt(attempt), attemptCookieOptions(ATTEMPT_MAX_AGE));
  return authorizeUrl(env, input.provider, values, callbackUri(input.provider), path("/oauth/fake", input.locale));
}

/** The provider's answer, as the callback received it (query for GET, form for POST). */
export interface CallbackInput {
  code?: string | null;
  state?: string | null;
  error?: string | null;
  /** Apple's first sign-in posts the user's name as JSON (`user`). */
  user?: string | null;
}

function appleName(user: string | null | undefined): string | undefined {
  if (!user) return undefined;
  try {
    const parsed = JSON.parse(user) as { name?: { firstName?: string; lastName?: string } };
    const name = [parsed.name?.firstName, parsed.name?.lastName].filter(Boolean).join(" ").trim();
    return name || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Callback: check the attempt (single use, `state` echoed, same provider), exchange the code, then sign in, sign up
 * or link with the API. Answers the URL to open next — the console, the portfolio, the sign-in settings, or the page
 * the attempt came from with `?oauthError=<code>` (an API problem code, or `oauth.*` for our own refusals).
 */
export async function finishAttempt(provider: OAuthProvider, input: CallbackInput): Promise<string> {
  const jar = await cookies();
  const attempt = decodeAttempt(jar.get(ATTEMPT_COOKIE)?.value);
  jar.set(ATTEMPT_COOKIE, "", attemptCookieOptions(0));
  if (!attempt) return failureUrl("signin", "th", "oauth.expired");
  const locale: Locale = isLocale(attempt.locale) ? attempt.locale : "th";
  if (attempt.provider !== provider || !sameState(attempt.state, input.state))
    return failureUrl(attempt.intent, locale, "oauth.state_mismatch", attempt.signUpAs);
  if (input.error || !input.code) return failureUrl(attempt.intent, locale, "oauth.cancelled", attempt.signUpAs);

  let identity: ProviderIdentity;
  try {
    identity = await exchangeCode(serverEnv(), provider, {
      code: input.code,
      redirectUri: callbackUri(provider),
      verifier: attempt.verifier,
      nonce: attempt.nonce,
      appleUserName: appleName(input.user),
    });
  } catch (error) {
    if (!(error instanceof OAuthExchangeError)) console.error("oauth exchange failed", error);
    return failureUrl(attempt.intent, locale, "oauth.exchange_failed", attempt.signUpAs);
  }

  try {
    return await complete(attempt, locale, identity);
  } catch (error) {
    if (isApiError(error)) return failureUrl(attempt.intent, locale, error.code, attempt.signUpAs);
    console.error("oauth completion failed", error);
    return failureUrl(attempt.intent, locale, "service.unavailable", attempt.signUpAs);
  }
}

async function complete(attempt: OAuthAttempt, locale: Locale, identity: ProviderIdentity): Promise<string> {
  const body = { provider: identity.provider, idToken: identity.idToken };
  switch (attempt.intent) {
    case "signin": {
      const pair = await unwrap((await authApiClient(locale)).POST("/v1/auth/operator/identity", { body }));
      const { next } = await afterOperatorSignIn("owner", pair);
      if (next === "select-tenant") {
        const url = new URL(path("/select-tenant", locale));
        if (attempt.next) url.searchParams.set("next", attempt.next);
        return url.toString();
      }
      return attempt.next ? `${ownerOrigin()}${attempt.next}` : path("/dashboard", locale);
    }
    case "signup": {
      const signUp = {
        ...body,
        displayName: (attempt.displayName ?? identity.displayName ?? "").trim() || "getproperty",
        language: locale === "en" ? ("en" as const) : ("th" as const),
      };
      const api = await authApiClient(locale);
      // An estate agency (G2, D-293) signs up the same way and starts at its mandated units.
      const result = await unwrap(
        attempt.signUpAs === "agency"
          ? api.POST("/v1/public/signup/agency", { body: signUp })
          : api.POST("/v1/public/signup/landlord", { body: signUp }),
      );
      await writeSession(result.tokens);
      await writeTenant(result.tenant.id);
      // The page the sign-up came from (validated with `safeNextPath` when the attempt started) — e.g. a getbuild
      // buyer's invitation claim (GW6) — wins over the usual first page, as on the phone path and the sign-in branch.
      const next = safeNextPath(attempt.next);
      if (next) return `${ownerOrigin()}${next}`;
      return path(attempt.signUpAs === "agency" ? "/mandated-units?welcome=1" : "/portfolio", locale);
    }
    case "link": {
      const api = await serverApi("owner");
      await unwrap(api.POST("/v1/owner/me/identities", { body }));
      const url = new URL(path("/settings/sign-in", locale));
      url.searchParams.set("linked", attempt.provider);
      return url.toString();
    }
  }
}

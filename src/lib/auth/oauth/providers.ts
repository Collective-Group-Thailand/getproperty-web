import { createHash, createSign, randomBytes } from "node:crypto";

import type { ServerEnv } from "@/lib/env/schema";

/**
 * Sign-in with Google, Apple and LINE (D-255, D-283) as plain OAuth 2.0 / OpenID Connect redirects run by this
 * server — no provider SDK in the browser, no new dependency:
 *
 * - **LINE Login** (authorization code + PKCE): LINE's id token goes to the API as is (`provider: line`).
 * - **Google** (code + PKCE) and **Apple** (code, `form_post`): the provider's id token is exchanged at Firebase
 *   Authentication (`accounts:signInWithIdp`, getproperty's own project) for a **Firebase ID token**, which is what
 *   the API verifies (`firebase_google` / `firebase_apple`, getpack's providers).
 * - **fake** (`OAUTH_MODE=fake`): the start step opens a local test page instead of the provider; its "code" is the
 *   test identity, turned into the readable fake tokens of getproperty-api's fake verifiers. Everything after the
 *   provider — state, nonce, the API call, cookies, errors — runs the same code as live.
 *
 * Pure apart from `fetch`: the env is passed in, so the unit test drives every branch.
 */

export const OAUTH_PROVIDERS = ["google", "apple", "line"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export function isOAuthProvider(value: unknown): value is OAuthProvider {
  return typeof value === "string" && (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

/** What the API is told (`IdentityTokenProvider`). */
export type ApiIdentityProvider = "line" | "firebase_google" | "firebase_apple";

export interface ProviderIdentity {
  provider: ApiIdentityProvider;
  idToken: string;
  /** The name the provider shared, for a new landlord's display name. */
  displayName?: string;
}

type OAuthEnv = Pick<
  ServerEnv,
  | "OAUTH_MODE"
  | "LINE_LOGIN_CHANNEL_ID"
  | "LINE_LOGIN_CHANNEL_SECRET"
  | "GOOGLE_OAUTH_CLIENT_ID"
  | "GOOGLE_OAUTH_CLIENT_SECRET"
  | "APPLE_SERVICES_ID"
  | "APPLE_TEAM_ID"
  | "APPLE_KEY_ID"
  | "APPLE_PRIVATE_KEY"
  | "FIREBASE_WEB_API_KEY"
>;

/** A provider is offered when its client is configured (live) — or always with the fake provider. */
export function enabledProviders(env: OAuthEnv): OAuthProvider[] {
  if (env.OAUTH_MODE === "fake") return [...OAUTH_PROVIDERS];
  return OAUTH_PROVIDERS.filter((provider) => configured(env, provider));
}

function configured(env: OAuthEnv, provider: OAuthProvider): boolean {
  switch (provider) {
    case "line":
      return Boolean(env.LINE_LOGIN_CHANNEL_ID && env.LINE_LOGIN_CHANNEL_SECRET);
    case "google":
      return Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET && env.FIREBASE_WEB_API_KEY);
    case "apple":
      return Boolean(
        env.APPLE_SERVICES_ID &&
        env.APPLE_TEAM_ID &&
        env.APPLE_KEY_ID &&
        env.APPLE_PRIVATE_KEY &&
        env.FIREBASE_WEB_API_KEY,
      );
  }
}

const base64url = (bytes: Buffer) => bytes.toString("base64url");

/** Random values of one sign-in attempt: `state` (CSRF), `nonce` (replay), PKCE verifier. */
export function newAttempt(): { state: string; nonce: string; verifier: string } {
  return { state: base64url(randomBytes(24)), nonce: base64url(randomBytes(24)), verifier: base64url(randomBytes(48)) };
}

export const sha256 = (value: string) => base64url(createHash("sha256").update(value).digest());

/** Where the browser goes to sign in: the provider's authorize URL, or the local fake page. */
export function authorizeUrl(
  env: OAuthEnv,
  provider: OAuthProvider,
  attempt: { state: string; nonce: string; verifier: string },
  redirectUri: string,
  fakePage: string,
): string {
  if (env.OAUTH_MODE === "fake") {
    const url = new URL(fakePage);
    url.searchParams.set("provider", provider);
    url.searchParams.set("state", attempt.state);
    return url.toString();
  }
  const challenge = sha256(attempt.verifier);
  switch (provider) {
    case "line": {
      const url = new URL("https://access.line.me/oauth2/v2.1/authorize");
      url.search = new URLSearchParams({
        response_type: "code",
        client_id: env.LINE_LOGIN_CHANNEL_ID!,
        redirect_uri: redirectUri,
        state: attempt.state,
        scope: "openid profile",
        nonce: attempt.nonce,
        code_challenge: challenge,
        code_challenge_method: "S256",
      }).toString();
      return url.toString();
    }
    case "google": {
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        response_type: "code",
        client_id: env.GOOGLE_OAUTH_CLIENT_ID!,
        redirect_uri: redirectUri,
        state: attempt.state,
        scope: "openid email profile",
        nonce: attempt.nonce,
        code_challenge: challenge,
        code_challenge_method: "S256",
        prompt: "select_account",
      }).toString();
      return url.toString();
    }
    case "apple": {
      const url = new URL("https://appleid.apple.com/auth/authorize");
      url.search = new URLSearchParams({
        response_type: "code",
        response_mode: "form_post",
        client_id: env.APPLE_SERVICES_ID!,
        redirect_uri: redirectUri,
        state: attempt.state,
        scope: "name email",
        // Apple carries the hash; Firebase checks the raw nonce against it.
        nonce: sha256Hex(attempt.nonce),
      }).toString();
      return url.toString();
    }
  }
}

const sha256Hex = (value: string) => createHash("sha256").update(value).digest("hex");

/** The test identity a fake "code" carries (the fake page's form). */
export interface FakeIdentity {
  uid: string;
  name?: string;
  email?: string;
}

export function encodeFakeCode(identity: FakeIdentity): string {
  return Buffer.from(JSON.stringify(identity)).toString("base64url");
}

function decodeFakeCode(code: string): FakeIdentity | null {
  try {
    const value = JSON.parse(Buffer.from(code, "base64url").toString("utf8")) as Partial<FakeIdentity>;
    if (typeof value.uid !== "string" || !/^[\w.-]{1,64}$/.test(value.uid)) return null;
    return {
      uid: value.uid,
      name: typeof value.name === "string" ? value.name.slice(0, 100) : undefined,
      email: typeof value.email === "string" ? value.email.slice(0, 200) : undefined,
    };
  } catch {
    return null;
  }
}

/** The tokens getproperty-api's fake verifiers accept (`@collective/integrations` fakes). */
function fakeIdentity(provider: OAuthProvider, fake: FakeIdentity, now: number): ProviderIdentity {
  if (provider === "line") {
    const claims = {
      sub: fake.uid,
      name: fake.name ?? "LINE Test",
      aud: "fake-channel",
      exp: Math.floor(now / 1000) + 600,
    };
    return {
      provider: "line",
      idToken: `fake-line.${Buffer.from(JSON.stringify(claims)).toString("base64url")}`,
      displayName: fake.name,
    };
  }
  const email = fake.email ? `.${encodeURIComponent(fake.email)}` : "";
  return {
    provider: provider === "google" ? "firebase_google" : "firebase_apple",
    idToken: `fake-firebase.${provider}.${fake.uid}${email}`,
    displayName: fake.name,
  };
}

export class OAuthExchangeError extends Error {
  constructor(readonly reason: string) {
    super(`oauth exchange failed: ${reason}`);
    this.name = "OAuthExchangeError";
  }
}

type Fetch = typeof fetch;

async function postForm(fetcher: Fetch, url: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  const response = await fetcher(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams(body).toString(),
    cache: "no-store",
  });
  if (!response.ok) throw new OAuthExchangeError(`token endpoint ${response.status}`);
  return (await response.json()) as Record<string, unknown>;
}

/** Firebase Authentication REST: a Google / Apple id token → a Firebase ID token of getproperty's project. */
async function firebaseIdToken(
  fetcher: Fetch,
  env: OAuthEnv,
  providerId: "google.com" | "apple.com",
  idToken: string,
  requestUri: string,
  rawNonce?: string,
): Promise<{ idToken: string; displayName?: string }> {
  const postBody = new URLSearchParams({ id_token: idToken, providerId, ...(rawNonce ? { nonce: rawNonce } : {}) });
  const response = await fetcher(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY!)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        postBody: postBody.toString(),
        requestUri,
        returnSecureToken: true,
        returnIdpCredential: false,
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new OAuthExchangeError(`firebase ${response.status}`);
  const data = (await response.json()) as { idToken?: unknown; displayName?: unknown; fullName?: unknown };
  if (typeof data.idToken !== "string") throw new OAuthExchangeError("firebase without idToken");
  const name =
    typeof data.displayName === "string"
      ? data.displayName
      : typeof data.fullName === "string"
        ? data.fullName
        : undefined;
  return { idToken: data.idToken, displayName: name };
}

/** Apple's client secret: an ES256 JWT signed with the `.p8` key, valid for five minutes. */
export function appleClientSecret(env: OAuthEnv, now = Date.now()): string {
  const header = base64url(Buffer.from(JSON.stringify({ alg: "ES256", kid: env.APPLE_KEY_ID })));
  const iat = Math.floor(now / 1000);
  const payload = base64url(
    Buffer.from(
      JSON.stringify({
        iss: env.APPLE_TEAM_ID,
        iat,
        exp: iat + 300,
        aud: "https://appleid.apple.com",
        sub: env.APPLE_SERVICES_ID,
      }),
    ),
  );
  const signer = createSign("SHA256");
  signer.update(`${header}.${payload}`);
  const key = env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const signature = signer.sign({ key, dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${base64url(signature)}`;
}

function nameFromJwt(token: string): string | undefined {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as {
      name?: unknown;
    };
    return typeof payload.name === "string" ? payload.name : undefined;
  } catch {
    return undefined;
  }
}

/** The provider's answer (`code`) → the identity the API verifies. */
export async function exchangeCode(
  env: OAuthEnv,
  provider: OAuthProvider,
  input: { code: string; redirectUri: string; verifier: string; nonce: string; appleUserName?: string },
  fetcher: Fetch = fetch,
  now = Date.now(),
): Promise<ProviderIdentity> {
  if (env.OAUTH_MODE === "fake") {
    const fake = decodeFakeCode(input.code);
    if (!fake) throw new OAuthExchangeError("fake code invalid");
    return fakeIdentity(provider, fake, now);
  }
  switch (provider) {
    case "line": {
      const token = await postForm(fetcher, "https://api.line.me/oauth2/v2.1/token", {
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: input.redirectUri,
        client_id: env.LINE_LOGIN_CHANNEL_ID!,
        client_secret: env.LINE_LOGIN_CHANNEL_SECRET!,
        code_verifier: input.verifier,
      });
      if (typeof token.id_token !== "string") throw new OAuthExchangeError("line without id_token");
      return { provider: "line", idToken: token.id_token, displayName: nameFromJwt(token.id_token) };
    }
    case "google": {
      const token = await postForm(fetcher, "https://oauth2.googleapis.com/token", {
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: input.redirectUri,
        client_id: env.GOOGLE_OAUTH_CLIENT_ID!,
        client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET!,
        code_verifier: input.verifier,
      });
      if (typeof token.id_token !== "string") throw new OAuthExchangeError("google without id_token");
      const firebase = await firebaseIdToken(fetcher, env, "google.com", token.id_token, input.redirectUri);
      return { provider: "firebase_google", idToken: firebase.idToken, displayName: firebase.displayName };
    }
    case "apple": {
      const token = await postForm(fetcher, "https://appleid.apple.com/auth/token", {
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: input.redirectUri,
        client_id: env.APPLE_SERVICES_ID!,
        client_secret: appleClientSecret(env, now),
      });
      if (typeof token.id_token !== "string") throw new OAuthExchangeError("apple without id_token");
      const firebase = await firebaseIdToken(fetcher, env, "apple.com", token.id_token, input.redirectUri, input.nonce);
      return {
        provider: "firebase_apple",
        idToken: firebase.idToken,
        displayName: input.appleUserName ?? firebase.displayName,
      };
    }
  }
}

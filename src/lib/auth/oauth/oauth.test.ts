import { createVerify, generateKeyPairSync } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { parseServerEnv } from "@/lib/env/schema";

import { decodeAttempt, encodeAttempt, sameState } from "./attempt";
import {
  appleClientSecret,
  authorizeUrl,
  enabledProviders,
  encodeFakeCode,
  exchangeCode,
  newAttempt,
  sha256,
} from "./providers";

const LIVE = {
  OAUTH_MODE: "live" as const,
  LINE_LOGIN_CHANNEL_ID: "1650000000",
  LINE_LOGIN_CHANNEL_SECRET: "line-secret",
  GOOGLE_OAUTH_CLIENT_ID: "client.apps.googleusercontent.com",
  GOOGLE_OAUTH_CLIENT_SECRET: "google-secret",
  APPLE_SERVICES_ID: "co.getproperty.web",
  APPLE_TEAM_ID: "TEAM123456",
  APPLE_KEY_ID: "KEY1234567",
  APPLE_PRIVATE_KEY: undefined as string | undefined,
  FIREBASE_WEB_API_KEY: "firebase-key",
};
const REDIRECT = "https://owner.example.com/bff/oauth/google/callback";
const FAKE_PAGE = "https://owner.example.com/th/oauth/fake";

describe("OAuth providers (D-255, D-283)", () => {
  it("offers only configured providers live, every one with the fake provider", () => {
    expect(enabledProviders({ ...LIVE, APPLE_PRIVATE_KEY: undefined })).toEqual(["google", "line"]);
    expect(enabledProviders({ ...LIVE, FIREBASE_WEB_API_KEY: undefined })).toEqual(["line"]);
    expect(enabledProviders({ OAUTH_MODE: "fake" } as never)).toEqual(["google", "apple", "line"]);
  });

  it("defaults to live in production and to fake elsewhere", () => {
    expect(parseServerEnv({ NODE_ENV: "development" }).OAUTH_MODE).toBe("fake");
    const production = parseServerEnv({
      NODE_ENV: "production",
      OWNER_HOST: "owner.example.com",
      STAFF_HOST: "staff.example.com",
      ADMIN_HOST: "admin.example.com",
      API_INTERNAL_URL: "http://api:4000",
    });
    expect(production.OAUTH_MODE).toBe("live");
  });

  it("builds authorize URLs with state, nonce and PKCE (Apple: form_post and a hashed nonce)", () => {
    const attempt = newAttempt();
    const google = new URL(authorizeUrl(LIVE, "google", attempt, REDIRECT, FAKE_PAGE));
    expect(google.origin).toBe("https://accounts.google.com");
    expect(Object.fromEntries(google.searchParams)).toMatchObject({
      client_id: LIVE.GOOGLE_OAUTH_CLIENT_ID,
      redirect_uri: REDIRECT,
      state: attempt.state,
      nonce: attempt.nonce,
      code_challenge: sha256(attempt.verifier),
      code_challenge_method: "S256",
      scope: "openid email profile",
    });
    const line = new URL(authorizeUrl(LIVE, "line", attempt, REDIRECT, FAKE_PAGE));
    expect(line.host).toBe("access.line.me");
    expect(line.searchParams.get("scope")).toBe("openid profile");
    const apple = new URL(authorizeUrl(LIVE, "apple", attempt, REDIRECT, FAKE_PAGE));
    expect(apple.searchParams.get("response_mode")).toBe("form_post");
    expect(apple.searchParams.get("nonce")).toMatch(/^[0-9a-f]{64}$/);
    expect(apple.searchParams.get("nonce")).not.toBe(attempt.nonce);
  });

  it("sends the fake mode to the local page and turns its code into the API's fake tokens", async () => {
    const attempt = newAttempt();
    const fake = { ...LIVE, OAUTH_MODE: "fake" as const };
    const url = new URL(authorizeUrl(fake, "apple", attempt, REDIRECT, FAKE_PAGE));
    expect(`${url.origin}${url.pathname}`).toBe(FAKE_PAGE);
    expect(url.searchParams.get("state")).toBe(attempt.state);

    const code = encodeFakeCode({ uid: "u-1", name: "Malee", email: "m@example.com" });
    const input = { code, redirectUri: REDIRECT, verifier: attempt.verifier, nonce: attempt.nonce };
    await expect(exchangeCode(fake, "google", input)).resolves.toEqual({
      provider: "firebase_google",
      idToken: "fake-firebase.google.u-1.m%40example.com",
      displayName: "Malee",
    });
    const line = await exchangeCode(fake, "line", input, fetch, 1_800_000_000_000);
    expect(line.provider).toBe("line");
    const claims = JSON.parse(Buffer.from(line.idToken.slice("fake-line.".length), "base64url").toString()) as Record<
      string,
      unknown
    >;
    expect(claims).toEqual({ sub: "u-1", name: "Malee", aud: "fake-channel", exp: 1_800_000_600 });
    await expect(exchangeCode(fake, "google", { ...input, code: "garbage!" })).rejects.toThrow("fake code invalid");
  });

  it("exchanges a Google code and then the Google id token at Firebase", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);
      if (target.startsWith("https://oauth2.googleapis.com/token")) {
        expect(String(init?.body)).toContain("code_verifier=v");
        return new Response(JSON.stringify({ id_token: "google-id-token" }), { status: 200 });
      }
      expect(target).toContain("accounts:signInWithIdp?key=firebase-key");
      expect(JSON.parse(String(init?.body))).toMatchObject({
        postBody: "id_token=google-id-token&providerId=google.com",
        requestUri: REDIRECT,
      });
      return new Response(JSON.stringify({ idToken: "firebase-id-token", displayName: "Malee M." }), { status: 200 });
    });
    await expect(
      exchangeCode(LIVE, "google", { code: "c", redirectUri: REDIRECT, verifier: "v", nonce: "n" }, fetcher as never),
    ).resolves.toEqual({ provider: "firebase_google", idToken: "firebase-id-token", displayName: "Malee M." });
    const failing = vi.fn(async () => new Response("{}", { status: 400 }));
    await expect(
      exchangeCode(LIVE, "line", { code: "c", redirectUri: REDIRECT, verifier: "v", nonce: "n" }, failing as never),
    ).rejects.toThrow("token endpoint 400");
  });

  it("signs Apple's client secret with the .p8 key (ES256, five minutes)", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString().replace(/\n/g, "\\n");
    const token = appleClientSecret({ ...LIVE, APPLE_PRIVATE_KEY: pem }, 1_800_000_000_000);
    const [header, payload, signature] = token.split(".");
    expect(JSON.parse(Buffer.from(header!, "base64url").toString())).toEqual({ alg: "ES256", kid: "KEY1234567" });
    expect(JSON.parse(Buffer.from(payload!, "base64url").toString())).toEqual({
      iss: "TEAM123456",
      iat: 1_800_000_000,
      exp: 1_800_000_300,
      aud: "https://appleid.apple.com",
      sub: "co.getproperty.web",
    });
    const verifier = createVerify("SHA256");
    verifier.update(`${header}.${payload}`);
    expect(verifier.verify({ key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signature!, "base64url"))).toBe(
      true,
    );
  });
});

describe("OAuth attempt cookie", () => {
  it("round-trips and refuses anything malformed", () => {
    const attempt = {
      ...newAttempt(),
      provider: "line" as const,
      intent: "signup" as const,
      locale: "th",
      displayName: "ก",
    };
    expect(decodeAttempt(encodeAttempt(attempt))).toEqual(attempt);
    expect(decodeAttempt("not-base64-json")).toBeNull();
    expect(
      decodeAttempt(Buffer.from(JSON.stringify({ ...attempt, intent: "admin" })).toString("base64url")),
    ).toBeNull();
    expect(decodeAttempt(undefined)).toBeNull();
  });

  it("compares the echoed state exactly", () => {
    expect(sameState("abc", "abc")).toBe(true);
    expect(sameState("abc", "abd")).toBe(false);
    expect(sameState("abc", "ab")).toBe(false);
    expect(sameState("abc", null)).toBe(false);
  });
});

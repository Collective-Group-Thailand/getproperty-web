import "server-only";

import { serverEnv } from "@/lib/env/server";

import { enabledProviders, type OAuthProvider } from "./providers";

/** The providers the sign-in pages offer (configured clients, or every one with `OAUTH_MODE=fake`). */
export function oauthProviders(): OAuthProvider[] {
  return enabledProviders(serverEnv());
}

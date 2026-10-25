"use client";

import { Callout } from "@/ui/components/Callout";

import { useOAuthErrorMessage } from "./OAuthButtons";

/** The refusal an OAuth attempt came back with (`?oauthError=`), in our own words. */
export function OAuthError({ code }: { code?: string }) {
  const message = useOAuthErrorMessage();
  if (!code) return null;
  return (
    <div data-testid="oauth-error" data-code={code}>
      <Callout tone="warning">{message(code)}</Callout>
    </div>
  );
}

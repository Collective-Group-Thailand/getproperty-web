import { NextResponse, type NextRequest } from "next/server";

import { isLocale } from "@/i18n/routing";
import { isOAuthIntent } from "@/lib/auth/oauth/attempt";
import { failureUrl, startAttempt } from "@/lib/auth/oauth/flow";
import { isOAuthProvider } from "@/lib/auth/oauth/providers";

export const dynamic = "force-dynamic";

/**
 * `GET /bff/oauth/{google|apple|line}/start?intent=signin|signup|link&locale=&next=&name=` (owner zone, D-255,
 * D-283): remembers the attempt and redirects to the provider — or to the local test page with `OAUTH_MODE=fake`.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const query = request.nextUrl.searchParams;
  const locale = isLocale(query.get("locale")) ? (query.get("locale") as "th" | "en") : "th";
  const intent = query.get("intent");
  if (!isOAuthIntent(intent) || !isOAuthProvider(provider)) {
    return NextResponse.redirect(failureUrl("signin", locale, "oauth.unavailable"), { status: 303 });
  }
  const target = await startAttempt({
    provider,
    intent,
    locale,
    next: query.get("next") ?? undefined,
    displayName: query.get("name") ?? undefined,
  });
  return NextResponse.redirect(target, { status: 303, headers: { "cache-control": "no-store" } });
}

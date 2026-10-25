import { NextResponse, type NextRequest } from "next/server";

import { failureUrl, finishAttempt } from "@/lib/auth/oauth/flow";
import { encodeFakeCode, isOAuthProvider } from "@/lib/auth/oauth/providers";
import { serverEnv } from "@/lib/env/server";

export const dynamic = "force-dynamic";

const go = (url: string) => NextResponse.redirect(url, { status: 303, headers: { "cache-control": "no-store" } });

/** `GET /bff/oauth/{provider}/callback?code=&state=` — LINE and Google come back here (D-255, D-283). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isOAuthProvider(provider)) return go(failureUrl("signin", "th", "oauth.unavailable"));
  const query = request.nextUrl.searchParams;
  return go(
    await finishAttempt(provider, { code: query.get("code"), state: query.get("state"), error: query.get("error") }),
  );
}

/** `POST …/callback` — Apple's `form_post`, and the local test page with `OAUTH_MODE=fake`. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isOAuthProvider(provider)) return go(failureUrl("signin", "th", "oauth.unavailable"));
  const form = await request.formData().catch(() => null);
  const field = (name: string) => {
    const value = form?.get(name);
    return typeof value === "string" ? value : null;
  };
  // The fake provider page posts the test identity itself; it becomes the "code" the fake exchange reads.
  const uid = field("uid");
  const code =
    field("code") ??
    (serverEnv().OAUTH_MODE === "fake" && uid
      ? encodeFakeCode({ uid, name: field("name") || undefined, email: field("email") || undefined })
      : null);
  return go(await finishAttempt(provider, { code, state: field("state"), error: field("error"), user: field("user") }));
}

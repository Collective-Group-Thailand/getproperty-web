import { redirect } from "next/navigation";

import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/**
 * The invitation link the API sends (`inviteUrl`, `/join?code=…`, D-145) lands here and continues to
 * sign-in with the code, which `otp/verify` turns into the membership.
 */
export default async function Join({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { locale } = await params;
  const { code } = await searchParams;
  const login = getPathname({ href: "/login", locale });
  const invitation = code?.trim().slice(0, 64);
  redirect(invitation ? `${login}?invitation=${encodeURIComponent(invitation)}` : login);
}

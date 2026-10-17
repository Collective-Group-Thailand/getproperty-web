import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/domain/forms/auth";
import { PlatformSignIn } from "@/features/admin/auth/PlatformSignIn";
import { AuthFrame } from "@/features/shared/auth/AuthFrame";
import { getPlatformActor } from "@/lib/auth/actor";

export async function generateMetadata() {
  const t = await getTranslations("auth.signIn");
  return { title: t("title") };
}

/** Platform sign-in: email + password + TOTP, with TOTP enrolment at first sign-in (D-164). */
export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const consoleHref = safeNextPath(next) ?? "/";
  if (await getPlatformActor()) redirect(consoleHref);
  const t = await getTranslations("auth.signIn");
  return (
    <AuthFrame zone="admin" title={t("title")}>
      <PlatformSignIn consoleHref={consoleHref} />
    </AuthFrame>
  );
}

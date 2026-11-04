import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/domain/forms/safe-next";
import { PlatformSignIn } from "@/features/admin/auth/PlatformSignIn";
import { adminEnvironment } from "@/features/admin/shell/AdminShell";
import { AuthFrame } from "@/features/shared/auth/AuthFrame";
import { LanguageSwitch } from "@/features/shared/shell/LanguageSwitch";
import { getPlatformActor } from "@/lib/auth/actor";
import { Badge } from "@/ui/components/Badge";
import { EnvBadge } from "@/ui/components/EnvBadge";
import { IconInfo } from "@/ui/icons/glyphs/info";
import { IconLock } from "@/ui/icons/glyphs/lock";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("auth.signIn.adminTitle") };
}

/**
 * Platform sign-in: email + password + TOTP, with TOTP enrolment at first sign-in (D-164). The door says which door it
 * is (the "แอดมิน" badge, the lock, who it is for, the environment) and announces the authenticator step before it
 * comes — the button reads "ดำเนินการต่อ", not "เข้าสู่ระบบ".
 */
export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const consoleHref = safeNextPath(next) ?? "/";
  if (await getPlatformActor()) redirect(consoleHref);
  const t = await getTranslations();
  const { info, envBadge } = await adminEnvironment();
  return (
    <AuthFrame
      zone="admin"
      title={t("auth.signIn.adminTitle")}
      zoneBadge={t("auth.signIn.zoneBadge.admin")}
      icon={IconLock}
      aside={<LanguageSwitch zone="admin" />}
      cardTop={
        <>
          <EnvBadge label={envBadge} />
          {info?.fakes ? (
            <Badge tone="info" size="sm" icon={IconInfo}>
              {t("admin.shell.fakes")}
            </Badge>
          ) : null}
        </>
      }
    >
      <PlatformSignIn consoleHref={consoleHref} />
    </AuthFrame>
  );
}

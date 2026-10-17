import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/domain/forms/auth";
import { AuthFrame } from "@/features/shared/auth/AuthFrame";
import { OperatorSignIn } from "@/features/shared/auth/OperatorSignIn";
import { getOperatorActor } from "@/lib/auth/actor";

export async function generateMetadata() {
  const t = await getTranslations("auth.signIn");
  return { title: t("title") };
}

/** Staff sign-in: phone OTP (00-master-plan.md §4). */
export default async function StaffLogin({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; invitation?: string }>;
}) {
  const { next, invitation } = await searchParams;
  const consoleHref = safeNextPath(next) ?? "/";
  const actor = await getOperatorActor("staff");
  if (actor?.me.currentTenant) redirect(consoleHref);
  const t = await getTranslations("auth.signIn");
  return (
    <AuthFrame zone="staff" title={t("title")}>
      <OperatorSignIn
        zone="staff"
        consoleHref={consoleHref}
        selectTenantHref="/select-tenant"
        invitationCode={invitation?.slice(0, 64)}
        allowPassword={false}
      />
    </AuthFrame>
  );
}

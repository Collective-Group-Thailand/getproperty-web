import { getTranslations, setRequestLocale } from "next-intl/server";

import { ownerAuthChrome } from "@/features/owner/marketing/authChrome";
import { AuthFrame } from "@/features/shared/auth/AuthFrame";
import { WorkspaceAccept } from "@/features/shared/auth/WorkspaceAccept";
import { formatDate } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { serverEnv } from "@/lib/env/server";
import { inboundEdgeHeaders } from "@/lib/http/server";
import { Callout } from "@/ui/components/Callout";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

/** The invitation's public preview: office name, condo, how many units — no landlord data (404 when not open). */
async function preview(code: string): Promise<Schemas["WorkspacePreviewDto"] | null> {
  if (!/^[A-Za-z0-9-]{6,64}$/.test(code)) return null;
  try {
    const response = await fetch(
      `${serverEnv().API_INTERNAL_URL}/v1/public/juristic-workspaces/${encodeURIComponent(code)}`,
      { headers: { accept: "application/json", ...(await inboundEdgeHeaders()) }, cache: "no-store" },
    );
    return response.ok ? ((await response.json()) as Schemas["WorkspacePreviewDto"]) : null;
  } catch {
    return null;
  }
}

/**
 * A landlord's invitation to a condo's juristic office (D-270): what it is (the office name the landlord typed, the
 * condo, the number of units), then the office signs in with a phone and an SMS code. The code is a credential: the
 * page is not indexed, not cached, sends no referrer.
 */
export default async function JoinWorkspacePage({ params }: { params: Promise<{ locale: Locale; code: string }> }) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("owner.collections.join");
  const invitation = await preview(code);
  return (
    <AuthFrame
      {...await ownerAuthChrome(locale)}
      zone="owner"
      title={invitation ? t("title", { office: invitation.officeName }) : t("invalidTitle")}
      subtitle={
        invitation
          ? t("subtitle", { building: invitation.buildingName, count: invitation.units })
          : t("invalidSubtitle")
      }
    >
      {invitation ? (
        <div className="flex flex-col gap-5">
          <Callout tone="neutral" size="sm">
            {t("what", { date: formatDate(invitation.expiresAt, locale) })}
          </Callout>
          <WorkspaceAccept code={code} workspaceHref={getPathname({ href: "/juristic/workspace", locale })} />
        </div>
      ) : (
        <p className="text-muted m-0" data-testid="join-invalid">
          {t("invalidBody")}
        </p>
      )}
    </AuthFrame>
  );
}

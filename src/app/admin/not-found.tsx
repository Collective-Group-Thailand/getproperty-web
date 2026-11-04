import { getTranslations } from "next-intl/server";

import { AdminShell } from "@/features/admin/shell/AdminShell";
import { ADMIN_MENU } from "@/features/admin/shell/menu";
import { BareZoneFrame } from "@/features/shared/errors/BareZoneFrame";
import { ZoneNotFound } from "@/features/shared/errors/ZoneNotFound";
import { entitledMenu } from "@/features/shared/shell/menu";
import { getPlatformActor } from "@/lib/auth/actor";

/** The admin host's 404: inside the admin column when signed in (with three entitled pages), else the bare frame. */
export default async function NotFound() {
  const actor = await getPlatformActor().catch(() => null);
  if (!actor) {
    return (
      <BareZoneFrame homeHref="/">
        <ZoneNotFound homeHref="/" />
      </BareZoneFrame>
    );
  }
  const t = await getTranslations("admin.nav");
  const links = entitledMenu(actor.me.menu, ADMIN_MENU)
    .filter((item) => item.href !== "/")
    .slice(0, 3)
    .map((item) => ({ href: item.href, label: t(item.key as Parameters<typeof t>[0]), icon: item.icon }));
  return (
    <AdminShell me={actor.me}>
      <ZoneNotFound homeHref="/" links={links} />
    </AdminShell>
  );
}

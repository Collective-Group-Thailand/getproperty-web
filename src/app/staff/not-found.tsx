import { getTranslations } from "next-intl/server";

import { BareZoneFrame } from "@/features/shared/errors/BareZoneFrame";
import { ZoneNotFound } from "@/features/shared/errors/ZoneNotFound";
import { entitledMenu } from "@/features/shared/shell/menu";
import { StaffShell } from "@/features/staff/shell/StaffShell";
import { STAFF_BOTTOM_NAV, STAFF_MENU } from "@/features/staff/shell/menu";
import { getOperatorActor } from "@/lib/auth/actor";

/** The staff host's 404: inside the staff app (top bar + bottom nav) when signed in, else the bare frame. */
export default async function NotFound() {
  const actor = await getOperatorActor("staff").catch(() => null);
  const me = actor?.me;
  if (!me?.currentTenant) {
    return (
      <BareZoneFrame homeHref="/">
        <ZoneNotFound homeHref="/" />
      </BareZoneFrame>
    );
  }
  const t = await getTranslations("staff.nav");
  const entitled = entitledMenu(me.menu, STAFF_MENU);
  const links = STAFF_BOTTOM_NAV.flatMap((key) => entitled.filter((item) => item.key === key))
    .slice(0, 3)
    .map((item) => ({ href: item.href, label: t(item.key as Parameters<typeof t>[0]), icon: item.icon }));
  return (
    <StaffShell me={{ ...me, currentTenant: me.currentTenant }}>
      <ZoneNotFound homeHref="/" links={links} />
    </StaffShell>
  );
}

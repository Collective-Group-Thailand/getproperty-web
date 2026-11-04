"use client";

import { useTranslations } from "next-intl";

import { Callout } from "@/ui/components/Callout";
import { IconOffline } from "@/ui/icons/glyphs/offline";

import { useOnlineStatus } from "./useOfflineQueue";

/**
 * The offline state of the staff PWA (F1 1.3 §1, ADR-0007), said in words right under the top bar: no signal, and
 * what happens to the work saved meanwhile. A notice that stays in view, not a badge — in a basement plant room it is
 * the first thing to know.
 */
export function OfflineBanner() {
  const t = useTranslations("staff.offline");
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="bg-bg z-sticky sticky top-14 px-4 pt-3" role="status" data-testid="offline-indicator">
      <Callout tone="warning" icon={IconOffline} title={t("offline")} className="max-w-phone mx-auto py-3">
        {t("banner")}
      </Callout>
    </div>
  );
}

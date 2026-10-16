import type { Zone } from "@/lib/zones";

import type { Locale } from "./routing";

/**
 * Messages are split by zone so the staff bundle never carries the admin's copy. `shared` is loaded
 * for every zone. Files are `messages/<locale>/<namespace>.json`; F0 ships only the shells' strings.
 */
export async function loadMessages(locale: Locale, zone: Zone) {
  const [shared, zoneMessages] = await Promise.all([
    import(`./messages/${locale}/shared.json`),
    import(`./messages/${locale}/${zone}.json`),
  ]);
  return { ...shared.default, ...zoneMessages.default };
}

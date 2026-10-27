import { getTranslations } from "next-intl/server";

import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";

/** Which banner a storage level asks for (D-276 notices at 80 % / 100 %; the thresholds are the API's `level`). */
export function storageBannerKind(
  storage: Pick<Schemas["OwnerStorageDto"], "level"> | null,
): "warning" | "full" | null {
  if (!storage?.level || storage.level === "ok") return null;
  return storage.level === "warning" ? "warning" : "full";
}

/**
 * The 80 % / 100 % storage banner (G1): what is happening and what to do — free space or add a package — with the
 * reassurance of D-286 (nothing is deleted, legal documents are always issued). Never red for "almost full".
 */
export async function StorageBanner({
  storage,
  manageHref,
}: {
  storage: Schemas["OwnerStorageDto"] | null;
  /** Link to the storage page; omitted on that page. */
  manageHref?: string;
}) {
  const kind = storageBannerKind(storage);
  if (!kind || !storage) return null;
  const t = await getTranslations("owner.subscription.storage.banner");
  return (
    <div data-testid="storage-banner" data-kind={kind}>
      <Callout
        tone={kind === "warning" ? "warning" : "danger"}
        title={t(`${kind}.title`, { percent: storage.usedPercent ?? 100 })}
        action={
          manageHref ? (
            <a href={manageHref} className="font-medium underline">
              {t("action")}
            </a>
          ) : undefined
        }
      >
        {t(`${kind}.body`)}
      </Callout>
    </div>
  );
}

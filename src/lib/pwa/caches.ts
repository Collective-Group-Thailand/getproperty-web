/**
 * Cache Storage names of the staff service worker (ADR-0007), shared by the worker and the page. Since review H2
 * only two caches exist, and neither holds anything personal: Next's hashed static assets and the static offline
 * page. Everything else under the `gp-staff-` prefix (the page caches of earlier workers, which held rendered
 * authenticated pages, images) is deleted on activation and on sign-out.
 */
export const STAFF_CACHE_PREFIX = "gp-staff-";
export const STAFF_STATIC_CACHE = "gp-staff-static";
export const STAFF_SHELL_CACHE_PREFIX = "gp-staff-shell-";
/** The static, unauthenticated offline page the worker shows when a navigation fails. */
export const STAFF_OFFLINE_PATH = "/offline";

/** Caches that hold nothing personal (survive sign-out). */
export function isSharedStaffCache(name: string): boolean {
  return name === STAFF_STATIC_CACHE || name.startsWith(STAFF_SHELL_CACHE_PREFIX);
}

/** Deletes every staff cache that could hold something personal (sign-out, review H2). Never throws. */
export async function purgeStaffCaches(storage: CacheStorage | undefined = globalThis.caches): Promise<string[]> {
  if (!storage) return [];
  try {
    const names = (await storage.keys()).filter(
      (name) => name.startsWith(STAFF_CACHE_PREFIX) && !isSharedStaffCache(name),
    );
    await Promise.all(names.map((name) => storage.delete(name)));
    return names;
  } catch {
    return [];
  }
}

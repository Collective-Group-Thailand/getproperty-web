import type { IconGlyph } from "@/ui/icons";

/**
 * Menu entitlements (`/v1/{owner,staff,admin}/me` → `menu`) are stable keys decided by the API from
 * permissions, tenant type and feature flags (getproperty-api `src/core/rbac/menu.ts`). Each zone maps
 * every key of the contract enum to a route, an icon and a label (`MenuRegistry`). The UI hides what
 * the user cannot do; the API stays the enforcement point.
 */
export interface MenuDefinition {
  /** Path inside the zone (owner paths get the locale prefix when rendered). */
  href: string;
  icon: IconGlyph;
  /** Section in the sidebar and the "more" sheet. */
  group: string;
}

export interface MenuItem extends MenuDefinition {
  key: string;
}

/**
 * A zone's routes per menu key, typed against the contract's enum (`OwnerMenuKey`, `StaffMenuKey`,
 * `AdminMenuKey`, D-180): a key the API adds fails the build until it has a route, an icon and a label.
 * `null` = the key is served by another entry's route (e.g. staff `reading_rounds` by `readings`).
 */
export type MenuRegistry<Key extends string> = Readonly<Record<Key, MenuDefinition | null>>;

export function entitledMenu<Key extends string>(keys: readonly Key[], registry: MenuRegistry<Key>): MenuItem[] {
  const seenKeys = new Set<string>();
  const seenHrefs = new Set<string>();
  const items: MenuItem[] = [];
  for (const key of keys) {
    const definition = registry[key];
    if (!definition || seenKeys.has(key) || seenHrefs.has(definition.href)) continue;
    seenKeys.add(key);
    seenHrefs.add(definition.href);
    items.push({ key, ...definition });
  }
  return items;
}

/** Whether a nav item is the current page: exact match, or the current path is below it. */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

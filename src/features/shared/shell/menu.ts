import type { IconGlyph } from "@/ui/icons";

/**
 * Menu entitlements (`/v1/{owner,staff,admin}/me` → `menu`) are stable keys decided by the API from
 * permissions, tenant type and feature flags (getproperty-api `src/core/rbac/menu.ts`). Each zone maps
 * the keys it knows to a route, an icon and a label; a key it does not know yet is skipped (and asked
 * for as a named enum in docs/contract-requests.md). The UI hides what the user cannot do; the API
 * stays the enforcement point.
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

export function entitledMenu(keys: readonly string[], registry: Readonly<Record<string, MenuDefinition>>): MenuItem[] {
  const seen = new Set<string>();
  const items: MenuItem[] = [];
  for (const key of keys) {
    const definition = registry[key];
    if (!definition || seen.has(key)) continue;
    seen.add(key);
    items.push({ key, ...definition });
  }
  return items;
}

/** Whether a nav item is the current page: exact match, or the current path is below it. */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

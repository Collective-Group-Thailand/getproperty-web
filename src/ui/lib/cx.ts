import { clsx, type ClassValue } from "clsx";

/**
 * Joins class names without tailwind-merge (JW4): for components whose callers never pass a utility that conflicts
 * with the component's own (layout additions only) — the icon, the gate kiosk kit. `cn` (`./cn.ts`) stays the default
 * wherever a caller may override; tailwind-merge alone is ~9 KB gz of the gate tablet's 180 KB first load (D-179).
 */
export function cx(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

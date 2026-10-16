import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The scale names tailwind-merge cannot guess. It only knows t-shirt sizes, so without these
 * `rounded-control` and `shadow-overlay` would never override each other. Listed here rather than
 * imported from `src/ui/tokens/scale.ts`, because `cn` ships in every client bundle and the token
 * module does not need to; `cn.test.ts` fails if a new radius or shadow in the tokens is missing.
 */
export const SEMANTIC_SCALE_NAMES = {
  radius: ["control", "card", "panel"],
  shadow: ["card", "raised", "overlay"],
};

const twMerge = extendTailwindMerge({ extend: { theme: SEMANTIC_SCALE_NAMES } });

/**
 * Joins class names and lets the *last* conflicting Tailwind utility win, so a caller can override a
 * component's default without `!important` or specificity games (ADR-0002).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

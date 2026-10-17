import type { AnchorHTMLAttributes } from "react";

import { usePathname as useNextPathname, useRouter as useNextRouter } from "./next-navigation";

/** `@/i18n/navigation` for Storybook (next-intl's navigation needs the Next router). */
export function Link({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; locale?: string }) {
  return <a href={href} {...props} />;
}

export const usePathname = useNextPathname;
export const useRouter = useNextRouter;
export function getPathname({ href }: { href: string; locale?: string }): string {
  return href;
}
export function redirect(): never {
  throw new Error("redirect() is not available in Storybook");
}
export const permanentRedirect = redirect;

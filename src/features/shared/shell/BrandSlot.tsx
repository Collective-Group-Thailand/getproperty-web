import { cn } from "@/ui/lib/cn";

import type { ShellBrand } from "./brand";

/**
 * Shows the shell's logo (`shellBrand()`, rendered on the server): the house alone while the sidebar is collapsed (and
 * on small phones unless `phone="full"`), the full logo otherwise. Both are in the markup, so switching costs no
 * request and no layout shift on hydration. Imports no brand code itself — safe inside a client frame.
 */
export function BrandSlot({
  brand,
  collapsed = false,
  phone = "compact",
}: {
  brand: ShellBrand;
  collapsed?: boolean;
  /** The logo below `sm`: the house (admin, beside the menu button) or the full wordmark (owner's top bar). */
  phone?: "full" | "compact";
}) {
  const full = phone === "full";
  return (
    <>
      <span
        className={cn(
          "inline-flex",
          full && "hidden",
          collapsed ? (full ? "md:inline-flex" : undefined) : full ? undefined : "sm:hidden",
        )}
        data-testid="brand-compact"
      >
        {brand.compact}
      </span>
      <span
        className={cn(full ? "inline-flex" : "hidden", collapsed ? "md:hidden" : full ? undefined : "sm:inline-flex")}
        data-testid="brand-full"
      >
        {brand.full}
      </span>
    </>
  );
}

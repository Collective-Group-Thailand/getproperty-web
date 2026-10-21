import { cn } from "@/ui/lib/cn";

import type { ShellBrand } from "./brand";

/**
 * Shows the shell's logo (`shellBrand()`, rendered on the server): the house alone on phones and while the
 * sidebar is collapsed, the full logo otherwise. Both are in the markup, so switching costs no request
 * and no layout shift on hydration. Imports no brand code itself — safe inside a client frame.
 */
export function BrandSlot({ brand, collapsed = false }: { brand: ShellBrand; collapsed?: boolean }) {
  return (
    <>
      <span className={cn("inline-flex", !collapsed && "sm:hidden")} data-testid="brand-compact">
        {brand.compact}
      </span>
      <span className={cn("hidden", !collapsed && "sm:inline-flex")} data-testid="brand-full">
        {brand.full}
      </span>
    </>
  );
}

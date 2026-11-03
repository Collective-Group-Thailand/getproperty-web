"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { ShellNavItem } from "@/features/shared/shell/types";
import { RailSearchButton } from "@/features/shared/shell/RailSearchButton";
import { lazyOverlay } from "@/ui/lib/lazy";

import type { GlobalSearchDialogProps } from "./GlobalSearchDialog";

const GlobalSearchDialog = lazyOverlay<GlobalSearchDialogProps>(() =>
  import("./GlobalSearchDialog").then((module) => module.GlobalSearchDialog),
);

/**
 * Global search (`/` opens it): menu entries match locally at once; entities come from
 * `GET /v1/owner/search` (buildings, units, parties, leases, devices, invoices); when it fails only the menu
 * part answers. The dialog loads on first open (D-179).
 */
export function GlobalSearch({
  items,
  tenantId,
  localePrefix,
  collapsed = false,
}: {
  items: ShellNavItem[];
  tenantId: string;
  localePrefix: string;
  /** In the console column: field-like from `md` (see RailSearchButton). */
  collapsed?: boolean;
}) {
  const t = useTranslations("shell.search");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <RailSearchButton
        label={t("open")}
        placeholder={t("placeholder")}
        collapsed={collapsed}
        onClick={() => setOpen(true)}
        testId="global-search"
      />
      <GlobalSearchDialog
        open={open}
        onOpenChange={setOpen}
        items={items}
        tenantId={tenantId}
        localePrefix={localePrefix}
      />
    </>
  );
}

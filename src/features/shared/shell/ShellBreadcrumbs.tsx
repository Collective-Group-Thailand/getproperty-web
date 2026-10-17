"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

import { Breadcrumbs, type Crumb } from "@/ui/components/Breadcrumbs";

import { isActive } from "./menu";
import type { ShellNavItem } from "./types";

const ExtraCrumbs = createContext<{ set: (items: Crumb[]) => void }>({ set: () => {} });

/**
 * Breadcrumbs of the console shells: home › the menu section of the current path, plus whatever the
 * page adds for itself with `<PageCrumbs>` (a building, a unit…).
 */
export function ShellBreadcrumbs({
  items,
  home,
  children,
}: {
  items: ShellNavItem[];
  home: ShellNavItem | undefined;
  children: React.ReactNode;
}) {
  const t = useTranslations("shell");
  const pathname = usePathname();
  const [extra, setExtra] = useState<Crumb[]>([]);
  const section = items
    .filter((item) => isActive(item.href, pathname))
    .sort((a, b) => b.href.length - a.href.length)[0];

  const trail: Crumb[] = [];
  if (home && section?.key !== home.key) trail.push({ label: home.label, href: home.href });
  if (section) trail.push({ label: section.label, href: extra.length ? section.href : undefined });
  trail.push(...extra);

  return (
    <ExtraCrumbs.Provider value={{ set: setExtra }}>
      {trail.length > 1 ? <Breadcrumbs items={trail} label={t("breadcrumbs")} className="px-4 pt-4 md:px-8" /> : null}
      {children}
    </ExtraCrumbs.Provider>
  );
}

/** A page's own trailing crumbs (the last one is the current page). */
export function PageCrumbs({ items }: { items: Crumb[] }) {
  const { set } = useContext(ExtraCrumbs);
  const serialised = JSON.stringify(items);
  useEffect(() => {
    set(JSON.parse(serialised) as Crumb[]);
    return () => set([]);
  }, [serialised, set]);
  return null;
}

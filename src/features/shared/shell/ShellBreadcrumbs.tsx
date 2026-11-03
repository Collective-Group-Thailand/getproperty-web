"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

import type { Crumb } from "@/ui/components/Breadcrumbs";
import { Icon } from "@/ui/icons";
import { IconChevronLeft } from "@/ui/icons/glyphs/chevron-left";

import { isActive } from "./menu";
import type { ShellNavItem } from "./types";

interface Trail {
  set: (items: Crumb[]) => void;
  /** Where "back" goes from this page: the parent record or the menu section; none on a section's own page. */
  back: { label: string; href: string } | null;
}

const TrailContext = createContext<Trail>({ set: () => {}, back: null });

/**
 * The console's way back (redesign G0, REDESIGN-PROMPT §4.2): a back link on record pages instead of breadcrumbs.
 * The shell knows the menu section of the current path; a page adds its own parents with `<PageCrumbs>` (a building,
 * a unit…) and the link goes to the nearest one. `PageHeader` renders it (`ShellBackLink`).
 */
export function ShellBreadcrumbs({
  items,
  children,
}: {
  items: ShellNavItem[];
  home?: ShellNavItem | undefined;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [extra, setExtra] = useState<Crumb[]>([]);
  const section = items
    .filter((item) => isActive(item.href, pathname))
    .sort((a, b) => b.href.length - a.href.length)[0];

  let back: Trail["back"] = null;
  const parents = extra.slice(0, -1).filter((crumb): crumb is Crumb & { href: string } => Boolean(crumb.href));
  const nearest = parents.at(-1);
  if (nearest) back = { label: String(nearest.label), href: nearest.href };
  else if (section && (extra.length > 0 || stripTrailing(pathname) !== stripTrailing(section.href)))
    back = { label: section.label, href: section.href };

  return <TrailContext.Provider value={{ set: setExtra, back }}>{children}</TrailContext.Provider>;
}

const stripTrailing = (path: string) => path.replace(/\/+$/, "") || "/";

/** A page's own trail (its parents, then itself); the back link goes to the nearest parent with a link. */
export function PageCrumbs({ items }: { items: Crumb[] }) {
  const { set } = useContext(TrailContext);
  const serialised = JSON.stringify(items);
  useEffect(() => {
    set(JSON.parse(serialised) as Crumb[]);
    return () => set([]);
  }, [serialised, set]);
  return null;
}

/** The back link above a page title: the explicit one, or the shell's nearest parent. */
export function ShellBackLink({ back }: { back?: { label: React.ReactNode; href: string } | null }) {
  const trail = useContext(TrailContext);
  const target = back === undefined ? trail.back : back;
  if (!target) return null;
  return (
    <Link
      href={target.href}
      className="text-muted hover:text-fg rounded-control focus-visible:ring-focus-ring -ms-1 inline-flex w-fit items-center gap-1 px-1 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
      data-testid="back-link"
    >
      <Icon icon={IconChevronLeft} className="rtl:rotate-180" />
      {target.label}
    </Link>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { IconButton } from "@/ui/components/IconButton";
import { LazyDropdownMenu as DropdownMenu } from "@/ui/components/overlays";
import type { IconGlyph } from "@/ui/icons";
import { IconMore } from "@/ui/icons/glyphs/more";
import { cn } from "@/ui/lib/cn";

interface Entry {
  id: string;
  label: string;
  icon?: IconGlyph;
  testId?: string;
  destructive?: boolean;
  disabled?: boolean;
  select: () => void;
}

interface Registry {
  put: (entry: Entry) => void;
  drop: (id: string) => void;
}

const noop = () => () => {};

const MenuContext = createContext<Registry | null>(null);

/**
 * How a dialog action reads as an item of an `ActionMenu`, when that differs from its own button: a menu wording
 * ("แก้ไขบทบาทและอาคาร" for "แก้ไข") or red for an action whose dialog is not destructive in tone (revoke an invitation).
 */
export interface MenuItemOptions {
  label?: string;
  destructive?: boolean;
}

/**
 * Lets a dialog action (`ConfirmAction`, `FormDialog`) live in a "⋯" menu: inside an `ActionMenu` it adds itself as a
 * menu item and renders only its dialog; elsewhere it returns false and the action renders its own button.
 */
export function useMenuEntry(entry: Omit<Entry, "id" | "select">, open: () => void): boolean {
  const menu = useContext(MenuContext);
  const id = useId();
  const latest = useRef(open);
  useEffect(() => {
    latest.current = open;
  });
  const { label, icon, testId, destructive, disabled } = entry;
  useEffect(() => {
    if (!menu) return;
    menu.put({
      id,
      label,
      icon,
      testId,
      destructive,
      disabled,
      // Open after the menu has closed and handed focus back, so the dialog keeps it.
      select: () => window.setTimeout(() => latest.current(), 0),
    });
    return () => menu.drop(id);
  }, [menu, id, label, icon, testId, destructive, disabled]);
  return Boolean(menu);
}

/**
 * The "⋯" of a row or a panel (REDESIGN-PROMPT §4.5–4.6): the record's secondary actions in one menu instead of a row
 * of buttons. Children are the actions themselves (`ConfirmAction`, `FormDialog` …); each becomes an item in the order
 * given, destructive ones in red, and opens its own dialog. Renders nothing visible when no action applies.
 */
export function ActionMenu({
  label,
  children,
  testId,
  className,
  variant = "ghost",
}: {
  /** Accessible name of the button and the menu ("การดำเนินการกับ สมชาย"), from `src/i18n` (default "more actions"). */
  label?: string;
  children: React.ReactNode;
  testId?: string;
  className?: string;
  variant?: "ghost" | "secondary";
}) {
  const common = useTranslations("common");
  const name = label ?? common("moreActions");
  const [entries, setEntries] = useState<Entry[]>([]);
  // Hydrated: an empty menu may hide its "⋯" (before that, nothing has registered yet).
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const registry = useMemo<Registry>(
    () => ({
      put: (entry) =>
        setEntries((current) => {
          const index = current.findIndex((one) => one.id === entry.id);
          if (index === -1) return [...current, entry];
          const next = current.slice();
          next[index] = entry;
          return next;
        }),
      drop: (id) => setEntries((current) => current.filter((one) => one.id !== id)),
    }),
    [],
  );
  const empty = mounted && entries.length === 0;
  return (
    <MenuContext.Provider value={registry}>
      <span className={cn("inline-flex", empty && "invisible", className)} aria-hidden={empty || undefined}>
        <DropdownMenu
          label={name}
          trigger={<IconButton icon={IconMore} label={name} variant={variant} data-testid={testId} />}
          items={entries.map((entry, index) => ({
            id: entry.id,
            label: <span data-testid={entry.testId}>{entry.label}</span>,
            icon: entry.icon,
            destructive: entry.destructive,
            disabled: entry.disabled,
            separatorBefore: Boolean(entry.destructive) && index > 0 && !entries[index - 1]?.destructive,
            onSelect: entry.select,
          }))}
        />
      </span>
      {children}
    </MenuContext.Provider>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import type { ShellNavItem } from "@/features/shared/shell/types";
import { Dialog } from "@/ui/components/Dialog";
import { IconButton } from "@/ui/components/IconButton";
import { Input } from "@/ui/components/Input";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

/**
 * The admin command palette (Ctrl/⌘ K): jump to any entitled back-office page by name. Arrow keys
 * move, Enter opens. Entries are the admin menu entitlements only — what the user may open.
 */
export function CommandPalette({ items }: { items: ShellNavItem[] }) {
  const t = useTranslations("shell.commandPalette");
  const common = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? items.filter((item) => item.label.toLowerCase().includes(needle) || item.key.includes(needle))
      : items;
  }, [items, query]);

  const go = (item: ShellNavItem | undefined) => {
    if (item) window.location.assign(item.href);
  };

  return (
    <>
      <IconButton
        name="command"
        label={`${t("open")} (${t("hint")})`}
        onClick={() => setOpen(true)}
        data-testid="command-palette"
      />
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          setQuery("");
          setIndex(0);
        }}
        title={t("title")}
        closeLabel={common("close")}
      >
        <Input
          autoFocus
          value={query}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          role="combobox"
          aria-expanded="true"
          aria-controls="command-palette-list"
          aria-activedescendant={matches[index] ? `command-${matches[index]!.key}` : undefined}
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIndex((current) => Math.min(current + 1, matches.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setIndex((current) => Math.max(current - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              go(matches[index]);
            }
          }}
        />
        <ul
          id="command-palette-list"
          role="listbox"
          aria-label={t("title")}
          className="mt-3 flex max-h-80 flex-col overflow-y-auto"
        >
          {matches.map((item, position) => (
            <li
              key={item.key}
              id={`command-${item.key}`}
              role="option"
              aria-selected={position === index}
              onMouseEnter={() => setIndex(position)}
              onClick={() => go(item)}
              className={cn(
                "rounded-control flex cursor-pointer items-center gap-3 px-3 py-2",
                position === index && "bg-primary-subtle text-primary-subtle-fg",
              )}
            >
              <Icon name={item.icon} />
              {item.label}
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}

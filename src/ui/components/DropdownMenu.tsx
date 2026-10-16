"use client";

import { DropdownMenu as MenuPrimitive } from "radix-ui";

import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";

export interface MenuItem {
  id: string;
  label: React.ReactNode;
  icon?: IconName;
  onSelect?: () => void;
  /** Rendered with a check mark, for a menu of choices (theme, language). */
  selected?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  /** A rule above this item. */
  separatorBefore?: boolean;
}

export interface DropdownMenuProps {
  /** Accessible name of the menu, from `src/i18n`. */
  label: string;
  trigger: React.ReactElement;
  items: MenuItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: "start" | "center" | "end";
}

/** Row actions and small choice menus on Radix: roving focus, typeahead, Escape closes. */
export function DropdownMenu({ label, trigger, items, align = "end", ...props }: DropdownMenuProps) {
  return (
    <MenuPrimitive.Root {...props}>
      <MenuPrimitive.Trigger asChild>{trigger}</MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content
          align={align}
          sideOffset={4}
          aria-label={label}
          className="border-border bg-surface-raised rounded-card shadow-overlay z-modal min-w-48 border p-1"
        >
          {items.map((item) => (
            <div key={item.id}>
              {item.separatorBefore ? <MenuPrimitive.Separator className="bg-border my-1 h-px" /> : null}
              <MenuPrimitive.Item
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(
                  "rounded-control data-highlighted:bg-bg-subtle flex min-h-10 cursor-default items-center gap-2 px-3 py-2 text-base outline-none select-none data-disabled:opacity-50",
                  item.destructive && "text-danger-subtle-fg",
                )}
              >
                {item.icon ? <Icon name={item.icon} className="text-muted" /> : null}
                <span className="flex-1">{item.label}</span>
                {item.selected ? <Icon name="check" className="text-primary" /> : null}
              </MenuPrimitive.Item>
            </div>
          ))}
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}

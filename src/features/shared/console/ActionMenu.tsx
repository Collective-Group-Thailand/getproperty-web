"use client";

import { Fragment, useState } from "react";

import { IconButton } from "@/ui/components/IconButton";
import { LazyDropdownMenu as DropdownMenu } from "@/ui/components/overlays";
import type { IconGlyph } from "@/ui/icons";
import { IconMore } from "@/ui/icons/glyphs/more";

/** A dialog opened from outside its own trigger (an `ActionMenu` item): pass both or neither. */
export interface DialogControl {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export interface MenuAction {
  id: string;
  label: string;
  icon?: IconGlyph;
  /** Red, last, after a rule (REDESIGN-PROMPT §4.5: the destructive one last). */
  destructive?: boolean;
  separatorBefore?: boolean;
  testId?: string;
  /**
   * The dialog the item opens — a `FormDialog` or `ConfirmAction` in controlled mode (`open` / `onOpenChange`), so the
   * row shows one "⋯" instead of a row of buttons.
   */
  dialog: (control: { open: boolean; onOpenChange: (open: boolean) => void }) => React.ReactNode;
}

/**
 * The "⋯" of a row or a card (REDESIGN-PROMPT §4.5): one quiet icon button, a menu of the record's secondary actions,
 * each opening its own confirmation or form. Renders nothing when there is no action.
 */
export function ActionMenu({
  label,
  actions,
  testId,
  variant = "ghost",
}: {
  /** Accessible name of the button and the menu ("การดำเนินการกับ สมชาย"), from `src/i18n`. */
  label: string;
  actions: MenuAction[];
  testId?: string;
  variant?: "ghost" | "secondary";
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (actions.length === 0) return null;
  return (
    <>
      <DropdownMenu
        label={label}
        trigger={<IconButton icon={IconMore} label={label} variant={variant} data-testid={testId} />}
        items={actions.map((action) => ({
          id: action.id,
          label: <span data-testid={action.testId}>{action.label}</span>,
          icon: action.icon,
          destructive: action.destructive,
          separatorBefore: action.separatorBefore,
          // Let the menu close (and hand focus back) before the dialog takes it.
          onSelect: () => window.setTimeout(() => setOpenId(action.id), 0),
        }))}
      />
      {actions.map((action) => (
        <Fragment key={action.id}>
          {action.dialog({ open: openId === action.id, onOpenChange: (open) => setOpenId(open ? action.id : null) })}
        </Fragment>
      ))}
    </>
  );
}

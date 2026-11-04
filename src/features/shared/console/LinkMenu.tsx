"use client";

import { useRouter } from "next/navigation";

import { LazyDropdownMenu as DropdownMenu } from "@/ui/components/overlays";
import { IconButton } from "@/ui/components/IconButton";
import type { IconGlyph } from "@/ui/icons";
import { IconMore } from "@/ui/icons/glyphs/more";

/**
 * The "⋯" of a page head or a row (REDESIGN-PROMPT §4.5–4.6) when its rare actions are pages to open: one outlined
 * icon button, a menu of links. Server pages pass plain hrefs; the menu navigates on select.
 */
export function LinkMenu({
  label,
  items,
  testId,
  variant = "secondary",
}: {
  /** Accessible name of the button and the menu, from `src/i18n`. */
  label: string;
  items: { id: string; label: string; href: string; icon?: IconGlyph; testId?: string }[];
  testId?: string;
  /** `ghost` in a table row (the row is the target; the "⋯" stays quiet). */
  variant?: "secondary" | "ghost";
}) {
  const router = useRouter();
  if (items.length === 0) return null;
  return (
    <DropdownMenu
      label={label}
      trigger={<IconButton icon={IconMore} label={label} variant={variant} data-testid={testId} />}
      items={items.map((item) => ({
        id: item.id,
        label: <span data-testid={item.testId}>{item.label}</span>,
        icon: item.icon,
        onSelect: () => router.push(item.href),
      }))}
    />
  );
}

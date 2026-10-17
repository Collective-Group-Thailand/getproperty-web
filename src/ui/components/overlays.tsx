"use client";

import { lazyOverlay, lazyTriggered } from "../lib/lazy";
import type { AlertDialogProps } from "./AlertDialog";
import type { DialogProps } from "./Dialog";
import type { DropdownMenuProps } from "./DropdownMenu";
import type { PopoverProps } from "./Popover";
import type { SheetProps } from "./Sheet";

/**
 * The overlays as app code uses them (D-179): same props as `Sheet`, `Dialog`, `AlertDialog`,
 * `DropdownMenu` and `Popover`, but each is downloaded the first time it opens (see `../lib/lazy`).
 * Zones import these; the eager components are for Storybook, tests and other `src/ui` components.
 */
export const LazySheet = lazyOverlay<SheetProps>(() => import("./Sheet").then((module) => module.Sheet));
export const LazyDialog = lazyOverlay<DialogProps>(() => import("./Dialog").then((module) => module.Dialog));
export const LazyAlertDialog = lazyOverlay<AlertDialogProps>(() =>
  import("./AlertDialog").then((module) => module.AlertDialog),
);
export const LazyDropdownMenu = lazyTriggered<DropdownMenuProps>(
  () => import("./DropdownMenu").then((module) => module.DropdownMenu),
  "menu",
);
export const LazyPopover = lazyTriggered<PopoverProps>(
  () => import("./Popover").then((module) => module.Popover),
  "dialog",
);

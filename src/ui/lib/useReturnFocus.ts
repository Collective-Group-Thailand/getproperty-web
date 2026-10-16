"use client";

import { useRef } from "react";

/**
 * Returns focus to whatever was focused before an overlay opened (WCAG 2.4.3).
 *
 * Radix's own restore focuses `Dialog.Trigger`'s ref, and our dialogs are *controlled* — they
 * are opened from a toolbar button, a menu item or a keyboard shortcut, with no Trigger child.
 * That ref is therefore null and focus lands on `<body>`, which drops a keyboard user back to
 * the top of the page. Requiring a Trigger at every call site would be worse.
 *
 * So the element is captured in `onOpenAutoFocus`, which Radix's FocusScope dispatches *before*
 * it moves focus into the overlay, and restored in `onCloseAutoFocus`, where `preventDefault()`
 * stops Radix reaching for its empty trigger ref.
 */
export function useReturnFocus() {
  const previous = useRef<HTMLElement | null>(null);

  return {
    onOpenAutoFocus: () => {
      const active = document.activeElement;
      previous.current = active instanceof HTMLElement ? active : null;
    },
    onCloseAutoFocus: (event: Event) => {
      const target = previous.current;
      if (!target?.isConnected) return;
      event.preventDefault();
      target.focus();
    },
  };
}

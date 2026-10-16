"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import {
  dataThemeAttribute,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  themeChoicesFor,
  type ThemeChoice,
  type Zone,
} from "./themes";

interface ThemeContextValue {
  /** What the user chose, including `system`. */
  choice: ThemeChoice;
  /** The choices this zone offers (the staff PWA also offers high contrast). */
  choices: readonly ThemeChoice[];
  setChoice: (choice: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Keeps the `gp_theme` cookie and the `data-theme` attribute in step (ADR-0003).
 *
 * The *initial* value comes from the server, which already stamped `<html>`, so there is nothing to
 * correct on hydration and no flash. Switching theme writes the cookie and the attribute directly:
 * no re-render of the tree, no request, and the next server render agrees because it reads the same
 * cookie.
 */
export function ThemeProvider({
  children,
  initialChoice,
  zone,
}: {
  children: React.ReactNode;
  initialChoice: ThemeChoice;
  zone: Zone;
}) {
  const [choice, setChoiceState] = useState<ThemeChoice>(initialChoice);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);

    const theme = dataThemeAttribute(next);
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;

    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax${
      window.location.protocol === "https:" ? "; secure" : ""
    }`;
  }, []);

  const value = useMemo(() => ({ choice, choices: themeChoicesFor(zone), setChoice }), [choice, setChoice, zone]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>");
  return context;
}

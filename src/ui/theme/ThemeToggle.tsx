"use client";

import { DropdownMenu } from "../components/DropdownMenu";
import { IconButton } from "../components/IconButton";
import type { IconName } from "../icons";
import { useTheme } from "./ThemeProvider";
import type { ThemeChoice } from "./themes";

const CHOICE_ICON: Record<ThemeChoice, IconName> = {
  system: "theme-system",
  light: "theme-light",
  dark: "theme-dark",
  hc: "theme-contrast",
};

export interface ThemeToggleProps {
  /** Accessible name for the trigger, from `src/i18n`. */
  label: string;
  /** One label per choice this zone offers, from `src/i18n`. */
  choiceLabels: Record<ThemeChoice, string>;
}

/**
 * The theme picker (ADR-0003). Writes the `gp_theme` cookie and flips `data-theme`, so the next
 * server render agrees with what the user is already looking at. Only the staff zone offers `hc`.
 */
export function ThemeToggle({ label, choiceLabels }: ThemeToggleProps) {
  const { choice, choices, setChoice } = useTheme();

  return (
    <DropdownMenu
      label={label}
      trigger={<IconButton name={CHOICE_ICON[choice]} label={label} size="sm" variant="ghost" />}
      items={choices.map((option) => ({
        id: option,
        label: choiceLabels[option],
        icon: CHOICE_ICON[option],
        selected: option === choice,
        onSelect: () => setChoice(option),
      }))}
    />
  );
}

import type { Decorator, Preview } from "@storybook/react-vite";

import { TooltipProvider } from "../src/ui/components/Tooltip";
import { ThemeProvider } from "../src/ui/theme/ThemeProvider";
import { THEMES, type Zone } from "../src/ui/theme/themes";

import "./preview.css";

/**
 * Stamps `data-theme` and `data-zone` the way a zone's root layout does, so every story can be viewed
 * in all three themes and at each zone's density from the toolbar.
 */
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme as (typeof THEMES)[number] | "";
  const zone = (context.globals.zone as Zone | undefined) || "owner";
  const root = document.documentElement;

  if (theme) root.dataset.theme = theme;
  else delete root.dataset.theme;
  root.dataset.zone = zone;

  return (
    <ThemeProvider initialChoice={theme || "system"} zone={zone}>
      <TooltipProvider>
        <div className="bg-bg text-fg min-h-full p-6">
          <Story />
        </div>
      </TooltipProvider>
    </ThemeProvider>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  initialGlobals: { theme: "light", zone: "owner" },
  globalTypes: {
    theme: {
      description: "Token theme",
      toolbar: {
        title: "Theme",
        icon: "paintbrush",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
          { value: "hc", title: "High contrast" },
          { value: "", title: "Follow the OS" },
        ],
        dynamicTitle: true,
      },
    },
    zone: {
      description: "Zone the story renders in",
      toolbar: {
        title: "Zone",
        icon: "globe",
        items: [
          { value: "owner", title: "Owner" },
          { value: "staff", title: "Staff" },
          { value: "admin", title: "Admin" },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
    // Advisory here; the gate that fails CI is in Vitest and Playwright.
    a11y: { test: "todo" },
    docs: { toc: true },
    options: {
      storySort: {
        order: [
          "Docs",
          ["Principles", "Tokens", "Voice & tone"],
          "Brand",
          "Foundations",
          "Forms",
          "Overlays",
          "Navigation",
          "Data",
          "Feedback",
          "Patterns",
        ],
      },
    },
  },
};

export default preview;

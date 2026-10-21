import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

import noMoneyArithmetic from "./eslint-rules/no-money-arithmetic.mjs";
import zoneBoundaries from "./eslint-rules/zone-boundaries.mjs";

/**
 * Attributes that are read aloud or shown to a person.
 *
 * A screen reader user hears `aria-label`, so an untranslated one is an English-only screen for
 * exactly the audience least able to work around it (design-system.md §6). An empty `alt=""` is
 * exempt: that is the standard way to mark an image decorative.
 */
const UNTRANSLATED_ATTRIBUTE = {
  selector:
    "JSXAttribute[name.name=/^(alt|title|placeholder|aria-label|aria-placeholder|aria-roledescription|aria-valuetext|aria-description)$/] > Literal[value!='']",
  message:
    "This attribute is read by a person or a screen reader, so its text belongs in src/i18n (design-system.md §8). Pass a translated string instead of a literal.",
};

/**
 * Token-usage rules (ADR-0003, D-100), matched in class strings — plain literals and template-literal
 * parts, which is where `className` and `cva` keep them.
 */
function classPattern(regex, message) {
  return [
    { selector: `Literal[value=${regex}]`, message },
    { selector: `TemplateElement[value.raw=${regex}]`, message },
  ];
}

const UTILITY_START = "(^|[\\s:!])";

/** Components name semantic tokens; a primitive step bypasses the themes and the contrast gate. */
const PRIMITIVE_PALETTE = classPattern(
  `/${UTILITY_START}(bg|text|border|ring|outline|fill|stroke|from|via|to|decoration|divide|shadow|placeholder|caret)-(neutral|brand|green|amber|red|blue)-(50|[1-9]00|950)\\b/`,
  "Raw palette steps skip the themes and the contrast gate (ADR-0003). Use a semantic token such as bg-surface, text-muted or bg-primary.",
);

/**
 * Amber is "needs attention" and red is danger, never "money that is merely due" (design-system.md §2,
 * D-100). Zones reach both through `src/ui` components (`<StatusBadge>`, `<Callout tone>`), which is
 * where that promise can be kept.
 */
const TONE_OUTSIDE_UI = classPattern(
  `/${UTILITY_START}(bg|text|border|ring|outline|fill|stroke|from|via|to|decoration|divide)-(warning|danger)(-|\\b)/`,
  'warning (amber) and danger (red) are reached through src/ui components — <StatusBadge>, <Callout tone>, <Button variant="destructive"> — never as raw utilities in a zone (design-system.md §2).',
);

/** D-179: single glyphs only — the registry and Lucide would ship the whole icon set. */
const ICON_PATHS = [
  {
    name: "lucide-react",
    message: "Icons come from the curated set: import { IconX } from '@/ui/icons/glyphs/x' (D-179).",
  },
];
const ICON_PATTERNS = [
  {
    regex: "(^@/ui/icons/registry$|/icons/registry$|^\\./registry$)",
    message:
      "The icon registry holds every glyph and is for Storybook/tests only. Import single glyphs from '@/ui/icons/glyphs/<name>' (D-179).",
  },
  {
    regex: "^lucide-react/",
    message: "Icons come from the curated set: import { IconX } from '@/ui/icons/glyphs/x' (D-179).",
  },
];

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "storybook-static/**",
      ".integration/**",
      // Generated from the OpenAPI contract (F1). `pnpm gen:api --check` keeps it honest, not the linter.
      "src/lib/api/schema.d.ts",
      "src/lib/api/generated/**",
      "src/lib/pwa/generated/**",
      "mocks/generated/**",
      "next-env.d.ts",
    ],
  },
  ...coreWebVitals,
  ...nextTypescript,
  prettier,
  {
    linterOptions: { reportUnusedDisableDirectives: "error" },
    plugins: {
      getproperty: { rules: { "zone-boundaries": zoneBoundaries, "no-money-arithmetic": noMoneyArithmetic } },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^$" }],
    },
  },

  {
    /**
     * UI copy comes from `src/i18n`, not from JSX (design-system.md §8). Thai is the default locale and
     * English is a real audience, so a literal that slips through ships a half-English screen.
     *
     * `src/ui` is included deliberately: its components take their copy as props so they stay usable
     * in Storybook — a primitive with a Thai string baked in breaks that.
     */
    files: ["src/app/**/*.tsx", "src/features/**/*.tsx", "src/ui/**/*.tsx"],
    // global-error renders without a layout, so without i18n: its two bilingual lines are the exception.
    ignores: ["**/*.stories.tsx", "**/*.test.tsx", "src/ui/docs/**", "src/app/global-error.tsx"],
    rules: {
      "react/jsx-no-literals": [
        "error",
        {
          noStrings: true,
          ignoreProps: true,
          allowedStrings: [
            "·",
            "—",
            "–",
            "-",
            "/",
            "|",
            ":",
            ",",
            ".",
            "×",
            "+",
            "@",
            "?",
            "!",
            "฿",
            "%",
            "#",
            "*",
            "→",
            "©",
          ],
        },
      ],
      "no-restricted-syntax": ["error", UNTRANSLATED_ATTRIBUTE, ...PRIMITIVE_PALETTE],
    },
  },

  {
    files: ["src/app/**/*.tsx", "src/features/**/*.tsx"],
    ignores: ["**/*.stories.tsx", "**/*.test.tsx"],
    rules: {
      "no-restricted-syntax": ["error", UNTRANSLATED_ATTRIBUTE, ...PRIMITIVE_PALETTE, ...TONE_OUTSIDE_UI],
    },
  },

  {
    // Zone isolation (00-master-plan.md §3). The rule reads the zone from the file's path; it runs on
    // all of src/ so the shared middle cannot import a retired zone either (D-154).
    files: ["src/**/*.{ts,tsx}"],
    rules: { "getproperty/zone-boundaries": "error" },
  },

  {
    // Initial-JS budgets (D-179): a page ships only the glyphs it draws. Icons are imported one by one
    // from `@/ui/icons/glyphs/<name>`; the by-name registry and Lucide's components would pull the whole set.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["**/*.stories.tsx", "**/*.test.{ts,tsx}", "src/ui/icons/registry.ts"],
    rules: { "no-restricted-imports": ["error", { paths: ICON_PATHS, patterns: ICON_PATTERNS }] },
  },

  {
    // D-179: zones open overlays through `@/ui/components/overlays` (loaded on first open); the eager
    // components would put Radix Dialog/Menu/Popper into every page of the zone.
    files: ["src/app/**/*.{ts,tsx}", "src/features/**/*.{ts,tsx}"],
    ignores: ["**/*.stories.tsx", "**/*.test.{ts,tsx}", "src/features/shared/storybook/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ICON_PATHS,
          patterns: [
            ...ICON_PATTERNS,
            {
              regex: "^@/ui/components/(Sheet|Dialog|AlertDialog|DropdownMenu|Popover|ToastViewport)$",
              allowTypeImports: true,
              message:
                "Use LazySheet / LazyDialog / LazyAlertDialog / LazyDropdownMenu / LazyPopover from '@/ui/components/overlays' and toast/Toaster from '@/ui/components/Toast' (D-179).",
            },
          ],
        },
      ],
    },
  },

  {
    // The UI formats money and meter quantities and never computes them (CLAUDE.md).
    files: ["src/app/**/*.{ts,tsx}", "src/features/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "**/*.stories.tsx"],
    rules: { "getproperty/no-money-arithmetic": "error" },
  },
];

export default eslintConfig;

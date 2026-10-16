import { composeStories, setProjectAnnotations } from "@storybook/react-vite";
import axe from "axe-core";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import preview from "../../../.storybook/preview";

/**
 * The accessibility gate (design-system.md §6, F0 0.2): every story of every `src/ui` component is
 * rendered under jsdom and must leave axe with nothing to say. Stories are the test fixtures, so a
 * component without a story has no gate — and `stories.test.ts` fails if one is missing.
 *
 * `color-contrast` is off here (jsdom does not paint; `contrast.test.ts` proves every token pair) and
 * `region` too (a story is a fragment, not a page). Overlays render through portals, so axe runs on
 * `document.body`.
 */
setProjectAnnotations([preview]);

const modules = import.meta.glob<Record<string, unknown>>("../**/*.stories.tsx", { eager: true });

for (const [path, mod] of Object.entries(modules)) {
  const name = path.replace(/^.*\/([^/]+)\.stories\.tsx$/, "$1");
  const stories = composeStories(mod as never) as Record<string, React.ComponentType & { storyName?: string }>;

  describe(name, () => {
    for (const [storyName, Story] of Object.entries(stories)) {
      it(`${storyName} is axe-clean`, async () => {
        render(<Story />);
        // Let Radix portals and effects (open dialogs, menus) settle.
        await new Promise((resolve) => setTimeout(resolve, 20));
        const results = await axe.run(document.body, {
          rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
        });
        const summary = results.violations
          .map((v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.html).join("\n  ")}`)
          .join("\n");
        expect(results.violations, summary).toEqual([]);
      });
    }
  });
}

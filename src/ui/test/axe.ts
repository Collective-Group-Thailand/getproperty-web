import axe, { type AxeResults, type RunOptions } from "axe-core";
import { render, type RenderOptions } from "@testing-library/react";
import { expect } from "vitest";

/**
 * The accessibility gate for `src/ui` (design-system.md §6): every component's test renders its
 * stories' states and asserts axe finds nothing. Runs under Vitest + jsdom, so it is part of
 * `pnpm test` rather than a Storybook add-on nobody opens. Colour contrast is excluded here — jsdom
 * does not lay out or paint, and the token gate (`contrast.test.ts`) already proves every pair.
 */
export async function expectNoAxeViolations(
  ui: React.ReactElement,
  options: RenderOptions & { axe?: RunOptions } = {},
) {
  const { axe: axeOptions, ...renderOptions } = options;
  const { container } = render(ui, renderOptions);
  const results: AxeResults = await axe.run(container, {
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    ...axeOptions,
  });
  const summary = results.violations
    .map((v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.html).join("\n  ")}`)
    .join("\n");
  expect(results.violations, summary).toEqual([]);
  return container;
}

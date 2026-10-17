import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/** Every component file in src/ui/components has a story beside it, so the axe gate covers it. */
describe("src/ui/components", () => {
  const dir = join(__dirname, "../components");
  const files = readdirSync(dir);
  const components = files.filter((f) => /^[A-Z][A-Za-z]+\.tsx$/.test(f)).map((f) => f.replace(".tsx", ""));
  // Several components share one file and one story: Input/NumberInput/Textarea live in Field's.
  // ToastViewport is the lazily loaded half of Toast (D-179); ScanPanel the lazily loaded half of ScanButton.
  const coveredBy: Record<string, string> = { Input: "Field", ToastViewport: "Toast", ScanPanel: "ScanButton" };

  it.each(components)("%s has a story", (component) => {
    const story = `${coveredBy[component] ?? component}.stories.tsx`;
    expect(files, `${story} is missing`).toContain(story);
  });
});

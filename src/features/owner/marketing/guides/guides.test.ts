import { describe, expect, it } from "vitest";

import { GUIDES_EN } from "./content.en";
import { GUIDES_TH } from "./content.th";

describe("guides content (D-271)", () => {
  it("has the same guides, sections and FAQ count in Thai and English", () => {
    expect(GUIDES_EN.map((g) => g.slug)).toEqual(GUIDES_TH.map((g) => g.slug));
    GUIDES_TH.forEach((th, index) => {
      const en = GUIDES_EN[index]!;
      expect(en.sections.map((s) => s.id)).toEqual(th.sections.map((s) => s.id));
      expect(en.faq).toHaveLength(th.faq.length);
      expect(en.category).toBe(th.category);
      expect(en.general).toBe(th.general);
    });
  });

  it("keeps slugs URL-safe, summaries short and dates ISO", () => {
    for (const guide of [...GUIDES_TH, ...GUIDES_EN]) {
      expect(guide.slug).toMatch(/^[a-z0-9-]{1,80}$/);
      expect(guide.summary.length).toBeLessThanOrEqual(200);
      expect(guide.reviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const source of guide.sources) expect(source.url).toMatch(/^https:\/\//);
    }
  });

  it("labels every legal or tax guide as general information", () => {
    for (const guide of [...GUIDES_TH, ...GUIDES_EN]) {
      if (guide.category === "tax" || guide.category === "law") expect(guide.general).toBe(true);
    }
  });
});

import { hasAffiliateLinks, sameShape, validateArticle } from "@collective/content";
import { describe, expect, it } from "vitest";

import { GUIDES_EN } from "../../../../../mocks/data/guides/content.en";
import { GUIDES_TH } from "../../../../../mocks/data/guides/content.th";

/*
 * The guides now live in getproperty-api (B7.13, edited in admin › Guides); these files are the mock API's copy of the
 * seed (`pnpm dev:mock`, e2e). They must stay valid articles so the pages render them like the real ones.
 */
describe("guides of the mock API (D-271, D-277)", () => {
  it("has the same guides, sections and FAQ count in Thai and English", () => {
    expect(GUIDES_EN.map((g) => g.slug)).toEqual(GUIDES_TH.map((g) => g.slug));
    GUIDES_TH.forEach((th, index) => {
      const en = GUIDES_EN[index]!;
      expect(sameShape(th, en)).toBe(true);
      expect(en.category).toBe(th.category);
      expect(en.general).toBe(th.general);
      expect(en.audience).toBe(th.audience);
      expect(hasAffiliateLinks(en)).toBe(hasAffiliateLinks(th));
    });
  });

  it("passes the shared article validation (slug, summary, ISO dates, https sources)", () => {
    for (const { audience, ...article } of [...GUIDES_TH, ...GUIDES_EN]) {
      void audience; // getproperty's own field; the shared schema is strict
      const result = validateArticle(article);
      expect({ guide: `${article.locale}/${article.slug}`, problems: result.ok ? [] : result.problems }).toEqual({
        guide: `${article.locale}/${article.slug}`,
        problems: [],
      });
    }
    expect(GUIDES_TH.every((g) => g.locale === "th")).toBe(true);
    expect(GUIDES_EN.every((g) => g.locale === "en")).toBe(true);
  });

  it("labels every legal or tax guide as general information", () => {
    for (const guide of [...GUIDES_TH, ...GUIDES_EN]) {
      if (guide.category === "tax" || guide.category === "law") expect(guide.general).toBe(true);
    }
  });
});

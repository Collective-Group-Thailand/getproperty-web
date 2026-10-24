import type { Article, ArticleBlock, ArticleSection } from "@collective/content";

/*
 * Guides (D-271): long-form public articles kept as content files per locale — not in the message catalogues, which
 * hold interface copy. The model is the shared article of `@collective/content` (D-277) with getproperty's categories
 * and the audience of the closing call to action. Each guide has a reviewed date and its sources; legal and tax guides
 * say they are general information. Plain data only: the page renders the blocks.
 */
export type GuideBlock = ArticleBlock;
export type GuideSection = ArticleSection;

export type GuideCategory = "tax" | "law" | "landlord" | "operations";

export interface Guide extends Article {
  locale: "th" | "en";
  category: GuideCategory;
  /** Who the product call to action speaks to at the end. */
  audience: "landlord" | "apartment";
}

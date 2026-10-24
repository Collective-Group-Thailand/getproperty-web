/*
 * Guides (D-271): long-form public articles kept as content files per locale — not in the message catalogues, which
 * hold interface copy. Each guide has a reviewed date and its sources; legal and tax guides say they are general
 * information. Plain data only: the page renders the blocks.
 */
export type GuideBlock =
  | { p: string }
  | { ul: string[] }
  | { ol: string[] }
  /** A highlighted aside: a rule of thumb, a warning, or how getproperty helps. */
  | { note: string; tone?: "info" | "warning" | "product" };

export interface GuideSection {
  /** Anchor id, stable across locales (the table of contents links to it). */
  id: string;
  heading: string;
  blocks: GuideBlock[];
}

export type GuideCategory = "tax" | "law" | "landlord" | "operations";

export interface Guide {
  slug: string;
  category: GuideCategory;
  title: string;
  /** Meta description and the hub card text (≤ 160 characters). */
  summary: string;
  /** The short answer first (AEO): two or three sentences an answer engine can quote. */
  answer: string;
  /** ISO date the content was last checked against its sources. */
  reviewed: string;
  readMinutes: number;
  /** Who the product call to action speaks to at the end. */
  audience: "landlord" | "apartment";
  /** Legal or tax content: show the "general information, not advice" notice. */
  general: boolean;
  sections: GuideSection[];
  faq: { q: string; a: string }[];
  sources: { label: string; url: string }[];
}

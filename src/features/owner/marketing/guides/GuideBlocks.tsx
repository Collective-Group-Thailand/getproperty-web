import { affiliateLinkProps } from "@collective/content";

import { Callout } from "@/ui/components/Callout";
import { Icon } from "@/ui/icons";
import { IconExternal } from "@/ui/icons/glyphs/external";

import type { GuideBlock } from "./types";

/** A note is a callout with its icon and word — never a coloured side stripe (G1 redesign 2026-11-03). */
const NOTE_TONE = { info: "neutral", warning: "warning", product: "info" } as const;

export interface AffiliateLabels {
  /** Small heading of the product box. */
  label: string;
  /** "View at {merchant}" with the merchant filled in. */
  at: (merchant: string) => string;
}

/** The body of one guide section: paragraphs, lists, asides and affiliate products (D-277), in reading width. */
export function GuideBlocks({
  blocks,
  noteLabels,
  affiliateLabels,
}: {
  blocks: GuideBlock[];
  noteLabels: Record<keyof typeof NOTE_TONE, string>;
  affiliateLabels: AffiliateLabels;
}) {
  return (
    <div className="flex flex-col gap-5 text-lg">
      {blocks.map((block, index) => {
        if ("p" in block) return <p key={index}>{block.p}</p>;
        if ("ul" in block)
          return (
            <ul key={index} className="marker:text-primary flex list-disc flex-col gap-2 ps-6">
              {block.ul.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          );
        if ("ol" in block)
          return (
            <ol key={index} className="marker:text-muted flex list-decimal flex-col gap-2 ps-6 marker:font-mono">
              {block.ol.map((item) => (
                <li key={item} className="ps-1">
                  {item}
                </li>
              ))}
            </ol>
          );
        if ("affiliate" in block) {
          const item = block.affiliate;
          // rel="sponsored nofollow", new tab, https only (affiliateLinkProps throws otherwise); the page shows the
          // disclosure once above the sources.
          return (
            <aside
              key={index}
              className="border-border bg-surface rounded-card flex flex-col gap-1 border px-5 py-4 text-base"
            >
              <p className="text-muted text-sm font-semibold">{affiliateLabels.label}</p>
              <p className="font-semibold">{item.name}</p>
              <p className="text-muted">{item.why}</p>
              <a
                {...affiliateLinkProps(item)}
                className="hover:text-primary mt-1 inline-flex items-center gap-1 self-start text-sm underline underline-offset-4"
              >
                {affiliateLabels.at(item.merchant)}
                <Icon icon={IconExternal} />
              </a>
            </aside>
          );
        }
        const tone = block.tone ?? "info";
        return (
          <aside key={index}>
            <Callout tone={NOTE_TONE[tone]} title={noteLabels[tone]} className="text-base">
              {block.note}
            </Callout>
          </aside>
        );
      })}
    </div>
  );
}

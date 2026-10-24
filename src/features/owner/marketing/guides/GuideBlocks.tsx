import { cn } from "@/ui/lib/cn";

import type { GuideBlock } from "./types";

const NOTE_TONE = {
  info: "border-border-strong bg-bg-subtle",
  warning: "border-fg bg-bg-subtle",
  product: "border-primary bg-primary-subtle",
} as const;

/** The body of one guide section: paragraphs, lists and asides, in reading width. */
export function GuideBlocks({
  blocks,
  noteLabels,
}: {
  blocks: GuideBlock[];
  noteLabels: Record<keyof typeof NOTE_TONE, string>;
}) {
  return (
    <div className="flex flex-col gap-5 text-lg leading-relaxed">
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
        const tone = block.tone ?? "info";
        return (
          <aside key={index} className={cn("rounded-control border-s-4 px-5 py-4 text-base", NOTE_TONE[tone])}>
            <p className="mb-1 text-sm font-semibold">{noteLabels[tone]}</p>
            <p>{block.note}</p>
          </aside>
        );
      })}
    </div>
  );
}

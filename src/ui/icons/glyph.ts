/** One SVG element of a glyph: tag and attributes on Lucide's 24-px grid. */
export type IconNodeElement = readonly [tag: string, attrs: Readonly<Record<string, string | number>>];

/**
 * An icon as plain data (D-179): what `<Icon icon={…}>` draws. Being data rather than a component, a
 * glyph is tree-shaken like any constant and can cross from a server component to a client one as a
 * prop. Glyphs come only from `./glyphs` (generated from the curated set in `./curated.ts`).
 */
export interface IconGlyph<N extends string = string> {
  readonly name: N;
  readonly node: readonly IconNodeElement[];
}

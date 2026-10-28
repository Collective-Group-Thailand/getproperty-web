/**
 * The editor's live view of a contract text (G3, D-294) — **display only**: the API owns the clause diff, the
 * variable catalogue and the compliance check. A clause is a `<section>` keyed by its `<h2>` (the API's rule); text
 * outside every section is the frame. Nothing here is ever rendered as HTML: tags are stripped and the result is shown
 * as text, so a draft cannot run anything in the console.
 */

export interface OutlineClause {
  /** The heading as typed (`""` for the frame). */
  title: string;
  /** The clause's text with tags removed and whitespace collapsed. */
  text: string;
  /** `{{variables}}` used in the clause, in order, once each. */
  variables: string[];
}

const SECTION = /<section\b[^>]*>([\s\S]*?)<\/section>/gi;
const HEADING = /<h2\b[^>]*>([\s\S]*?)<\/h2>/i;
const TOKEN = /\{\{\s*([#/]?)([\w.]+)(?:\s+([\w.]+))?[^}]*\}\}/g;
const KEYWORDS = new Set(["if", "unless", "each", "with", "else", "this"]);

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };

export function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name: string) => ENTITIES[name] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The variable names a text uses (block helpers' arguments included, keywords and `this.*` left out). */
export function variablesIn(html: string): string[] {
  const out: string[] = [];
  for (const match of html.matchAll(TOKEN)) {
    const [, mark, word, arg] = match;
    const name = mark === "#" ? arg : mark === "/" ? undefined : word;
    if (!name || KEYWORDS.has(name) || name.startsWith("this.")) continue;
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

/** The clauses of a text in order (the frame first when it has text). */
export function outline(html: string): OutlineClause[] {
  const clauses: OutlineClause[] = [];
  let frame = html;
  let n = 0;
  for (const match of html.matchAll(SECTION)) {
    n += 1;
    frame = frame.replace(match[0], "");
    const inner = match[1] ?? "";
    const heading = HEADING.exec(inner)?.[1];
    clauses.push({
      title: heading ? stripTags(heading) : `§${n}`,
      text: stripTags(heading ? inner.replace(HEADING, "") : inner),
      variables: variablesIn(inner),
    });
  }
  const frameText = stripTags(frame);
  if (frameText) clauses.unshift({ title: "", text: frameText, variables: variablesIn(frame) });
  return clauses;
}

export type TextPart = { kind: "text"; value: string } | { kind: "variable"; value: string };

/** Splits plain text into text and `{{variable}}` parts so the preview can mark each variable. */
export function textParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
    if (match.index > last) parts.push({ kind: "text", value: text.slice(last, match.index) });
    parts.push({ kind: "variable", value: match[1]! });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", value: text.slice(last) });
  return parts;
}

/** Inserts `{{name}}` in place of the selection; returns the new text and where the caret goes. */
export function insertVariable(
  text: string,
  start: number,
  end: number,
  name: string,
): { text: string; caret: number } {
  const token = `{{${name}}}`;
  return { text: text.slice(0, start) + token + text.slice(end), caret: start + token.length };
}

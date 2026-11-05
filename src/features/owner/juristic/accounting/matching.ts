import { isNegative } from "./money";

/**
 * The bank statement matching queue (J2.1 §7): statement lines on the left, the API's ranked candidates for the
 * selected line on the right. The API decides what matches; this file orders the queue, says how far the file is
 * and picks the line to show after an action, so the office can work down the queue without hunting for the next one.
 */
export interface QueueLine {
  id: string;
  lineNo: number;
  bookedOn: string;
  amount: string;
  matchKind: string;
}

export type LineState = "unmatched" | "matched" | "ignored";

export function lineState(line: Pick<QueueLine, "matchKind">): LineState {
  if (line.matchKind === "ignored") return "ignored";
  return line.matchKind === "none" ? "unmatched" : "matched";
}

/** Money in or out of the account (the API's amount is signed). */
export function direction(amount: string): "in" | "out" {
  return isNegative(amount) ? "out" : "in";
}

/** The queue in statement order: by date, then the line's number in the file. */
export function queueOrder<Line extends QueueLine>(lines: readonly Line[]): Line[] {
  return [...lines].sort((a, b) => a.bookedOn.localeCompare(b.bookedOn) || a.lineNo - b.lineNo);
}

export interface QueueProgress {
  /** Lines settled (matched or ignored). */
  done: number;
  total: number;
  matched: number;
  ignored: number;
  unmatched: number;
  /** 0–1, drawing only. */
  share: number;
}

/** How far a statement is, from the API's counts (ignored = the rest). */
export function queueProgress(statement: { lineCount: number; matchedCount: number; unmatchedCount: number }) {
  const total = statement.lineCount;
  const matched = statement.matchedCount;
  const unmatched = statement.unmatchedCount;
  const ignored = Math.max(0, total - matched - unmatched);
  const done = matched + ignored;
  return {
    done,
    total,
    matched,
    ignored,
    unmatched,
    share: total > 0 ? done / total : 0,
  } satisfies QueueProgress;
}

/**
 * The line to select after the current one was matched or ignored: the next unmatched line after it in statement
 * order, else the first unmatched one before it, else `null` (the queue is done).
 */
export function nextLineAfter<Line extends QueueLine>(lines: readonly Line[], currentId: string): Line | null {
  const ordered = queueOrder(lines);
  const at = ordered.findIndex((line) => line.id === currentId);
  const open = (line: Line) => line.id !== currentId && lineState(line) === "unmatched";
  return ordered.slice(at + 1).find(open) ?? ordered.slice(0, Math.max(0, at)).find(open) ?? null;
}

/** The selected line: the one asked for when it is in the list, else the first unmatched, else the first. */
export function selectLine<Line extends QueueLine>(lines: readonly Line[], wanted: string | undefined): Line | null {
  const ordered = queueOrder(lines);
  return (
    ordered.find((line) => line.id === wanted) ??
    ordered.find((line) => lineState(line) === "unmatched") ??
    ordered[0] ??
    null
  );
}

export interface Suggestion {
  kind: string;
  id: string;
  label: string;
  days: number;
  referenceHit: boolean;
}

/**
 * Candidates as the API ranks them, made stable for the screen: a reference found in the bank text first, then the
 * closest date, then the label. The first one is "best" only when it is clearly ahead (a reference hit or alone).
 */
export function rankSuggestions<S extends Suggestion>(suggestions: readonly S[]): { list: S[]; best: S | null } {
  const list = [...suggestions].sort(
    (a, b) => Number(b.referenceHit) - Number(a.referenceHit) || a.days - b.days || a.label.localeCompare(b.label),
  );
  const first = list[0] ?? null;
  const clear = first !== null && (list.length === 1 || (first.referenceHit && !list[1]!.referenceHit));
  return { list, best: clear ? first : null };
}

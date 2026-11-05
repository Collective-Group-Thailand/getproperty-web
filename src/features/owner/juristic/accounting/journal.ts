import { parseSatang, satangString } from "./money";

/**
 * A manual journal as the office types it (J2.1 §2: opening balances, WHT remittance, corrections). Each line is a
 * debit **or** a credit; the journal needs at least two lines and Σ debit = Σ credit — the database refuses anything
 * else at commit, so the form refuses it first and says why. Amounts are the user's own input, summed in satang.
 */
export interface JournalDraftLine {
  accountId: string;
  debit: string;
  credit: string;
  unitId?: string;
  memo?: string;
}

export type JournalLineError = "account" | "amount" | "both" | "none";
export type JournalProblem = "lines" | "unbalanced" | "lineErrors";

export interface JournalCheck {
  /** Per line: what is wrong, or `null` (blank lines are ignored entirely). */
  lineErrors: (JournalLineError | null)[];
  /** Σ debit / Σ credit / debit − credit of the valid lines, as decimal strings. */
  debit: string;
  credit: string;
  difference: string;
  /** Lines that count (not blank, no error). */
  counted: number;
  balanced: boolean;
  problems: JournalProblem[];
  /** Ready to send: ≥ 2 counted lines, no line errors, balanced and not zero. */
  ok: boolean;
}

const blank = (line: JournalDraftLine) => !line.accountId && !line.debit.trim() && !line.credit.trim();

export function checkJournal(lines: readonly JournalDraftLine[]): JournalCheck {
  let debit = 0n;
  let credit = 0n;
  let counted = 0;
  const lineErrors = lines.map((line): JournalLineError | null => {
    if (blank(line)) return null;
    const hasDebit = line.debit.trim() !== "";
    const hasCredit = line.credit.trim() !== "";
    const d = hasDebit ? parseSatang(line.debit) : 0n;
    const c = hasCredit ? parseSatang(line.credit) : 0n;
    if (d === null || c === null) return "amount";
    if (d > 0n && c > 0n) return "both";
    if (d === 0n && c === 0n) return "none";
    if (!line.accountId) return "account";
    debit += d;
    credit += c;
    counted += 1;
    return null;
  });
  const balanced = debit === credit && debit > 0n;
  const problems: JournalProblem[] = [];
  if (lineErrors.some((error) => error !== null)) problems.push("lineErrors");
  if (counted < 2) problems.push("lines");
  if (!balanced) problems.push("unbalanced");
  return {
    lineErrors,
    debit: satangString(debit),
    credit: satangString(credit),
    difference: satangString(debit - credit),
    counted,
    balanced,
    problems,
    ok: problems.length === 0,
  };
}

/** The lines to send: blank lines dropped, each amount normalised, the empty side left out. */
export function journalLinesForApi(lines: readonly JournalDraftLine[]): {
  accountId: string;
  debit?: string;
  credit?: string;
  unitId?: string;
  memo?: string;
}[] {
  return lines
    .filter((line) => !blank(line))
    .map((line) => {
      const d = parseSatang(line.debit);
      const c = parseSatang(line.credit);
      return {
        accountId: line.accountId,
        ...(d !== null && d > 0n ? { debit: satangString(d) } : {}),
        ...(c !== null && c > 0n ? { credit: satangString(c) } : {}),
        ...(line.unitId ? { unitId: line.unitId } : {}),
        ...(line.memo?.trim() ? { memo: line.memo.trim() } : {}),
      };
    });
}

export const emptyJournalLine = (): JournalDraftLine => ({
  accountId: "",
  debit: "",
  credit: "",
  unitId: "",
  memo: "",
});

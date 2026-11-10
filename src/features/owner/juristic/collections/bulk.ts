import { isApiError } from "@/lib/api/errors";

/** Why a selected row was left out of a bulk action before anything was sent (message keys `bulk.skip.<reason>`). */
export type SkipReason = "noLine" | "inPlan" | "inDispute" | "noCase" | "nothingDue";

export interface BulkOutcome<Row> {
  done: Row[];
  skipped: { row: Row; reason: SkipReason }[];
  failed: { row: Row; code: string; message: string }[];
}

/**
 * Runs one request per selected row, one after another (the API's own rules decide each; a bulk endpoint is a contract
 * request): rows the action does not apply to are skipped with a reason before anything is sent, a refusal of one
 * row never stops the others, and the outcome lists each row's fate for the summary.
 */
export async function runBulk<Row>(
  rows: readonly Row[],
  skip: (row: Row) => SkipReason | null,
  send: (row: Row) => Promise<unknown>,
): Promise<BulkOutcome<Row>> {
  const outcome: BulkOutcome<Row> = { done: [], skipped: [], failed: [] };
  for (const row of rows) {
    const reason = skip(row);
    if (reason) {
      outcome.skipped.push({ row, reason });
      continue;
    }
    try {
      await send(row);
      outcome.done.push(row);
    } catch (error) {
      outcome.failed.push({
        row,
        code: isApiError(error) ? error.code : "network",
        message: isApiError(error) ? error.detail || error.title : "",
      });
    }
  }
  return outcome;
}

/**
 * Sends one row's request with its own `Idempotency-Key`, kept in `keys` under `id` (action × row × what is sent)
 * until the API has answered (review W5, like the invite sheet): a dropped connection, a 408 / 429 or a 5xx leaves the
 * key, so running the bulk action again replays the request instead of reminding twice or opening a second plan; a
 * success or a refusal drops it, and the next run is a new request.
 */
export async function keyedSend<T>(
  keys: Map<string, string>,
  id: string,
  send: (key: string) => Promise<T>,
): Promise<T> {
  const key = keys.get(id) ?? crypto.randomUUID();
  keys.set(id, key);
  try {
    const answer = await send(key);
    keys.delete(id);
    return answer;
  } catch (error) {
    const answered =
      isApiError(error) && error.status !== 408 && error.status !== 429 && error.status < 500 && error.status > 0;
    if (answered) keys.delete(id);
    throw error;
  }
}

/** The skip rules of the three bulk actions (J-DESIGN §3), from the row's own facts. */
export const BULK_SKIP = {
  /** A reminder goes out on LINE: an owner reached only by e-mail or paper gets the statement instead. */
  remind: (row: { channels: string[]; disputeOpen: boolean }): SkipReason | null =>
    row.disputeOpen ? "inDispute" : row.channels.includes("line") ? null : "noLine",
  /** One open plan per owner × unit: a row already in a plan is left alone. */
  plan: (row: { planId: string | null; disputeOpen: boolean }): SkipReason | null =>
    row.planId ? "inPlan" : row.disputeOpen ? "inDispute" : null,
  /** Pausing opens a dispute on the case; there must be a case, and not one already disputed. */
  dispute: (row: { caseId: string | null; disputeOpen: boolean }): SkipReason | null =>
    !row.caseId ? "noCase" : row.disputeOpen ? "inDispute" : null,
} as const;

import type { Schemas } from "@/lib/api/types";

/** A baht amount as typed (no arithmetic: the API's decimal string rules — up to 2 decimals, more than zero). */
export const MONEY = /^\d{1,9}(\.\d{1,2})?$/;
const ZERO = /^0+(\.0{1,2})?$/;

/** The juristic manual channel (J1.2a §2): a note that says where the money came from, at least this long. */
export const JURISTIC_NOTE_MIN = 5;

export interface ManualPaymentInput {
  method: Schemas["ManualPaymentMethod"];
  amount: string;
  paidDate: string | null;
  notes: string;
  /** The uploaded evidence's document id, once stored. */
  evidenceDocumentId: string | null;
}

export type ManualPaymentField = "amount" | "paidDate" | "notes" | "evidence";
/** Message keys of `owner.payments.manual.error.*`. */
export type ManualPaymentError = "amount" | "date" | "noteShort" | "evidenceRequired";

/**
 * What a hand-recorded payment still lacks before it is sent (inline errors; the API checks again). Apartments: a
 * bank transfer needs its evidence. Juristic tenants (J1.2a §2): cash **and** transfers need the evidence and a note of
 * at least five characters (a foreign transfer's sender bank or SWIFT reference) — 422 from the API otherwise.
 */
export function manualPaymentErrors(
  input: ManualPaymentInput,
  options: { juristic: boolean },
): Partial<Record<ManualPaymentField, ManualPaymentError>> {
  const errors: Partial<Record<ManualPaymentField, ManualPaymentError>> = {};
  const amount = input.amount.trim();
  if (!MONEY.test(amount) || ZERO.test(amount)) errors.amount = "amount";
  if (!input.paidDate) errors.paidDate = "date";
  const evidenceNeeded = options.juristic || input.method === "bank_transfer_manual";
  if (evidenceNeeded && !input.evidenceDocumentId) errors.evidence = "evidenceRequired";
  if (options.juristic && input.notes.trim().length < JURISTIC_NOTE_MIN) errors.notes = "noteShort";
  return errors;
}

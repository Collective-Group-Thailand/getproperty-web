import type { Schemas } from "@/lib/api/types";

import { checkShares, evenShares, type ShareCheck } from "./shares";

/**
 * The whole-unit transfer wizard (J1.1b, D-307): the date the buyers own the unit from → the buyers and their shares
 * → a review that restates the unit, the date and the shares before the API records it. The proration of issued
 * advance invoices (credit notes to the sellers, charges to the buyers) is the API's: the wizard shows its answer.
 * Pure state (unit-tested); the page renders it.
 */
export type TransferStep = "date" | "buyers" | "review";
export const TRANSFER_STEPS: readonly TransferStep[] = ["date", "buyers", "review"];

export interface BuyerDraft {
  key: string;
  /** An existing party of the tenant, or a new person / company created with the transfer. */
  source: "existing" | "new";
  partyId: string;
  type: Schemas["PartyType"];
  displayName: string;
  phone: string;
  email: string;
  share: string;
}

export interface TransferState {
  step: TransferStep;
  transferDate: string;
  policy: Schemas["TransferProration"] | "";
  note: string;
  buyers: BuyerDraft[];
  /** Field errors shown after a "next" that could not move on (validate on submit, then on change). */
  showErrors: boolean;
}

export type TransferAction =
  | { type: "date"; value: string }
  | { type: "policy"; value: Schemas["TransferProration"] | "" }
  | { type: "note"; value: string }
  | { type: "addBuyer"; key: string }
  | { type: "removeBuyer"; key: string }
  | { type: "buyer"; key: string; patch: Partial<Omit<BuyerDraft, "key">> }
  | { type: "splitEvenly" }
  | { type: "next" }
  | { type: "back" }
  | { type: "goto"; step: TransferStep };

export function emptyBuyer(key: string): BuyerDraft {
  return { key, source: "new", partyId: "", type: "person", displayName: "", phone: "", email: "", share: "" };
}

export function initialTransfer(firstKey = "buyer-1"): TransferState {
  return {
    step: "date",
    transferDate: "",
    policy: "",
    note: "",
    buyers: [{ ...emptyBuyer(firstKey), share: "100" }],
    showErrors: false,
  };
}

export type BuyerError = "party" | "name" | "share" | "shareZero";

export interface TransferCheck {
  date: "required" | "invalid" | null;
  buyers: Record<string, BuyerError[]>;
  shares: ShareCheck;
  /** Two rows naming the same existing party. */
  duplicate: boolean;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function checkTransfer(state: TransferState): TransferCheck {
  const shares = checkShares(state.buyers.map((buyer) => buyer.share));
  const buyers = Object.fromEntries(
    state.buyers.map((buyer, index) => {
      const errors: BuyerError[] = [];
      if (buyer.source === "existing" && !buyer.partyId) errors.push("party");
      if (buyer.source === "new" && buyer.displayName.trim().length === 0) errors.push("name");
      const share = shares.errors[index];
      if (share === "format") errors.push("share");
      if (share === "zero") errors.push("shareZero");
      return [buyer.key, errors];
    }),
  );
  const chosen = state.buyers.filter((buyer) => buyer.source === "existing" && buyer.partyId).map((b) => b.partyId);
  return {
    date: state.transferDate === "" ? "required" : validDate(state.transferDate) ? null : "invalid",
    buyers,
    shares,
    duplicate: new Set(chosen).size !== chosen.length,
  };
}

/** Whether the open step is complete (the next step may open). */
export function stepComplete(state: TransferState, step: TransferStep = state.step): boolean {
  const check = checkTransfer(state);
  if (step === "date") return check.date === null;
  if (step === "buyers")
    return (
      state.buyers.length > 0 &&
      Object.values(check.buyers).every((errors) => errors.length === 0) &&
      check.shares.ok &&
      !check.duplicate
    );
  return stepComplete(state, "date") && stepComplete(state, "buyers");
}

export function transferReducer(state: TransferState, action: TransferAction): TransferState {
  switch (action.type) {
    case "date":
      return { ...state, transferDate: action.value };
    case "policy":
      return { ...state, policy: action.value };
    case "note":
      return { ...state, note: action.value };
    case "addBuyer":
      return { ...state, buyers: [...state.buyers, emptyBuyer(action.key)] };
    case "removeBuyer":
      return state.buyers.length < 2
        ? state
        : { ...state, buyers: state.buyers.filter((buyer) => buyer.key !== action.key) };
    case "buyer":
      return {
        ...state,
        buyers: state.buyers.map((buyer) => (buyer.key === action.key ? { ...buyer, ...action.patch } : buyer)),
      };
    case "splitEvenly": {
      const shares = evenShares(state.buyers.length);
      return { ...state, buyers: state.buyers.map((buyer, index) => ({ ...buyer, share: shares[index]! })) };
    }
    case "next": {
      if (!stepComplete(state)) return { ...state, showErrors: true };
      const index = TRANSFER_STEPS.indexOf(state.step);
      return { ...state, step: TRANSFER_STEPS[Math.min(index + 1, TRANSFER_STEPS.length - 1)]!, showErrors: false };
    }
    case "back": {
      const index = TRANSFER_STEPS.indexOf(state.step);
      return { ...state, step: TRANSFER_STEPS[Math.max(index - 1, 0)]!, showErrors: false };
    }
    case "goto": {
      // Only back to a step already passed, or forward over complete steps.
      const target = TRANSFER_STEPS.indexOf(action.step);
      const passed = TRANSFER_STEPS.slice(0, target).every((step) => stepComplete(state, step));
      return passed ? { ...state, step: action.step, showErrors: false } : state;
    }
  }
}

/** The request body (`TransferCreateDto`) of a complete wizard. */
export function transferBody(state: TransferState): Schemas["TransferCreateDto"] {
  return {
    transferDate: state.transferDate,
    ...(state.policy ? { policy: state.policy } : {}),
    ...(state.note.trim() ? { note: state.note.trim() } : {}),
    buyers: state.buyers.map((buyer) =>
      buyer.source === "existing"
        ? { partyId: buyer.partyId, sharePct: buyer.share.trim().replace(/%$/, "").trim() }
        : {
            sharePct: buyer.share.trim().replace(/%$/, "").trim(),
            party: {
              type: buyer.type,
              displayName: buyer.displayName.trim(),
              ...(buyer.phone.trim() ? { phone: buyer.phone.trim() } : {}),
              ...(buyer.email.trim() ? { email: buyer.email.trim() } : {}),
            },
          },
    ),
  };
}

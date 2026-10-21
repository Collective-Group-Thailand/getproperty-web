import type { components } from "../../src/lib/api/schema";
import { BUILDING_A, BUILDING_B, INVOICE, LEASE, PARTY, PAYMENT, UNIT, day, iso, type MockInvoice } from "./world";

type Schemas = components["schemas"];

/**
 * Seeds of the release-fix and B6 parts of the owner world (mocks/owner/release.ts serves them). `world.ts`
 * imports this file, so nothing here touches a `world.ts` binding at load time — only inside the seed
 * functions, which run once the world module has finished loading.
 */
const HOUR = 3_600_000;
const id = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const LINK_REQUEST = { malee: id("11c00000", 1), anan: id("11c00000", 2) } as const;
export const HELD_PAYMENT = id("9a9e0000", 9);
export const TM30 = { b101: id("7a300000", 1), a302: id("7a300000", 2), done: id("7a300000", 3) } as const;
export const ETAX = { signed: id("e7a00000", 1), rejected: id("e7a00000", 2), queued: id("e7a00000", 3) } as const;

// ---------------------------------------------------------------------------------------------------
// Seeds

/** A QR callback that repeats A-201's paid transfer: held, never booked (D-220). */
export function initialHeldPayments(invoices: MockInvoice[]): Schemas["PaymentDto"][] {
  const a201 = invoices.find((invoice) => invoice.id === INVOICE.a201prev)!;
  return [
    {
      id: HELD_PAYMENT,
      amount: a201.total,
      allocatedTotal: "0.00",
      creditedAmount: "0.00",
      whtAmount: "0.00",
      allocations: [],
      method: "qr",
      provider: "kbank",
      providerRef: "KB-20261001-0001-R",
      status: "pending",
      confirmedVia: null,
      confirmedAt: null,
      paidAt: new Date(Date.now() - 2 * HOUR).toISOString(),
      invoiceId: a201.id,
      payerName: "สมศักดิ์ ใจดี",
      payerPartyId: PARTY.somsak,
      unitId: UNIT.a201,
      unitNo: "A-201",
      evidenceDocumentId: null,
      slipReviewId: null,
      notes: null,
      receipts: [],
      reconciledAt: null,
      reverseReason: null,
      heldReason: "qr_already_paid",
      duplicateOfPaymentId: PAYMENT.qr101,
      dismissedAt: null,
      dismissReason: null,
      reversedAt: null,
      nextActions: ["confirm", "dismiss"],
      version: 1,
    },
  ];
}

export function initialLinkRequests(): Schemas["PartyLinkRequestDto"][] {
  return [
    {
      id: LINK_REQUEST.malee,
      partyId: PARTY.malee,
      partyDisplayName: "มาลี ศรีสุข",
      userId: id("05e00000", 102),
      userDisplayName: "Malee S.",
      lineLinked: true,
      via: "phone_match",
      state: "pending",
      requestedAt: new Date(Date.now() - 3 * HOUR).toISOString(),
      decidedAt: null,
      rejectReason: null,
      linkId: null,
    },
    {
      id: LINK_REQUEST.anan,
      partyId: PARTY.anan,
      partyDisplayName: "อนันต์ พากเพียร",
      userId: id("05e00000", 103),
      userDisplayName: "อนันต์",
      lineLinked: true,
      via: "phone_match",
      state: "confirmed",
      requestedAt: iso(-20),
      decidedAt: iso(-19),
      rejectReason: null,
      linkId: id("11c10000", 2),
    },
  ];
}

function tm30(
  partial: Pick<
    Schemas["Tm30ExportDto"],
    "id" | "buildingId" | "unitId" | "unitNo" | "leaseId" | "partyId" | "name" | "status" | "movedInAt" | "dueAt"
  > &
    Partial<Schemas["Tm30ExportDto"]>,
): Schemas["Tm30ExportDto"] {
  const row: Schemas["Tm30ExportDto"] = {
    nationality: null,
    arrivalDate: null,
    overdue: false,
    missing: [],
    format: "immigration_xlsx_v1",
    generatedAt: null,
    fileDocumentId: null,
    downloadedAt: null,
    submittedAt: null,
    submissionRef: null,
    cancelReason: null,
    nextActions: [],
    ...partial,
  };
  return refreshTm30(row);
}

/** `overdue` and `nextActions` as the API derives them from the status and the clock. */
export function refreshTm30(row: Schemas["Tm30ExportDto"]): Schemas["Tm30ExportDto"] {
  const pending = ["due", "generated", "downloaded"].includes(row.status);
  row.overdue = pending && Date.parse(row.dueAt) < Date.now();
  row.nextActions = pending ? ["generate", "mark-submitted", "cancel"] : [];
  if (!pending) row.missing = [];
  return row;
}

export function initialTm30(): Schemas["Tm30ExportDto"][] {
  const movedB101 = Date.now() - 6 * HOUR;
  const movedA302 = Date.now() - 30 * HOUR;
  return [
    tm30({
      id: TM30.b101,
      buildingId: BUILDING_B,
      unitId: UNIT.b101,
      unitNo: "B-101",
      leaseId: LEASE.b101,
      partyId: id("9a7f0000", 1),
      name: "John Smith",
      nationality: "GB",
      arrivalDate: day(-3),
      status: "due",
      movedInAt: new Date(movedB101).toISOString(),
      dueAt: new Date(movedB101 + 24 * HOUR).toISOString(),
    }),
    tm30({
      id: TM30.a302,
      buildingId: BUILDING_A,
      unitId: UNIT.a302,
      unitNo: "A-302",
      leaseId: LEASE.a302,
      partyId: id("9a7f0000", 2),
      name: "Aung Kyaw",
      nationality: "MM",
      status: "due",
      missing: ["passportNo", "arrivalDate"],
      movedInAt: new Date(movedA302).toISOString(),
      dueAt: new Date(movedA302 + 24 * HOUR).toISOString(),
    }),
    tm30({
      id: TM30.done,
      buildingId: BUILDING_A,
      unitId: UNIT.a201,
      unitNo: "A-201",
      leaseId: LEASE.a201,
      partyId: id("9a7f0000", 3),
      name: "Lena Müller",
      nationality: "DE",
      arrivalDate: day(-62),
      status: "submitted_manually",
      movedInAt: iso(-60),
      dueAt: iso(-59),
      generatedAt: iso(-59.5),
      fileDocumentId: id("d0c7a300", 3),
      downloadedAt: iso(-59.5),
      submittedAt: iso(-59.4),
      submissionRef: "TM30-6610-000077",
    }),
  ];
}

function etax(
  partial: Pick<Schemas["EtaxSubmissionDto"], "id" | "number" | "status"> & Partial<Schemas["EtaxSubmissionDto"]>,
): Schemas["EtaxSubmissionDto"] {
  const row: Schemas["EtaxSubmissionDto"] = {
    buildingId: BUILDING_A,
    subjectType: "receipt",
    subjectId: id("9ece0000", 1),
    documentTypeCode: "T03",
    issuedAt: iso(-2),
    subtotal: "4205.61",
    vatAmount: "294.39",
    total: "4500.00",
    provider: "inet",
    providerDocId: null,
    attempts: 1,
    nextAttemptAt: null,
    sourceDocumentId: id("d0c0e7a0", 1),
    signedPdfDocumentId: null,
    signedXmlDocumentId: null,
    submittedAt: iso(-2),
    signedAt: null,
    error: null,
    nextActions: [],
    ...partial,
  };
  row.nextActions = row.status === "rejected" || row.status === "failed" ? ["retry"] : [];
  return row;
}

export function initialEtax(): Schemas["EtaxSubmissionDto"][] {
  return [
    etax({
      id: ETAX.rejected,
      number: "RC2610-0003",
      status: "rejected",
      attempts: 3,
      issuedAt: iso(-1),
      submittedAt: iso(-1),
      error: "Buyer tax id 0105500000000 is not valid (checksum)",
      subjectId: id("9ece0000", 3),
    }),
    etax({
      id: ETAX.queued,
      number: "RC2610-0002",
      status: "queued",
      attempts: 0,
      submittedAt: null,
      nextAttemptAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      subjectId: id("9ece0000", 2),
    }),
    etax({
      id: ETAX.signed,
      number: "RC2610-0001",
      status: "signed",
      providerDocId: "TX-20261019-0001",
      issuedAt: iso(-3),
      submittedAt: iso(-3),
      signedAt: iso(-2.9),
      signedPdfDocumentId: id("d0c0e7a0", 11),
      signedXmlDocumentId: id("d0c0e7a0", 12),
    }),
  ];
}

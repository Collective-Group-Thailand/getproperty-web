import type { Schemas } from "@/lib/api/types";

/**
 * Exactly what the public verification page may show (D-306, D-025 PDPA): the document's type, number and status, its
 * dates, the issuer, the unit number and the holder's **initials**. Built field by field from the API's answer, so a
 * field the API might add later never reaches the page by accident.
 */
export interface VerifyView {
  documentType: Schemas["VerifiedDocumentType"];
  number: string;
  status: Schemas["VerifiedDocumentStatus"];
  issuedAt: string;
  asOf: string;
  validUntil: string;
  issuer: string;
  unitNo: string;
  holderInitials: string;
}

export function verifyView(document: Schemas["VerifiedDocumentDto"]): VerifyView {
  return {
    documentType: document.documentType,
    number: document.number,
    status: document.status,
    issuedAt: document.issuedAt,
    asOf: document.asOf,
    validUntil: document.validUntil,
    issuer: document.issuer,
    unitNo: document.unitNo,
    // Initials only, even if a longer name were ever sent: letters, dots and spaces, at most 12 characters.
    holderInitials: document.holderInitials.replace(/[^\p{L}.\s]/gu, "").slice(0, 12),
  };
}

/** A verification code as printed under the QR: letters and digits (and dashes), 6–64 characters. */
export function plausibleVerifyCode(code: string): boolean {
  return /^[A-Za-z0-9-]{6,64}$/.test(code);
}

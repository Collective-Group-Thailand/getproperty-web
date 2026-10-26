import { http, type HttpHandler } from "msw";

import { SAMPLE_RENT_RECORD } from "../owner/leads";
import { json, problem } from "./support";

/** `GET /v1/public/rent-records/{code}` (D-256): one live sample letter, `H4N8R2K7QX`; anything else is a 404. */
export const SAMPLE_LETTER_CODE = "H4N8R2K7QX";

export const rentRecordHandlers: HttpHandler[] = [
  http.get("*/v1/public/rent-records/:code", ({ params }) =>
    String(params.code).toUpperCase() === SAMPLE_LETTER_CODE
      ? json({
          holderName: "สมศรี ใจดี",
          issuedAt: "2026-10-20T09:15:00+07:00",
          expiresAt: "2027-01-18T09:15:00+07:00",
          record: SAMPLE_RENT_RECORD,
        })
      : problem("public.rentRecords.get", "http.not_found"),
  ),
];

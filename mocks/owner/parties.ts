import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { state } from "../state";
import {
  body,
  etagged,
  json,
  mutating,
  notFound,
  noContent,
  owner,
  paged,
  problem,
  query,
  stale,
  validation,
} from "./support";
import { iso, PARTY } from "./world";

type Schemas = components["schemas"];

/**
 * Parties of the owner surface (F2 2.2, B2.2): residents and other parties of the tenant. ID numbers
 * are sealed (never returned); revealing one, or opening an ID document, needs Owner/Manager and a
 * purpose, and is audited (D-148, D-172). Unlinking a resident login is Owner-only.
 */
const w = () => state.owner;

const ID_DOCUMENT = { somsak: "1d0c0000-0000-4000-8000-000000000001" } as const;
const THAI_ID = /^\d{13}$/;

function thaiIdValid(id: string): boolean {
  if (!THAI_ID.test(id)) return false;
  const digits = id.split("").map(Number);
  const sum = digits.slice(0, 12).reduce((total, digit, index) => total + digit * (13 - index), 0);
  return (11 - (sum % 11)) % 10 === digits[12];
}

export const partyHandlers: HttpHandler[] = [
  http.get("*/v1/owner/parties", ({ request }) => {
    const ok = owner(request, "owner.parties.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const q = params.get("q")?.toLowerCase();
    const parties = (ok.own ? w().parties : []).filter(
      (party) =>
        !party.anonymised &&
        (!params.get("type") || party.type === params.get("type")) &&
        (!q || party.displayName.toLowerCase().includes(q) || (party.phone ?? "").includes(q)),
    );
    return json(
      paged(
        [...parties].sort((a, b) => a.displayName.localeCompare(b.displayName, "th")),
        request,
      ),
    );
  }),
  http.post("*/v1/owner/parties", async ({ request }) => {
    const op = "owner.parties.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own) return notFound(op);
    const input = await body<Schemas["PartyCreateDto"]>(request);
    if (!input.displayName?.trim()) return validation(op, "displayName", "a name is required");
    if (input.type === "company" && !input.companyName?.trim())
      return validation(op, "companyName", "the company name is required");
    if (input.phone && !/^(\+66|0)\d{8,9}$/.test(input.phone.replace(/[\s-]/g, "")))
      return validation(op, "phone", "a Thai mobile number");
    if (input.idNumber && input.idDocumentType === "thai_national_id" && !thaiIdValid(input.idNumber))
      return validation(op, "idNumber", "the Thai national id checksum does not match");
    const phone = input.phone ? input.phone.replace(/[\s-]/g, "").replace(/^0/, "+66") : null;
    const party: Schemas["PartyDto"] = {
      id: crypto.randomUUID(),
      type: input.type,
      displayName: input.displayName.trim(),
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      companyName: input.companyName ?? null,
      taxId: input.taxId ?? null,
      phone,
      email: input.email ?? null,
      language: input.language ?? "th",
      nationality: input.nationality ?? null,
      idDocumentType: input.idDocumentType ?? null,
      idDocumentCountry: input.idDocumentCountry ?? null,
      idExpiresOn: input.idExpiresOn ?? null,
      idNumberOnFile: Boolean(input.idNumber),
      dateOfBirth: input.dateOfBirth ?? null,
      gender: input.gender ?? null,
      address: input.address ?? null,
      emergencyContact: input.emergencyContact
        ? { name: input.emergencyContact.name, relation: input.emergencyContact.relation, phoneOnFile: true }
        : null,
      occupantProfile: input.occupantProfile ?? null,
      notes: input.notes ?? null,
      lineLinked: false,
      linkedLogins: 0,
      anonymised: false,
      createdAt: iso(),
      version: 1,
    };
    w().parties.push(party);
    return etagged(party, 201);
  }),
  http.get("*/v1/owner/parties/:partyId", ({ request, params }) => {
    const op = "owner.parties.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const party = ok.own ? w().parties.find((candidate) => candidate.id === params.partyId) : undefined;
    return party ? etagged(party) : notFound(op);
  }),
  http.patch("*/v1/owner/parties/:partyId", async ({ request, params }) => {
    const op = "owner.parties.update";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const party = ok.own ? w().parties.find((candidate) => candidate.id === params.partyId) : undefined;
    if (!party) return notFound(op);
    if (!request.headers.get("if-match")) return problem(op, "concurrency.precondition_required");
    if (stale(request, party)) return problem(op, "concurrency.stale");
    const input = await body<Schemas["PartyUpdateDto"]>(request);
    if (input.idNumber && party.idDocumentType === "thai_national_id" && !thaiIdValid(input.idNumber))
      return validation(op, "idNumber", "the Thai national id checksum does not match");
    const { idNumber, emergencyContact, ...rest } = input;
    Object.assign(party, rest);
    if (idNumber) party.idNumberOnFile = true;
    if (emergencyContact)
      party.emergencyContact = { name: emergencyContact.name, relation: emergencyContact.relation, phoneOnFile: true };
    party.version += 1;
    return etagged(party);
  }),
  http.post("*/v1/owner/parties/:partyId/actions/reveal-pii", async ({ request, params }) => {
    const op = "owner.parties.revealPii";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const party = ok.own ? w().parties.find((candidate) => candidate.id === params.partyId) : undefined;
    if (!party) return notFound(op);
    const role = ok.persona.memberships[0]?.role;
    if (role !== "owner" && role !== "manager") return problem(op, "auth.forbidden");
    const input = await body<Schemas["RevealPiiDto"]>(request);
    if (!input.purpose?.trim()) return validation(op, "purpose", "a purpose is required (audited)");
    w().received.push({ op, idempotencyKey: null, body: input });
    return json({
      idNumber: input.fields.includes("idNumber") && party.idNumberOnFile ? "1101700230705" : null,
      emergencyContactPhone:
        input.fields.includes("emergencyContactPhone") && party.emergencyContact ? "+66810000199" : null,
    } satisfies Schemas["RevealedPiiDto"]);
  }),
  http.get("*/v1/owner/parties/:partyId/id-documents", ({ request, params }) => {
    const op = "owner.parties.listIdDocuments";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const party = ok.own ? w().parties.find((candidate) => candidate.id === params.partyId) : undefined;
    if (!party) return notFound(op);
    return json(
      party.id === PARTY.somsak
        ? [
            {
              id: ID_DOCUMENT.somsak,
              kind: "id_document",
              title: "บัตรประชาชน",
              mimeType: "image/jpeg",
              sizeBytes: 182_000,
              width: 1200,
              height: 760,
              scopeType: "party",
              scopeId: party.id,
              buildingId: null,
              retentionClass: "id_document",
              scanStatus: "clean",
              uploadState: "verified",
              createdAt: iso(-352),
            } satisfies Schemas["FileDto"],
          ]
        : [],
    );
  }),
  http.get("*/v1/owner/parties/:partyId/id-documents/:documentId", ({ request, params }) => {
    const op = "owner.parties.downloadIdDocument";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const party = ok.own ? w().parties.find((candidate) => candidate.id === params.partyId) : undefined;
    if (!party || params.documentId !== ID_DOCUMENT.somsak) return notFound(op);
    const purpose = query(request).get("purpose");
    if (!purpose) return validation(op, "purpose", "a purpose is required (audited)");
    w().received.push({ op, idempotencyKey: null, body: { purpose, documentId: params.documentId } });
    const origin = new URL(request.url).origin;
    return json({
      file: {
        id: ID_DOCUMENT.somsak,
        kind: "id_document",
        title: "บัตรประชาชน",
        mimeType: "image/svg+xml",
        sizeBytes: 1,
        width: 300,
        height: 200,
        scopeType: "party",
        scopeId: party.id,
        buildingId: null,
        retentionClass: "id_document",
        scanStatus: "clean",
        uploadState: "verified",
        createdAt: iso(-352),
      },
      url: `${origin}/__files/${ID_DOCUMENT.somsak}`,
      thumbnailUrl: null,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    } satisfies Schemas["FileDownloadDto"]);
  }),
  http.get("*/v1/owner/parties/:partyId/links", ({ request, params }) => {
    const op = "owner.parties.listLinks";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const party = ok.own ? w().parties.find((candidate) => candidate.id === params.partyId) : undefined;
    if (!party) return notFound(op);
    return json(
      party.linkedLogins > 0
        ? [
            {
              id: `${party.id.slice(0, -4)}11aa`,
              userId: crypto.randomUUID(),
              userDisplayName: party.displayName,
              lineLinked: party.lineLinked,
              linkedVia: "invitation",
              linkedAt: iso(-100),
              state: "active",
              unlinkReason: null,
              unlinkedAt: null,
            } satisfies Schemas["PartyLinkDto"],
          ]
        : [],
    );
  }),
  http.post("*/v1/owner/parties/:partyId/links/:linkId/actions/unlink", async ({ request, params }) => {
    const op = "owner.parties.unlink";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const party = ok.own ? w().parties.find((candidate) => candidate.id === params.partyId) : undefined;
    if (!party) return notFound(op);
    if (party.linkedLogins === 0) return problem(op, "party.link_not_active");
    const input = await body<Schemas["UnlinkDto"]>(request);
    if (!input.unlinkReason?.trim()) return validation(op, "unlinkReason", "a reason is required");
    party.linkedLogins = 0;
    party.lineLinked = false;
    return noContent();
  }),

  // Owner inspections (read): the staff world's inspections, for the lease timeline and the comparison.
  http.get("*/v1/owner/inspections", ({ request }) => {
    const ok = owner(request, "owner.inspections.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const list = (ok.own ? state.staff.inspections : []).filter(
      (inspection) =>
        (!params.get("leaseId") || inspection.leaseId === params.get("leaseId")) &&
        (!params.get("unitId") || inspection.unitId === params.get("unitId")),
    );
    return json(paged(list, request));
  }),
];

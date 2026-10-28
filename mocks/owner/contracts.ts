import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { placeholderPdf } from "../handlers/staff";
import { TENANTS } from "../fixtures";
import { state } from "../state";
import {
  allowed,
  body,
  documentDownload,
  idempotent,
  json,
  mutating,
  notFound,
  owner,
  problem,
  query,
  validation,
  type Ok,
} from "./support";
import { TENANT_ID } from "./world";

type Schemas = components["schemas"];

/**
 * Pack G3 on the owner surface (D-290, D-294): the contract library (platform drafts of every kind in th / en, all
 * `pending_legal_verification` with the disclaimer), a tenant's own copies with a clause-level diff and the text check
 * (forbidden wording added / protective wording removed: **block** for the sample apartment tenant — in the สคบ.
 * scope, D-158 — and **warn** for every other tenant), unknown variables refused, the signable documents (reservation,
 * addendum, brokerage mandate, co-broke) with their signers, and renewal offers with the suggestion. Reset with the
 * owner part `contracts`.
 */

type Kind = Schemas["ContractKind"];
type Language = Schemas["Language"];

export type MockTemplateVersion = Schemas["ContractTemplateVersionDto"] & { bodyHtml: string };

export interface MockTemplate {
  id: string;
  key: string;
  name: string;
  kind: Kind;
  /** `null` = a platform draft. */
  tenantId: string | null;
  versions: MockTemplateVersion[];
}

export type MockContract = Omit<Schemas["ContractDto"], "disclaimer" | "nextActions"> & { tenantId: string };
export type MockOffer = Schemas["RenewalOfferDto"] & { tenantId: string };

export interface MockContractsWorld {
  templates: MockTemplate[];
  contracts: MockContract[];
  offers: MockOffer[];
  /** The B7.5 renewal letters issued with the offers, by lease id (merged into the lease's notices). */
  letters: Record<string, Schemas["LeaseNoticeDto"][]>;
}

const DISCLAIMER: Schemas["DisclaimerDto"] = {
  th: "ตัวอย่างสัญญาเพื่ออำนวยความสะดวก ไม่ใช่คำแนะนำทางกฎหมาย",
  en: "A sample contract provided for convenience; not legal advice.",
  settingKey: "contract.library.disclaimer",
};
const PENDING_REF = "⚖ ร่างโดยระบบ รอการตรวจสอบทางกฎหมาย (O-025)";
const FORBIDDEN_REF = {
  renewal_fee: "ประกาศคณะกรรมการว่าด้วยสัญญา … พ.ศ. 2568 ข้อ 5 (11) ⚖",
  waiver_of_rights: "ประกาศคณะกรรมการว่าด้วยสัญญา … พ.ศ. 2568 ข้อ 5 (5) ⚖",
} as const;

const COMMON_VARS = [
  "contract.date",
  "contract.number",
  "lessor.legalName",
  "premises.buildingName",
  "premises.unitNo",
];
export const VARIABLES: Record<Kind, string[]> = {
  lease_apartment_ocpb: [...COMMON_VARS, "lease.endDate", "lease.rent", "lease.startDate", "lessee.name"],
  lease_condo_private: [...COMMON_VARS, "lease.endDate", "lease.rent", "lease.startDate", "lessee.name"],
  lease_house: [...COMMON_VARS, "lease.endDate", "lease.rent", "lease.startDate", "lessee.name"],
  lease_room: [...COMMON_VARS, "lease.endDate", "lease.rent", "lease.startDate", "lessee.name"],
  reservation: [
    ...COMMON_VARS,
    "lessee.name",
    "reservation.expiresOn",
    "reservation.fee",
    "reservation.moveInDate",
    "reservation.refundTerms",
    "reservation.rent",
  ],
  brokerage_mandate: [...COMMON_VARS, "agency.name", "mandate.commission", "mandate.note", "mandate.scope"],
  co_broke: [...COMMON_VARS, "agency.name", "coAgency.name", "coBroke.note", "coBroke.splitPercent"],
  addendum: [...COMMON_VARS, "addendum.clauses", "addendum.effectiveDate", "lease.number", "lessee.name"],
  notice_termination: [...COMMON_VARS, "lessee.name", "notice.effectiveDate", "notice.reason"],
  notice_renewal: [...COMMON_VARS, "lessee.name", "notice.newRent", "notice.respondBy"],
};

const NAMES: Record<Kind, { th: string; en: string }> = {
  lease_apartment_ocpb: {
    th: "สัญญาเช่าอาคารเพื่ออยู่อาศัย (แบบมาตรฐาน สคบ.)",
    en: "Residential lease (OCPB standard)",
  },
  lease_condo_private: { th: "สัญญาเช่าห้องชุด (เจ้าของรายย่อย)", en: "Condominium unit lease (private owner)" },
  lease_house: { th: "สัญญาเช่าบ้าน", en: "House lease" },
  lease_room: { th: "สัญญาเช่าห้อง", en: "Room lease" },
  reservation: { th: "สัญญาจองห้องเช่า (ร่างจากคลังสัญญา)", en: "Reservation agreement (library draft)" },
  brokerage_mandate: { th: "สัญญาแต่งตั้งนายหน้า (ร่างจากคลังสัญญา)", en: "Brokerage mandate (library draft)" },
  co_broke: { th: "สัญญาแบ่งค่านายหน้า (ร่างจากคลังสัญญา)", en: "Co-broke agreement (library draft)" },
  addendum: { th: "บันทึกข้อตกลงแนบท้ายสัญญาเช่า (ร่างจากคลังสัญญา)", en: "Lease addendum (library draft)" },
  notice_termination: { th: "หนังสือบอกเลิกสัญญาเช่า (ร่างจากคลังสัญญา)", en: "Termination notice (library draft)" },
  notice_renewal: { th: "หนังสือเสนอต่อสัญญาเช่า (ร่างจากคลังสัญญา)", en: "Renewal offer letter (library draft)" },
};

const section = (title: string, text: string) => `<section><h2>${title}</h2><p>${text}</p></section>`;

/** Short sample texts: a `<section>` per clause keyed by its `<h2>` (the API's rule), protective wording in each. */
function body_(kind: Kind, language: Language): string {
  const th = language === "th";
  const parties = section(
    th ? "คู่สัญญา" : "Parties",
    th
      ? "ผู้ให้เช่า {{lessor.legalName}} ทำสัญญานี้สำหรับห้อง {{premises.unitNo}} อาคาร {{premises.buildingName}}"
      : "The lessor {{lessor.legalName}} makes this agreement for unit {{premises.unitNo}}, {{premises.buildingName}}",
  );
  const protection = section(
    th ? "ข้อความคุ้มครองผู้เช่า" : "Lessee protection",
    th
      ? "ผู้ให้เช่าไม่เรียกเก็บค่าต่อสัญญา และผู้เช่าไม่สละสิทธิตามกฎหมาย"
      : "The lessor charges no renewal fee and the lessee waives no statutory right",
  );
  const head = `<h1>${NAMES[kind][language]}</h1><p>{{contract.number}} · {{contract.date}}</p>`;
  let clauses = "";
  switch (kind) {
    case "reservation":
      clauses =
        section(
          th ? "เงินจอง" : "Reservation fee",
          th
            ? "ผู้จอง {{lessee.name}} ชำระเงินจอง {{reservation.fee}} บาท"
            : "{{lessee.name}} pays a reservation fee of {{reservation.fee}} THB",
        ) +
        section(
          th ? "การคืนเงินจอง" : "Refund",
          th
            ? "คืนเงินจองเต็มจำนวนหากผู้ให้เช่าไม่ทำสัญญา {{reservation.refundTerms}}"
            : "Refunded in full if the lessor does not sign the lease {{reservation.refundTerms}}",
        );
      break;
    case "addendum":
      clauses =
        section(
          th ? "สัญญาเดิม" : "Original lease",
          th
            ? "บันทึกนี้แนบท้ายสัญญาเช่าเลขที่ {{lease.number}} กับ {{lessee.name}}"
            : "This addendum amends lease {{lease.number}} with {{lessee.name}}",
        ) +
        section(
          th ? "ข้อตกลงเพิ่มเติม" : "Added terms",
          th
            ? "{{addendum.clauses}} มีผลตั้งแต่ {{addendum.effectiveDate}}"
            : "{{addendum.clauses}} effective {{addendum.effectiveDate}}",
        ) +
        protection;
      break;
    case "brokerage_mandate":
      clauses = section(
        th ? "ขอบเขตงานนายหน้า" : "Scope",
        th
          ? "แต่งตั้ง {{agency.name}} ขอบเขต {{mandate.scope}} ค่านายหน้า {{mandate.commission}}"
          : "Appoints {{agency.name}} ({{mandate.scope}}), commission {{mandate.commission}}",
      );
      break;
    case "co_broke":
      clauses = section(
        th ? "การแบ่งค่านายหน้า" : "Commission split",
        th
          ? "{{agency.name}} และ {{coAgency.name}} แบ่งค่านายหน้า {{coBroke.splitPercent}}%"
          : "{{agency.name}} and {{coAgency.name}} split the commission {{coBroke.splitPercent}}%",
      );
      break;
    case "notice_termination":
      clauses = section(
        th ? "การบอกเลิก" : "Termination",
        th
          ? "แจ้ง {{lessee.name}} สัญญาสิ้นสุด {{notice.effectiveDate}} เหตุ {{notice.reason}}"
          : "Notice to {{lessee.name}}: the lease ends {{notice.effectiveDate}} ({{notice.reason}})",
      );
      break;
    case "notice_renewal":
      clauses = section(
        th ? "ข้อเสนอต่อสัญญา" : "Renewal offer",
        th
          ? "เสนอ {{lessee.name}} ต่อสัญญาค่าเช่า {{notice.newRent}} บาท ตอบภายใน {{notice.respondBy}}"
          : "Offer to {{lessee.name}}: renew at {{notice.newRent}} THB, answer by {{notice.respondBy}}",
      );
      break;
    default:
      clauses =
        section(
          th ? "ค่าเช่า" : "Rent",
          th
            ? "ค่าเช่าเดือนละ {{lease.rent}} บาท ตั้งแต่ {{lease.startDate}} ถึง {{lease.endDate}}"
            : "Rent {{lease.rent}} THB a month from {{lease.startDate}} to {{lease.endDate}}",
        ) + protection;
  }
  return `<article class="contract">${head}${parties}${clauses}</article>`;
}

const PLATFORM_KINDS: Kind[] = [
  "lease_apartment_ocpb",
  "lease_condo_private",
  "reservation",
  "brokerage_mandate",
  "co_broke",
  "addendum",
  "notice_termination",
  "notice_renewal",
];
export const LIBRARY_ID = (index: number) => `c0a10000-0000-4000-8000-0000000000${String(10 + index)}`;
export const LIBRARY_VERSION_ID = (index: number, language: Language) =>
  `c0a10000-0000-4000-8000-000000001${String(10 + index)}${language === "th" ? "0" : "1"}`;

function version(
  input: Partial<MockTemplateVersion> & Pick<MockTemplateVersion, "id" | "language" | "bodyHtml">,
): MockTemplateVersion {
  return {
    version: 1,
    state: "published",
    legalReviewState: "pending_legal_verification",
    legalReviewedAt: null,
    effectiveFrom: "2026-10-27",
    publishedAt: "2026-10-27T09:00:00+07:00",
    derivedFromVersionId: null,
    legalRef: PENDING_REF,
    ...input,
  };
}

export function initialContractsWorld(): MockContractsWorld {
  return {
    templates: PLATFORM_KINDS.map((kind, index) => ({
      id: LIBRARY_ID(index),
      key: `library_${kind}`,
      name: NAMES[kind].th,
      kind,
      tenantId: null,
      versions: (["th", "en"] as const).map((language) =>
        version({ id: LIBRARY_VERSION_ID(index, language), language, bodyHtml: body_(kind, language) }),
      ),
    })),
    contracts: [],
    offers: [],
    letters: {},
  };
}

const w = () => state.contracts;
const now = () => new Date().toISOString();
const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const hex = () => Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
/** Only the sample apartment tenant is in the สคบ. 2568 scope (D-158); the landlord and the agency are not. */
const inScope = (tenantId: string) => tenantId === TENANT_ID;

function visible(ok: Ok, id: string) {
  return w().templates.find((t) => t.id === id && (t.tenantId === null || t.tenantId === ok.tenantId));
}

function versionDto(v: MockTemplateVersion): Schemas["ContractTemplateVersionDto"] {
  const dto: Partial<MockTemplateVersion> = { ...v };
  delete dto.bodyHtml;
  return dto as Schemas["ContractTemplateVersionDto"];
}

function sortedVersions(t: MockTemplate) {
  return [...t.versions].sort((a, b) => b.version - a.version || a.language.localeCompare(b.language));
}

function current(t: MockTemplate): MockTemplateVersion {
  const versions = sortedVersions(t);
  return versions.find((v) => v.state === "draft") ?? versions.find((v) => v.state === "published") ?? versions[0]!;
}

function findVersion(id: string | null): MockTemplateVersion | null {
  if (!id) return null;
  for (const t of w().templates) {
    const found = t.versions.find((v) => v.id === id);
    if (found) return found;
  }
  return null;
}

function detail(t: MockTemplate, v: MockTemplateVersion = current(t)): Schemas["ContractTemplateDetailDto"] {
  const base = findVersion(v.derivedFromVersionId);
  return {
    id: t.id,
    key: t.key,
    name: t.name,
    kind: t.kind,
    platform: t.tenantId === null,
    versions: sortedVersions(t).map(versionDto),
    current: versionDto(v),
    bodyHtml: v.bodyHtml,
    base: base ? versionDto(base) : null,
    variables: [...VARIABLES[t.kind]].sort(),
    disclaimer: DISCLAIMER,
  };
}

// --- text rules (the API's are richer; these mirror their outcomes for the e2e flows) ---------------------------------

const toText = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function clausesOf(html: string): { key: string; title: string; text: string }[] {
  const out: { key: string; title: string; text: string }[] = [];
  let frame = html;
  let n = 0;
  for (const m of html.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi)) {
    n += 1;
    frame = frame.replace(m[0], "");
    const heading = /<h2\b[^>]*>([\s\S]*?)<\/h2>/i.exec(m[1]!)?.[1];
    const title = heading ? toText(heading) : `section ${n}`;
    out.push({ key: heading ? title.toLowerCase() : `section-${n}`, title, text: toText(m[1]!) });
  }
  const frameText = toText(frame);
  if (frameText) out.unshift({ key: "_frame", title: "", text: frameText });
  return out;
}

function diff(base: string, edited: string): Schemas["ClauseDiffDto"][] {
  const before = new Map(clausesOf(base).map((c) => [c.key, c]));
  const after = clausesOf(edited);
  const out: Schemas["ClauseDiffDto"][] = after.map((c) => {
    const b = before.get(c.key);
    if (!b) return { key: c.key, title: c.title, status: "added", baseText: null, text: c.text };
    return {
      key: c.key,
      title: c.title,
      status: b.text === c.text ? "unchanged" : "changed",
      baseText: b.text,
      text: c.text,
    };
  });
  const kept = new Set(after.map((c) => c.key));
  for (const b of before.values())
    if (!kept.has(b.key)) out.push({ key: b.key, title: b.title, status: "removed", baseText: b.text, text: null });
  return out;
}

const KEYWORDS = new Set(["if", "unless", "each", "with", "else", "this"]);

function structure(html: string, kind: Kind) {
  const problems: Schemas["ProblemFieldError"][] = [];
  if (/<script|<style|\son\w+=|<a\s/i.test(html))
    problems.push({
      path: "bodyHtml",
      code: "html",
      message: "script, style, links and event handlers are not allowed",
    });
  if (html.includes("{{{")) problems.push({ path: "bodyHtml", code: "unescaped", message: "{{{…}}} is not allowed" });
  if (/\{\{>/.test(html)) problems.push({ path: "bodyHtml", code: "partial", message: "partials are not allowed" });
  const unknown = new Set<string>();
  for (const m of html.matchAll(/\{\{\s*([#/]?)([\w.]+)(?:\s+([\w.]+))?[^}]*\}\}/g)) {
    const [, mark, word, arg] = m;
    const name = mark === "#" ? arg : mark === "/" ? undefined : word;
    if (mark === "#" && !KEYWORDS.has(word!)) unknown.add(word!);
    if (!name || KEYWORDS.has(name) || name.startsWith("this.")) continue;
    if (!VARIABLES[kind].includes(name)) unknown.add(name);
  }
  return { problems, unknownVariables: [...unknown] };
}

const FORBIDDEN_WORDING = /(ไม่เรียกเก็บ|ไม่มี|no\s+)?(ค่าต่อสัญญา|renewal fee)/gi;

function findings(base: string, edited: string, tenantId: string): Schemas["ClauseFindingDto"][] {
  const severity: Schemas["ComplianceSeverity"] = inScope(tenantId) ? "block" : "warn";
  const out: Schemas["ClauseFindingDto"][] = [];
  const before = new Map(clausesOf(base).map((c) => [c.key, c]));
  for (const clause of clausesOf(edited)) {
    for (const m of clause.text.matchAll(FORBIDDEN_WORDING)) {
      if (m[1]) continue; // negated ("ไม่เรียกเก็บค่าต่อสัญญา")
      const baseHas = [...(before.get(clause.key)?.text ?? "").matchAll(FORBIDDEN_WORDING)].some((b) => !b[1]);
      if (baseHas) continue;
      out.push({
        clauseType: "renewal_fee",
        clauseKey: clause.key,
        clauseTitle: clause.title,
        source: "added_wording",
        excerpt: m[0],
        legalRef: FORBIDDEN_REF.renewal_fee,
        severity,
      });
    }
  }
  const kept = new Set(clausesOf(edited).map((c) => c.key));
  for (const b of before.values())
    if (!kept.has(b.key) && /ไม่สละสิทธิ|waives no/i.test(b.text))
      out.push({
        clauseType: "waiver_of_rights",
        clauseKey: b.key,
        clauseTitle: b.title,
        source: "removed_protection",
        excerpt: b.text.slice(0, 80),
        legalRef: FORBIDDEN_REF.waiver_of_rights,
        severity,
      });
  return out;
}

const CHECKED_KINDS = new Set<Kind>([
  "lease_apartment_ocpb",
  "lease_condo_private",
  "lease_house",
  "lease_room",
  "addendum",
]);

function check(t: MockTemplate, v: MockTemplateVersion, tenantId: string): Schemas["ContractTemplateCheckDto"] {
  const base = findVersion(v.derivedFromVersionId);
  const s = structure(v.bodyHtml, t.kind);
  const found = base && CHECKED_KINDS.has(t.kind) ? findings(base.bodyHtml, v.bodyHtml, tenantId) : [];
  return {
    inScope: inScope(tenantId),
    problems: s.problems,
    unknownVariables: s.unknownVariables,
    findings: found,
    publishable: !s.problems.length && !s.unknownVariables.length && !found.some((f) => f.severity === "block"),
  };
}

// --- contracts ---------------------------------------------------------------------------------------------------

function contractActions(c: MockContract, tenantId: string): string[] {
  const own = c.tenantId === tenantId;
  if (c.state === "draft") return own ? ["preview", "send-for-signature", "cancel"] : [];
  if (c.state === "pending_signature") {
    const mine = c.signers.some((s) => s.tenantId === tenantId && !s.signedAt);
    return [...(mine ? ["sign"] : []), "download", ...(own ? ["cancel"] : [])];
  }
  return c.state === "signed" ? ["download"] : [];
}

const contractDto = (c: MockContract, tenantId: string): Schemas["ContractDto"] => {
  const dto: Partial<MockContract> = { ...c };
  delete dto.tenantId;
  return {
    ...(dto as Omit<MockContract, "tenantId">),
    disclaimer: DISCLAIMER,
    nextActions: contractActions(c, tenantId),
  };
};

function visibleContract(ok: Ok, id: string) {
  return w().contracts.find(
    (c) => c.id === id && (c.tenantId === ok.tenantId || c.counterpartyTenantId === ok.tenantId),
  );
}

let contractSeq = 0;
const documentIds = new Map<string, string>();

/** Test hook: the other side (resident / prospect / counterparty) signs every remaining signer slot. */
export function counterpartySignsContract(contractId: string): boolean {
  const c = w().contracts.find((candidate) => candidate.id === contractId);
  if (!c || c.state !== "pending_signature") return false;
  for (const signer of c.signers) signer.signedAt ??= now();
  c.state = "signed";
  c.signedAt = now();
  c.sha256 = hex();
  return true;
}

// --- renewals ----------------------------------------------------------------------------------------------------

function suggestion(lease: Schemas["LeaseDto"], tenantId: string): Schemas["RenewalSuggestionDto"] {
  const candidates: Schemas["RentSuggestionDto"][] = [];
  // Give to get (D-217): the sample tenant shares anonymised analytics, so the k ≥ 5 benchmark is offered.
  if (tenantId === TENANT_ID) {
    const rent = (Math.round((Number(lease.rent) * 1.04) / 50) * 50).toFixed(2);
    candidates.push({
      source: "benchmark",
      rent,
      basis: `rent_per_m2 p50 ${(Number(rent) / 28).toFixed(2)} × 28.00 m² (k = 7, ${today()})`,
    });
  }
  candidates.push({ source: "current_rent", rent: lease.rent, basis: "ค่าเช่าปัจจุบันตามสัญญา" });
  return { currentRent: lease.rent, suggested: candidates[0]!, candidates };
}

const offerActions = (o: MockOffer) => (o.state === "offered" ? ["withdraw"] : []);
const offerDto = (o: MockOffer): Schemas["RenewalOfferDto"] => {
  const dto: Partial<MockOffer> = { ...o };
  delete dto.tenantId;
  return { ...(dto as Schemas["RenewalOfferDto"]), nextActions: offerActions(o) };
};

/** Test hook: the resident answers an open offer in LINE (accept → a renewal lease id; decline with a reason). */
export function residentAnswersOffer(offerId: string, answer: "accept" | "decline"): boolean {
  const o = w().offers.find((candidate) => candidate.id === offerId);
  if (!o || o.state !== "offered") return false;
  o.state = answer === "accept" ? "accepted" : "declined";
  o.decidedAt = now();
  if (answer === "accept") o.newLeaseId = crypto.randomUUID();
  else o.declineReason = "ย้ายไปทำงานต่างจังหวัด";
  return true;
}

const leaseOf = (ok: Ok, leaseId: string) =>
  ok.own ? state.owner.leases.find((lease) => lease.id === leaseId) : undefined;

export const contractHandlers: HttpHandler[] = [
  // ------------------------------------------------------------------------------------------------- library
  http.get("*/v1/owner/contract-library", ({ request }) => {
    const op = "owner.contractLibrary.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const params = query(request);
    const kind = params.get("kind");
    const language = params.get("language");
    const data = w()
      .templates.filter((t) => (t.tenantId === null || t.tenantId === ok.tenantId) && (!kind || t.kind === kind))
      .map((t) => ({
        id: t.id,
        key: t.key,
        name: t.name,
        kind: t.kind,
        platform: t.tenantId === null,
        versions: sortedVersions(t)
          .filter((v) => !language || v.language === language)
          .map(versionDto),
      }))
      .filter((t) => t.versions.length)
      .sort((a, b) => Number(b.platform) - Number(a.platform));
    return json({ data, disclaimer: DISCLAIMER } satisfies Schemas["ContractLibraryDto"]);
  }),

  http.post("*/v1/owner/contract-templates", async ({ request }) => {
    const op = "owner.contractTemplates.copy";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "lease.manage");
    if (forbidden) return forbidden;
    const input = await body<Schemas["ContractTemplateCopyDto"]>(request);
    const source = w().templates.find(
      (t) =>
        (t.tenantId === null || t.tenantId === ok.tenantId) &&
        t.versions.some((v) => v.id === input.derivedFromVersionId),
    );
    const base = source?.versions.find((v) => v.id === input.derivedFromVersionId);
    if (!source || !base) return notFound(op);
    if (base.state !== "published") return validation(op, "derivedFromVersionId", "copy a published version", "state");
    const prefix = `my_${source.kind}`;
    const n = w().templates.filter((t) => t.tenantId === ok.tenantId && t.key.startsWith(prefix)).length;
    const created: MockTemplate = {
      id: crypto.randomUUID(),
      key: `${prefix}_${n + 1}`,
      name: input.name?.trim() || `${source.name} (ฉบับของฉัน)`,
      kind: source.kind,
      tenantId: ok.tenantId,
      versions: [
        version({
          id: crypto.randomUUID(),
          language: base.language,
          bodyHtml: base.bodyHtml,
          state: "draft",
          publishedAt: null,
          effectiveFrom: today(),
          derivedFromVersionId: base.id,
        }),
      ],
    };
    w().templates.push(created);
    return json(detail(created), 201);
  }),

  http.get("*/v1/owner/contract-templates/:templateId", ({ request, params }) => {
    const op = "owner.contractTemplates.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const t = visible(ok, String(params.templateId));
    return t ? json(detail(t)) : notFound(op);
  }),

  http.patch("*/v1/owner/contract-templates/:templateId", async ({ request, params }) => {
    const op = "owner.contractTemplates.update";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const t = visible(ok, String(params.templateId));
    if (!t || t.tenantId !== ok.tenantId) return notFound(op);
    const input = await body<Schemas["ContractTemplateUpdateDto"]>(request);
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name || name.length > 200) return validation(op, "name", "1–200 characters", "length");
      t.name = name;
    }
    if (input.bodyHtml !== undefined) {
      const s = structure(input.bodyHtml, t.kind);
      if (s.problems.length) return problem(op, "contract.template_invalid", { errors: s.problems });
      if (s.unknownVariables.length)
        return problem(op, "contract.unknown_variable", {
          errors: s.unknownVariables.map((v) => ({ path: "bodyHtml", code: "unknown", message: v })),
        });
      const latest = current(t);
      if (latest.state === "draft") latest.bodyHtml = input.bodyHtml;
      else
        t.versions.push(
          version({
            id: crypto.randomUUID(),
            version: Math.max(...t.versions.map((v) => v.version)) + 1,
            language: latest.language,
            bodyHtml: input.bodyHtml,
            state: "draft",
            publishedAt: null,
            effectiveFrom: today(),
            derivedFromVersionId: latest.derivedFromVersionId,
          }),
        );
    }
    return json(detail(t));
  }),

  http.get("*/v1/owner/contract-templates/:templateId/diff", ({ request, params }) => {
    const op = "owner.contractTemplates.diff";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const t = visible(ok, String(params.templateId));
    if (!t) return notFound(op);
    const v = current(t);
    const base = findVersion(v.derivedFromVersionId);
    return json({
      versionId: v.id,
      baseVersionId: base?.id ?? null,
      clauses: diff(base?.bodyHtml ?? v.bodyHtml, v.bodyHtml),
    } satisfies Schemas["ContractTemplateDiffDto"]);
  }),

  http.get("*/v1/owner/contract-templates/:templateId/preview", ({ request, params }) => {
    const op = "owner.contractTemplates.preview";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const t = visible(ok, String(params.templateId));
    if (!t) return notFound(op);
    return new Response(placeholderPdf(current(t).id), { headers: { "content-type": "application/pdf" } });
  }),

  http.post("*/v1/owner/contract-templates/:templateId/actions/check", ({ request, params }) => {
    const op = "owner.contractTemplates.check";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const t = visible(ok, String(params.templateId));
    if (!t) return notFound(op);
    state.owner.received.push({ op, idempotencyKey: null, body: { templateId: t.id } });
    return json(check(t, current(t), ok.tenantId));
  }),

  http.post("*/v1/owner/contract-templates/:templateId/actions/publish", ({ request, params }) => {
    const op = "owner.contractTemplates.publish";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const t = visible(ok, String(params.templateId));
    if (!t || t.tenantId !== ok.tenantId) return notFound(op);
    const draft = t.versions.find((v) => v.state === "draft");
    if (!draft) return problem(op, "contract.invalid_state");
    const result = check(t, draft, ok.tenantId);
    if (result.problems.length) return problem(op, "contract.template_invalid", { errors: result.problems });
    if (result.unknownVariables.length)
      return problem(op, "contract.unknown_variable", {
        errors: result.unknownVariables.map((v) => ({ path: "bodyHtml", code: "unknown", message: v })),
      });
    const blocking = result.findings.filter((f) => f.severity === "block");
    if (blocking.length)
      return problem(op, "compliance.forbidden_clause", {
        ruleId: "compliance.forbidden_clause",
        legalRef: blocking[0]!.legalRef,
        errors: blocking.map((f) => ({
          path: `clauses.${f.clauseKey}`,
          code: f.clauseType,
          message: `${f.source === "removed_protection" ? "protective wording removed" : "forbidden wording"}: ${f.excerpt} — ${f.legalRef}`,
        })),
      });
    draft.state = "published";
    draft.publishedAt = now();
    draft.effectiveFrom = today();
    state.owner.received.push({
      op,
      idempotencyKey: null,
      body: { templateId: t.id, warnings: result.findings.length },
    });
    return json({ ...detail(t, draft), check: result } satisfies Schemas["ContractTemplatePublishedDto"]);
  }),

  // ----------------------------------------------------------------------------------------------- contracts
  http.get("*/v1/owner/contracts", ({ request }) => {
    const op = "owner.contracts.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const params = query(request);
    const rows = w()
      .contracts.filter(
        (c) =>
          (c.tenantId === ok.tenantId || c.counterpartyTenantId === ok.tenantId) &&
          (!params.get("kind") || c.kind === params.get("kind")) &&
          (!params.get("state") || c.state === params.get("state")) &&
          (!params.get("leaseId") || c.leaseId === params.get("leaseId")),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((c) => contractDto(c, ok.tenantId));
    const perPage = Math.min(100, Number(params.get("perPage")) || 25);
    const page = Math.max(1, Number(params.get("page")) || 1);
    return json({
      data: rows.slice((page - 1) * perPage, page * perPage),
      meta: { page, perPage, total: rows.length },
    });
  }),

  http.post("*/v1/owner/contracts", async ({ request }) => {
    const op = "owner.contracts.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const forbidden = allowed(ok, op, "lease.manage");
    if (forbidden) return forbidden;
    const input = await body<Schemas["ContractCreateDto"]>(request);
    const language = input.language ?? "th";
    const variables = input.variables ?? {};
    const allowedKeys: Record<Schemas["SignableContractKind"], string[]> = {
      reservation: ["fee", "rent", "moveInDate", "expiresOn", "refundTerms"],
      addendum: ["clauses", "effectiveDate"],
      brokerage_mandate: ["note"],
      co_broke: ["note"],
    };
    const unknown = Object.keys(variables).filter((k) => !allowedKeys[input.kind]?.includes(k));
    if (unknown.length)
      return problem(op, "contract.unknown_variable", {
        errors: unknown.map((k) => ({ path: `variables.${k}`, code: "unknown", message: k })),
      });
    // The template version: the one picked (own or platform, of this kind), else the platform draft in the language.
    const template = input.templateVersionId
      ? w().templates.find(
          (t) =>
            (t.tenantId === null || t.tenantId === ok.tenantId) &&
            t.kind === input.kind &&
            t.versions.some((v) => v.id === input.templateVersionId && v.state === "published"),
        )
      : w().templates.find((t) => t.tenantId === null && t.kind === input.kind);
    const pinned = template?.versions.find((v) =>
      input.templateVersionId ? v.id === input.templateVersionId : v.language === language && v.state === "published",
    );
    if (!template || !pinned) return validation(op, "templateVersionId", "a published version of this kind", "kind");
    const self = Object.values(TENANTS).find((tenant) => tenant.profile.id === ok.tenantId)!.profile;
    let signers: Schemas["ContractSignerDto"][] = [];
    let unitId: string | null = null;
    let unitNo = "";
    let leaseId: string | null = null;
    let counterpartyTenantId: string | null = null;
    switch (input.kind) {
      case "reservation": {
        if (!input.unitId) return validation(op, "unitId", "the unit", "required");
        if (!input.partyId) return validation(op, "partyId", "the person reserving", "required");
        if (!variables.fee) return validation(op, "variables.fee", "the reservation fee", "required");
        const unit = ok.own ? state.owner.units.find((u) => u.id === input.unitId) : undefined;
        const party = ok.own ? state.owner.parties.find((p) => p.id === input.partyId) : undefined;
        if (!unit || !party) return notFound(op);
        unitId = unit.id;
        unitNo = unit.unitNo;
        signers = [
          { index: 0, role: "lessor", name: self.displayName, partyId: null, tenantId: ok.tenantId, signedAt: null },
          { index: 1, role: "prospect", name: party.displayName, partyId: party.id, tenantId: null, signedAt: null },
        ];
        break;
      }
      case "addendum": {
        const lease = input.leaseId ? leaseOf(ok, input.leaseId) : undefined;
        if (!input.leaseId) return validation(op, "leaseId", "the lease", "required");
        if (!lease) return notFound(op);
        const clauses = variables.clauses ?? [];
        if (!clauses.length || clauses.length > 20) return validation(op, "variables.clauses", "1–20 clauses", "size");
        leaseId = lease.id;
        unitId = lease.unitId;
        unitNo = lease.unitNo;
        signers = [
          { index: 0, role: "lessor", name: self.displayName, partyId: null, tenantId: ok.tenantId, signedAt: null },
          {
            index: 1,
            role: "lessee",
            name: lease.lesseeName ?? "—",
            partyId: lease.lesseePartyId,
            tenantId: null,
            signedAt: null,
          },
        ];
        break;
      }
      case "brokerage_mandate": {
        const mandate = state.agency.mandates.find((m) => m.id === input.mandateId && m.ownerTenantId === ok.tenantId);
        if (!input.mandateId) return validation(op, "mandateId", "the mandate", "required");
        if (!mandate) return notFound(op);
        unitId = mandate.unitId;
        unitNo = mandate.unitNo;
        counterpartyTenantId = mandate.agencyTenantId;
        signers = [
          { index: 0, role: "owner", name: mandate.ownerName, partyId: null, tenantId: ok.tenantId, signedAt: null },
          {
            index: 1,
            role: "agency",
            name: mandate.agencyName,
            partyId: null,
            tenantId: mandate.agencyTenantId,
            signedAt: null,
          },
        ];
        break;
      }
      case "co_broke": {
        const agreement = state.agency.coBrokes.find(
          (a) => a.id === input.coBrokeAgreementId && a.listingAgencyTenantId === ok.tenantId,
        );
        if (!input.coBrokeAgreementId) return validation(op, "coBrokeAgreementId", "the agreement", "required");
        if (!agreement) return notFound(op);
        unitId = agreement.unitId;
        counterpartyTenantId = agreement.coAgencyTenantId;
        signers = [
          {
            index: 0,
            role: "agency",
            name: agreement.listingAgencyName,
            partyId: null,
            tenantId: ok.tenantId,
            signedAt: null,
          },
          {
            index: 1,
            role: "co_agency",
            name: agreement.coAgencyName,
            partyId: null,
            tenantId: agreement.coAgencyTenantId,
            signedAt: null,
          },
        ];
        break;
      }
    }
    const created: MockContract = {
      id: crypto.randomUUID(),
      tenantId: ok.tenantId,
      kind: input.kind,
      title: input.title?.trim() || `${template.name}${unitNo ? ` ${unitNo}` : ""}`,
      number: null,
      state: "draft",
      language: pinned.language,
      templateVersionId: pinned.id,
      templateKey: template.key,
      templateVersion: pinned.version,
      legalReviewState: pinned.legalReviewState,
      leaseId,
      unitId,
      coBrokeAgreementId: input.kind === "co_broke" ? (input.coBrokeAgreementId ?? null) : null,
      mandateId: input.kind === "brokerage_mandate" ? (input.mandateId ?? null) : null,
      counterpartyTenantId,
      signers,
      variables,
      sha256: null,
      sentAt: null,
      signedAt: null,
      cancelledAt: null,
      createdAt: now(),
    };
    w().contracts.push(created);
    state.owner.received.push({ op, idempotencyKey: null, body: input as unknown as Record<string, unknown> });
    return json(contractDto(created, ok.tenantId), 201);
  }),

  http.get("*/v1/owner/contracts/:contractId", ({ request, params }) => {
    const op = "owner.contracts.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const c = visibleContract(ok, String(params.contractId));
    return c ? json(contractDto(c, ok.tenantId)) : notFound(op);
  }),

  http.get("*/v1/owner/contracts/:contractId/preview", ({ request, params }) => {
    const op = "owner.contracts.preview";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const c = visibleContract(ok, String(params.contractId));
    if (!c) return notFound(op);
    return new Response(placeholderPdf(c.id), { headers: { "content-type": "application/pdf" } });
  }),

  http.get("*/v1/owner/contracts/:contractId/document", ({ request, params }) => {
    const op = "owner.contracts.document";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const c = visibleContract(ok, String(params.contractId));
    if (!c) return notFound(op);
    if (!c.sha256) return problem(op, "contract.invalid_state");
    const documentId = documentIds.get(`${c.id}:${c.sha256}`) ?? crypto.randomUUID();
    documentIds.set(`${c.id}:${c.sha256}`, documentId);
    return json({
      ...documentDownload(request, documentId, c.number ?? ""),
      sha256: c.sha256,
      signed: c.state === "signed",
    } satisfies Schemas["ContractDownloadDto"]);
  }),

  http.post("*/v1/owner/contracts/:contractId/actions/send-for-signature", async ({ request, params }) => {
    const op = "owner.contracts.sendForSignature";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const c = visibleContract(ok, String(params.contractId));
    if (!c || c.tenantId !== ok.tenantId) return notFound(op);
    return idempotent(request, op, () => {
      if (c.state !== "draft") return problem(op, "contract.invalid_state");
      c.state = "pending_signature";
      c.number = `CTR-2026-${String(++contractSeq).padStart(5, "0")}`;
      c.sha256 = hex();
      c.sentAt = now();
      return { status: 200, body: contractDto(c, ok.tenantId) };
    });
  }),

  http.post("*/v1/owner/contracts/:contractId/actions/sign", async ({ request, params }) => {
    const op = "owner.contracts.sign";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const c = visibleContract(ok, String(params.contractId));
    if (!c) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["ContractOperatorSignDto"];
      if (c.state !== "pending_signature") return problem(op, "contract.invalid_state");
      const mine = c.signers.filter((s) => s.tenantId === ok.tenantId);
      if (!mine.length) return problem(op, "contract.not_signer");
      const open = mine.find((s) => !s.signedAt);
      if (!open) return problem(op, "contract.already_signed");
      if (input.contractSha256 !== c.sha256) return problem(op, "contract.changed");
      if (!input.signaturePng) return validation(op, "signaturePng", "a drawn signature", "required");
      open.signedAt = now();
      if (c.signers.every((s) => s.signedAt)) {
        c.state = "signed";
        c.signedAt = now();
        c.sha256 = hex();
      }
      return { status: 200, body: contractDto(c, ok.tenantId) };
    });
  }),

  http.post("*/v1/owner/contracts/:contractId/actions/cancel", async ({ request, params }) => {
    const op = "owner.contracts.cancel";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const c = visibleContract(ok, String(params.contractId));
    if (!c || c.tenantId !== ok.tenantId) return notFound(op);
    if (c.state !== "draft" && c.state !== "pending_signature") return problem(op, "contract.invalid_state");
    const input = await body<Schemas["MandateReasonDto"]>(request);
    state.owner.received.push({ op, idempotencyKey: null, body: input as Record<string, unknown> });
    c.state = "cancelled";
    c.cancelledAt = now();
    return json(contractDto(c, ok.tenantId));
  }),

  // ------------------------------------------------------------------------------------------------ renewals
  http.get("*/v1/owner/leases/:leaseId/renewal-suggestion", ({ request, params }) => {
    const op = "owner.renewals.suggestion";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const lease = leaseOf(ok, String(params.leaseId));
    return lease ? json(suggestion(lease, ok.tenantId)) : notFound(op);
  }),

  http.get("*/v1/owner/leases/:leaseId/renewal-offers", ({ request, params }) => {
    const op = "owner.renewals.listForLease";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const lease = leaseOf(ok, String(params.leaseId));
    if (!lease) return notFound(op);
    const data = w()
      .offers.filter((o) => o.leaseId === lease.id && o.tenantId === ok.tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(offerDto);
    return json({ data } satisfies Schemas["RenewalOffersDto"]);
  }),

  http.post("*/v1/owner/leases/:leaseId/renewal-offers", async ({ request, params }) => {
    const op = "owner.renewals.offer";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const lease = leaseOf(ok, String(params.leaseId));
    if (!lease) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as Schemas["RenewalOfferCreateDto"];
      if (!["active", "ending"].includes(lease.status)) return problem(op, "renewal.invalid_state");
      if (w().offers.some((o) => o.leaseId === lease.id && o.state === "offered"))
        return problem(op, "renewal.offer_exists");
      if (input.rent !== undefined && !/^\d{1,12}(\.\d{1,2})?$/.test(input.rent))
        return validation(op, "rent", "an amount like 15500.00", "money");
      const s = suggestion(lease, ok.tenantId);
      const months = input.months ?? lease.months;
      if (!Number.isInteger(months) || months < 1 || months > 36) return validation(op, "months", "1–36", "range");
      const startDate = addDays(lease.endDate, 1);
      const respondBy = [addDays(today(), 15), lease.endDate].sort()[0]!;
      const offeredRent = Number(input.rent ?? s.suggested.rent).toFixed(2);
      const notice: Schemas["LeaseNoticeDto"] = {
        id: crypto.randomUUID(),
        leaseId: lease.id,
        kind: "renewal_offer",
        number: `NTC-2569-R${String(w().offers.length + 1).padStart(4, "0")}`,
        language: input.language ?? lease.template.language,
        issuedOn: today(),
        effectiveDate: startDate,
        respondBy,
        noticeDays: null,
        newRent: offeredRent,
        renewalMonths: months,
        amountDue: null,
        reasonCode: null,
        message: input.message ?? null,
        items: [],
        documentId: crypto.randomUUID(),
        sentAt: now(),
      };
      w().letters[lease.id] = [notice, ...(w().letters[lease.id] ?? [])];
      const offer: MockOffer = {
        id: crypto.randomUUID(),
        tenantId: ok.tenantId,
        leaseId: lease.id,
        unitId: lease.unitId,
        noticeId: notice.id,
        currentRent: lease.rent,
        suggestedRent: s.suggested.rent,
        suggestionSource: s.suggested.source,
        offeredRent,
        months,
        startDate,
        respondBy,
        state: "offered",
        message: input.message ?? null,
        newLeaseId: null,
        decidedAt: null,
        declineReason: null,
        nextActions: [],
        createdAt: now(),
      };
      w().offers.push(offer);
      return { status: 201, body: offerDto(offer) };
    });
  }),

  http.get("*/v1/owner/renewal-offers", ({ request }) => {
    const op = "owner.renewals.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const wanted = query(request).get("state");
    const data = w()
      .offers.filter((o) => o.tenantId === ok.tenantId && (!wanted || o.state === wanted))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(offerDto);
    return json({ data } satisfies Schemas["RenewalOffersDto"]);
  }),

  http.post("*/v1/owner/renewal-offers/:offerId/actions/withdraw", ({ request, params }) => {
    const op = "owner.renewals.withdraw";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const o = w().offers.find((candidate) => candidate.id === params.offerId && candidate.tenantId === ok.tenantId);
    if (!o) return notFound(op);
    if (o.state !== "offered") return problem(op, "renewal.invalid_state");
    o.state = "withdrawn";
    o.decidedAt = now();
    state.owner.received.push({ op, idempotencyKey: null, body: { offerId: o.id } });
    return json(offerDto(o));
  }),
];

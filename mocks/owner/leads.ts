import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { TENANTS } from "../fixtures";
import { state } from "../state";
import { body, json, mutating, owner, problem } from "./support";

type Schemas = components["schemas"];

/** An enquiry as the mock holds it: the owner DTO and whose tenant it belongs to. */
export interface MockLead {
  tenantId: string;
  dto: Schemas["OwnerLeadDto"];
}

const LANDLORD = TENANTS.landlord.profile.id;
const ARI = {
  id: "8d4b2c1a-0000-4000-8000-00000000a001",
  slug: "condo-1br-a1b2c3d4e5",
  title: "คอนโด 1 ห้องนอน ใกล้ BTS อารีย์ วิวเมือง",
  unitId: "7b2e1d4f-3c5a-4f6b-9c0d-1e2f3a4b5c01",
};
const HOUR = 3_600_000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const CLOSED = new Set(["won", "lost"]);
const LIVE = new Set(["requested", "confirmed"]);

/** A Saturday-morning-style slot `days` ahead at `hour` (Bangkok), 30 minutes long. */
function slot(days: number, hour: number) {
  const d = new Date(Date.now() + days * 24 * HOUR);
  d.setUTCHours(hour - 7, 0, 0, 0);
  return { startsAt: d.toISOString(), endsAt: new Date(d.getTime() + 30 * 60_000).toISOString() };
}

function viewing(
  id: string,
  at: { startsAt: string; endsAt: string },
  state: Schemas["ListingViewingState"],
  note: string | null = null,
): Schemas["LeadViewingDto"] {
  return { id, ...at, state, note, reason: null, cancelledBy: null, rescheduledTo: null };
}

function lead(input: {
  id: string;
  name: string;
  state: Schemas["ListingLeadState"];
  messages: [Schemas["ListingLeadAuthor"], string, number][];
  viewings?: Schemas["LeadViewingDto"][];
  extra?: Partial<Schemas["OwnerLeadDto"]>;
  /** The prospect verified their identity (D-267). */
  verified?: boolean;
}): MockLead {
  const messages = input.messages.map(([author, text, ago], i) => ({
    id: `${input.id.slice(0, -3)}${String(100 + i)}`,
    author,
    body: text,
    createdAt: iso(-ago * HOUR),
  }));
  const dto: Schemas["OwnerLeadDto"] = {
    id: input.id,
    listing: ARI,
    prospect: {
      partyId: `${input.id.slice(0, -1)}f`,
      name: input.name,
      phone: null,
      lineLinked: true,
      identityVerified: input.verified ?? false,
    },
    state: input.state,
    lastMessage: null,
    channel: null,
    lastMessageBy: null,
    awaitingReply: false,
    nextViewing: null,
    lastProspectAt: messages.filter((m) => m.author === "prospect").at(-1)?.createdAt ?? iso(-HOUR),
    lastOwnerAt: messages.filter((m) => m.author === "owner").at(-1)?.createdAt ?? null,
    createdAt: messages[0]?.createdAt ?? iso(-HOUR),
    moveInDate: null,
    termMonths: null,
    occupants: null,
    nationality: null,
    notes: null,
    lostReason: null,
    lostNote: null,
    messages,
    viewings: input.viewings ?? [],
    leaseId: null,
    version: 1,
    ...input.extra,
  };
  return { tenantId: LANDLORD, dto: derive(dto) };
}

/** The summary fields the API derives from the conversation and the viewings. */
function derive(dto: Schemas["OwnerLeadDto"]): Schemas["OwnerLeadDto"] {
  const last = dto.messages.at(-1) ?? null;
  const next =
    [...dto.viewings].filter((v) => LIVE.has(v.state)).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null;
  return {
    ...dto,
    lastMessage: last?.body.slice(0, 200) ?? null,
    lastMessageBy: last?.author ?? null,
    awaitingReply: !CLOSED.has(dto.state) && last?.author === "prospect",
    nextViewing: next,
  };
}

export function initialLeads(): MockLead[] {
  return [
    lead({
      id: "5e7a9c1b-0000-4000-8000-0000000e1001",
      name: "สมศรี ใจดี",
      state: "viewing_booked",
      messages: [["prospect", "ห้องยังว่างไหมคะ อยากเข้าดูเสาร์นี้ ทำงานแถวอารีย์ค่ะ", 3]],
      viewings: [viewing("6f8b0d2c-0000-4000-8000-0000000f1001", slot(2, 10), "requested", "จะมากับแฟนค่ะ")],
      extra: { moveInDate: "2026-12-01", termMonths: 12, occupants: 2, channel: "facebook_group" },
      verified: true,
    }),
    lead({
      id: "5e7a9c1b-0000-4000-8000-0000000e1002",
      name: "Daniel Weber",
      state: "contacted",
      messages: [
        ["prospect", "Hi, is the unit available from December? Pets allowed?", 30],
        ["owner", "Hello, yes from 1 December. Small pets are fine.", 26],
        ["prospect", "Great, thanks!", 25],
        ["owner", "You are welcome — book a viewing time whenever it suits you.", 24],
      ],
      extra: { nationality: "DE", termMonths: 6, occupants: 1, channel: "line" },
    }),
    lead({
      id: "5e7a9c1b-0000-4000-8000-0000000e1003",
      name: "ธนพล ศรีสุข",
      state: "viewing_booked",
      messages: [
        ["prospect", "สนใจครับ ขอดูห้องวันอาทิตย์ได้ไหมครับ", 50],
        ["owner", "ได้ค่ะ ยืนยันนัดให้แล้วนะคะ", 48],
      ],
      viewings: [viewing("6f8b0d2c-0000-4000-8000-0000000f1003", slot(3, 14), "confirmed")],
    }),
    lead({
      id: "5e7a9c1b-0000-4000-8000-0000000e1004",
      name: "พิมพ์ชนก แก้วมณี",
      state: "lost",
      messages: [
        ["prospect", "ลดราคาได้ไหมคะ งบ 12,000", 120],
        ["owner", "ขออภัยค่ะ ราคานี้เป็นราคาสุดท้ายแล้ว", 118],
      ],
      extra: { lostReason: "price", lostNote: "งบ 12,000" },
    }),
  ];
}

const mine = (tenantId: string) => state.leads.filter((l) => l.tenantId === tenantId);
const find = (tenantId: string, id: string) => mine(tenantId).find((l) => l.dto.id === id);
const summary = (dto: Schemas["OwnerLeadDto"]): Schemas["OwnerLeadSummaryDto"] => ({
  id: dto.id,
  listing: dto.listing,
  prospect: dto.prospect,
  state: dto.state,
  lastMessage: dto.lastMessage,
  channel: dto.channel,
  lastMessageBy: dto.lastMessageBy,
  awaitingReply: dto.awaitingReply,
  nextViewing: dto.nextViewing,
  lastProspectAt: dto.lastProspectAt,
  lastOwnerAt: dto.lastOwnerAt,
  createdAt: dto.createdAt,
});
const save = (l: MockLead, patch: Partial<Schemas["OwnerLeadDto"]>) => {
  l.dto = derive({ ...l.dto, ...patch, version: l.dto.version + 1 });
  return json(l.dto);
};
const byViewing = (tenantId: string, viewingId: string) =>
  mine(tenantId).find((l) => l.dto.viewings.some((v) => v.id === viewingId));
const unbooked = (l: MockLead, viewings: Schemas["LeadViewingDto"][]): Schemas["ListingLeadState"] =>
  l.dto.state === "viewing_booked" && !viewings.some((v) => LIVE.has(v.state))
    ? l.dto.lastOwnerAt
      ? "contacted"
      : "new"
    : l.dto.state;

/** `/v1/owner/leads*` and `/v1/owner/listing-viewings*` (B7.3, D-252). */
export const leadHandlers: HttpHandler[] = [
  http.get("*/v1/owner/leads", ({ request }) => {
    const ok = owner(request, "owner.leads.list");
    if (ok instanceof Response) return ok;
    const params = new URL(request.url).searchParams;
    const open = params.get("open") === "true";
    return json(
      mine(ok.tenantId)
        .filter((l) => !open || !CLOSED.has(l.dto.state))
        .sort((a, b) => b.dto.lastProspectAt.localeCompare(a.dto.lastProspectAt))
        .map((l) => summary(l.dto)),
    );
  }),
  http.get("*/v1/owner/leads/:leadId", ({ request, params }) => {
    const ok = owner(request, "owner.leads.get");
    if (ok instanceof Response) return ok;
    const l = find(ok.tenantId, String(params.leadId));
    return l ? json(l.dto) : problem("owner.leads.get", "http.not_found");
  }),
  http.post("*/v1/owner/leads/:leadId/messages", async ({ request, params }) => {
    const op = "owner.leads.reply";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const l = find(ok.tenantId, String(params.leadId));
    if (!l) return problem(op, "http.not_found");
    if (CLOSED.has(l.dto.state)) return problem(op, "listing.lead_invalid_state");
    const { body: text } = await body<{ body?: string }>(request);
    if (!text?.trim())
      return problem(op, "validation.failed", { errors: [{ path: "body", code: "required", message: "required" }] });
    const at = new Date().toISOString();
    const message = { id: crypto.randomUUID(), author: "owner" as const, body: text.trim(), createdAt: at };
    const res = save(l, {
      messages: [...l.dto.messages, message],
      lastOwnerAt: at,
      state: l.dto.state === "new" ? "contacted" : l.dto.state,
    });
    return json(await res.json(), 201);
  }),
  http.patch("*/v1/owner/leads/:leadId", async ({ request, params }) => {
    const op = "owner.leads.update";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const l = find(ok.tenantId, String(params.leadId));
    if (!l) return problem(op, "http.not_found");
    const { notes } = await body<{ notes?: string | null }>(request);
    return save(l, { notes: notes?.trim() || null });
  }),
  http.post("*/v1/owner/leads/:leadId/actions/set-state", async ({ request, params }) => {
    const op = "owner.leads.setState";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const l = find(ok.tenantId, String(params.leadId));
    if (!l) return problem(op, "http.not_found");
    if (CLOSED.has(l.dto.state)) return problem(op, "listing.lead_invalid_state");
    const input = await body<{
      state: Schemas["OwnerLeadState"];
      lostReason?: Schemas["ListingLeadLostReason"] | null;
      lostNote?: string | null;
    }>(request);
    if (input.state === "lost" && !input.lostReason)
      return problem(op, "validation.failed", {
        errors: [{ path: "lostReason", code: "required", message: "a lost enquiry needs a reason" }],
      });
    const closing = input.state === "won" || input.state === "lost";
    return save(l, {
      state: input.state,
      lostReason: input.state === "lost" ? (input.lostReason ?? null) : null,
      lostNote: input.state === "lost" ? input.lostNote?.trim() || null : null,
      viewings: closing
        ? l.dto.viewings.map((v) =>
            LIVE.has(v.state) ? { ...v, state: "cancelled" as const, cancelledBy: "owner" as const } : v,
          )
        : l.dto.viewings,
    });
  }),
  // B7.4: a lease draft from the enquiry (the mock owner world keeps leases of the sample apartment only).
  http.post("*/v1/owner/leads/:leadId/lease-draft", ({ request, params }) => {
    const op = "owner.leads.leaseDraft";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const l = find(ok.tenantId, String(params.leadId));
    if (!l) return problem(op, "http.not_found");
    if (CLOSED.has(l.dto.state)) return problem(op, "listing.lead_invalid_state");
    if (l.dto.leaseId) return problem(op, "listing.lease_exists");
    const leaseId = crypto.randomUUID();
    save(l, { leaseId, state: "applied" });
    return json({ leaseId, lead: l.dto }, 201);
  }),
  http.get("*/v1/owner/listing-viewings", ({ request }) => {
    const ok = owner(request, "owner.listingViewings.list");
    if (ok instanceof Response) return ok;
    const from = Date.now() - 12 * HOUR;
    return json(
      mine(ok.tenantId)
        .flatMap((l) =>
          l.dto.viewings
            .filter((v) => v.state !== "declined" && v.state !== "cancelled" && Date.parse(v.startsAt) >= from)
            .map((v) => ({
              id: v.id,
              startsAt: v.startsAt,
              endsAt: v.endsAt,
              state: v.state,
              leadId: l.dto.id,
              prospectName: l.dto.prospect.name,
              listing: { id: l.dto.listing.id, title: l.dto.listing.title, slug: l.dto.listing.slug },
            })),
        )
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    );
  }),
  http.post("*/v1/owner/listing-viewings/:viewingId/actions/:action", async ({ request, params }) => {
    const action = String(params.action);
    const op = `owner.listingViewings.${action}`;
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const id = String(params.viewingId);
    const l = byViewing(ok.tenantId, id);
    const v = l?.dto.viewings.find((x) => x.id === id);
    if (!l || !v) return problem(op, "http.not_found");
    const started = Date.parse(v.startsAt) <= Date.now();
    const at = new Date().toISOString();
    if (action === "confirm") {
      if (v.state !== "requested" || started) return problem(op, "listing.viewing_invalid_state");
      const viewings = l.dto.viewings.map((x) => (x.id === id ? { ...x, state: "confirmed" as const } : x));
      return save(l, { viewings, lastOwnerAt: at });
    }
    if (action === "decline") {
      if (!LIVE.has(v.state) || started) return problem(op, "listing.viewing_invalid_state");
      const { reason } = await body<{ reason?: string }>(request);
      if (!reason?.trim())
        return problem(op, "validation.failed", {
          errors: [{ path: "reason", code: "required", message: "required" }],
        });
      const viewings = l.dto.viewings.map((x) =>
        x.id === id ? { ...x, state: "declined" as const, reason: reason.trim() } : x,
      );
      return save(l, { viewings, lastOwnerAt: at, state: unbooked(l, viewings) });
    }
    if (action === "complete") {
      if (v.state !== "confirmed" || !started) return problem(op, "listing.viewing_invalid_state");
      const { outcome } = await body<{ outcome: "completed" | "no_show" }>(request);
      const viewings = l.dto.viewings.map((x) => (x.id === id ? { ...x, state: outcome } : x));
      return save(l, {
        viewings,
        state:
          outcome === "completed" && ["new", "contacted", "viewing_booked"].includes(l.dto.state)
            ? "viewed"
            : unbooked(l, viewings),
      });
    }
    return problem("owner.leads.get", "http.not_found");
  }),
];

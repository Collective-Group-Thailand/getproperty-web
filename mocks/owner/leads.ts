import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { TENANTS } from "../fixtures";
import { state } from "../state";
import { body, idempotent, json, mutating, owner, problem } from "./support";

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
  mode: Schemas["ViewingMode"] = "accompanied",
  access: Schemas["ViewingAccessSummaryDto"] | null = null,
): Schemas["LeadViewingDto"] {
  // G7 (D-295): the seeded enquiries are accompanied; self viewings come from `addSelfViewingLead` (mock control).
  return {
    id,
    ...at,
    state,
    note,
    reason: null,
    cancelledBy: null,
    rescheduledTo: null,
    mode,
    access,
  };
}

const MINUTE = 60_000;
/** The door-code window around a self viewing's start (`viewing.self.code_early_minutes` 5, `.code_minutes` 30). */
function accessWindow(startsAt: string): Schemas["ViewingAccessSummaryDto"] {
  const start = Date.parse(startsAt);
  return {
    state: "issued",
    validFrom: new Date(start - 5 * MINUTE).toISOString(),
    validTo: new Date(start + 30 * MINUTE).toISOString(),
    enteredAt: null,
    enteredSource: null,
    exitedAt: null,
    incidentAt: null,
    incidentNote: null,
    closedAt: null,
    closeReason: null,
    workOrderId: null,
  };
}

/** The entry log of a self viewing as the mock derives it from the access (G7): never a code. */
function logFor(viewingId: string, access: Schemas["ViewingAccessSummaryDto"]): Schemas["ViewingAccessLogDto"] {
  const open = !access.closedAt && (access.state === "issued" || access.state === "entered");
  const credentials: Schemas["ViewingAccessCredentialDto"][] = [
    {
      lockName: "ประตูห้อง A-1203",
      lockScope: "unit",
      status: open ? "active" : "revoked",
      validFrom: access.validFrom,
      validTo: access.validTo,
    },
    {
      lockName: "ประตูหน้าอาคาร",
      lockScope: "building_door",
      status: open ? "active" : "revoked",
      validFrom: access.validFrom,
      validTo: access.validTo,
    },
  ];
  const events: Schemas["ViewingAccessEventDto"][] = access.enteredAt
    ? [
        { time: access.enteredAt, lockName: "ประตูหน้าอาคาร", result: "success", source: "pin" },
        {
          time: new Date(Date.parse(access.enteredAt) + MINUTE).toISOString(),
          lockName: "ประตูห้อง A-1203",
          result: "success",
          source: "pin",
        },
      ]
    : [];
  return { viewingId, access, credentials, events };
}

/**
 * Mock control (G7): adds an enquiry with a self viewing in the given stage — `requested` (tomorrow), `issued`
 * (confirmed, later today), `entered` (inside now), `incident` (problem reported, work order opened) or `overstay`
 * (inside after the window). Returns the enquiry id.
 */
export function addSelfViewingLead(stage: string): string | null {
  const now = Date.now();
  const at = (startOffsetMin: number) => {
    const start = new Date(now + startOffsetMin * MINUTE);
    start.setUTCSeconds(0, 0);
    return { startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 30 * MINUTE).toISOString() };
  };
  const leadId = crypto.randomUUID();
  const viewingId = crypto.randomUUID();
  let v: Schemas["LeadViewingDto"];
  if (stage === "requested") v = viewing(viewingId, slot(1, 11), "requested", null, "self");
  else if (stage === "issued") {
    const when = at(180);
    v = viewing(viewingId, when, "confirmed", null, "self", accessWindow(when.startsAt));
  } else if (stage === "entered" || stage === "incident") {
    const when = at(-10);
    v = viewing(viewingId, when, "confirmed", null, "self", {
      ...accessWindow(when.startsAt),
      state: "entered",
      enteredAt: new Date(now - 8 * MINUTE).toISOString(),
      enteredSource: "lock_log",
      ...(stage === "incident"
        ? {
            incidentAt: new Date(now - 3 * MINUTE).toISOString(),
            incidentNote: "ก๊อกน้ำในห้องน้ำรั่ว น้ำนองพื้น",
            workOrderId: "9a1b2c3d-0000-4000-8000-00000000c901",
          }
        : {}),
    });
  } else if (stage === "overstay") {
    const when = at(-90);
    v = viewing(viewingId, when, "confirmed", null, "self", {
      ...accessWindow(when.startsAt),
      state: "entered",
      enteredAt: new Date(now - 88 * MINUTE).toISOString(),
      enteredSource: "prospect",
    });
  } else return null;
  state.leads.push(
    lead({
      id: leadId,
      name: "Kanokwan Visitor",
      state: "viewing_booked",
      messages: [["prospect", "ขอชมห้องด้วยตัวเองค่ะ ยืนยันตัวตนแล้ว", 5]],
      viewings: [v],
      verified: true,
    }),
  );
  return leadId;
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
    rentRecord: null,
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

/** A rent record a prospect shared (D-256): eleven months, one late — facts as the API counts them. */
export const SAMPLE_RENT_RECORD: Schemas["RentRecordDto"] = {
  months: [
    "2026-09",
    "2026-08",
    "2026-07",
    "2026-06",
    "2026-05",
    "2026-04",
    "2026-03",
    "2026-02",
    "2026-01",
    "2025-12",
    "2025-11",
  ].map((month) => ({ month, status: month === "2026-03" ? ("late" as const) : ("on_time" as const) })),
  onTime: 10,
  late: 1,
  outstanding: 0,
  notConfirmed: 0,
  firstMonth: "2025-11",
  lastMonth: "2026-09",
};

export function initialLeads(): MockLead[] {
  return [
    lead({
      id: "5e7a9c1b-0000-4000-8000-0000000e1001",
      name: "สมศรี ใจดี",
      state: "viewing_booked",
      messages: [["prospect", "ห้องยังว่างไหมคะ อยากเข้าดูเสาร์นี้ ทำงานแถวอารีย์ค่ะ", 3]],
      viewings: [viewing("6f8b0d2c-0000-4000-8000-0000000f1001", slot(2, 10), "requested", "จะมากับแฟนค่ะ")],
      extra: {
        moveInDate: "2026-12-01",
        termMonths: 12,
        occupants: 2,
        channel: "facebook_group",
        rentRecord: { ...SAMPLE_RENT_RECORD, sharedAt: iso(-2 * HOUR) },
      },
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

/** `viewing.self.enabled` as the owner settings hold it (G7, O-024: off by default). */
function selfViewingEnabled(): boolean {
  return state.owner.settings.find((setting) => setting.key === "viewing.self.enabled")?.value === true;
}

/** Mock control (G7): turns `viewing.self.enabled` on or off for the sample tenants. */
export function setSelfViewingEnabled(on: boolean) {
  const setting = state.owner.settings.find((one) => one.key === "viewing.self.enabled");
  if (setting) setting.value = on;
}

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
    // B7.3 default: from 12 hours ago, open-ended; G7's calendar passes a week (`from` / `to`).
    const params = new URL(request.url).searchParams;
    const from = params.get("from") ? Date.parse(params.get("from")!) : Date.now() - 12 * HOUR;
    const to = params.get("to") ? Date.parse(params.get("to")!) : Number.POSITIVE_INFINITY;
    return json(
      mine(ok.tenantId)
        .flatMap((l) =>
          l.dto.viewings
            .filter(
              (v) =>
                v.state !== "declined" &&
                v.state !== "cancelled" &&
                Date.parse(v.startsAt) >= from &&
                Date.parse(v.startsAt) < to,
            )
            .map((v): Schemas["OwnerViewingDto"] => ({
              id: v.id,
              startsAt: v.startsAt,
              endsAt: v.endsAt,
              state: v.state,
              mode: v.mode,
              access: v.access,
              leadId: l.dto.id,
              prospectName: l.dto.prospect.name,
              listing: { id: l.dto.listing.id, title: l.dto.listing.title, slug: l.dto.listing.slug },
            })),
        )
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    );
  }),
  // G7 (D-295): the entry log (audited at the API; locks, credential windows, door events — never a code).
  http.get("*/v1/owner/listing-viewings/:viewingId/access-log", ({ request, params }) => {
    const op = "owner.listingViewings.accessLog";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const id = String(params.viewingId);
    const v = byViewing(ok.tenantId, id)?.dto.viewings.find((x) => x.id === id);
    if (!v?.access) return problem(op, "http.not_found");
    return json(logFor(id, v.access));
  }),
  // G7: end a self viewing's door codes now (reason, Idempotency-Key).
  http.post("*/v1/owner/listing-viewings/:viewingId/actions/end-access", ({ request, params }) => {
    const op = "owner.listingViewings.endAccess";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    return idempotent(request, op, (input) => {
      const id = String(params.viewingId);
      const l = byViewing(ok.tenantId, id);
      const v = l?.dto.viewings.find((x) => x.id === id);
      if (!l || !v?.access) return problem(op, "http.not_found");
      const reason = typeof input.reason === "string" ? input.reason.trim() : "";
      if (!reason)
        return problem(op, "validation.failed", {
          errors: [{ path: "reason", code: "required", message: "required" }],
        });
      if (v.access.closedAt || !["issued", "entered"].includes(v.access.state))
        return problem(op, "viewing.access_invalid_state");
      const at = new Date().toISOString();
      const access: Schemas["ViewingAccessSummaryDto"] = {
        ...v.access,
        state: v.access.state === "entered" ? "exited" : "cancelled",
        exitedAt: v.access.state === "entered" ? at : v.access.exitedAt,
        closedAt: at,
        closeReason: reason,
      };
      save(l, { viewings: l.dto.viewings.map((x) => (x.id === id ? { ...x, access } : x)) });
      return { status: 200, body: access };
    });
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
      // G7: confirming a self viewing re-checks the switch and issues the door codes (never shown to the owner).
      if (v.mode === "self" && !selfViewingEnabled()) return problem(op, "viewing.self_unavailable");
      const viewings = l.dto.viewings.map((x) =>
        x.id === id
          ? { ...x, state: "confirmed" as const, access: x.mode === "self" ? accessWindow(x.startsAt) : x.access }
          : x,
      );
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

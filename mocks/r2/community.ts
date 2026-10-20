import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { emit } from "../handlers/realtime";
import { state } from "../state";
import {
  json,
  notFound,
  paged,
  problem,
  query,
  r2,
  read,
  reader,
  record,
  type Surface,
  validation,
  visible,
  writer,
} from "./support";

type Schemas = components["schemas"];

/**
 * Community (B5.3, D-073, D-212): announcements (a published text never changes; archive keeps the receipts),
 * parcels (photo → unit → the recipient is notified; hand-over with the resident's PIN or staff-confirmed;
 * return with a reason), facilities with booking policies and bookings, building rules (versions in force
 * from a date never in the past) with acknowledgements, and contacts.
 */

const today = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

function announcementOf(ok: Parameters<typeof visible>[0], id: unknown) {
  return r2().announcements.find((a) => a.id === id && ok.own && (!a.buildingId || visible(ok, a.buildingId))) ?? null;
}

function parcelHandlers(surface: Surface): HttpHandler[] {
  const base = `*/v1/${surface}/parcels`;
  const op = (name: string) => `${surface}.parcels.${name}`;
  const find = (ok: Parameters<typeof visible>[0], id: unknown) =>
    r2().parcels.find((parcel) => parcel.id === id && visible(ok, parcel.buildingId)) ?? null;
  return [
    http.get(base, ({ request }) => {
      const id = op("list");
      const ok = reader(request, id);
      if (ok instanceof Response) return ok;
      const params = query(request);
      const q = params.get("q")?.toLowerCase();
      const list = r2()
        .parcels.filter((parcel) => visible(ok, parcel.buildingId))
        .filter((parcel) => !params.get("buildingId") || parcel.buildingId === params.get("buildingId"))
        .filter((parcel) => !params.get("unitId") || parcel.unitId === params.get("unitId"))
        .filter((parcel) => !params.get("status") || parcel.status === params.get("status"))
        .filter((parcel) => params.get("open") !== "true" || ["received", "notified"].includes(parcel.status))
        .filter(
          (parcel) =>
            !q ||
            parcel.unitNo.toLowerCase().includes(q) ||
            (parcel.trackingNo ?? "").toLowerCase().includes(q) ||
            (parcel.carrier ?? "").toLowerCase().includes(q),
        )
        .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
      return json(paged(list, request));
    }),
    http.get(`${base}/:parcelId`, ({ request, params }) => {
      const id = op("get");
      const ok = reader(request, id);
      if (ok instanceof Response) return ok;
      const parcel = find(ok, params.parcelId);
      return parcel ? json(parcel) : notFound(id);
    }),
    http.post(base, async ({ request }) => {
      const id = op("receive");
      const ok = writer(request, id);
      if (ok instanceof Response) return ok;
      if (!ok.own) return notFound(id);
      const input = await read<Schemas["ParcelCreateDto"]>(request);
      if (!input.photoDocumentId)
        return validation(id, "photoDocumentId", "an uploaded photo of the parcel", "unknown");
      const unit = state.owner.units.find((candidate) => candidate.id === input.unitId);
      if (!unit || !visible(ok, unit.buildingId)) return notFound(id);
      const now = new Date().toISOString();
      const parcel: Schemas["ParcelDto"] = {
        id: crypto.randomUUID(),
        buildingId: unit.buildingId,
        unitId: unit.id,
        unitNo: unit.unitNo,
        recipientPartyId: input.recipientPartyId ?? null,
        carrier: input.carrier ?? null,
        trackingNo: input.trackingNo ?? null,
        notes: input.notes ?? null,
        photoDocumentId: input.photoDocumentId,
        status: "notified",
        receivedAt: now,
        notifiedAt: now,
        pickedUpAt: null,
        pickupConfirmedBy: null,
        returnedAt: null,
        returnReason: null,
      };
      r2().parcels.unshift(parcel);
      r2().pins[parcel.id] = String(100000 + Math.floor(Math.random() * 899999));
      record(id, request, input);
      emit(
        "parcel.received",
        { aggregateType: "parcel", aggregateId: parcel.id },
        surface === "owner" ? "staff" : "owner",
      );
      return json(parcel, 201);
    }),
    http.post(`${base}/:parcelId/actions/pick-up`, async ({ request, params }) => {
      const id = op("pickUp");
      const ok = writer(request, id);
      if (ok instanceof Response) return ok;
      const parcel = find(ok, params.parcelId);
      if (!parcel) return notFound(id);
      if (!["received", "notified"].includes(parcel.status)) return problem(id, "parcel.invalid_state");
      const input = await read<Schemas["ParcelPickUpDto"]>(request);
      if (!input.pin && !input.staffConfirmed)
        return validation(id, "pin", "the resident's PIN or a staff confirmation");
      if (input.pin && input.pin !== r2().pins[parcel.id]) return problem(id, "parcel.pin_mismatch");
      parcel.status = "picked_up";
      parcel.pickedUpAt = new Date().toISOString();
      parcel.pickupConfirmedBy = input.pin ? "resident_pin" : "staff";
      record(id, request, input);
      return json(parcel);
    }),
    http.post(`${base}/:parcelId/actions/return`, async ({ request, params }) => {
      const id = op("return");
      const ok = writer(request, id);
      if (ok instanceof Response) return ok;
      const parcel = find(ok, params.parcelId);
      if (!parcel) return notFound(id);
      if (!["received", "notified"].includes(parcel.status)) return problem(id, "parcel.invalid_state");
      const input = await read<Schemas["ReasonDto"]>(request);
      if (!input.reason?.trim()) return validation(id, "reason", "why the parcel goes back");
      parcel.status = "returned";
      parcel.returnedAt = new Date().toISOString();
      parcel.returnReason = input.reason.trim();
      record(id, request, input);
      return json(parcel);
    }),
  ];
}

function bookingStep(
  name: string,
  opName: string,
  allowed: Schemas["BookingStatus"][],
  to: Schemas["BookingStatus"],
  needsReason = false,
) {
  return http.post(`*/v1/owner/facility-bookings/:bookingId/actions/${name}`, async ({ request, params }) => {
    const op = `owner.facilityBookings.${opName}`;
    const ok = writer(request, op);
    if (ok instanceof Response) return ok;
    const booking = r2().bookings.find((candidate) => candidate.id === params.bookingId);
    const facility = booking ? r2().facilities.find((candidate) => candidate.id === booking.facilityId) : undefined;
    if (!booking || !facility || !visible(ok, facility.buildingId)) return notFound(op);
    if (!allowed.includes(booking.status)) return problem(op, "facility.booking_invalid_state");
    if (name === "no-show" && booking.startsAt > new Date().toISOString())
      return problem(op, "facility.booking_invalid_state");
    const input = await read<Schemas["BookingDecisionDto"]>(request);
    if (needsReason && !input.reason?.trim()) return validation(op, "reason", "a reason the resident sees");
    booking.status = to;
    if (to === "cancelled") booking.cancelReason = input.reason?.trim() ?? null;
    record(op, request, input);
    return json(booking);
  });
}

export const communityR2Handlers: HttpHandler[] = [
  // Announcements
  http.get("*/v1/owner/announcements", ({ request }) => {
    const op = "owner.announcements.list";
    const ok = reader(request, op);
    if (ok instanceof Response) return ok;
    const params = query(request);
    const published = params.get("published");
    const q = params.get("q")?.toLowerCase();
    const list = r2()
      .announcements.filter((a) => ok.own && (!a.buildingId || visible(ok, a.buildingId)))
      .filter((a) => !params.get("buildingId") || a.buildingId === params.get("buildingId") || a.buildingId === null)
      .filter((a) => published === null || (published === "true") === (a.publishedAt !== null))
      .filter((a) => !q || a.title.toLowerCase().includes(q))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
    return json(paged(list, request));
  }),
  http.post("*/v1/owner/announcements", async ({ request }) => {
    const op = "owner.announcements.create";
    const ok = writer(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own) return notFound(op);
    const input = await read<Schemas["AnnouncementCreateDto"]>(request);
    if (!input.title?.trim()) return validation(op, "title", "a title");
    if (!input.bodyTh?.trim()) return validation(op, "bodyTh", "the Thai text");
    if (input.buildingId && !state.owner.buildings.some((building) => building.id === input.buildingId))
      return notFound(op);
    const now = new Date().toISOString();
    const announcement: Schemas["AnnouncementDto"] = {
      id: crypto.randomUUID(),
      buildingId: input.buildingId ?? null,
      title: input.title.trim(),
      bodyTh: input.bodyTh.trim(),
      translations: input.translations ?? {},
      audienceFilter: input.audienceFilter ?? {},
      pinned: input.pinned ?? false,
      expiresAt: input.expiresAt ?? null,
      publishedAt: input.publish ? now : null,
      archivedAt: null,
      createdAt: now,
      readCount: 0,
      version: 1,
    };
    r2().announcements.unshift(announcement);
    r2().reads[announcement.id] = [];
    record(op, request, input);
    return json(announcement, 201);
  }),
  http.get("*/v1/owner/announcements/:announcementId", ({ request, params }) => {
    const op = "owner.announcements.get";
    const ok = reader(request, op);
    if (ok instanceof Response) return ok;
    const announcement = announcementOf(ok, params.announcementId);
    return announcement ? json(announcement) : notFound(op);
  }),
  http.patch("*/v1/owner/announcements/:announcementId", async ({ request, params }) => {
    const op = "owner.announcements.update";
    const ok = writer(request, op);
    if (ok instanceof Response) return ok;
    const announcement = announcementOf(ok, params.announcementId);
    if (!announcement) return notFound(op);
    const input = await read<Schemas["AnnouncementUpdateDto"]>(request);
    const textChange =
      input.title !== undefined ||
      input.bodyTh !== undefined ||
      input.translations !== undefined ||
      input.audienceFilter !== undefined;
    if (announcement.publishedAt && textChange) return problem(op, "announcement.published");
    Object.assign(announcement, Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)));
    announcement.version += 1;
    record(op, request, input);
    return json(announcement);
  }),
  http.post("*/v1/owner/announcements/:announcementId/actions/publish", ({ request, params }) => {
    const op = "owner.announcements.publish";
    const ok = writer(request, op);
    if (ok instanceof Response) return ok;
    const announcement = announcementOf(ok, params.announcementId);
    if (!announcement) return notFound(op);
    if (announcement.publishedAt) return problem(op, "announcement.published");
    announcement.publishedAt = new Date().toISOString();
    announcement.version += 1;
    record(op, request, {});
    return json(announcement);
  }),
  http.post("*/v1/owner/announcements/:announcementId/actions/archive", ({ request, params }) => {
    const op = "owner.announcements.archive";
    const ok = writer(request, op);
    if (ok instanceof Response) return ok;
    const announcement = announcementOf(ok, params.announcementId);
    if (!announcement) return notFound(op);
    announcement.archivedAt ??= new Date().toISOString();
    announcement.pinned = false;
    announcement.version += 1;
    return json(announcement);
  }),
  http.get("*/v1/owner/announcements/:announcementId/reads", ({ request, params }) => {
    const op = "owner.announcements.reads";
    const ok = reader(request, op);
    if (ok instanceof Response) return ok;
    const announcement = announcementOf(ok, params.announcementId);
    if (!announcement) return notFound(op);
    // The audience: the residents of the building (or the floors / units chosen) — 6 in the mock.
    const audience = announcement.publishedAt ? (announcement.audienceFilter.unitIds?.length ?? 6) : 0;
    return json({ audience, data: r2().reads[announcement.id] ?? [] } satisfies Schemas["AnnouncementReadsDto"]);
  }),

  ...parcelHandlers("owner"),
  ...parcelHandlers("staff"),

  // Facilities and bookings
  http.get("*/v1/owner/facilities", ({ request }) => {
    const op = "owner.facilities.list";
    const ok = reader(request, op);
    if (ok instanceof Response) return ok;
    const buildingId = query(request).get("buildingId");
    return json({
      data: r2().facilities.filter((f) => visible(ok, f.buildingId) && (!buildingId || f.buildingId === buildingId)),
    } satisfies Schemas["FacilitiesDto"]);
  }),
  http.post("*/v1/owner/facilities", async ({ request }) => {
    const op = "owner.facilities.create";
    const ok = writer(request, op);
    if (ok instanceof Response) return ok;
    const input = await read<Schemas["FacilityCreateDto"]>(request);
    if (!ok.own || !state.owner.buildings.some((building) => building.id === input.buildingId)) return notFound(op);
    if (!input.name?.trim()) return validation(op, "name", "a name");
    const facility: Schemas["FacilityDto"] = {
      id: crypto.randomUUID(),
      buildingId: input.buildingId,
      name: input.name.trim(),
      kind: input.kind ?? "other",
      capacity: input.capacity ?? null,
      isActive: input.isActive ?? true,
      bookingPolicy: {
        slotMinutes: 60,
        openFrom: "08:00",
        openTo: "22:00",
        maxDurationMinutes: 120,
        maxAdvanceDays: 14,
        maxPerUnitPerWeek: 2,
        requiresApproval: false,
        ...input.bookingPolicy,
      },
    };
    r2().facilities.push(facility);
    record(op, request, input);
    return json(facility, 201);
  }),
  http.patch("*/v1/owner/facilities/:facilityId", async ({ request, params }) => {
    const op = "owner.facilities.update";
    const ok = writer(request, op);
    if (ok instanceof Response) return ok;
    const facility = r2().facilities.find((f) => f.id === params.facilityId && visible(ok, f.buildingId));
    if (!facility) return notFound(op);
    const input = await read<Schemas["FacilityUpdateDto"]>(request);
    const policy = input.bookingPolicy;
    if (policy?.slotMinutes !== undefined && (policy.slotMinutes < 15 || policy.slotMinutes > 240))
      return validation(op, "bookingPolicy.slotMinutes", "15 to 240 minutes");
    if (policy?.openFrom && policy.openTo && policy.openFrom >= policy.openTo)
      return validation(op, "bookingPolicy.openTo", "after the opening time");
    const { bookingPolicy, ...rest } = input;
    Object.assign(facility, Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined)));
    if (bookingPolicy) facility.bookingPolicy = { ...facility.bookingPolicy, ...bookingPolicy };
    record(op, request, input);
    return json(facility);
  }),
  http.get("*/v1/owner/facilities/:facilityId/bookings", ({ request, params }) => {
    const op = "owner.facilities.bookings";
    const ok = reader(request, op);
    if (ok instanceof Response) return ok;
    const facility = r2().facilities.find((f) => f.id === params.facilityId && visible(ok, f.buildingId));
    if (!facility) return notFound(op);
    const from = query(request).get("from");
    const to = query(request).get("to");
    return json({
      data: r2()
        .bookings.filter((b) => b.facilityId === facility.id)
        .filter((b) => (!from || b.endsAt > from) && (!to || b.startsAt < to))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    } satisfies Schemas["BookingsDto"]);
  }),
  bookingStep("approve", "approve", ["requested"], "confirmed"),
  bookingStep("reject", "reject", ["requested"], "cancelled", true),
  bookingStep("cancel", "cancel", ["requested", "confirmed"], "cancelled", true),
  bookingStep("no-show", "noShow", ["confirmed"], "no_show"),

  // Building rules
  http.get("*/v1/owner/buildings/:buildingId/rules", ({ request, params }) => {
    const op = "owner.buildingRules.list";
    const ok = reader(request, op);
    if (ok instanceof Response) return ok;
    if (!visible(ok, String(params.buildingId)) || !state.owner.buildings.some((b) => b.id === params.buildingId))
      return notFound(op);
    return json({
      data: r2()
        .rules.filter((rule) => rule.buildingId === params.buildingId)
        .sort((a, b) => b.version - a.version),
    } satisfies Schemas["BuildingRulesDto"]);
  }),
  http.post("*/v1/owner/buildings/:buildingId/rules", async ({ request, params }) => {
    const op = "owner.buildingRules.publish";
    const ok = writer(request, op);
    if (ok instanceof Response) return ok;
    if (!visible(ok, String(params.buildingId)) || !state.owner.buildings.some((b) => b.id === params.buildingId))
      return notFound(op);
    const input = await read<Schemas["BuildingRuleCreateDto"]>(request);
    if (!input.title?.trim()) return validation(op, "title", "a title");
    if (!input.bodyTh?.trim()) return validation(op, "bodyTh", "the rules in Thai");
    if (!input.effectiveFrom || input.effectiveFrom < today())
      return validation(op, "effectiveFrom", "today or a later date (never in the past)");
    const versions = r2().rules.filter((rule) => rule.buildingId === params.buildingId);
    const rule: Schemas["BuildingRuleDto"] = {
      id: crypto.randomUUID(),
      buildingId: String(params.buildingId),
      version: versions.reduce((max, one) => Math.max(max, one.version), 0) + 1,
      title: input.title.trim(),
      bodyTh: input.bodyTh.trim(),
      translations: input.translations ?? {},
      effectiveFrom: input.effectiveFrom,
      publishedAt: new Date().toISOString(),
      acknowledgements: 0,
    };
    r2().rules.push(rule);
    r2().acks[rule.id] = [];
    record(op, request, input);
    return json(rule, 201);
  }),
  http.get("*/v1/owner/building-rules/:ruleId/acknowledgements", ({ request, params }) => {
    const op = "owner.buildingRules.acknowledgements";
    const ok = reader(request, op);
    if (ok instanceof Response) return ok;
    const rule = r2().rules.find((candidate) => candidate.id === params.ruleId && visible(ok, candidate.buildingId));
    if (!rule) return notFound(op);
    return json({ data: r2().acks[rule.id] ?? [] } satisfies Schemas["RuleAcksDto"]);
  }),

  // Contacts
  http.get("*/v1/owner/contacts", ({ request }) => {
    const op = "owner.contacts.list";
    const ok = reader(request, op);
    if (ok instanceof Response) return ok;
    const buildingId = query(request).get("buildingId");
    return json({
      data: ok.own
        ? r2()
            .contacts.filter((c) => !buildingId || c.buildingId === buildingId || c.buildingId === null)
            .sort((a, b) => a.sortOrder - b.sortOrder)
        : [],
    } satisfies Schemas["ContactsDto"]);
  }),
  http.post("*/v1/owner/contacts", async ({ request }) => {
    const op = "owner.contacts.create";
    const ok = writer(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own) return notFound(op);
    const input = await read<Schemas["ContactCreateDto"]>(request);
    if (!input.name?.trim()) return validation(op, "name", "a name");
    if (!input.phone && !input.lineId) return validation(op, "phone", "a phone or a LINE id");
    const contact: Schemas["ContactDto"] = {
      id: crypto.randomUUID(),
      buildingId: input.buildingId ?? null,
      kind: input.kind ?? "building",
      name: input.name.trim(),
      phone: input.phone ?? null,
      lineId: input.lineId ?? null,
      notes: input.notes ?? null,
      sortOrder: input.sortOrder ?? r2().contacts.length + 1,
    };
    r2().contacts.push(contact);
    record(op, request, input);
    return json(contact, 201);
  }),
  http.patch("*/v1/owner/contacts/:contactId", async ({ request, params }) => {
    const op = "owner.contacts.update";
    const ok = writer(request, op);
    if (ok instanceof Response) return ok;
    const contact = ok.own ? r2().contacts.find((c) => c.id === params.contactId) : undefined;
    if (!contact) return notFound(op);
    const input = await read<Schemas["ContactUpdateDto"]>(request);
    Object.assign(contact, Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)));
    if (!contact.phone && !contact.lineId) return validation(op, "phone", "a phone or a LINE id");
    record(op, request, input);
    return json(contact);
  }),
  http.delete("*/v1/owner/contacts/:contactId", ({ request, params }) => {
    const op = "owner.contacts.remove";
    const ok = writer(request, op);
    if (ok instanceof Response) return ok;
    const index = ok.own ? r2().contacts.findIndex((c) => c.id === params.contactId) : -1;
    if (index < 0) return notFound(op);
    r2().contacts.splice(index, 1);
    return new Response(null, { status: 204 });
  }),
];

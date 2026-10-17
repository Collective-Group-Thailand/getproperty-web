import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { channelDto } from "../handlers/staff";
import { state } from "../state";
import { buildingOf, unitOf, type MockMeter } from "../staff-world";
import { milli, qty } from "./money";
import {
  body,
  etagged,
  idempotent,
  json,
  mutating,
  notFound,
  owner,
  paged,
  problem,
  query,
  stale,
  validation,
} from "./support";
import { BUILDING_A, id, iso, lossView, PERIODS, reading, REVIEW_PHOTO } from "./world";

type Schemas = components["schemas"];

/**
 * Meters, readings, reviews, devices, utility invoices and loss of the owner surface (F2 2.5,
 * B3.1–B3.4). Meter points are the staff world's meters (one source for both zones); the reading
 * history is generated monthly per meter plus everything staff recorded; series are hourly/daily
 * buckets of a deterministic profile; reviews accept / correct / reject (D-142 supersede).
 */
const w = () => state.owner;
const DECIMAL_3 = /^\d{1,9}(\.\d{1,3})?$/;

function meterDto(meter: MockMeter): Schemas["MeterDto"] {
  const unit = unitOf(meter);
  return {
    id: meter.assignmentId,
    assetItemId: meter.assetItemId,
    code: meter.code,
    name: meter.name,
    utility: meter.utility,
    purpose: "unit",
    serial: meter.serial,
    initialReading: meter.initialReading,
    multiplier: "1",
    unitId: unit?.id ?? null,
    unitNo: unit?.no ?? null,
    commonAreaLabel: null,
    validFrom: iso(-400),
    validTo: meter.retired ? iso(-1) : null,
  };
}

const commonMeters: Schemas["MeterDto"][] = [
  {
    id: id("aa000000", 90),
    assetItemId: id("a1000000", 90),
    code: "E-A-COMMON",
    name: "มิเตอร์ส่วนกลาง อาคาร A",
    utility: "electric",
    purpose: "common_area",
    serial: "SN-E-CA",
    initialReading: "0.000",
    multiplier: "1",
    unitId: null,
    unitNo: null,
    commonAreaLabel: "ทางเดินและลิฟต์",
    validFrom: iso(-400),
    validTo: null,
  },
];

/** Six monthly readings before the round, ending at the meter's last register (D-030 cumulative registers). */
function history(meter: MockMeter): Schemas["MeterReadingDto"][] {
  const unit = unitOf(meter);
  const end = milli(meter.last?.register ?? "0.000");
  const step = meter.utility === "electric" ? 185_500 : 6_400;
  const base: Schemas["MeterReadingDto"][] = Array.from({ length: 6 }, (_, index) => {
    const back = 5 - index;
    const register = Math.max(0, end - back * step);
    return reading({
      id: id(`e${meter.assetItemId.slice(1, 8)}`, 100 + index),
      assetItemId: meter.assetItemId,
      meterAssignmentId: meter.assignmentId,
      meterCode: meter.code,
      register: qty(register),
      consumption: index === 0 ? null : qty(step),
      readAt: iso(-(back * 30 + (meter.last ? (Date.now() - Date.parse(meter.last.readAt)) / 86_400_000 : 30))),
      source: index === 5 ? (meter.last?.source ?? "manual") : meter.iot ? "iot" : "ocr",
      evidenceDocumentId: index === 5 ? (meter.last?.photo ?? null) : meter.iot ? null : id("d0c00000", 200 + index),
      unit: meter.utility === "electric" ? "kwh" : "m3",
      utility: meter.utility,
      unitId: unit?.id ?? null,
    });
  });
  const staff = state.staff.readings.filter((candidate) => candidate.assetItemId === meter.assetItemId);
  const reviews = w()
    .reviews.filter((review) => review.reading.assetItemId === meter.assetItemId)
    .map((review) => review.reading);
  return [...base, ...staff.map(({ idempotencyKey: _key, ...rest }) => rest), ...reviews].sort((a, b) =>
    b.readAt.localeCompare(a.readAt),
  );
}

function series(
  meter: MockMeter,
  bucket: Schemas["SeriesBucket"],
  from: number,
  to: number,
): Schemas["MeterSeriesDto"] {
  const span = bucket === "15m" ? 900_000 : bucket === "1h" ? 3_600_000 : 86_400_000;
  const points: Schemas["SeriesPointDto"][] = [];
  let register = milli(meter.last?.register ?? "1000.000");
  const start = Math.floor(from / span) * span;
  for (let at = start; at < to && points.length < 3000; at += span) {
    const hour = new Date(at + 7 * 3_600_000).getUTCHours();
    const daily = meter.utility === "electric" ? 6_200 : 210;
    const shape = 0.4 + 0.9 * Math.max(0, Math.sin(((hour - 6) / 24) * Math.PI * 2)) + ((at / span) % 7) * 0.03;
    const usage = Math.round((daily * shape * span) / 86_400_000);
    register += usage;
    const gap = bucket !== "1d" && hour === 3 && new Date(at).getUTCDate() % 9 === 0;
    points.push({
      bucket: new Date(at).toISOString(),
      usage: gap ? null : qty(usage),
      lastRegister: gap ? null : qty(register),
      points: gap ? 0 : Math.max(1, Math.round(span / 900_000)),
      avgPowerW: meter.utility === "electric" && !gap ? String(Math.round((usage / (span / 3_600_000)) * 1000)) : null,
      avgFlowLpm: meter.utility === "water" && !gap ? ((usage * 1000) / (span / 60_000) / 1000).toFixed(2) : null,
    });
  }
  return { assetItemId: meter.assetItemId, bucket, unit: meter.utility === "electric" ? "kwh" : "m3", points };
}

function meterById(assetItemId: string): MockMeter | undefined {
  return state.staff.meters.find((meter) => meter.assetItemId === assetItemId);
}

export const meteringHandlers: HttpHandler[] = [
  http.get("*/v1/owner/buildings/:buildingId/meters", ({ request, params }) => {
    const op = "owner.meters.listForBuilding";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own || !w().buildings.some((building) => building.id === params.buildingId)) return notFound(op);
    const meters = state.staff.meters
      .filter((meter) => !meter.retired && buildingOf(meter) === params.buildingId)
      .map(meterDto);
    return json([...meters, ...(params.buildingId === BUILDING_A ? commonMeters : [])]);
  }),
  http.get("*/v1/owner/meters/:assetItemId/readings", ({ request, params }) => {
    const op = "owner.meterReadings.listForMeter";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const meter = ok.own ? meterById(String(params.assetItemId)) : undefined;
    if (!meter) return notFound(op);
    const from = query(request).get("from");
    const to = query(request).get("to");
    const list = history(meter).filter((item) => (!from || item.readAt >= from) && (!to || item.readAt <= to));
    return json(paged(list, request));
  }),
  http.get("*/v1/owner/meters/:assetItemId/series", ({ request, params }) => {
    const op = "owner.meterReadings.series";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const meter = ok.own ? meterById(String(params.assetItemId)) : undefined;
    if (!meter) return notFound(op);
    const bucket = (query(request).get("bucket") ?? "1h") as Schemas["SeriesBucket"];
    if (!["15m", "1h", "1d"].includes(bucket)) return validation(op, "bucket", "15m, 1h or 1d");
    const to = Date.parse(query(request).get("to") ?? iso());
    const from = Date.parse(query(request).get("from") ?? new Date(to - 86_400_000).toISOString());
    if (!meter.iot)
      return json({
        assetItemId: meter.assetItemId,
        bucket,
        unit: meter.utility === "electric" ? "kwh" : "m3",
        points: [],
      });
    return json(series(meter, bucket, from, to));
  }),
  http.get("*/v1/owner/units/:unitId/meter-history", ({ request, params }) => {
    const op = "owner.readingReviews.unitHistory";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const unit = ok.own ? w().units.find((candidate) => candidate.id === params.unitId) : undefined;
    if (!unit) return notFound(op);
    const meters = state.staff.meters.filter((meter) => unitOf(meter)?.id === unit.id);
    return json({
      unitId: unit.id,
      unitNo: unit.unitNo,
      assignments: meters.map((meter) => ({
        id: meter.assignmentId,
        assetItemId: meter.assetItemId,
        code: meter.code,
        meterName: meter.name,
        meterSerial: meter.serial,
        utility: meter.utility,
        initialReading: meter.initialReading,
        finalReading: meter.retired ? (meter.last?.register ?? null) : null,
        validFrom: iso(-400),
        validTo: meter.retired ? iso(-1) : null,
        readings: history(meter).slice(0, 3),
      })),
      swaps: [],
    } satisfies Schemas["UnitMeterHistoryDto"]);
  }),
  http.get("*/v1/owner/buildings/:buildingId/meter-readings/export", ({ request, params }) => {
    const op = "owner.readingReviews.export";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own) return notFound(op);
    const rows = state.staff.meters
      .filter((meter) => buildingOf(meter) === params.buildingId)
      .flatMap((meter) =>
        history(meter).map((item) => [meter.code, item.readAt, item.register, item.source, item.reviewState].join(",")),
      );
    return new Response(`﻿meter,readAt,register,source,reviewState\n${rows.join("\n")}\n`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="readings.csv"',
      },
    });
  }),

  // Review queue (D-035, D-142)
  http.get("*/v1/owner/meter-readings/reviews", ({ request }) => {
    const ok = owner(request, "owner.readingReviews.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const list = (ok.own ? w().reviews : []).filter(
      (review) =>
        (!params.get("status") || review.status === params.get("status")) &&
        (!params.get("buildingId") || review.buildingId === params.get("buildingId")),
    );
    return json(paged(list, request));
  }),
  http.get("*/v1/owner/meter-readings/reviews/:reviewId", ({ request, params }) => {
    const op = "owner.readingReviews.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const review = ok.own ? w().reviews.find((candidate) => candidate.id === params.reviewId) : undefined;
    return review ? json(review) : notFound(op);
  }),
  http.post("*/v1/owner/meter-readings/reviews/:reviewId/actions/decide", async ({ request, params }) => {
    const op = "owner.readingReviews.decide";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const review = ok.own ? w().reviews.find((candidate) => candidate.id === params.reviewId) : undefined;
    if (!review) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["ReviewDecisionDto"];
      if (review.status !== "open") return problem(op, "reading.review_closed");
      if (input.action !== "accept" && !input.note?.trim())
        return validation(op, "note", "a note is required to correct or reject");
      if (input.action === "correct") {
        if (!input.register || !DECIMAL_3.test(input.register))
          return validation(op, "register", "a register like 8891.500");
        const meter = meterById(review.reading.assetItemId);
        const previous = milli(meter?.last?.register ?? "0");
        if (milli(input.register) < previous) return problem(op, "reading.non_monotonic");
        review.correctedRegister = Number(input.register).toFixed(3);
        review.correctedReadingId = crypto.randomUUID();
        review.status = "corrected";
        review.reading = {
          ...review.reading,
          reviewState: "corrected",
          supersededByReadingId: review.correctedReadingId,
        };
      } else {
        review.status = input.action === "accept" ? "accepted" : "rejected";
        review.reading = { ...review.reading, reviewState: input.action === "accept" ? "accepted" : "rejected" };
      }
      review.decidedAt = iso();
      review.decisionNote = input.note ?? null;
      review.nextActions = [];
      return { status: 200, body: review };
    });
  }),

  // Devices (read-mostly for operators, D-183)
  http.get("*/v1/owner/devices", ({ request }) => {
    const ok = owner(request, "owner.devices.list");
    if (ok instanceof Response) return ok;
    const params = query(request);
    const q = params.get("q")?.toLowerCase();
    const list = (ok.own ? state.staff.devices : []).filter(
      (device) =>
        (!params.get("buildingId") || device.buildingId === params.get("buildingId")) &&
        (!params.get("kind") || device.kind === params.get("kind")) &&
        (!params.get("status") || device.status === params.get("status")) &&
        (!q || device.serial.toLowerCase().includes(q)),
    );
    return json(paged(list, request));
  }),
  http.get("*/v1/owner/devices/:deviceId", ({ request, params }) => {
    const op = "owner.devices.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const device = ok.own ? state.staff.devices.find((candidate) => candidate.id === params.deviceId) : undefined;
    if (!device) return notFound(op);
    const channels = state.staff.channels
      .filter((channel) => channel.gatewayDeviceId === device.id || channel.meterDeviceId === device.id)
      .sort((a, b) => Number(a.validTo !== null) - Number(b.validTo !== null))
      .map(channelDto);
    const configs: Schemas["GatewayConfigVersionDto"][] =
      device.kind === "gateway" && device.configAppliedVersion
        ? [
            {
              id: id("cf900000", 4),
              version: 4,
              meters: device.meters,
              compiledAt: iso(-3),
              publishedAt: iso(-3),
              appliedAt: iso(-3),
              rejectedAt: null,
              rejectError: null,
              driftFlaggedAt: null,
            },
            {
              id: id("cf900000", 3),
              version: 3,
              meters: 0,
              compiledAt: iso(-20),
              publishedAt: iso(-20),
              appliedAt: iso(-20),
              rejectedAt: null,
              rejectError: null,
              driftFlaggedAt: null,
            },
          ]
        : [];
    const events: Schemas["DeviceEventDto"][] =
      device.status === "online"
        ? [
            {
              id: id("e7e00000", 1),
              deviceId: device.id,
              type: "device.online",
              severity: "info",
              message: null,
              occurredAt: iso(-2),
            },
            {
              id: id("e7e00000", 2),
              deviceId: device.id,
              type: "config.applied",
              severity: "info",
              message: "version 4",
              occurredAt: iso(-3),
            },
          ]
        : [];
    return json({ device, channels, configs, events } satisfies Schemas["DeviceDetailDto"]);
  }),
  http.get("*/v1/owner/devices/:deviceId/commands", ({ request, params }) => {
    const op = "owner.devices.listCommands";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own || !state.staff.devices.some((device) => device.id === params.deviceId)) return notFound(op);
    const list = state.staff.commands.filter((command) => command.gatewayDeviceId === params.deviceId);
    for (const command of list)
      if (command.status === "queued") Object.assign(command, { status: "done", finishedAt: iso(), attempts: 1 });
    return json([...list].reverse());
  }),
  http.post("*/v1/owner/devices/:deviceId/commands", async ({ request, params }) => {
    const op = "owner.devices.sendCommand";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const device = ok.own ? state.staff.devices.find((candidate) => candidate.id === params.deviceId) : undefined;
    if (!device) return notFound(op);
    if (device.kind !== "gateway") return problem(op, "device.not_gateway");
    if (device.status !== "online" && device.status !== "degraded") return problem(op, "device.invalid_state");
    const input = await body<Partial<Schemas["OperatorCommandCreateDto"]>>(request);
    if (!input.type || !["read_now", "restart", "identify", "upload_logs"].includes(input.type))
      return validation(op, "type", "read_now, restart, identify or upload_logs");
    const command: Schemas["DeviceCommandDto"] = {
      id: crypto.randomUUID(),
      gatewayDeviceId: device.id,
      type: input.type,
      args: input.args ?? {},
      status: "queued",
      issuedAt: iso(),
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      attempts: 0,
      finishedAt: null,
      result: null,
      error: null,
    };
    state.staff.commands.push(command);
    return json(command, 202);
  }),

  // Utility invoices and loss (D-032, D-188)
  http.get("*/v1/owner/buildings/:buildingId/utility-invoices", ({ request, params }) => {
    const op = "owner.utilityInvoices.list";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own || !w().buildings.some((building) => building.id === params.buildingId)) return notFound(op);
    const utility = query(request).get("utility");
    return json(
      w()
        .utilityInvoices.filter(
          (invoice) => invoice.buildingId === params.buildingId && (!utility || invoice.utility === utility),
        )
        .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)),
    );
  }),
  http.post("*/v1/owner/buildings/:buildingId/utility-invoices", async ({ request, params }) => {
    const op = "owner.utilityInvoices.create";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own || !w().buildings.some((building) => building.id === params.buildingId)) return notFound(op);
    return idempotent(request, op, (payload) => {
      const input = payload as unknown as Schemas["UtilityInvoiceCreateDto"];
      for (const field of ["amount", "units"] as const) {
        if (!input[field] || !/^\d{1,9}(\.\d{1,3})?$/.test(input[field]))
          return validation(op, field, "a decimal number");
      }
      if (!input.periodStart || !input.periodEnd || input.periodEnd < input.periodStart)
        return validation(op, "periodEnd", "the period end is after its start");
      if (
        w().utilityInvoices.some(
          (invoice) =>
            invoice.buildingId === params.buildingId &&
            invoice.utility === input.utility &&
            invoice.periodStart === input.periodStart &&
            (invoice.utilityAccountId ?? null) === (input.utilityAccountId ?? null),
        )
      )
        return problem(op, "utility_invoice.duplicate");
      const invoice: Schemas["UtilityInvoiceDto"] = {
        id: crypto.randomUUID(),
        buildingId: String(params.buildingId),
        utility: input.utility,
        provider: input.provider,
        utilityAccountId: input.utilityAccountId ?? null,
        invoiceNo: input.invoiceNo ?? null,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        units: Number(input.units).toFixed(3),
        amount: Number(input.amount).toFixed(2),
        ft: input.ft ?? null,
        serviceCharge: input.serviceCharge ?? null,
        vat: input.vat ?? null,
        previousRegister: input.previousRegister ?? null,
        currentRegister: input.currentRegister ?? null,
        invoiceDocumentId: input.invoiceDocumentId ?? null,
        source: input.invoiceDocumentId ? "ocr" : "manual",
        version: 1,
      };
      w().utilityInvoices.push(invoice);
      return { status: 201, body: invoice };
    });
  }),
  http.post("*/v1/owner/buildings/:buildingId/utility-invoices/actions/prefill", async ({ request, params }) => {
    const op = "owner.utilityInvoices.prefill";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own || !w().buildings.some((building) => building.id === params.buildingId)) return notFound(op);
    const input = await body<Schemas["UtilityInvoicePrefillRequestDto"]>(request);
    const stored = state.staff.files.get(input.documentId);
    if (!stored?.bytes) return problem(op, "document.not_uploaded");
    const bounds = PERIODS.bounds(PERIODS.current());
    return json({
      model: "fake-vision-1",
      confidence: 0.91,
      fields: {
        invoiceNo: input.utility === "electric" ? "MEA-6910-0004321" : "MWA-6910-778",
        periodStart: bounds.start,
        periodEnd: bounds.end,
        units: input.utility === "electric" ? "2910.000" : "196.000",
        amount: input.utility === "electric" ? "12880.40" : "2410.75",
        ft: input.utility === "electric" ? "0.3972" : null,
        serviceCharge: input.utility === "electric" ? "38.22" : "30.00",
        vat: input.utility === "electric" ? "842.62" : "157.71",
        previousRegister: input.utility === "electric" ? "90970.000" : null,
        currentRegister: input.utility === "electric" ? "93880.000" : null,
      },
    } satisfies Schemas["UtilityInvoicePrefillDto"]);
  }),
  http.get("*/v1/owner/buildings/:buildingId/utility-invoices/:invoiceId", ({ request, params }) => {
    const op = "owner.utilityInvoices.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const invoice = ok.own ? w().utilityInvoices.find((candidate) => candidate.id === params.invoiceId) : undefined;
    return invoice ? etagged(invoice) : notFound(op);
  }),
  http.patch("*/v1/owner/buildings/:buildingId/utility-invoices/:invoiceId", async ({ request, params }) => {
    const op = "owner.utilityInvoices.update";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const invoice = ok.own ? w().utilityInvoices.find((candidate) => candidate.id === params.invoiceId) : undefined;
    if (!invoice) return notFound(op);
    if (!request.headers.get("if-match")) return problem(op, "concurrency.precondition_required");
    if (stale(request, invoice)) return problem(op, "concurrency.stale");
    Object.assign(invoice, await body<Schemas["UtilityInvoiceUpdateDto"]>(request));
    invoice.version += 1;
    return etagged(invoice);
  }),
  http.get("*/v1/owner/buildings/:buildingId/loss", ({ request, params }) => {
    const op = "owner.loss.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own || !w().buildings.some((building) => building.id === params.buildingId)) return notFound(op);
    const utility = (query(request).get("utility") ?? "electric") as Schemas["Utility"];
    const cycle = query(request).get("cycle") ?? PERIODS.previous();
    const hasInvoice = w().utilityInvoices.some(
      (invoice) =>
        invoice.buildingId === params.buildingId &&
        invoice.utility === utility &&
        invoice.periodStart.startsWith(cycle),
    );
    if (params.buildingId !== BUILDING_A || (!hasInvoice && cycle !== PERIODS.previous()))
      return problem(op, "loss.no_invoice");
    if (!hasInvoice && utility === "water") return problem(op, "loss.no_invoice");
    const view = lossView(utility, cycle);
    return json({ ...view, report: { ...view.report, periodKey: cycle } });
  }),
  http.post("*/v1/owner/buildings/:buildingId/loss/actions/recompute", async ({ request, params }) => {
    const op = "owner.loss.recompute";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    if (!ok.own) return notFound(op);
    const input = await body<Schemas["LossRecomputeDto"]>(request);
    if (params.buildingId !== BUILDING_A) return problem(op, "loss.no_invoice");
    const view = lossView(input.utility, input.cycle);
    return json({ ...view, report: { ...view.report, computedAt: iso() } });
  }),
  http.get("*/v1/owner/loss/summary", ({ request }) => {
    const ok = owner(request, "owner.loss.summary");
    if (ok instanceof Response) return ok;
    if (!ok.own) return json([]);
    const view = lossView("electric", PERIODS.previous());
    return json([
      {
        buildingId: BUILDING_A,
        buildingName: "อาคาร A",
        utility: "electric",
        lossUnits: view.report.lossUnits,
        lossThb: view.report.lossThb,
        lossPct: view.report.lossPct,
        periodEnd: view.report.periodEnd,
        suspects: view.report.suspects.length,
      },
    ] satisfies Schemas["LossSummaryRowDto"][]);
  }),
];

export { REVIEW_PHOTO };

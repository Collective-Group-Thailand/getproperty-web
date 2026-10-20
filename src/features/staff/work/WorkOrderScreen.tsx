"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";

import { WORK_ORDER_STATUS } from "@/domain/status/workOrder";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { uploadFile } from "@/lib/pwa/queue";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconCamera } from "@/ui/icons/glyphs/camera";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconDelete } from "@/ui/icons/glyphs/delete";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconParcel } from "@/ui/icons/glyphs/parcel";
import { IconPlay } from "@/ui/icons/glyphs/play";
import { lazyWarm } from "@/ui/lib/lazy";

import { PhotoThumb } from "../shared/PhotoThumb";
import { problemText } from "../shared/problem";

const PhotoCapture = lazyWarm(() => import("./PhotoCapture").then((module) => module.PhotoCapture));

const COST_KINDS: Schemas["WorkOrderCostKind"][] = ["part", "labour", "travel", "other"];
const MONEY = /^\d{1,9}(\.\d{1,2})?$/;
const QTY = /^\d{1,6}(\.\d{1,3})?$/;
const PHOTO_STEPS = new Set<Schemas["WorkOrderStatus"]>(["assigned", "accepted", "in_progress", "done"]);
const COST_STEPS = new Set<Schemas["WorkOrderStatus"]>(["assigned", "accepted", "in_progress", "done"]);

type Role = Schemas["WorkOrderPhotoRole"];

/**
 * A work order on the phone (F4 4.4, D-072, D-210), one-handed and big: what was reported, the access codes
 * for the visit, then the steps the API offers (`nextActions`): check in (checking in accepts — the staff
 * surface has no separate accept), before photos, waiting for parts → resume, after photos, parts and
 * costs, complete with a note (the API refuses without an after photo). Verification is the owner's.
 */
export function WorkOrderScreen({
  workOrder,
  request,
  access,
}: {
  workOrder: Schemas["WorkOrderDto"];
  request: Pick<Schemas["ServiceRequestDto"], "ref" | "description" | "photoIds"> | null;
  access: Schemas["RevealedCredentialDto"][] | null;
}) {
  const t = useTranslations("staff.work");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [camera, setCamera] = useState<Role | null>(null);
  const [partsNote, setPartsNote] = useState("");
  const [note, setNote] = useState("");
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [cost, setCost] = useState({
    description: "",
    kind: "part" as Schemas["WorkOrderCostKind"],
    quantity: "1",
    unitPrice: "",
  });
  const can = (name: string) => workOrder.nextActions.includes(name);
  const path = { workOrderId: workOrder.id };

  const step = async (name: string, call: () => Promise<unknown>, done?: () => void) => {
    setBusy(name);
    setError(null);
    try {
      await call();
      done?.();
      router.refresh();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(null);
    }
  };

  const addPhotos = (role: Role, files: File[]) => {
    setCamera(null);
    void step(`photos-${role}`, async () => {
      for (const file of files) {
        const documentId = await uploadFile({
          blob: file,
          fileName: file.name,
          kind: "service_photo",
          scopeType: workOrder.unitId ? "unit" : "building",
          scopeId: workOrder.unitId ?? workOrder.buildingId,
          bodyField: "documentId",
        });
        await unwrap(
          browserApi().POST("/v1/staff/work-orders/{workOrderId}/photos", {
            params: { path },
            body: { documentId, role },
          }),
        );
      }
    });
  };

  const photoSection = (role: Role) => {
    const ids = role === "before" ? workOrder.beforePhotoIds : workOrder.afterPhotoIds;
    return (
      <section aria-labelledby={`photos-${role}`} className="flex flex-col gap-3" data-testid={`photos-${role}`}>
        <h2 id={`photos-${role}`} className="text-lg font-semibold">
          {t(`photos.${role}`)} <span className="text-muted tabular-nums">{t("count", { count: ids.length })}</span>
        </h2>
        {ids.length ? (
          <ul className="flex flex-wrap gap-2">
            {ids.map((id, index) => (
              <li key={id}>
                <PhotoThumb fileId={id} alt={t(`photos.${role}Alt`, { index: index + 1 })} />
              </li>
            ))}
          </ul>
        ) : null}
        {PHOTO_STEPS.has(workOrder.status) ? (
          camera === role ? (
            <Suspense fallback={null}>
              <PhotoCapture
                label={t(`photos.${role}Take`)}
                fileBaseName={`work-order-${role}`}
                onPhotos={(files) => addPhotos(role, files)}
                onClose={() => setCamera(null)}
              />
            </Suspense>
          ) : (
            <Button
              variant={
                role === "after" && workOrder.status === "in_progress" && ids.length === 0 ? "primary" : "secondary"
              }
              size="xl"
              block
              iconStart={IconCamera}
              loading={busy === `photos-${role}`}
              onClick={() => setCamera(role)}
              data-testid={`take-${role}`}
            >
              {t(`photos.${role}Take`)}
            </Button>
          )
        ) : null}
      </section>
    );
  };

  return (
    <div className="flex flex-col gap-6 py-6" data-testid="staff-work-order" data-status={workOrder.status}>
      <header className="flex flex-col gap-2">
        <Button asChild variant="ghost" size="lg" className="self-start">
          <Link href="/work-orders">{t("back")}</Link>
        </Button>
        <h1 className="text-2xl font-semibold" data-testid="work-order-title">
          {workOrder.title}
        </h1>
        <p className="text-muted text-lg">
          {workOrder.unitNo ? t("unit", { unit: workOrder.unitNo }) : t("commonArea")}
          {workOrder.scheduledAt ? ` · ${t("visit", { at: formatDateTime(workOrder.scheduledAt, locale) })}` : ""}
        </p>
        <StatusBadgeOf map={WORK_ORDER_STATUS} value={workOrder.status} />
      </header>

      {request || workOrder.description ? (
        <section aria-labelledby="reported" className="flex flex-col gap-2">
          <h2 id="reported" className="text-lg font-semibold">
            {request ? t("reported", { ref: request.ref }) : t("details")}
          </h2>
          <p className="whitespace-pre-line">{request?.description ?? workOrder.description}</p>
          {request?.photoIds.length ? (
            <ul className="flex flex-wrap gap-2">
              {request.photoIds.map((id, index) => (
                <li key={id}>
                  <PhotoThumb fileId={id} alt={t("reportedAlt", { index: index + 1 })} />
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {access && access.length ? (
        <section aria-labelledby="access" className="flex flex-col gap-2" data-testid="access-codes">
          <h2 id="access" className="text-lg font-semibold">
            {t("access.title")}
          </h2>
          <ul className="flex flex-col gap-2">
            {access.map((code) => (
              <li
                key={code.id}
                className="border-border rounded-card flex flex-col gap-2 border p-3"
                data-testid="access-code"
              >
                <span className="font-medium">{code.lockName}</span>
                <span className="text-muted text-sm">
                  {t("access.window", {
                    from: formatDateTime(code.validFrom, locale),
                    until: code.validTo ? formatDateTime(code.validTo, locale) : "—",
                  })}
                </span>
                {code.status !== "active" ? (
                  <span className="text-muted text-sm">{t("access.notActive")}</span>
                ) : shown.has(code.id) ? (
                  <span className="font-mono text-3xl tracking-widest" data-testid="access-pin">
                    {code.pin ?? t("access.app")}
                  </span>
                ) : (
                  <Button
                    variant="secondary"
                    size="xl"
                    block
                    iconStart={IconKey}
                    onClick={() => setShown((current) => new Set(current).add(code.id))}
                    data-testid="access-show"
                  >
                    {t("access.show")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="steps" className="flex flex-col gap-3" data-testid="work-steps">
        <h2 id="steps" className="sr-only">
          {t("steps")}
        </h2>
        {can("check-in") ? (
          <Button
            size="xl"
            block
            iconStart={IconPlay}
            loading={busy === "check-in"}
            onClick={() =>
              void step("check-in", () =>
                unwrap(browserApi().POST("/v1/staff/work-orders/{workOrderId}/actions/check-in", { params: { path } })),
              )
            }
            data-testid="check-in"
          >
            {t("checkIn")}
          </Button>
        ) : null}
        {can("resume") ? (
          <Button
            size="xl"
            block
            iconStart={IconPlay}
            loading={busy === "resume"}
            onClick={() =>
              void step("resume", () =>
                unwrap(browserApi().POST("/v1/staff/work-orders/{workOrderId}/actions/resume", { params: { path } })),
              )
            }
            data-testid="resume"
          >
            {t("resume")}
          </Button>
        ) : null}
      </section>

      {photoSection("before")}

      {can("wait-parts") ? (
        <section aria-labelledby="parts" className="flex flex-col gap-3">
          <h2 id="parts" className="text-lg font-semibold">
            {t("waitParts")}
          </h2>
          <Field label={t("partsNote")}>
            <Textarea
              className="text-lg"
              rows={2}
              value={partsNote}
              onChange={(event) => setPartsNote(event.target.value)}
              data-testid="parts-note"
            />
          </Field>
          <Button
            variant="secondary"
            size="xl"
            block
            iconStart={IconParcel}
            loading={busy === "wait-parts"}
            onClick={() =>
              void step(
                "wait-parts",
                () =>
                  unwrap(
                    browserApi().POST("/v1/staff/work-orders/{workOrderId}/actions/wait-parts", {
                      params: { path },
                      body: { note: partsNote.trim() || null },
                    }),
                  ),
                () => setPartsNote(""),
              )
            }
            data-testid="wait-parts"
          >
            {t("waitParts")}
          </Button>
        </section>
      ) : null}

      {photoSection("after")}

      {COST_STEPS.has(workOrder.status) || workOrder.costLines.length ? (
        <section aria-labelledby="costs" className="flex flex-col gap-3" data-testid="costs">
          <h2 id="costs" className="text-lg font-semibold">
            {t("costs.title")}
          </h2>
          {workOrder.costLines.length ? (
            <ul className="flex flex-col gap-2">
              {workOrder.costLines.map((line) => (
                <li
                  key={line.id}
                  className="border-border flex items-center justify-between gap-2 border-b py-2"
                  data-testid="cost-line"
                >
                  <span className="flex flex-col">
                    <span>{line.description}</span>
                    <span className="text-muted text-sm">
                      {t(`costs.kinds.${line.kind}`)} · {line.quantity} × {formatTHB(line.unitPrice, locale)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{formatTHB(line.amount, locale)}</span>
                    {COST_STEPS.has(workOrder.status) ? (
                      <Button
                        variant="ghost"
                        size="lg"
                        iconStart={IconDelete}
                        aria-label={t("costs.remove", { description: line.description })}
                        loading={busy === `remove-${line.id}`}
                        onClick={() =>
                          void step(`remove-${line.id}`, () =>
                            unwrap(
                              browserApi().DELETE("/v1/staff/work-orders/{workOrderId}/cost-lines/{costLineId}", {
                                params: { path: { workOrderId: workOrder.id, costLineId: line.id } },
                              }),
                            ),
                          )
                        }
                      />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-end font-semibold" data-testid="cost-total">
            {t("costs.total", { total: formatTHB(workOrder.costTotal, locale) })}
          </p>
          {COST_STEPS.has(workOrder.status) ? (
            <div className="flex flex-col gap-3">
              <Field label={t("costs.description")}>
                <Input
                  inputSize="lg"
                  value={cost.description}
                  onChange={(event) => setCost({ ...cost, description: event.target.value })}
                  data-testid="cost-description"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("costs.kind")}>
                  <NativeSelect
                    inputSize="lg"
                    value={cost.kind}
                    onChange={(event) => setCost({ ...cost, kind: event.target.value as Schemas["WorkOrderCostKind"] })}
                    options={COST_KINDS.map((value) => ({ value, label: t(`costs.kinds.${value}`) }))}
                  />
                </Field>
                <Field label={t("costs.quantity")}>
                  <Input
                    inputSize="lg"
                    inputMode="decimal"
                    value={cost.quantity}
                    onChange={(event) => setCost({ ...cost, quantity: event.target.value })}
                    data-testid="cost-quantity"
                  />
                </Field>
              </div>
              <Field label={t("costs.unitPrice")} hint={t("costs.unitPriceHint")}>
                <Input
                  inputSize="lg"
                  inputMode="decimal"
                  value={cost.unitPrice}
                  onChange={(event) => setCost({ ...cost, unitPrice: event.target.value })}
                  data-testid="cost-unit-price"
                />
              </Field>
              <Button
                variant="secondary"
                size="xl"
                block
                loading={busy === "cost"}
                disabled={!cost.description.trim() || !MONEY.test(cost.unitPrice) || !QTY.test(cost.quantity)}
                onClick={() =>
                  void step(
                    "cost",
                    () =>
                      unwrap(
                        browserApi().POST("/v1/staff/work-orders/{workOrderId}/cost-lines", {
                          params: { path },
                          body: {
                            description: cost.description.trim(),
                            kind: cost.kind,
                            quantity: cost.quantity,
                            unitPrice: cost.unitPrice,
                          },
                        }),
                      ),
                    () => setCost({ description: "", kind: "part", quantity: "1", unitPrice: "" }),
                  )
                }
                data-testid="cost-add"
              >
                {t("costs.add")}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {can("complete") ? (
        <section aria-labelledby="complete" className="flex flex-col gap-3">
          <h2 id="complete" className="text-lg font-semibold">
            {t("complete")}
          </h2>
          {workOrder.afterPhotoIds.length === 0 ? <p className="text-muted">{t("completeNeedsPhoto")}</p> : null}
          <Field label={t("completionNote")}>
            <Textarea
              className="text-lg"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              data-testid="completion-note"
            />
          </Field>
          <Button
            size="xl"
            block
            iconStart={IconCheckCircle}
            loading={busy === "complete"}
            onClick={() =>
              void step("complete", () =>
                unwrap(
                  browserApi().POST("/v1/staff/work-orders/{workOrderId}/actions/complete", {
                    params: { path },
                    body: { note: note.trim() || null },
                  }),
                ),
              )
            }
            data-testid="complete"
          >
            {t("complete")}
          </Button>
        </section>
      ) : null}

      {workOrder.status === "done" ? (
        <Callout tone="success" title={t("doneTitle")}>
          {t("doneBody")}
        </Callout>
      ) : null}

      {error ? (
        <Callout tone="danger">
          <span role="alert" data-testid="work-problem">
            {problemText(error, t("offline"))}
          </span>
        </Callout>
      ) : null}
    </div>
  );
}

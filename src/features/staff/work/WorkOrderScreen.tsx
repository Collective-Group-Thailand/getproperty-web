"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";

import { PRIORITY_STATUS } from "@/domain/status/priority";
import { WORK_ORDER_STATUS } from "@/domain/status/workOrder";
import { ServiceThread } from "@/features/shared/console/ServiceThread";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { uploadFile } from "@/lib/pwa/queue";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconCamera } from "@/ui/icons/glyphs/camera";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconDelete } from "@/ui/icons/glyphs/delete";
import { IconParcel } from "@/ui/icons/glyphs/parcel";
import { IconPlay } from "@/ui/icons/glyphs/play";
import { lazyWarm } from "@/ui/lib/lazy";

import { StaffActionBar } from "../shell/StaffList";
import { CaptureTile } from "../shared/CaptureTile";
import { PhotoThumb } from "../shared/PhotoThumb";
import { DoorCodes } from "./DoorCodes";
import { problemText } from "../shared/problem";

const PhotoCapture = lazyWarm(() => import("./PhotoCapture").then((module) => module.PhotoCapture));

const COST_KINDS: Schemas["WorkOrderCostKind"][] = ["part", "labour", "travel", "other"];
const MONEY = /^\d{1,9}(\.\d{1,2})?$/;
const QTY = /^\d{1,6}(\.\d{1,3})?$/;
const PHOTO_STEPS = new Set<Schemas["WorkOrderStatus"]>(["assigned", "accepted", "in_progress", "done"]);
const COST_STEPS = new Set<Schemas["WorkOrderStatus"]>(["assigned", "accepted", "in_progress", "done"]);
/** While a visit can still happen, the assignee may ask for the door codes (fetched on tap, review H2). */
const DOOR_CODE_STEPS = new Set<Schemas["WorkOrderStatus"]>(["assigned", "accepted", "in_progress"]);

type Role = Schemas["WorkOrderPhotoRole"];

/**
 * A work order on the phone (F4 4.4, D-072, D-210), one-handed and big: what was reported, the access codes
 * for the visit (fetched on tap, never in the rendered page — review H2), then the steps the API offers (`nextActions`): check in (checking in accepts — the staff
 * surface has no separate accept), before photos, waiting for parts → resume, after photos, parts and
 * costs, complete with a note (the API refuses without an after photo). Verification is the owner's.
 */
export function WorkOrderScreen({
  workOrder,
  request,
  messages,
  canWrite,
}: {
  workOrder: Schemas["WorkOrderDto"];
  request: Pick<
    Schemas["ServiceRequestDto"],
    "ref" | "description" | "photoIds" | "status" | "preferredVisit" | "visitConfirmedAt"
  > | null;
  /** The thread (the request's, or the work order's own); `null` when it could not be read. */
  messages: Schemas["ServiceMessageDto"][] | null;
  canWrite: boolean;
}) {
  const t = useTranslations("staff.work");
  const visit = useTranslations("console.visit");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [camera, setCamera] = useState<Role | null>(null);
  const [partsNote, setPartsNote] = useState("");
  const [note, setNote] = useState("");
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

  /** Photos are added while the job is on (assigned → in progress); after that they are evidence only. */
  const canShoot = PHOTO_STEPS.has(workOrder.status) && workOrder.status !== "done";
  const photoRow = (role: Role) => {
    const ids = role === "before" ? workOrder.beforePhotoIds : workOrder.afterPhotoIds;
    return (
      <section aria-labelledby={`photos-${role}`} className="flex flex-col gap-2" data-testid={`photos-${role}`}>
        <h3 id={`photos-${role}`} className="text-muted text-sm font-semibold">
          {t(`photos.${role}`)} <span className="font-normal tabular-nums">{ids.length}</span>
        </h3>
        {camera === role ? (
          <Suspense fallback={null}>
            <PhotoCapture
              label={t(`photos.${role}Take`)}
              fileBaseName={`work-order-${role}`}
              onPhotos={(files) => addPhotos(role, files)}
              onClose={() => setCamera(null)}
            />
          </Suspense>
        ) : (
          <div className="flex flex-wrap gap-2">
            {ids.length ? (
              <ul className="contents">
                {ids.map((id, index) => (
                  <li key={id}>
                    <PhotoThumb fileId={id} alt={t(`photos.${role}Alt`, { index: index + 1 })} />
                  </li>
                ))}
              </ul>
            ) : null}
            {canShoot ? (
              <CaptureTile
                shape="square"
                icon={IconCamera}
                label={t(`photos.${role}Add`)}
                loading={busy === `photos-${role}`}
                onClick={() => setCamera(role)}
                testId={`take-${role}`}
              />
            ) : ids.length === 0 ? (
              <p className="text-muted text-sm">{t("photos.none")}</p>
            ) : null}
          </div>
        )}
      </section>
    );
  };

  /** The one filled action of the screen, in the bottom bar: whatever the work order is waiting for next. */
  const lead = can("check-in")
    ? {
        name: "check-in",
        label: t("checkIn"),
        icon: IconPlay,
        run: () =>
          unwrap(browserApi().POST("/v1/staff/work-orders/{workOrderId}/actions/check-in", { params: { path } })),
      }
    : can("resume")
      ? {
          name: "resume",
          label: t("resume"),
          icon: IconPlay,
          run: () =>
            unwrap(browserApi().POST("/v1/staff/work-orders/{workOrderId}/actions/resume", { params: { path } })),
        }
      : can("complete")
        ? {
            name: "complete",
            label: t("complete"),
            icon: IconCheckCircle,
            run: () =>
              unwrap(
                browserApi().POST("/v1/staff/work-orders/{workOrderId}/actions/complete", {
                  params: { path },
                  body: { note: note.trim() || null },
                }),
              ),
          }
        : null;

  const problem = error ? (
    <Callout tone="danger">
      <span role="alert" data-testid="work-problem">
        {problemText(error, t("offline"))}
      </span>
    </Callout>
  ) : null;

  return (
    <div className="flex flex-col gap-5 py-6" data-testid="staff-work-order" data-status={workOrder.status}>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-balance" data-testid="work-order-title">
          {workOrder.title}
        </h1>
        <p className="text-muted">{workOrder.unitNo ? t("unit", { unit: workOrder.unitNo }) : t("commonArea")}</p>
        <span className="flex flex-wrap gap-2">
          <StatusBadgeOf map={WORK_ORDER_STATUS} value={workOrder.status} />
          {workOrder.priority === "high" || workOrder.priority === "urgent" ? (
            <StatusBadgeOf map={PRIORITY_STATUS} value={workOrder.priority} />
          ) : null}
        </span>
      </header>

      {workOrder.status === "done" ? (
        <Callout tone="success" title={t("doneTitle")}>
          {t("doneBody")}
        </Callout>
      ) : null}

      <Card as="section" aria-label={t("facts")}>
        <DescriptionList
          className="grid-cols-2"
          items={[
            { id: "kind", term: t("kindLabel"), description: t(`kind.${workOrder.kind}`) },
            {
              id: "visit",
              term: t("visitLabel"),
              description: workOrder.scheduledAt ? formatDateTime(workOrder.scheduledAt, locale) : t("noVisit"),
            },
            { id: "assignee", term: t("assigneeLabel"), description: workOrder.assignee?.displayName ?? "—" },
            {
              id: "priority",
              term: t("priorityLabel"),
              description: <StatusBadgeOf map={PRIORITY_STATUS} value={workOrder.priority} size="sm" />,
            },
          ]}
        />
      </Card>

      {request || workOrder.description ? (
        <Card as="section" aria-labelledby="reported" className="flex flex-col gap-3">
          <h2 id="reported" className="text-lg font-semibold">
            {request ? t("reported", { ref: request.ref }) : t("details")}
          </h2>
          <p className="whitespace-pre-line">{request?.description ?? workOrder.description}</p>
          {request ? (
            <p className="text-muted text-sm" data-testid="work-order-visit-preference">
              {visit("preferred")}:{" "}
              {request.preferredVisit ? visit(`preference.${request.preferredVisit}`) : visit("noPreference")}
              {request.visitConfirmedAt
                ? ` · ${visit("confirmedAt", { at: formatDateTime(request.visitConfirmedAt, locale) })}`
                : workOrder.scheduledAt && !workOrder.completedAt
                  ? ` · ${visit("notConfirmed")}`
                  : ""}
            </p>
          ) : null}
          {request?.photoIds.length ? (
            <ul className="flex flex-wrap gap-2">
              {request.photoIds.map((id, index) => (
                <li key={id}>
                  <PhotoThumb fileId={id} alt={t("reportedAlt", { index: index + 1 })} />
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {DOOR_CODE_STEPS.has(workOrder.status) ? <DoorCodes workOrderId={workOrder.id} /> : null}

      <Card as="section" aria-labelledby="photos" className="flex flex-col gap-4" data-testid="work-steps">
        <h2 id="photos" className="text-lg font-semibold">
          {t("photos.title")}
        </h2>
        {canShoot || workOrder.beforePhotoIds.length || workOrder.afterPhotoIds.length ? (
          <>
            {photoRow("before")}
            {photoRow("after")}
          </>
        ) : (
          <p className="text-muted">{t("photos.noneYet")}</p>
        )}
      </Card>

      {can("wait-parts") ? (
        <Card as="section" aria-labelledby="parts" className="flex flex-col gap-3">
          <h2 id="parts" className="text-lg font-semibold">
            {t("waitParts")}
          </h2>
          <Field label={t("partsNote")} hint={t("partsHint")}>
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
        </Card>
      ) : null}

      {COST_STEPS.has(workOrder.status) || workOrder.costLines.length ? (
        <Card as="section" aria-labelledby="costs" className="flex flex-col gap-3" data-testid="costs">
          <h2 id="costs" className="text-lg font-semibold">
            {t("costs.title")}
          </h2>
          {workOrder.costLines.length ? (
            <ul className="divide-border border-border divide-y border-y">
              {workOrder.costLines.map((line) => (
                <li
                  key={line.id}
                  className="flex min-h-14 items-center justify-between gap-2 py-2"
                  data-testid="cost-line"
                >
                  <span className="flex min-w-0 flex-col">
                    <span>{line.description}</span>
                    <span className="text-muted text-sm tabular-nums">
                      {t(`costs.kinds.${line.kind}`)} · {line.quantity} × {formatTHB(line.unitPrice, locale)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
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
          <p className="flex items-baseline justify-between gap-3 font-semibold" data-testid="cost-total">
            <span>{t("costs.totalLabel")}</span>
            <span className="tabular-nums">{formatTHB(workOrder.costTotal, locale)}</span>
          </p>
          {COST_STEPS.has(workOrder.status) && workOrder.status !== "done" ? (
            <div className="border-border flex flex-col gap-3 border-t pt-4">
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
                    className="tabular-nums"
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
                  className="tabular-nums"
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
        </Card>
      ) : null}

      {can("complete") ? (
        <Card as="section" aria-labelledby="complete" className="flex flex-col gap-3">
          <h2 id="complete" className="text-lg font-semibold">
            {t("completeTitle")}
          </h2>
          {workOrder.afterPhotoIds.length === 0 ? (
            <p className="text-muted text-sm">{t("completeNeedsPhoto")}</p>
          ) : null}
          <Field label={t("completionNote")}>
            <Textarea
              className="text-lg"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              data-testid="completion-note"
            />
          </Field>
        </Card>
      ) : null}

      <ServiceThread
        target={{ surface: "staff", kind: "workOrder", id: workOrder.id }}
        initial={messages}
        canWrite={canWrite}
        ended={
          workOrder.status === "cancelled" ||
          (request !== null && (request.status === "closed" || request.status === "cancelled"))
        }
        touch
      />

      {lead ? (
        <StaffActionBar problem={problem}>
          <Button
            size="xl"
            iconStart={lead.icon}
            loading={busy === lead.name}
            onClick={() => void step(lead.name, lead.run)}
            data-testid={lead.name}
          >
            {lead.label}
          </Button>
        </StaffActionBar>
      ) : (
        problem
      )}
    </div>
  );
}

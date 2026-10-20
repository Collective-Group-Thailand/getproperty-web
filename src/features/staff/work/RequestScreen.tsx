"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PRIORITY_STATUS } from "@/domain/status/priority";
import { SERVICE_REQUEST_STATUS } from "@/domain/status/serviceRequest";
import { ServiceThread } from "@/features/shared/console/ServiceThread";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconFilter } from "@/ui/icons/glyphs/filter";
import { IconWrench } from "@/ui/icons/glyphs/wrench";

import { PhotoThumb } from "../shared/PhotoThumb";
import { newKey, problemText } from "../shared/problem";

const PRIORITIES: Schemas["ServicePriority"][] = ["low", "normal", "high", "urgent"];

/**
 * A service request on the phone (F4 4.4): what was reported, its photos; triage (priority) while new, and
 * "take it" — a repair work order assigned to me (`POST …/work-orders`, one Idempotency-Key per attempt),
 * which opens the work order.
 */
export function RequestScreen({
  request,
  userId,
  messages,
  canWrite,
}: {
  request: Schemas["ServiceRequestDto"];
  userId: string;
  /** The request's thread; `null` when it could not be read. */
  messages: Schemas["ServiceMessageDto"][] | null;
  canWrite: boolean;
}) {
  const t = useTranslations("staff.work.request");
  const visit = useTranslations("console.visit");
  const locale = useLocale() as Locale;
  const priorities = useTranslations("status.priority");
  const router = useRouter();
  const [priority, setPriority] = useState(request.priority);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [key] = useState(newKey);
  const can = (name: string) => request.nextActions.includes(name);
  const path = { serviceRequestId: request.id };

  return (
    <div className="flex flex-col gap-6 py-6" data-testid="staff-request">
      <header className="flex flex-col gap-2">
        <Button asChild variant="ghost" size="lg" className="self-start">
          <Link href="/work-orders">{t("back")}</Link>
        </Button>
        <h1 className="text-2xl font-semibold">
          {request.ref} · {request.unitNo ?? t("commonArea")}
        </h1>
        <span className="flex flex-wrap gap-2">
          <StatusBadgeOf map={SERVICE_REQUEST_STATUS} value={request.status} />
          <StatusBadgeOf map={PRIORITY_STATUS} value={request.priority} />
        </span>
      </header>
      <p className="text-lg whitespace-pre-line">{request.description}</p>
      <p className="text-base" data-testid="request-visit-preference">
        {visit("preferred")}:{" "}
        {request.preferredVisit ? visit(`preference.${request.preferredVisit}`) : visit("noPreference")}
        {request.visitConfirmedAt
          ? ` · ${visit("confirmedAt", { at: formatDateTime(request.visitConfirmedAt, locale) })}`
          : ""}
      </p>
      {request.photoIds.length ? (
        <ul className="flex flex-wrap gap-2">
          {request.photoIds.map((id, index) => (
            <li key={id}>
              <PhotoThumb fileId={id} alt={t("photoAlt", { index: index + 1 })} />
            </li>
          ))}
        </ul>
      ) : null}
      {can("triage") ? (
        <section aria-labelledby="triage" className="flex flex-col gap-3">
          <h2 id="triage" className="text-lg font-semibold">
            {t("triage")}
          </h2>
          <Field label={t("priority")}>
            <NativeSelect
              inputSize="lg"
              value={priority}
              onChange={(event) => setPriority(event.target.value as Schemas["ServicePriority"])}
              options={PRIORITIES.map((value) => ({ value, label: priorities(value) }))}
            />
          </Field>
          <Button
            variant="secondary"
            size="xl"
            block
            iconStart={IconFilter}
            loading={busy === "triage"}
            onClick={async () => {
              setBusy("triage");
              setError(null);
              try {
                await unwrap(
                  browserApi().POST("/v1/staff/service-requests/{serviceRequestId}/actions/triage", {
                    params: { path },
                    body: { priority },
                  }),
                );
                router.refresh();
              } catch (failure) {
                setError(failure);
              } finally {
                setBusy(null);
              }
            }}
            data-testid="request-triage"
          >
            {t("triage")}
          </Button>
        </section>
      ) : null}
      {can("create-work-order") ? (
        <Button
          size="xl"
          block
          iconStart={IconWrench}
          loading={busy === "take"}
          onClick={async () => {
            setBusy("take");
            setError(null);
            try {
              const workOrder = await unwrap(
                browserApi().POST("/v1/staff/service-requests/{serviceRequestId}/work-orders", {
                  params: { path, header: { "Idempotency-Key": key } },
                  body: {
                    title: request.description.slice(0, 80),
                    kind: "repair",
                    assigneeUserId: userId,
                  },
                }),
              );
              router.push(`/work-orders/${workOrder.id}`);
            } catch (failure) {
              setError(failure);
            } finally {
              setBusy(null);
            }
          }}
          data-testid="request-take"
        >
          {t("take")}
        </Button>
      ) : null}
      {request.workOrders.length ? (
        <section aria-labelledby="request-work" className="flex flex-col gap-2">
          <h2 id="request-work" className="text-lg font-semibold">
            {t("workOrders")}
          </h2>
          <ul className="flex flex-col gap-1">
            {request.workOrders.map((workOrder) => (
              <li key={workOrder.id}>
                <Button asChild variant="secondary" size="lg" block>
                  <Link href={`/work-orders/${workOrder.id}`}>{workOrder.title}</Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ServiceThread
        target={{ surface: "staff", kind: "serviceRequest", id: request.id }}
        initial={messages}
        canWrite={canWrite}
        ended={request.status === "closed" || request.status === "cancelled"}
        touch
      />
      {error ? (
        <Callout tone="danger">
          <span role="alert">{problemText(error, t("offline"))}</span>
        </Callout>
      ) : null}
    </div>
  );
}

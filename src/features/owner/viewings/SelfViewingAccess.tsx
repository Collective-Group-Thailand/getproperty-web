"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ACCESS_RESULT_STATUS, CREDENTIAL_STATUS, VIEWING_ACCESS_STATUS } from "@/domain/status";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { LazyDialog } from "@/ui/components/overlays";
import { Skeleton } from "@/ui/components/Skeleton";
import { IconHistory } from "@/ui/icons/glyphs/history";
import { IconLock } from "@/ui/icons/glyphs/lock";

import { ownerPath } from "../shared/links";
import { attention, canEndAccess } from "./selfViewing";

type Access = Schemas["ViewingAccessSummaryDto"];

/**
 * The door-code window of a confirmed self viewing (G7, D-295) as the owner sees it: its state, the window, when
 * the visitor entered (and how the API knows — the lock's log or the visitor's tap) and left, an incident with its
 * work order, why it closed. The code itself is never shown here (only the visitor gets it, inside the window).
 * The entry log is an audited read; ending access early revokes the codes at the lock (reason, Idempotency-Key).
 */
export function SelfViewingAccess({ viewingId, access, now }: { viewingId: string; access: Access; now: number }) {
  const t = useTranslations("owner.viewings.access");
  const locale = useLocale() as Locale;
  const need = attention(access, now);
  const window = `${formatDateTime(access.validFrom, locale)}–${formatTime(access.validTo, locale)}`;
  const facts: [string, string, string][] = [
    ["window", t("window"), window],
    ...(access.enteredAt
      ? [
          [
            "entered",
            t("entered"),
            `${formatDateTime(access.enteredAt, locale)} · ${t(`source.${access.enteredSource === "lock_log" ? "lock_log" : "prospect"}`)}`,
          ] as [string, string, string],
        ]
      : []),
    ...(access.exitedAt
      ? [["exited", t("exited"), formatDateTime(access.exitedAt, locale)] as [string, string, string]]
      : []),
    ...(access.closedAt
      ? [
          [
            "closed",
            t("closed"),
            access.closeReason
              ? `${formatDateTime(access.closedAt, locale)} · ${access.closeReason}`
              : formatDateTime(access.closedAt, locale),
          ] as [string, string, string],
        ]
      : []),
  ];

  return (
    <div
      className="border-border bg-bg-subtle rounded-card flex flex-col gap-3 border p-3"
      data-testid="viewing-access"
      data-access-state={access.state}
      data-attention={need ?? undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-semibold">{t("title")}</span>
        <StatusBadgeOf map={VIEWING_ACCESS_STATUS} value={access.state} size="sm" />
      </div>
      {need === "incident" ? (
        <Callout
          tone="danger"
          title={t("incidentTitle")}
          action={
            access.workOrderId ? (
              <Button asChild size="sm" variant="secondary">
                <a href={ownerPath(locale, `/work-orders/${access.workOrderId}`)} data-testid="viewing-work-order">
                  {t("workOrder")}
                </a>
              </Button>
            ) : undefined
          }
        >
          <span data-testid="viewing-incident">{access.incidentNote ?? t("incidentNoNote")}</span>
        </Callout>
      ) : need === "overstay" ? (
        <Callout tone="warning" title={t("overstayTitle")}>
          {t("overstayBody", { time: formatTime(access.validTo, locale) })}
        </Callout>
      ) : need === "inside" ? (
        <Callout tone="info" title={t("insideTitle")}>
          {t("insideBody")}
        </Callout>
      ) : null}
      <dl className="m-0 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {facts.map(([key, term, value]) => (
          <div key={key} className="flex flex-col">
            <dt className="text-muted">{term}</dt>
            <dd className="m-0 font-medium tabular-nums" data-testid={`viewing-access-${key}`}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-muted inline-flex items-start gap-1 text-xs">{t("noCode")}</p>
      <div className="flex flex-wrap gap-2">
        <AccessLog viewingId={viewingId} />
        {canEndAccess(access) ? (
          <FormDialog
            label={t("end")}
            icon={IconLock}
            size="sm"
            variant="ghost"
            testId="viewing-end-access"
            title={t("endTitle")}
            description={t("endBody")}
            submitLabel={t("end")}
            successMessage={t("ended")}
            onSubmit={(data, _ack, idempotencyKey) =>
              unwrap(
                browserApi().POST("/v1/owner/listing-viewings/{viewingId}/actions/end-access", {
                  params: { path: { viewingId }, header: { "Idempotency-Key": idempotencyKey } },
                  body: { reason: text(data, "reason") ?? "" },
                }),
              )
            }
          >
            {(errors) => (
              <Field label={t("endReason")} required error={errors.reason}>
                <Textarea name="reason" rows={3} maxLength={500} required data-testid="viewing-end-reason" />
              </Field>
            )}
          </FormDialog>
        ) : null}
      </div>
    </div>
  );
}

/** The entry log of one self viewing — read on demand (each read is audited by the API, never cached here). */
function AccessLog({ viewingId }: { viewingId: string }) {
  const t = useTranslations("owner.viewings.log");
  const common = useTranslations("common");
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<Schemas["ViewingAccessLogDto"] | null>(null);
  const action = useApiAction<Schemas["ViewingAccessLogDto"]>({ refresh: false });

  const load = () =>
    action.run(
      () =>
        unwrap(
          browserApi().GET("/v1/owner/listing-viewings/{viewingId}/access-log", {
            params: { path: { viewingId } },
          }),
        ),
      setLog,
    );

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        iconStart={IconHistory}
        onClick={() => {
          setOpen(true);
          setLog(null);
          void load();
        }}
        data-testid="viewing-access-log"
      >
        {t("open")}
      </Button>
      <LazyDialog
        open={open}
        onOpenChange={setOpen}
        title={t("title")}
        description={t("audited")}
        size="lg"
        closeLabel={common("close")}
      >
        <div className="flex flex-col gap-5" data-testid="viewing-access-log-body">
          {action.error ? <ProblemNotice error={action.error} /> : null}
          {!log && !action.error ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : null}
          {log ? (
            <>
              <section aria-labelledby="log-credentials" className="flex flex-col gap-2">
                <h3 id="log-credentials" className="text-sm font-semibold">
                  {t("credentials")}
                </h3>
                {log.credentials.length === 0 ? (
                  <p className="text-muted text-sm">{t("noCredentials")}</p>
                ) : (
                  <ul className="divide-border m-0 list-none divide-y p-0">
                    {log.credentials.map((credential, i) => (
                      <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                        <span className="flex flex-col">
                          <span className="font-medium">{credential.lockName}</span>
                          <span className="text-muted text-xs tabular-nums">
                            {t(`scope.${credential.lockScope}`)} · {formatDateTime(credential.validFrom, locale)}
                            {credential.validTo ? `–${formatTime(credential.validTo, locale)}` : ""}
                          </span>
                        </span>
                        <StatusBadgeOf map={CREDENTIAL_STATUS} value={credential.status} size="sm" />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section aria-labelledby="log-events" className="flex flex-col gap-2">
                <h3 id="log-events" className="text-sm font-semibold">
                  {t("events")}
                </h3>
                {log.events.length === 0 ? (
                  <p className="text-muted text-sm" data-testid="viewing-access-log-empty">
                    {t("noEvents")}
                  </p>
                ) : (
                  <ol className="divide-border m-0 list-none divide-y p-0" data-testid="viewing-access-events">
                    {log.events.map((event, i) => (
                      <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                        <span className="flex flex-col">
                          <time className="font-medium tabular-nums" dateTime={event.time}>
                            {formatDateTime(event.time, locale)}
                          </time>
                          <span className="text-muted text-xs">
                            {event.lockName} · {t(`via.${event.source}`)}
                          </span>
                        </span>
                        <StatusBadgeOf map={ACCESS_RESULT_STATUS} value={event.result} size="sm" />
                      </li>
                    ))}
                  </ol>
                )}
              </section>
              <p className="text-muted text-xs">{t("retention")}</p>
            </>
          ) : null}
        </div>
      </LazyDialog>
    </>
  );
}

"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconPackageCheck } from "@/ui/icons/glyphs/package-check";

import { newKey, problemText } from "../shared/problem";

/**
 * Finishes a task from Today (`POST /v1/staff/tasks/{type}/{id}/actions/complete`, D-213) where it can be
 * finished from the list: a work order (the API needs its after photo — otherwise the refusal links to the
 * work order to take it) or a parcel handed over with the resident's PIN or staff-confirmed. One
 * Idempotency-Key per attempt, kept while the same attempt is retried.
 */
export function TaskComplete({ task }: { task: Pick<Schemas["StaffTaskDto"], "id" | "type" | "subject" | "unitNo"> }) {
  const t = useTranslations("staff.today.complete");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [key, setKey] = useState(newKey);

  const send = async (body: Schemas["StaffTaskCompleteDto"]) => {
    setBusy(true);
    setError(null);
    try {
      await unwrap(
        browserApi().POST("/v1/staff/tasks/{type}/{taskId}/actions/complete", {
          params: { path: { type: task.type, taskId: task.id }, header: { "Idempotency-Key": key } },
          body,
        }),
      );
      setOpen(false);
      setKey(newKey());
      router.refresh();
    } catch (failure) {
      setError(failure);
      // A refusal is final for this attempt: a corrected retry is a new request.
      if (isApiError(failure) && failure.status !== 409) setKey(newKey());
    } finally {
      setBusy(false);
    }
  };

  if (!open)
    return (
      <Button
        variant="secondary"
        size="xl"
        block
        iconStart={task.type === "parcel" ? IconPackageCheck : IconCheckCircle}
        onClick={() => setOpen(true)}
        data-testid="task-complete"
      >
        {task.type === "parcel" ? t("handOver") : t("finish")}
      </Button>
    );

  return (
    <div className="border-border rounded-card flex flex-col gap-3 border p-3" data-testid="task-complete-panel">
      {task.type === "parcel" ? (
        <>
          <Field label={t("pin")} hint={t("pinHint")}>
            <Input
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              inputSize="lg"
              className="font-mono text-2xl tracking-widest"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
              data-testid="task-pin"
            />
          </Field>
          <Button
            size="xl"
            block
            loading={busy}
            disabled={pin.length !== 6}
            onClick={() => void send({ pin })}
            data-testid="task-pin-submit"
          >
            {t("withPin")}
          </Button>
          <Button
            size="xl"
            block
            variant="secondary"
            loading={busy}
            onClick={() => void send({ staffConfirmed: true })}
            data-testid="task-staff-confirm"
          >
            {t("staffConfirmed")}
          </Button>
        </>
      ) : (
        <>
          <Field label={t("note")}>
            <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} data-testid="task-note" />
          </Field>
          <Button
            size="xl"
            block
            loading={busy}
            onClick={() => void send({ note: note.trim() || null })}
            data-testid="task-finish"
          >
            {t("finish")}
          </Button>
        </>
      )}
      <Button size="lg" variant="ghost" onClick={() => setOpen(false)}>
        {t("cancel")}
      </Button>
      {error ? (
        <Callout tone="danger">
          <span role="alert" data-testid="task-problem">
            {problemText(error, t("offline"))}
          </span>
          {isApiError(error) && error.code === "work_order.photo_required" ? (
            <Button asChild variant="secondary" size="lg" className="mt-2">
              <Link href={`/work-orders/${task.id}`}>{t("takeAfterPhoto")}</Link>
            </Button>
          ) : null}
        </Callout>
      ) : null}
    </div>
  );
}

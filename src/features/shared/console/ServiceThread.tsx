"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useId, useState } from "react";

import { useRealtimeEvents } from "@/features/shared/realtime/RealtimeProvider";
import { formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { ApiError, NetworkError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { cn } from "@/ui/lib/cn";

type Message = Schemas["ServiceMessageDto"];

/** Whose thread: a request's (resident, office, technicians) or a work order's (its request's, else its own). */
export interface ServiceThreadTarget {
  surface: "owner" | "staff";
  kind: "serviceRequest" | "workOrder";
  id: string;
}

/** The API's limit on one message (`ServiceMessageCreateDto.body`). */
export const MESSAGE_MAX = 2000;

function listThread({ surface, kind, id }: ServiceThreadTarget): Promise<Schemas["ServiceMessagesDto"]> {
  const api = browserApi();
  if (kind === "serviceRequest") {
    const params = { path: { serviceRequestId: id } };
    return surface === "owner"
      ? unwrap(api.GET("/v1/owner/service-requests/{serviceRequestId}/messages", { params }))
      : unwrap(api.GET("/v1/staff/service-requests/{serviceRequestId}/messages", { params }));
  }
  const params = { path: { workOrderId: id } };
  return surface === "owner"
    ? unwrap(api.GET("/v1/owner/work-orders/{workOrderId}/messages", { params }))
    : unwrap(api.GET("/v1/staff/work-orders/{workOrderId}/messages", { params }));
}

function postToThread({ surface, kind, id }: ServiceThreadTarget, body: string, key: string): Promise<Message> {
  const api = browserApi();
  const header = { "Idempotency-Key": key };
  if (kind === "serviceRequest") {
    const params = { path: { serviceRequestId: id }, header };
    return surface === "owner"
      ? unwrap(api.POST("/v1/owner/service-requests/{serviceRequestId}/messages", { params, body: { body } }))
      : unwrap(api.POST("/v1/staff/service-requests/{serviceRequestId}/messages", { params, body: { body } }));
  }
  const params = { path: { workOrderId: id }, header };
  return surface === "owner"
    ? unwrap(api.POST("/v1/owner/work-orders/{workOrderId}/messages", { params, body: { body } }))
    : unwrap(api.POST("/v1/staff/work-orders/{workOrderId}/messages", { params, body: { body } }));
}

/**
 * The message thread of a repair request or a work order (D-072, D-218): the resident, the office and the
 * assigned technician talk inside the apps, so nobody hands out a phone number. Oldest first, as the API
 * lists it; a new `service_request.message` on this request or work order re-reads the thread. Writing is
 * offered only when the caller may handle requests and the thread is still open — the API answers 409 once
 * the request ended (or the work order was cancelled), and that answer is shown as it comes.
 */
export function ServiceThread({
  target,
  initial,
  canWrite,
  ended = false,
  touch = false,
}: {
  target: ServiceThreadTarget;
  /** The thread read on the server; `null` when that read failed (the panel offers to read again). */
  initial: Message[] | null;
  canWrite: boolean;
  /** The request ended (closed / cancelled) or the work order was cancelled: read-only. */
  ended?: boolean;
  /** Staff PWA: 48-px targets and larger text (design-system.md §5). */
  touch?: boolean;
}) {
  const t = useTranslations("console.serviceThread");
  const locale = useLocale() as Locale;
  const [messages, setMessages] = useState<Message[] | null>(initial);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // One Idempotency-Key per message, kept across retries of the same send (contract §3).
  const [key, setKey] = useState(() => crypto.randomUUID());
  const errors = useTranslations("errors");
  const headingId = useId();

  const reload = useCallback(() => {
    setLoading(true);
    void listThread(target)
      .then((body) => setMessages(body.data))
      .catch(() => setMessages((current) => current))
      .finally(() => setLoading(false));
  }, [target]);

  useRealtimeEvents((event) => {
    if (event.type !== "service_request.message") return;
    if (Object.values(event.ids).includes(target.id)) reload();
  });

  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const posted = await postToThread(target, body, key);
      setMessages((current) => [...(current ?? []).filter((message) => message.id !== posted.id), posted]);
      setDraft("");
      setKey(crypto.randomUUID());
    } catch (failure) {
      setError(failure);
    } finally {
      setSending(false);
    }
  };

  const tooLong = draft.length > MESSAGE_MAX;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3" data-testid="service-thread">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className={cn("font-semibold", touch ? "text-lg" : "text-base")}>
          {t("title")}
        </h2>
        <Button
          variant="ghost"
          size={touch ? "lg" : "sm"}
          loading={loading}
          onClick={reload}
          data-testid="thread-reload"
        >
          {t("reload")}
        </Button>
      </div>
      <p className="text-muted text-sm">{t("hint")}</p>
      {messages === null ? (
        <p className="text-muted text-sm" role="status" data-testid="thread-unavailable">
          {t("unavailable")}
        </p>
      ) : messages.length === 0 ? (
        <p className="text-muted text-sm" data-testid="thread-empty">
          {t("empty")}
        </p>
      ) : (
        <ol className="flex flex-col gap-2" aria-label={t("title")} data-testid="thread-messages">
          {messages.map((message) => (
            <li
              key={message.id}
              data-testid="thread-message"
              data-author={message.author}
              data-mine={message.mine || undefined}
              className={cn(
                "rounded-card flex max-w-[44rem] flex-col gap-1 px-3 py-2",
                message.mine ? "bg-primary-subtle self-end" : "bg-bg-subtle self-start",
              )}
            >
              <span className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold">{message.mine ? t("you") : message.authorName}</span>
                <Badge size="sm" tone={message.author === "resident" ? "info" : "neutral"}>
                  {t(`author.${message.author}`)}
                </Badge>
                <time className="text-muted" dateTime={message.createdAt}>
                  {formatDateTime(message.createdAt, locale)}
                </time>
              </span>
              <p className={cn("break-words whitespace-pre-line", touch ? "text-base" : "text-sm")}>{message.body}</p>
            </li>
          ))}
        </ol>
      )}
      {ended ? (
        <p className="text-muted text-sm" data-testid="thread-ended">
          {t("ended")}
        </p>
      ) : canWrite ? (
        <form className="flex flex-col gap-2" onSubmit={send} data-testid="thread-form">
          <Field
            label={t("write")}
            hint={t("writeHint", { count: draft.length, max: MESSAGE_MAX })}
            error={tooLong ? t("tooLong", { max: MESSAGE_MAX }) : undefined}
          >
            <Textarea
              name="body"
              rows={touch ? 4 : 3}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              data-testid="thread-input"
            />
          </Field>
          {error ? (
            // The API's localised problem (409 once the request ended, 422 too long), or no connection. Kept
            // light here: the staff PWA's work order screen is close to its JS budget (D-179).
            <Callout
              tone="danger"
              title={
                error instanceof ApiError
                  ? error.title || errors("unexpected.title")
                  : error instanceof NetworkError
                    ? errors("offline.title")
                    : errors("unexpected.title")
              }
            >
              <span role="alert" data-testid="thread-problem">
                {error instanceof ApiError
                  ? error.detail || errors("unexpected.body")
                  : error instanceof NetworkError
                    ? errors("offline.body")
                    : errors("unexpected.body")}
              </span>
            </Callout>
          ) : null}
          <div>
            <Button
              type="submit"
              size={touch ? "xl" : "md"}
              block={touch}
              loading={sending}
              disabled={!draft.trim() || tooLong}
              data-testid="thread-send"
            >
              {t("send")}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

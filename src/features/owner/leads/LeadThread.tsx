"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { Icon } from "@/ui/icons";
import { IconForward as IconSend } from "@/ui/icons/glyphs/forward";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { cn } from "@/ui/lib/cn";

/** The API's limit on one reply (`LeadMessageCreateDto.body`). */
export const REPLY_MAX = 1000;

/**
 * The conversation with a prospect (F6.2 part 2, D-252): their messages on the left, mine on the right, oldest
 * first like a chat, the newest kept in view. A reply goes to the prospect in LINE (the API sends it); while the
 * enquiry is closed the composer gives way to a note saying so.
 */
export function LeadThread({
  leadId,
  prospectName,
  messages,
  closed,
}: {
  leadId: string;
  prospectName: string;
  messages: Schemas["LeadMessageDto"][];
  closed: boolean;
}) {
  const t = useTranslations("owner.leads.thread");
  const locale = useLocale() as Locale;
  const action = useApiAction();
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLLIElement>(null);
  const tooLong = draft.length > REPLY_MAX;

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  const send = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || tooLong) return;
    action.run(
      () =>
        unwrap(
          browserApi().POST("/v1/owner/leads/{leadId}/messages", { params: { path: { leadId } }, body: { body } }),
        ),
      () => setDraft(""),
    );
  };

  return (
    <div className="-mx-5 -my-4 flex flex-col" data-testid="lead-thread">
      <p className="bg-bg-subtle text-muted border-border m-0 flex items-start gap-2 border-b px-5 py-2.5 text-sm">
        <Icon icon={IconShield} className="mt-0.5 shrink-0" />
        {t("hint")}
      </p>
      {messages.length === 0 ? (
        <p className="text-muted m-0 px-5 py-8 text-center text-sm">{t("empty")}</p>
      ) : (
        <ol
          className="m-0 flex max-h-[34rem] min-h-48 list-none flex-col gap-3 overflow-y-auto px-5 py-5"
          aria-label={t("title")}
        >
          {messages.map((message, index) => {
            const mine = message.author === "owner";
            return (
              <li
                key={message.id}
                ref={index === messages.length - 1 ? end : undefined}
                className={cn(
                  "flex max-w-[85%] flex-col gap-1",
                  mine ? "items-end self-end" : "items-start self-start",
                )}
                data-testid="lead-message"
                data-author={message.author}
              >
                <p
                  className={cn(
                    "rounded-card m-0 px-3.5 py-2.5 text-sm break-words whitespace-pre-line",
                    mine ? "bg-primary text-primary-fg rounded-ee-thumb" : "bg-bg-subtle text-fg rounded-es-thumb",
                  )}
                >
                  {message.body}
                </p>
                <span className="text-muted text-xs">
                  {mine ? t("you") : prospectName} ·{" "}
                  <time dateTime={message.createdAt}>{formatDateTime(message.createdAt, locale)}</time>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {closed ? (
        <p
          className="border-border text-muted m-0 flex items-center gap-2 border-t px-5 py-4 text-sm"
          data-testid="lead-closed"
        >
          <Icon icon={IconLock} className="shrink-0" />
          {t("closed")}
        </p>
      ) : (
        <form className="border-border flex flex-col gap-2 border-t px-5 py-4" onSubmit={send} data-testid="lead-reply">
          <Field
            label={t("write")}
            labelHidden
            hint={t("writeHint", { count: draft.length, max: REPLY_MAX })}
            error={tooLong ? t("tooLong", { max: REPLY_MAX }) : undefined}
          >
            <Textarea
              name="body"
              rows={3}
              value={draft}
              placeholder={t("placeholder")}
              onChange={(event) => setDraft(event.target.value)}
              data-testid="lead-reply-input"
            />
          </Field>
          <ProblemNotice error={action.error} />
          <div className="flex justify-end">
            <Button
              type="submit"
              iconStart={IconSend}
              loading={action.busy}
              disabled={!draft.trim() || tooLong}
              data-testid="lead-reply-send"
            >
              {t("send")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

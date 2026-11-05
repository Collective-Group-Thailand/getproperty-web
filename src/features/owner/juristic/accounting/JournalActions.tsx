"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { DateField } from "@/features/shared/console/DateField";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { IconUndo } from "@/ui/icons/glyphs/undo";

import { ownerPath } from "../../shared/links";

/**
 * Reverses a manual or opening journal (J2.1 §2): journals are immutable, so a correction posts the mirror entry on
 * the chosen date (not before the original) with the reason in its memo. Typed confirmation: the journal's reference.
 */
export function ReverseJournalButton({ journal, today }: { journal: Schemas["JournalDto"]; today: string }) {
  const t = useTranslations("owner.accounting.reverse");
  const locale = useLocale() as Locale;
  const [reason, setReason] = useState("");
  const [postedOn, setPostedOn] = useState<string | null>(today);
  return (
    <ConfirmAction
      label={t("button")}
      icon={IconUndo}
      variant="secondary"
      block
      testId="journal-reverse"
      title={t("title")}
      description={t("body", { memo: journal.memo })}
      confirmLabel={t("confirm")}
      tone="destructive"
      ready={reason.trim().length >= 3 && Boolean(postedOn)}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/journals/{journalId}/actions/reverse", {
            params: { path: { journalId: journal.id }, header: { "Idempotency-Key": key } },
            body: { reason: reason.trim(), ...(postedOn ? { postedOn } : {}) },
          }),
        )
      }
      onDone={(result) =>
        window.location.assign(
          ownerPath(locale, `/juristic/accounting/journals/${(result as Schemas["JournalDto"]).id}`),
        )
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t("postedOn")} hint={t("postedOnHint")} required>
          <DateField name="postedOn" defaultValue={today} min={journal.postedOn} max={today} onChange={setPostedOn} />
        </Field>
        <Field label={t("reason")} hint={t("reasonHint")} required>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={400}
            data-testid="journal-reverse-reason"
          />
        </Field>
      </div>
    </ConfirmAction>
  );
}

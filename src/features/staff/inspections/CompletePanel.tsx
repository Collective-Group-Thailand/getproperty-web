"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Textarea } from "@/ui/components/Input";
import { blobToBase64, SignaturePad } from "@/ui/components/SignaturePad";
import { IconSign } from "@/ui/icons/glyphs/sign";

import { useSignatureLabels } from "../shared/labels";
import { deleteDraft, type InspectionDraft } from "./draft";

/** The API's limit per signature PNG (`InspectionCompleteDto`). */
const SIGNATURE_MAX_BYTES = 200 * 1024;

/**
 * Completing an inspection (D-023, D-050): the inspector signs (required here), the resident signs on
 * the same device when present (the report is then `signed`), both kept in the draft until sent. The
 * dirty lines are synced first; the completion carries an Idempotency-Key fixed at the first attempt
 * (kept in the draft), so pressing again after a dropped connection replays instead of failing.
 */
export function CompletePanel({
  inspection,
  draft,
  patch,
  sync,
  onCancel,
}: {
  inspection: Schemas["InspectionDto"];
  draft: InspectionDraft;
  patch: (
    fields: Partial<Pick<InspectionDraft, "staffSignature" | "residentSignature" | "notes" | "completeKey">>,
  ) => Promise<void>;
  sync: () => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations("staff.inspections.complete");
  const common = useTranslations("common");
  const labels = useSignatureLabels();
  const router = useRouter();
  const [notes, setNotes] = useState(draft.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ detail: string; requestId?: string } | null>(null);
  const [staff, setStaff] = useState<Blob | null>(draft.staffSignature ?? null);
  const [resident, setResident] = useState<Blob | null>(draft.residentSignature ?? null);

  const [initialStaff] = useState(draft.staffSignature);
  const [initialResident] = useState(draft.residentSignature);

  const submit = async () => {
    setError(null);
    if (!navigator.onLine) {
      setError({ detail: t("offline") });
      return;
    }
    if (!staff) return;
    if (staff.size > SIGNATURE_MAX_BYTES || (resident && resident.size > SIGNATURE_MAX_BYTES)) {
      setError({ detail: t("tooLarge") });
      return;
    }
    setBusy(true);
    try {
      await sync();
      const key = draft.completeKey ?? crypto.randomUUID();
      if (!draft.completeKey) await patch({ completeKey: key, notes });
      await unwrap(
        browserApi().POST("/v1/staff/inspections/{inspectionId}/actions/complete", {
          params: { path: { inspectionId: inspection.id }, header: { "Idempotency-Key": key } },
          body: {
            notes: notes.trim() ? notes : null,
            staffSignaturePng: await blobToBase64(staff),
            ...(resident ? { residentSignaturePng: await blobToBase64(resident) } : {}),
          },
        }),
      );
      await deleteDraft(inspection.id);
      router.refresh();
    } catch (failure) {
      setError(
        isApiError(failure)
          ? { detail: failure.detail || failure.code, requestId: failure.requestId }
          : { detail: t("offline") },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4" data-testid="complete-panel">
      <div className="flex flex-col gap-1">
        <label htmlFor="inspection-notes" className="text-muted text-sm font-medium">
          {t("notes")}
        </label>
        <Textarea
          id="inspection-notes"
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={() => void patch({ notes })}
          className="text-lg"
        />
      </div>
      <section className="flex flex-col gap-2" aria-labelledby="sign-staff">
        <h3 id="sign-staff" className="font-semibold">
          {t("staffSignature")}
        </h3>
        <SignaturePad
          label={t("staffSignature")}
          labels={labels}
          initial={initialStaff}
          onChange={(png) => {
            setStaff(png);
            void patch({ staffSignature: png ?? undefined });
          }}
        />
      </section>
      <section className="flex flex-col gap-2" aria-labelledby="sign-resident">
        <h3 id="sign-resident" className="font-semibold">
          {t("residentSignature")}
        </h3>
        <p className="text-muted text-sm">{t("residentHint")}</p>
        <SignaturePad
          label={t("residentSignature")}
          labels={labels}
          initial={initialResident}
          onChange={(png) => {
            setResident(png);
            void patch({ residentSignature: png ?? undefined });
          }}
        />
      </section>
      {error ? (
        <Callout tone="danger" title={t("errorTitle")}>
          {error.detail}
          {error.requestId ? (
            <span className="text-muted block font-mono text-xs">
              {common("requestId")}: {error.requestId}
            </span>
          ) : null}
        </Callout>
      ) : null}
      <Button
        size="xl"
        block
        iconStart={IconSign}
        loading={busy}
        disabled={!staff}
        onClick={() => void submit()}
        data-testid="complete-submit"
      >
        {resident ? t("submitSigned") : t("submit")}
      </Button>
      <Button variant="ghost" size="lg" onClick={onCancel}>
        {t("cancel")}
      </Button>
    </div>
  );
}

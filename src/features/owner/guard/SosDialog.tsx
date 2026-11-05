"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { FieldError } from "@/ui/components/FieldError";
import { KindTiles } from "@/ui/components/KindTiles";
import { KioskButton as Button, KioskInput as Input } from "@/ui/components/Kiosk";

import { INCIDENT_ICONS } from "./Incidents";
import { KioskDialog } from "./KioskDialog";
import type { IncidentKind } from "./lib/api";

const KINDS: IncidentKind[] = ["fire", "medical", "intrusion", "other"];

/** The tablet's own SOS (J4.2 §5: `POST /v1/guard/incidents`, source `guard`). */
export default function SosDialog({
  onClose,
  onSend,
}: {
  onClose: () => void;
  onSend: (kind: IncidentKind, note: string) => Promise<boolean>;
}) {
  const t = useTranslations("owner.guard");
  const [kind, setKind] = useState<IncidentKind | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <KioskDialog
      open
      onClose={onClose}
      title={t("sos.title")}
      closeLabel={t("close")}
      testId="sos-dialog"
      footer={
        <>
          <Button variant="secondary" size="xl" className="h-14" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            variant="destructive-solid"
            size="xl"
            className="h-14"
            loading={busy}
            onClick={async () => {
              if (!kind) return setError(true);
              setBusy(true);
              const ok = await onSend(kind, note.trim());
              setBusy(false);
              if (ok) onClose();
            }}
            data-testid="sos-send"
          >
            {t("sos.submit")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-muted">{t("sos.lede")}</p>
        <div className="flex flex-col gap-2">
          <span className="font-semibold">{t("sos.kind")}</span>
          <KindTiles
            label={t("sos.kind")}
            value={kind}
            onValueChange={(value) => {
              setError(false);
              setKind(value as IncidentKind);
            }}
            options={KINDS.map((value) => ({ value, label: t(`sos.kinds.${value}`), icon: INCIDENT_ICONS[value] }))}
          />
          {error ? <FieldError alert>{t("sos.kindRequired")}</FieldError> : null}
        </div>
        <label className="flex flex-col gap-2">
          <span className="font-semibold">{t("sos.note")}</span>
          <Input
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            className="h-14 text-lg"
          />
        </label>
      </div>
    </KioskDialog>
  );
}

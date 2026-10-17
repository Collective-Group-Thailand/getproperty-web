"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { Button } from "@/ui/components/Button";
import { IconDownload } from "@/ui/icons/glyphs/download";

/** The signed inspection report (PDF, a 5-minute URL; the download is audited, D-023). */
export function ReportButton({ inspectionId }: { inspectionId: string }) {
  const t = useTranslations("staff.inspections");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="secondary"
        size="xl"
        block
        iconStart={IconDownload}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          try {
            const report = await unwrap(
              browserApi().GET("/v1/staff/inspections/{inspectionId}/report", { params: { path: { inspectionId } } }),
            );
            window.location.assign(report.url);
          } catch {
            setFailed(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {t("downloadReport")}
      </Button>
      {failed ? (
        <p className="text-muted text-sm" role="alert">
          {t("reportUnavailable")}
        </p>
      ) : null}
    </div>
  );
}

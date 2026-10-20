"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button, type ButtonProps } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";
import { IconDownload } from "@/ui/icons/glyphs/download";

import { ProblemNotice, useApiAction, useIdempotencyKey } from "@/features/shared/console/useApiAction";

const POLL_MS = 1000;
const MAX_POLLS = 120;

/**
 * An export the API builds in the background (D-202: `POST /v1/owner/exports` → `202` job → poll
 * `GET /v1/owner/exports/{id}` until `done`), then a download streamed through this zone's BFF
 * (`/bff/exports/{id}/download`, the signed URL stays on the server). One
 * Idempotency-Key per request; a failed job shows the API's error.
 */
export function ExportButton({
  kind,
  params,
  label,
  variant = "secondary",
  testId,
}: {
  kind: Schemas["ExportKind"];
  params: Schemas["ExportParamsDto"];
  label: string;
  variant?: ButtonProps["variant"];
  testId?: string;
}) {
  const t = useTranslations("owner.common.export");
  const action = useApiAction<Schemas["ExportJobDto"]>({ refresh: false });
  const idempotency = useIdempotencyKey();
  const [job, setJob] = useState<Schemas["ExportJobDto"] | null>(null);
  const polls = useRef(0);

  useEffect(() => {
    if (!job || job.status === "done" || job.status === "failed") return;
    if (polls.current >= MAX_POLLS) return;
    const timer = window.setTimeout(() => {
      polls.current += 1;
      unwrap(browserApi().GET("/v1/owner/exports/{exportId}", { params: { path: { exportId: job.id } } }))
        .then(setJob)
        .catch(() => undefined);
    }, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [job]);

  const working = action.busy || (job !== null && (job.status === "queued" || job.status === "running"));
  return (
    <div className="flex flex-col items-start gap-2" data-testid={testId} data-export-status={job?.status ?? "idle"}>
      <span className="flex flex-wrap items-center gap-2">
        <Button
          variant={variant}
          iconStart={IconDownload}
          loading={working}
          onClick={() => {
            polls.current = 0;
            setJob(null);
            void action.run(
              () =>
                unwrap(
                  browserApi().POST("/v1/owner/exports", {
                    params: { header: { "Idempotency-Key": idempotency.key } },
                    body: { kind, params },
                  }),
                ),
              (created) => {
                idempotency.renew();
                setJob(created);
              },
            );
          }}
        >
          {label}
        </Button>
        {working && job ? (
          <span className="text-muted text-sm" role="status">
            {t("working")}
          </span>
        ) : null}
        {job?.status === "done" && job.download ? (
          <a
            className="text-primary inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
            href={`/bff/exports/${job.id}/download`}
            download
            data-testid="export-download"
          >
            <Icon icon={IconDownload} size={16} />
            {job.rowCount !== null ? t("downloadRows", { count: job.rowCount }) : t("download")}
          </a>
        ) : null}
      </span>
      {job?.status === "failed" ? (
        <p className="text-muted text-sm" role="alert">
          {t("failed", { error: job.error ?? "" })}
        </p>
      ) : null}
      <ProblemNotice error={action.error} />
    </div>
  );
}

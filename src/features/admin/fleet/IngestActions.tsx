"use client";

import { useTranslations } from "next-intl";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { toast } from "@/ui/components/Toast";
import type { Schemas } from "@/lib/api/types";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";

/**
 * `POST /v1/admin/ingest/dead-letters/{id}/actions/replay` — runs a refused payload through ingest again
 * (after the gateway or the driver was fixed); the answer says where it went (`outcome`), e.g. still
 * `dead_letter` when the gateway is still unknown.
 */
export function ReplayIngest({ row }: { row: Schemas["DeadLetterDto"] }) {
  const t = useTranslations("admin.fleet.ingest");
  return (
    <ConfirmAction
      label={t("replay")}
      icon={IconRefresh}
      size="sm"
      variant="secondary"
      testId={`ingest-replay-${row.id}`}
      title={t("replayTitle", { topic: row.topic })}
      description={t("replayBody")}
      confirmLabel={t("replay")}
      onDone={(result) => {
        const answer = result as Schemas["DeadLetterReplayDto"];
        toast.success(t("replayed", { outcome: answer.outcome }));
      }}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/admin/ingest/dead-letters/{deadLetterId}/actions/replay", {
            params: { path: { deadLetterId: row.id }, header: { "Idempotency-Key": key } },
          }),
        )
      }
    />
  );
}

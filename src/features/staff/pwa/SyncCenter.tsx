"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { AlertDialog } from "@/ui/components/AlertDialog";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { CountBadge } from "@/ui/components/CountBadge";
import { IconButton } from "@/ui/components/IconButton";
import { Sheet } from "@/ui/components/Sheet";

import { useOfflineQueue, useOnlineStatus } from "./useOfflineQueue";

/**
 * Offline indicator + sync badge of the staff shell (F1 1.3 §1, ADR-0007): shows when the device is
 * offline and how many submissions wait; the sheet lists them, with the API's reason for each one it
 * refused (a conflict is never retried blindly — the staff member retries or removes it).
 */
export function SyncCenter() {
  const t = useTranslations("staff.offline");
  const common = useTranslations("common");
  const format = useFormatter();
  const online = useOnlineStatus();
  const queue = useOfflineQueue();
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; label: string } | null>(null);
  const waiting = queue.pending + queue.conflicts;

  return (
    <div className="flex items-center gap-1">
      {online ? null : (
        <Badge tone="warning" icon="offline" size="sm" className="whitespace-nowrap">
          <span data-testid="offline-indicator">{t("offline")}</span>
        </Badge>
      )}
      <IconButton
        name={queue.conflicts > 0 ? "sync-failed" : "sync-pending"}
        label={t("syncLabel", { count: waiting })}
        onClick={() => setOpen(true)}
        data-testid="sync-badge"
        data-pending={queue.pending}
        data-conflicts={queue.conflicts}
        badge={<CountBadge count={waiting} />}
      />
      <Sheet open={open} onOpenChange={setOpen} title={t("syncTitle")} closeLabel={common("close")} side="bottom">
        {queue.lastResult?.stopped === "signed-out" ? <Callout tone="warning">{t("signedOut")}</Callout> : null}
        {queue.entries.length === 0 ? (
          <p className="text-muted py-6 text-center">{t("syncEmpty")}</p>
        ) : (
          <ul className="divide-border divide-y" data-testid="sync-list">
            {queue.entries.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-2 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{entry.label}</span>
                  <Badge tone={entry.state === "conflict" ? "danger" : "neutral"} size="sm">
                    {entry.state === "conflict" ? t("conflict") : t("pending")}
                  </Badge>
                </div>
                <span className="text-muted text-sm">
                  {t("queuedAt", { time: format.relativeTime(entry.createdAt) })}
                </span>
                {entry.problem ? (
                  <Callout tone="danger">
                    {entry.problem.detail || entry.problem.code}
                    {entry.problem.requestId ? (
                      <span className="text-muted block font-mono text-xs">
                        {common("requestId")}: {entry.problem.requestId}
                      </span>
                    ) : null}
                  </Callout>
                ) : null}
                <div className="flex gap-2">
                  {entry.state === "conflict" ? (
                    <Button size="md" variant="secondary" onClick={() => void queue.retry(entry.id)}>
                      {t("retry")}
                    </Button>
                  ) : null}
                  <Button
                    size="md"
                    variant="destructive"
                    onClick={() => setRemoving({ id: entry.id, label: entry.label })}
                  >
                    {t("discard")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {queue.pending > 0 && online ? (
          <Button block size="lg" className="mt-3" onClick={() => void queue.replayNow()}>
            {t("sendNow")}
          </Button>
        ) : null}
      </Sheet>
      <AlertDialog
        open={removing !== null}
        onOpenChange={(next) => !next && setRemoving(null)}
        title={t("discard")}
        description={removing ? t("discardConfirm", { label: removing.label }) : ""}
        confirmLabel={t("discard")}
        cancelLabel={common("cancel")}
        tone="destructive"
        onConfirm={() => {
          if (removing) void queue.discard(removing.id);
          setRemoving(null);
        }}
      />
    </div>
  );
}

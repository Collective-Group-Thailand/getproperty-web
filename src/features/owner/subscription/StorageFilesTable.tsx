"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { formatBytes, formatNumber } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { toast } from "@/ui/components/Toast";
import { Icon } from "@/ui/icons";
import { IconDelete } from "@/ui/icons/glyphs/delete";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconUndo } from "@/ui/icons/glyphs/undo";

/** One row as the server rendered it: the API's file plus its dates already formatted in Asia/Bangkok. */
export interface StorageFileRow {
  file: Schemas["StoredFileDto"];
  added: string;
  /** `retainUntil` or `purgeAfter`, formatted. */
  until: string | null;
}

/**
 * The largest files with multi-select (G1, D-285 / D-286): stored files can be deleted to reclaim space (all or
 * nothing, restorable until the purge), deleted ones restored. A file under a legal hold, evidence, a system file or
 * a live listing's photo is locked with its reason — its checkbox is disabled, nothing is worked around here; the
 * API refuses the same.
 */
export function StorageFilesTable({
  rows,
  mode,
  canManage,
  locale,
}: {
  rows: StorageFileRow[];
  mode: "active" | "deleted";
  canManage: boolean;
  locale: Locale;
}) {
  const t = useTranslations("owner.subscription.storage");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const restore = useApiAction<Schemas["StoredFilesResultDto"]>();
  const selectable = rows.filter((row) => canManage && (mode === "deleted" || row.file.deletable));
  const chosen = rows.filter((row) => selected.has(row.file.id));
  const chosenBytes = chosen.reduce((sum, row) => sum + Number(row.file.bytes), 0);
  const allChosen = selectable.length > 0 && selectable.every((row) => selected.has(row.file.id));
  const someChosen = chosen.length > 0 && !allChosen;
  const documentIds = chosen.map((row) => row.file.id);

  const toggle = (id: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      {canManage && selectable.length > 0 ? (
        <div
          className="bg-bg-subtle rounded-card flex flex-wrap items-center justify-between gap-3 px-3 py-2"
          data-testid="storage-bulk"
        >
          <Checkbox
            label={t("files.selectAll")}
            checked={allChosen ? true : someChosen ? "indeterminate" : false}
            onCheckedChange={(on) =>
              setSelected(on === true ? new Set(selectable.map((row) => row.file.id)) : new Set())
            }
            data-testid="storage-select-all"
          />
          <span className="flex flex-wrap items-center gap-3">
            {chosen.length ? (
              <span className="text-muted text-sm tabular-nums" data-testid="storage-selected">
                {t("files.selected", {
                  count: formatNumber(chosen.length, locale),
                  bytes: formatBytes(chosenBytes, locale),
                })}
              </span>
            ) : null}
            {mode === "active" ? (
              <ConfirmAction
                label={t("files.delete")}
                icon={IconDelete}
                variant="secondary"
                tone="destructive"
                size="sm"
                disabled={chosen.length === 0}
                testId="storage-delete"
                title={t("files.deleteTitle", {
                  count: formatNumber(chosen.length, locale),
                  bytes: formatBytes(chosenBytes, locale),
                })}
                description={
                  <span className="flex flex-col gap-2">
                    <span>{t("files.deleteBody")}</span>
                    <span className="text-muted text-sm">
                      {chosen.map((row) => row.file.title ?? t("files.untitled")).join(", ")}
                    </span>
                  </span>
                }
                confirmLabel={t("files.delete")}
                successMessage={t("files.deleted")}
                onConfirm={() =>
                  unwrap(browserApi().POST("/v1/owner/storage/files/actions/delete", { body: { documentIds } }))
                }
                onDone={() => setSelected(new Set())}
              />
            ) : (
              <Button
                variant="secondary"
                size="sm"
                iconStart={IconUndo}
                disabled={chosen.length === 0}
                loading={restore.busy}
                onClick={() =>
                  restore.run(
                    () =>
                      unwrap(browserApi().POST("/v1/owner/storage/files/actions/restore", { body: { documentIds } })),
                    () => {
                      setSelected(new Set());
                      toast.success(t("files.restored"));
                    },
                  )
                }
                data-testid="storage-restore"
              >
                {t("files.restore")}
              </Button>
            )}
          </span>
        </div>
      ) : null}
      <ProblemNotice error={restore.error} />

      <SimpleTable
        caption={t("files.title")}
        testId="storage-files"
        minWidth="40rem"
        columns={[
          { key: "file", header: t("files.columns.file") },
          { key: "size", header: t("files.columns.size"), align: "end" },
          { key: "added", header: t("files.columns.added") },
          { key: "status", header: t("files.columns.status") },
        ]}
        rows={rows.map(({ file, added, until }) => {
          const title = file.title ?? t("files.untitled");
          const canSelect = canManage && (mode === "deleted" || file.deletable);
          return {
            key: file.id,
            testId: "storage-file-row",
            data: { id: file.id, held: file.held, deletable: file.deletable, reason: file.notDeletableReason },
            cells: {
              file: (
                <span className="flex items-start gap-3">
                  {canManage ? (
                    <Checkbox
                      label={<span className="sr-only">{t("files.select", { name: title })}</span>}
                      checked={selected.has(file.id)}
                      disabled={!canSelect}
                      onCheckedChange={(on) => toggle(file.id, on === true)}
                      data-testid="storage-file-select"
                    />
                  ) : null}
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium break-words">{title}</span>
                    <span className="text-muted text-xs">{t(`category.${file.category}`)}</span>
                  </span>
                </span>
              ),
              size: formatBytes(file.bytes, locale),
              added,
              status:
                mode === "deleted" ? (
                  <span className="text-muted text-sm">{until ? t("files.purgeOn", { date: until }) : "—"}</span>
                ) : file.notDeletableReason ? (
                  <span className="flex flex-col gap-0.5 text-sm" data-testid="storage-file-locked">
                    <span className="flex items-center gap-1 font-medium">
                      <Icon icon={IconLock} className="text-muted shrink-0" />
                      {t(`files.reason.${file.notDeletableReason}`)}
                    </span>
                    {file.held ? (
                      <span className="text-muted text-xs">
                        {until ? t("files.heldUntil", { date: until }) : t("files.heldOpen")}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-sm">{t("files.deletable")}</span>
                ),
            },
          };
        })}
      />
    </div>
  );
}

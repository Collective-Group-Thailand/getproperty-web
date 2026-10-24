"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Stepper } from "@/ui/components/Stepper";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconDownload } from "@/ui/icons/glyphs/download";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";

import { uploadOwnerFile, whenScanned } from "../shared/upload";
import { ProblemNotice, useApiAction, useIdempotencyKey } from "@/features/shared/console/useApiAction";

type Step = "upload" | "preview" | "done";
const STEPS: Step[] = ["upload", "preview", "done"];
const ACTION_TONE: Record<Schemas["ImportAction"], "success" | "info" | "neutral" | "danger"> = {
  create: "success",
  update: "info",
  unchanged: "neutral",
  error: "danger",
};

/**
 * Units from Excel (F2 2.1, D-170): download the template → upload the filled file (presign → PUT →
 * complete) → `preview` validates every row and answers the plan (create / update / unchanged / error,
 * floors to create) → `commit` writes exactly that plan (`previewToken`, Idempotency-Key) or nothing.
 * Rows with errors must be fixed in the file and uploaded again; nothing here edits the plan.
 */
export function UnitImport({
  building,
  boardHref,
}: {
  building: Pick<Schemas["BuildingDto"], "id" | "name">;
  boardHref: string;
}) {
  const t = useTranslations("owner.buildings.import");
  const locale = useLocale() as Locale;
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [createFloors, setCreateFloors] = useState(false);
  const [preview, setPreview] = useState<Schemas["UnitImportPreviewDto"] | null>(null);
  const [result, setResult] = useState<Schemas["UnitImportPreviewDto"] | null>(null);
  const action = useApiAction({ refresh: false });
  const commitKey = useIdempotencyKey();

  const runPreview = (chosen: File, floors: boolean) =>
    action.run(
      async () => {
        const uploaded = await uploadOwnerFile(chosen, {
          kind: "other",
          scopeType: "building",
          scopeId: building.id,
          title: chosen.name,
        });
        return whenScanned(() =>
          unwrap(
            browserApi().POST("/v1/owner/buildings/{buildingId}/unit-imports/actions/preview", {
              params: { path: { buildingId: building.id } },
              body: { fileId: uploaded.id, createFloors: floors },
            }),
          ),
        );
      },
      (answer) => {
        setPreview(answer as Schemas["UnitImportPreviewDto"]);
        commitKey.renew();
        setStep("preview");
      },
    );

  return (
    <div className="flex flex-col gap-5" data-testid="unit-import" data-step={step}>
      <Stepper
        steps={STEPS.map((id) => ({ id, label: t(`step.${id}`) }))}
        current={STEPS.indexOf(step)}
        label={t("steps")}
        progressText={t("progress", { step: STEPS.indexOf(step) + 1, total: STEPS.length })}
      />

      {step === "upload" ? (
        <section className="flex flex-col gap-4">
          <Callout tone="info" title={t("templateTitle")}>
            <p>{t("templateBody")}</p>
            <Button asChild variant="secondary" size="sm" iconStart={IconDownload} className="mt-2">
              <a href={`/bff/v1/owner/buildings/${building.id}/unit-imports/template`} data-testid="download-template">
                {t("downloadTemplate")}
              </a>
            </Button>
          </Callout>
          <FileDropzone
            label={file ? t("chosen", { name: file.name }) : t("dropLabel")}
            hint={t("dropHint")}
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            maxBytes={5 * 1024 * 1024}
            tooLargeText={t("tooLarge")}
            chooseText={t("choose")}
            onFiles={(files) => setFile(files[0] ?? null)}
            data-testid="import-file"
          />
          <Checkbox
            checked={createFloors}
            onCheckedChange={(checked) => setCreateFloors(checked === true)}
            label={t("createFloors")}
            description={t("createFloorsHint")}
          />
          <ProblemNotice error={action.error} />
          <div className="flex justify-end">
            <Button
              disabled={!file}
              loading={action.busy}
              onClick={() => file && void runPreview(file, createFloors)}
              data-testid="import-preview"
            >
              {t("check")}
            </Button>
          </div>
        </section>
      ) : null}

      {step === "preview" && preview ? (
        <section className="flex flex-col gap-4" aria-labelledby="import-plan">
          <h2 id="import-plan" className="text-lg font-semibold">
            {t("planTitle", { building: building.name })}
          </h2>
          <div className="flex flex-wrap gap-2" data-testid="import-summary">
            <Badge tone="success">{t("summary.create", { count: preview.summary.create })}</Badge>
            <Badge tone="info">{t("summary.update", { count: preview.summary.update })}</Badge>
            <Badge tone="neutral">{t("summary.unchanged", { count: preview.summary.unchanged })}</Badge>
            {preview.summary.error > 0 ? (
              <Badge tone="danger">{t("summary.error", { count: preview.summary.error })}</Badge>
            ) : null}
            {preview.summary.floorsToCreate.length > 0 ? (
              <Badge tone="warning">{t("summary.floors", { floors: preview.summary.floorsToCreate.join(", ") })}</Badge>
            ) : null}
          </div>
          {preview.summary.error > 0 ? (
            <Callout tone="danger" title={t("errorsTitle")}>
              {t("errorsBody")}
            </Callout>
          ) : null}
          <div className="border-border bg-surface rounded-card relative max-h-[28rem] overflow-auto border">
            <table className="w-full text-sm" data-testid="import-rows">
              <caption className="sr-only">{t("rowsCaption")}</caption>
              <thead className="bg-bg-subtle text-muted sticky top-0">
                <tr>
                  {(["row", "unitNo", "floor", "type", "rent", "action", "errors"] as const).map((column) => (
                    <th key={column} scope="col" className="px-3 py-2 text-start font-medium whitespace-nowrap">
                      {t(`column.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr
                    key={row.row}
                    className="border-border border-t"
                    data-testid="import-row"
                    data-action={row.action}
                  >
                    <td className="px-3 py-2 tabular-nums">{row.row}</td>
                    <td className="px-3 py-2 font-mono">{row.unitNo}</td>
                    <td className="px-3 py-2">
                      {row.floorLevel ?? "—"}
                      {row.createsFloor ? <span className="text-muted ms-1 text-xs">{t("newFloor")}</span> : null}
                    </td>
                    <td className="px-3 py-2">{row.type}</td>
                    <td className="px-3 py-2 tabular-nums">{row.baseRent ? formatTHB(row.baseRent, locale) : "—"}</td>
                    <td className="px-3 py-2">
                      <Badge tone={ACTION_TONE[row.action]} size="sm">
                        {t(`action.${row.action}`)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {row.errors.length ? (
                        <ul className="flex flex-col gap-0.5">
                          {row.errors.map((error) => (
                            <li key={`${error.column}-${error.code}`}>
                              <span className="font-mono text-xs">{error.column}</span> — {error.message}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ProblemNotice error={action.error} />
          <div className="flex flex-wrap justify-between gap-2">
            <Button
              variant="secondary"
              iconStart={IconRefresh}
              onClick={() => {
                action.reset();
                setPreview(null);
                setStep("upload");
              }}
              data-testid="import-again"
            >
              {t("uploadAgain")}
            </Button>
            <Button
              disabled={preview.summary.error > 0 || preview.summary.create + preview.summary.update === 0}
              loading={action.busy}
              onClick={() =>
                void action.run(
                  () =>
                    unwrap(
                      browserApi().POST("/v1/owner/buildings/{buildingId}/unit-imports/actions/commit", {
                        params: { path: { buildingId: building.id }, header: { "Idempotency-Key": commitKey.key } },
                        body: { fileId: preview.fileId, previewToken: preview.previewToken, createFloors },
                      }),
                    ),
                  (answer) => {
                    setResult(answer as Schemas["UnitImportPreviewDto"]);
                    setStep("done");
                  },
                )
              }
              data-testid="import-commit"
            >
              {t("commit", { count: preview.summary.create + preview.summary.update })}
            </Button>
          </div>
        </section>
      ) : null}

      {step === "done" && result ? (
        <Callout tone="success" title={t("doneTitle")} icon={IconCheckCircle}>
          <p data-testid="import-done">
            {t("doneBody", { created: result.summary.create, updated: result.summary.update })}
          </p>
          <Button asChild size="sm" className="mt-2">
            <a href={boardHref}>{t("openBoard")}</a>
          </Button>
        </Callout>
      ) : null}
    </div>
  );
}

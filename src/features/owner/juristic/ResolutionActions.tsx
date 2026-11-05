"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { DateField } from "@/features/shared/console/DateField";
import { FormDialog, invalidField, text } from "@/features/shared/console/FormDialog";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconDelete } from "@/ui/icons/glyphs/delete";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconUpload } from "@/ui/icons/glyphs/upload";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { ownerPath } from "../shared/links";
import { uploadOwnerFile } from "../shared/upload";

type Resolution = Schemas["ResolutionDto"];
const MEETING_KINDS: Schemas["MeetingKind"][] = ["agm", "egm", "committee"];
const DOCUMENT_KINDS: Schemas["ResolutionDocumentKind"][] = ["minutes", "attachment", "notice"];

function ResolutionFields({
  errors,
  resolution,
  buildings,
}: {
  errors: Record<string, string>;
  resolution?: Resolution;
  buildings?: { id: string; name: string }[];
}) {
  const t = useTranslations("owner.juristic.resolution");
  return (
    <>
      {buildings ? (
        <Field label={t("building")} hint={t("buildingHint")} required error={errors.buildingId}>
          <NativeSelect
            name="buildingId"
            required
            defaultValue={buildings.length === 1 ? buildings[0]!.id : undefined}
            placeholder={buildings.length === 1 ? undefined : t("buildingPick")}
            options={buildings.map((building) => ({ value: building.id, label: building.name }))}
            data-testid="resolution-building"
          />
        </Field>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("meetingKind")} required error={errors.meetingKind}>
          <NativeSelect
            name="meetingKind"
            defaultValue={resolution?.meetingKind ?? "agm"}
            options={MEETING_KINDS.map((value) => ({ value, label: t(`meetingKindName.${value}`) }))}
          />
        </Field>
        <Field label={t("meetingDate")} required error={errors.meetingDate}>
          <DateField name="meetingDate" defaultValue={resolution?.meetingDate ?? null} />
        </Field>
        <Field label={t("number")} hint={t("numberHint")} required error={errors.number}>
          <Input
            name="number"
            required
            maxLength={50}
            defaultValue={resolution?.number}
            data-testid="resolution-number"
          />
        </Field>
      </div>
      <Field label={t("titleLabel")} required error={errors.title}>
        <Input name="title" required maxLength={300} defaultValue={resolution?.title} data-testid="resolution-title" />
      </Field>
      <Field label={t("text")} hint={t("textHint")} required error={errors.text}>
        <Textarea
          name="text"
          required
          rows={6}
          maxLength={20000}
          defaultValue={resolution?.text}
          data-testid="resolution-text"
        />
      </Field>
      <Field label={t("votes")} hint={t("votesHint")} error={errors.votesSummary}>
        <Input name="votesSummary" maxLength={2000} defaultValue={resolution?.votesSummary ?? ""} />
      </Field>
    </>
  );
}

function fields(data: FormData) {
  return {
    meetingKind: (text(data, "meetingKind") ?? "agm") as Schemas["MeetingKind"],
    meetingDate: text(data, "meetingDate") ?? "",
    number: text(data, "number") ?? "",
    title: text(data, "title") ?? "",
    text: text(data, "text") ?? "",
  };
}

/** Records a resolution as the minutes word it (draft until adopted, D-304). */
export function NewResolutionButton({
  buildings,
  defaultOpen,
}: {
  buildings: { id: string; name: string }[];
  defaultOpen?: boolean;
}) {
  const t = useTranslations("owner.juristic.resolution");
  const locale = useLocale() as Locale;
  return (
    <FormDialog
      label={t("new")}
      icon={IconAdd}
      variant="primary"
      testId="resolution-new"
      title={t("newTitle")}
      description={t("newHint")}
      submitLabel={t("create")}
      successMessage={t("created")}
      size_="lg"
      defaultOpen={defaultOpen}
      disabled={buildings.length === 0}
      onSubmit={(data) => {
        const buildingId = text(data, "buildingId");
        if (!buildingId) invalidField("buildingId", t("buildingRequired"));
        const votes = text(data, "votesSummary");
        return unwrap(
          browserApi().POST("/v1/owner/juristic/resolutions", {
            body: { buildingId, ...fields(data), ...(votes ? { votesSummary: votes } : {}) },
          }),
        );
      }}
      onDone={(result) =>
        window.location.assign(ownerPath(locale, `/juristic/resolutions/${(result as Resolution).id}`))
      }
    >
      {(errors) => <ResolutionFields errors={errors} buildings={buildings} />}
    </FormDialog>
  );
}

/** Edits a draft (`PATCH` with the version read; an adopted resolution is never edited — void and record anew). */
export function EditResolutionButton({ resolution }: { resolution: Resolution }) {
  const t = useTranslations("owner.juristic.resolution");
  return (
    <FormDialog
      label={t("edit")}
      icon={IconEdit}
      testId="resolution-edit"
      title={t("editTitle", { number: resolution.number })}
      submitLabel={t("save")}
      successMessage={t("saved")}
      size_="lg"
      onSubmit={(data) =>
        unwrap(
          browserApi().PATCH("/v1/owner/juristic/resolutions/{resolutionId}", {
            params: { path: { resolutionId: resolution.id } },
            body: { ...fields(data), votesSummary: text(data, "votesSummary") ?? null, version: resolution.version },
          }),
        )
      }
    >
      {(errors) => <ResolutionFields errors={errors} resolution={resolution} />}
    </FormDialog>
  );
}

/** Adopts a draft (committee / owner, Idempotency-Key): from now on budgets and rates may name it. */
export function AdoptResolutionButton({ resolution }: { resolution: Resolution }) {
  const t = useTranslations("owner.juristic.resolution");
  return (
    <ConfirmAction
      label={t("adopt")}
      icon={IconCheckCircle}
      block
      testId="resolution-adopt"
      title={t("adoptTitle", { number: resolution.number })}
      description={t("adoptBody", { title: resolution.title })}
      confirmLabel={t("adopt")}
      phrase={resolution.number}
      successMessage={t("adopted")}
      onConfirm={(idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/resolutions/{resolutionId}/actions/adopt", {
            params: { path: { resolutionId: resolution.id }, header: { "Idempotency-Key": idempotencyKey } },
          }),
        )
      }
    />
  );
}

/** Voids a resolution with a reason; the API refuses one an approved budget or a rate in force relies on. */
export function VoidResolutionButton({ resolution }: { resolution: Resolution }) {
  const t = useTranslations("owner.juristic.resolution");
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label={t("void")}
      icon={IconXCircle}
      variant="secondary"
      tone="destructive"
      block
      testId="resolution-void"
      title={t("voidTitle", { number: resolution.number })}
      description={t("voidBody")}
      confirmLabel={t("void")}
      ready={reason.trim().length >= 3}
      successMessage={t("voided")}
      onConfirm={() =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/resolutions/{resolutionId}/actions/void", {
            params: { path: { resolutionId: resolution.id } },
            body: { reason: reason.trim() },
          }),
        )
      }
    >
      <Field label={t("voidReason")} required>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          maxLength={500}
          data-testid="resolution-void-reason"
        />
      </Field>
    </ConfirmAction>
  );
}

/** Attaches the minutes, an attachment or the meeting notice (uploaded first through `files/presign`). */
export function AttachDocumentButton({ resolution }: { resolution: Resolution }) {
  const t = useTranslations("owner.juristic.resolution");
  const [file, setFile] = useState<File | null>(null);
  return (
    <FormDialog
      label={t("attach")}
      icon={IconUpload}
      testId="resolution-attach"
      title={t("attachTitle", { number: resolution.number })}
      description={t("attachHint")}
      submitLabel={t("attachSubmit")}
      successMessage={t("attached")}
      onSubmit={async (data) => {
        if (!file) invalidField("documentId", t("attachRequired"));
        const kind = (text(data, "kind") ?? "minutes") as Schemas["ResolutionDocumentKind"];
        const stored = await uploadOwnerFile(file, {
          kind: "other",
          scopeType: "building",
          scopeId: resolution.buildingId,
          title: t("documentTitle", { kind: t(`documentKind.${kind}`), number: resolution.number }),
        });
        return unwrap(
          browserApi().POST("/v1/owner/juristic/resolutions/{resolutionId}/documents", {
            params: { path: { resolutionId: resolution.id } },
            body: { documentId: stored.id, kind },
          }),
        );
      }}
      onDone={() => setFile(null)}
    >
      {(errors) => (
        <>
          <Field label={t("documentKindLabel")} error={errors.kind}>
            <NativeSelect
              name="kind"
              options={DOCUMENT_KINDS.map((value) => ({ value, label: t(`documentKind.${value}`) }))}
            />
          </Field>
          <Field label={t("file")} required error={errors.documentId}>
            <div className="flex flex-col gap-2">
              <FileDropzone
                label={t("fileDrop")}
                hint={t("fileTypes")}
                accept="application/pdf,image/jpeg,image/png"
                maxBytes={20 * 1024 * 1024}
                tooLargeText={t("fileTooLarge")}
                chooseText={t("fileChoose")}
                onFiles={(files) => setFile(files[0] ?? null)}
                data-testid="resolution-file"
              />
              {file ? <p className="m-0 text-sm">{t("fileChosen", { name: file.name })}</p> : null}
            </div>
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/** Removes an attachment from a draft. */
export function RemoveDocumentButton({ resolution, documentId }: { resolution: Resolution; documentId: string }) {
  const t = useTranslations("owner.juristic.resolution");
  return (
    <ConfirmAction
      label={t("removeDocument")}
      icon={IconDelete}
      variant="ghost"
      size="sm"
      tone="destructive"
      title={t("removeDocumentTitle")}
      description={t("removeDocumentBody", { number: resolution.number })}
      confirmLabel={t("removeDocument")}
      successMessage={t("documentRemoved")}
      onConfirm={() =>
        unwrap(
          browserApi().DELETE("/v1/owner/juristic/resolutions/{resolutionId}/documents/{documentId}", {
            params: { path: { resolutionId: resolution.id, documentId } },
          }),
        )
      }
    />
  );
}

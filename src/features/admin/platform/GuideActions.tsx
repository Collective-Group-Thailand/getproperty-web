"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconHide } from "@/ui/icons/glyphs/hide";

type Guide = Schemas["AdminGuideDto"];
const CATEGORIES: Schemas["GuideCategory"][] = ["landlord", "law", "tax", "operations"];
const AUDIENCES: Schemas["GuideAudience"][] = ["landlord", "apartment"];

/** The JSON of a body field; text that is not JSON is a field error next to it (the API is not asked). */
function json(data: FormData, name: string, message: string): unknown {
  const raw = String(data.get(name) ?? "").trim();
  try {
    return JSON.parse(raw === "" ? "[]" : raw) as unknown;
  } catch {
    throw new ApiError(422, {
      code: "validation.failed",
      title: message,
      detail: message,
      errors: [{ path: name, code: "json", message }],
    });
  }
}

/** `POST /v1/admin/guides` — a draft with its first section; the body is edited on the guide's page. */
export function NewGuide() {
  const t = useTranslations("admin.platform.guides");
  const router = useRouter();
  return (
    <FormDialog
      label={t("new")}
      icon={IconAdd}
      testId="new-guide"
      title={t("newTitle")}
      description={t("newHint")}
      submitLabel={t("saveDraft")}
      size_="lg"
      successMessage={t("draftSaved")}
      onDone={(created) => router.push(`/guides/${(created as Guide).id}`)}
      onSubmit={(data) => {
        // today in Bangkok: the draft's first published and reviewed day (the editor sets them later)
        const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
        const title = text(data, "title") ?? "";
        const summary = text(data, "summary") ?? "";
        return unwrap(
          browserApi().POST("/v1/admin/guides", {
            body: {
              slug: text(data, "slug") ?? "",
              locale: (text(data, "locale") as Schemas["Language"]) ?? "th",
              category: (text(data, "category") as Schemas["GuideCategory"]) ?? "landlord",
              audience: (text(data, "audience") as Schemas["GuideAudience"]) ?? "landlord",
              title,
              summary,
              answer: text(data, "answer") ?? "",
              readMinutes: Number(text(data, "readMinutes") ?? "5"),
              general: data.get("general") === "on",
              reviewed: today,
              published: today,
              sections: [{ id: "intro", heading: title, blocks: [{ p: summary }] }],
              faq: [],
              sources: [],
            },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("field.slug")} hint={t("field.slugHint")} required error={errors.slug}>
              <Input name="slug" required pattern="[a-z0-9-]{1,80}" className="font-mono" data-testid="guide-slug" />
            </Field>
            <Field label={t("col.locale")} error={errors.locale}>
              <NativeSelect
                name="locale"
                defaultValue="th"
                options={(["th", "en"] as const).map((value) => ({ value, label: t(`locale.${value}`) }))}
              />
            </Field>
            <Field label={t("col.category")} error={errors.category}>
              <NativeSelect
                name="category"
                defaultValue="landlord"
                options={CATEGORIES.map((value) => ({ value, label: t(`category.${value}`) }))}
              />
            </Field>
            <Field label={t("field.audience")} error={errors.audience}>
              <NativeSelect
                name="audience"
                defaultValue="landlord"
                options={AUDIENCES.map((value) => ({ value, label: t(`audience.${value}`) }))}
              />
            </Field>
          </div>
          <TextFields errors={errors} />
        </>
      )}
    </FormDialog>
  );
}

function TextFields({ errors, guide }: { errors: Record<string, string>; guide?: Guide }) {
  const t = useTranslations("admin.platform.guides");
  return (
    <>
      <Field label={t("field.title")} required error={errors.title}>
        <Input name="title" required maxLength={120} defaultValue={guide?.title} data-testid="guide-title" />
      </Field>
      <Field label={t("field.summary")} hint={t("field.summaryHint")} required error={errors.summary}>
        <Textarea
          name="summary"
          rows={2}
          required
          maxLength={200}
          defaultValue={guide?.summary}
          data-testid="guide-summary"
        />
      </Field>
      <Field label={t("field.answer")} hint={t("field.answerHint")} required error={errors.answer}>
        <Textarea
          name="answer"
          rows={4}
          required
          maxLength={600}
          defaultValue={guide?.answer}
          data-testid="guide-answer"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("field.readMinutes")} error={errors.readMinutes}>
          <Input name="readMinutes" type="number" min={1} max={60} defaultValue={guide?.readMinutes ?? 5} />
        </Field>
        <div className="flex items-end pb-2">
          <Checkbox name="general" defaultChecked={guide?.general ?? false} label={t("field.generalLabel")} />
        </div>
      </div>
    </>
  );
}

/** `PATCH /v1/admin/guides/{id}` (If-Match) — the text and facts; a published guide shows the change at once. */
export function EditGuide({ guide, etag }: { guide: Guide; etag: string | null }) {
  const t = useTranslations("admin.platform.guides");
  return (
    <FormDialog
      label={t("edit")}
      icon={IconEdit}
      variant="secondary"
      size="sm"
      testId="edit-guide"
      title={t("editTitle")}
      description={guide.state === "published" ? t("editLive") : undefined}
      submitLabel={t("save")}
      size_="lg"
      successMessage={t("saved")}
      onSubmit={(data) =>
        unwrap(
          browserApi().PATCH("/v1/admin/guides/{guideId}", {
            params: { path: { guideId: guide.id }, header: { "If-Match": etag ?? "*" } },
            body: {
              title: text(data, "title"),
              summary: text(data, "summary"),
              answer: text(data, "answer"),
              readMinutes: Number(text(data, "readMinutes") ?? guide.readMinutes),
              general: data.get("general") === "on",
              category: text(data, "category") as Schemas["GuideCategory"] | undefined,
              audience: text(data, "audience") as Schemas["GuideAudience"] | undefined,
              reviewed: text(data, "reviewed"),
            },
          }),
        )
      }
    >
      {(errors) => (
        <>
          <TextFields errors={errors} guide={guide} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("col.category")} error={errors.category}>
              <NativeSelect
                name="category"
                defaultValue={guide.category}
                options={CATEGORIES.map((value) => ({ value, label: t(`category.${value}`) }))}
              />
            </Field>
            <Field label={t("field.audience")} error={errors.audience}>
              <NativeSelect
                name="audience"
                defaultValue={guide.audience}
                options={AUDIENCES.map((value) => ({ value, label: t(`audience.${value}`) }))}
              />
            </Field>
            <Field label={t("col.reviewed")} hint={t("field.reviewedHint")} error={errors.reviewed}>
              <Input name="reviewed" type="date" defaultValue={guide.reviewed} data-testid="guide-reviewed" />
            </Field>
          </div>
        </>
      )}
    </FormDialog>
  );
}

/** The body as the article JSON (sections of blocks, FAQ, sources); the API refuses what the page cannot draw. */
export function EditGuideContent({ guide, etag }: { guide: Guide; etag: string | null }) {
  const t = useTranslations("admin.platform.guides");
  return (
    <FormDialog
      label={t("editBody")}
      icon={IconEdit}
      variant="secondary"
      size="sm"
      testId="edit-guide-body"
      title={t("editBodyTitle")}
      description={t("editBodyHint")}
      submitLabel={t("save")}
      size_="lg"
      successMessage={t("saved")}
      onSubmit={(data) =>
        unwrap(
          browserApi().PATCH("/v1/admin/guides/{guideId}", {
            params: { path: { guideId: guide.id }, header: { "If-Match": etag ?? "*" } },
            body: {
              sections: json(data, "sections", t("invalidJson")) as Record<string, never>[],
              faq: json(data, "faq", t("invalidJson")) as Schemas["GuideFaqDto"][],
              sources: json(data, "sources", t("invalidJson")) as Schemas["GuideSourceDto"][],
            },
          }),
        )
      }
    >
      {(errors) => (
        <>
          <Field label={t("field.sections")} hint={t("field.sectionsHint")} error={errors.sections}>
            <Textarea
              name="sections"
              rows={14}
              defaultValue={JSON.stringify(guide.sections, null, 2)}
              className="font-mono text-sm"
              data-testid="guide-sections"
            />
          </Field>
          <Field label={t("field.faq")} error={errors.faq}>
            <Textarea
              name="faq"
              rows={6}
              defaultValue={JSON.stringify(guide.faq, null, 2)}
              className="font-mono text-sm"
            />
          </Field>
          <Field label={t("field.sources")} error={errors.sources}>
            <Textarea
              name="sources"
              rows={4}
              defaultValue={JSON.stringify(guide.sources, null, 2)}
              className="font-mono text-sm"
            />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/** A second platform user reviews and publishes (`guide.same_reviewer` for the last editor). */
export function PublishGuide({ guide }: { guide: Guide }) {
  const t = useTranslations("admin.platform.guides");
  return (
    <ConfirmAction
      label={t("publish")}
      icon={IconCheckCircle}
      testId="publish-guide"
      title={t("publishTitle")}
      description={t("publishBody", { title: guide.title })}
      confirmLabel={t("publish")}
      successMessage={t("published")}
      onConfirm={() =>
        unwrap(
          browserApi().POST("/v1/admin/guides/{guideId}/actions/publish", { params: { path: { guideId: guide.id } } }),
        )
      }
    />
  );
}

export function UnpublishGuide({ guide }: { guide: Guide }) {
  const t = useTranslations("admin.platform.guides");
  return (
    <ConfirmAction
      label={t("unpublish")}
      icon={IconHide}
      variant="secondary"
      testId="unpublish-guide"
      title={t("unpublishTitle")}
      description={t("unpublishBody", { title: guide.title })}
      confirmLabel={t("unpublish")}
      tone="destructive"
      successMessage={t("unpublished")}
      onConfirm={() =>
        unwrap(
          browserApi().POST("/v1/admin/guides/{guideId}/actions/unpublish", {
            params: { path: { guideId: guide.id } },
          }),
        )
      }
    />
  );
}

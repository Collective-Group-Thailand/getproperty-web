"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { BRAND_NAME } from "@/ui/brand/config";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { LazyDialog } from "@/ui/components/overlays";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconMail } from "@/ui/icons/glyphs/mail";
import { IconShow } from "@/ui/icons/glyphs/show";

const FORMATS: Schemas["TemplateFormat"][] = ["handlebars_text", "plain", "mjml", "line_flex_json"];

/** `POST /v1/admin/notification-templates/versions` — a draft version of a template (key × channel × audience). */
export function NewTemplateVersion({
  template,
  base,
}: {
  template: Schemas["NotificationTemplateDto"];
  base: Schemas["TemplateVersionDto"] | null;
}) {
  const t = useTranslations("admin.platform.templates");
  return (
    <FormDialog
      label={t("newVersion")}
      icon={IconAdd}
      testId="new-template-version"
      title={t("newVersionTitle", { key: template.key })}
      description={t("newVersionHint")}
      submitLabel={t("saveDraft")}
      size_="lg"
      successMessage={t("draftSaved")}
      onSubmit={(data) => {
        let sampleData: Record<string, unknown> | undefined;
        const raw = text(data, "sampleData");
        if (raw) sampleData = JSON.parse(raw) as Record<string, unknown>;
        return unwrap(
          browserApi().POST("/v1/admin/notification-templates/versions", {
            body: {
              key: template.key,
              audience: template.audience,
              channel: template.channel,
              description: template.description,
              language: (text(data, "language") as Schemas["Language"]) ?? "th",
              format: (text(data, "format") as Schemas["TemplateFormat"]) ?? "handlebars_text",
              subject: text(data, "subject") ?? null,
              body: String(data.get("body") ?? ""),
              sampleData: sampleData as Record<string, never> | undefined,
            },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("language")} error={errors.language}>
              <NativeSelect
                name="language"
                defaultValue={base?.language ?? "th"}
                options={[
                  { value: "th", label: "ไทย" },
                  { value: "en", label: "English" },
                ]}
              />
            </Field>
            <Field label={t("format")} error={errors.format}>
              <NativeSelect
                name="format"
                defaultValue={base?.format ?? "handlebars_text"}
                options={FORMATS.map((value) => ({ value, label: value }))}
              />
            </Field>
          </div>
          <Field label={t("subject")} error={errors.subject}>
            <Input name="subject" defaultValue={base?.subject ?? ""} />
          </Field>
          <Field label={t("body")} hint={t("bodyHint")} required error={errors.body}>
            <Textarea
              name="body"
              rows={6}
              required
              defaultValue={base?.body ?? ""}
              className="font-mono text-sm"
              data-testid="template-body"
            />
          </Field>
          <Field label={t("sampleData")} hint={t("sampleDataHint")} error={errors.sampleData}>
            <Textarea
              name="sampleData"
              rows={4}
              defaultValue={base ? JSON.stringify(base.sampleData, null, 2) : ""}
              className="font-mono text-sm"
            />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/** Renders a version with its sample data, or data typed here (`…/actions/preview`), as the recipient would see it. */
export function PreviewTemplate({ version }: { version: Schemas["TemplateVersionDto"] }) {
  const t = useTranslations("admin.platform.templates");
  const common = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(() => JSON.stringify(version.sampleData, null, 2));
  const [result, setResult] = useState<Schemas["RenderedMessageDto"] | null>(null);
  const [invalid, setInvalid] = useState(false);
  const action = useApiAction<Schemas["RenderedMessageDto"]>({ refresh: false });
  const render = () => {
    let parsed: Record<string, never>;
    try {
      parsed = JSON.parse(data) as Record<string, never>;
      setInvalid(false);
    } catch {
      setInvalid(true);
      return;
    }
    void action.run(
      () =>
        unwrap(
          browserApi().POST("/v1/admin/notification-templates/versions/{versionId}/actions/preview", {
            params: { path: { versionId: version.id } },
            body: { data: parsed },
          }),
        ),
      (rendered) => setResult(rendered),
    );
  };
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        iconStart={IconShow}
        onClick={() => {
          setOpen(true);
          render();
        }}
        data-testid="preview-template"
      >
        {t("preview")}
      </Button>
      <LazyDialog
        open={open}
        onOpenChange={setOpen}
        title={t("previewTitle", { version: version.version })}
        size="lg"
        closeLabel={common("close")}
        footer={
          <Button variant="secondary" onClick={render} loading={action.busy}>
            {t("render")}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label={t("sampleData")} error={invalid ? t("invalidJson") : undefined}>
            <Textarea
              rows={5}
              value={data}
              onChange={(event) => setData(event.target.value)}
              className="font-mono text-sm"
            />
          </Field>
          <ProblemNotice error={action.error} />
          {result ? (
            <div
              className="border-border rounded-card flex flex-col gap-2 border p-4"
              data-testid="template-preview"
              aria-live="polite"
            >
              {result.subject ? (
                <>
                  {/* An e-mail carries the hosted PNG logo (clients drop SVG); the preview shows it the same way. */}
                  <p className="border-border -mx-4 -mt-4 mb-1 border-b px-4 py-3" data-testid="template-preview-brand">
                    {/* eslint-disable-next-line @next/next/no-img-element -- the e-mail's own static logo file, as the recipient's client loads it */}
                    <img src="/brand/getproperty-logo.png" alt={BRAND_NAME} width={131} height={28} />
                  </p>
                  <p className="font-semibold">{result.subject}</p>
                </>
              ) : null}
              <p className="whitespace-pre-wrap">{result.text}</p>
            </div>
          ) : null}
        </div>
      </LazyDialog>
    </>
  );
}

/** Publish a draft (the published version of the same language retires) or send a test to yourself. */
export function TemplateVersionActions({
  template,
  version,
}: {
  template: Schemas["NotificationTemplateDto"];
  version: Schemas["TemplateVersionDto"];
}) {
  const t = useTranslations("admin.platform.templates");
  return (
    <div className="flex flex-wrap gap-1">
      <PreviewTemplate version={version} />
      {version.state === "draft" ? (
        <ConfirmAction
          label={t("publish")}
          icon={IconCheckCircle}
          size="sm"
          testId="publish-template"
          title={t("publishTitle", { key: template.key, version: version.version })}
          description={t("publishBody", { language: version.language })}
          confirmLabel={t("publish")}
          onConfirm={() =>
            unwrap(
              browserApi().POST("/v1/admin/notification-templates/versions/{versionId}/actions/publish", {
                params: { path: { versionId: version.id } },
              }),
            )
          }
          successMessage={t("published")}
        />
      ) : null}
      {version.state === "published" ? (
        <ConfirmAction
          label={t("testSend")}
          icon={IconMail}
          size="sm"
          variant="secondary"
          testId="test-send"
          title={t("testSendTitle", { key: template.key })}
          description={t("testSendBody", { channel: template.channel })}
          confirmLabel={t("testSend")}
          onConfirm={() =>
            unwrap(
              browserApi().POST("/v1/admin/notification-templates/{templateId}/actions/test-send", {
                params: { path: { templateId: template.id } },
                body: {},
              }),
            )
          }
          successMessage={t("testSent")}
        />
      ) : null}
    </div>
  );
}

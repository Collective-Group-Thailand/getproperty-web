import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { TEMPLATE_VERSION_STATUS } from "@/domain/status/templateVersion";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Card, CardHeader } from "@/ui/components/Card";

import { section, type AdminContext } from "../shared/server";
import { NewTemplateVersion, TemplateVersionActions } from "./TemplateActions";

/** Notification templates (F5 5.2, B1.3): every template (key × channel × audience) with its published version. */
export async function TemplatesView({ context }: { context: AdminContext }) {
  const t = await getTranslations("admin.platform.templates");
  const templates = await section(unwrap(context.api.GET("/v1/admin/notification-templates")));
  return (
    <ConsolePage testId="templates">
      <PageHeader title={t("title")} description={t("description")} />
      {!templates.data ? (
        <SectionError error={templates.error} />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="template-table"
          minWidth="52rem"
          columns={[
            { key: "key", header: t("col.key") },
            { key: "channel", header: t("col.channel") },
            { key: "audience", header: t("col.audience") },
            { key: "published", header: t("col.published") },
            { key: "drafts", header: t("col.drafts") },
          ]}
          rows={templates.data.map((template) => {
            const published = template.versions.filter((version) => version.state === "published");
            const drafts = template.versions.filter((version) => version.state === "draft");
            return {
              key: template.id,
              testId: "template-row",
              data: { key: template.key },
              cells: {
                key: (
                  <a href={`/notification-templates/${template.id}`} className="flex flex-col hover:underline">
                    <span className="font-mono font-semibold">{template.key}</span>
                    <span className="text-muted text-xs">{template.description}</span>
                  </a>
                ),
                channel: t(`channel.${template.channel}`),
                audience: t(`audience.${template.audience}`),
                published: published.length ? published.map((v) => `v${v.version} (${v.language})`).join(", ") : "—",
                drafts: drafts.length ? (
                  <Badge size="sm" tone="warning">
                    {t("draftCount", { count: drafts.length })}
                  </Badge>
                ) : (
                  "—"
                ),
              },
            };
          })}
        />
      )}
    </ConsolePage>
  );
}

/** One template: its versions (draft, published, retired) with preview, publish, test send and a new draft. */
export async function TemplateDetail({ context, templateId }: { context: AdminContext; templateId: string }) {
  const t = await getTranslations("admin.platform.templates");
  const { api, locale } = context;
  const templates = await unwrap(api.GET("/v1/admin/notification-templates"));
  const template = templates.find((candidate) => candidate.id === templateId);
  if (!template) notFound();
  const versions = [...template.versions].sort((a, b) => b.version - a.version);
  return (
    <ConsolePage testId="template-detail">
      <PageHeader
        title={<span className="font-mono">{template.key}</span>}
        crumbs={[{ label: template.key }]}
        description={`${template.description} · ${t(`channel.${template.channel}`)} · ${t(`audience.${template.audience}`)}`}
        actions={<NewTemplateVersion template={template} base={versions[0] ?? null} />}
      />
      <div className="flex flex-col gap-4">
        {versions.map((version) => (
          <Card
            key={version.id}
            as="section"
            aria-labelledby={`tv-${version.id}`}
            data-testid="template-version"
            data-state={version.state}
          >
            <CardHeader
              title={
                <span id={`tv-${version.id}`} className="flex flex-wrap items-center gap-2">
                  {t("versionLabel", { version: version.version, language: version.language })}
                  <StatusBadgeOf map={TEMPLATE_VERSION_STATUS} value={version.state} size="sm" />
                </span>
              }
              description={
                version.publishedAt
                  ? t("publishedAt", { date: formatDateTime(version.publishedAt, locale) })
                  : version.format
              }
              action={<TemplateVersionActions template={template} version={version} />}
            />
            {version.subject ? <p className="font-semibold">{version.subject}</p> : null}
            <pre className="bg-bg-subtle rounded-control relative overflow-x-auto p-3 text-sm whitespace-pre-wrap">
              {version.body}
            </pre>
          </Card>
        ))}
      </div>
    </ConsolePage>
  );
}

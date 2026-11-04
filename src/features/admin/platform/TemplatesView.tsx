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
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { messageKey } from "@/i18n/keys";

import { section, type AdminContext } from "../shared/server";
import { NewTemplateVersion, TemplateVersionActions } from "./TemplateActions";

/** A template language as people read it ("ไทย", "English"); a code the catalogue does not name is shown as it is. */
async function languageName() {
  const names = await getTranslations("admin.platform.guides.locale");
  return (code: string) => (names.has(code) ? names(code as Parameters<typeof names>[0]) : code);
}

/** Notification templates (F5 5.2, B1.3): every template (key × channel × audience) with its published version. */
/** A template's name in words when the message files know its key; else null (the key shows, in mono). */
function templateName(t: Awaited<ReturnType<typeof getTranslations<"admin.platform.templates">>>, key: string) {
  const path = `name.${messageKey(key)}`;
  return t.has(path) ? t(path as Parameters<typeof t>[0]) : null;
}

export async function TemplatesView({ context }: { context: AdminContext }) {
  const t = await getTranslations("admin.platform.templates");
  const language = await languageName();
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
          stackOnPhones
          minWidth="52rem"
          columns={[
            { key: "key", header: t("col.key"), phone: "title" },
            { key: "channel", header: t("col.channel"), phone: "meta" },
            { key: "audience", header: t("col.audience"), phone: "meta" },
            { key: "published", header: t("col.published"), phone: "meta" },
            { key: "drafts", header: t("col.drafts"), phone: "status" },
          ]}
          rows={templates.data.map((template) => {
            const published = template.versions.filter((version) => version.state === "published");
            const drafts = template.versions.filter((version) => version.state === "draft");
            return {
              key: template.id,
              href: `/notification-templates/${template.id}`,
              testId: "template-row",
              data: { key: template.key },
              cells: {
                key: (
                  <span className="flex flex-col">
                    <span className="font-semibold">{templateName(t, template.key) ?? template.description}</span>
                    <span className="text-muted font-mono text-xs font-normal">{template.key}</span>
                  </span>
                ),
                channel: t(`channel.${template.channel}`),
                audience: t(`audience.${template.audience}`),
                published: published.length
                  ? published
                      .map((v) => t("versionLabel", { version: v.version, language: language(v.language) }))
                      .join(", ")
                  : "—",
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
  const language = await languageName();
  const { api, locale } = context;
  const templates = await unwrap(api.GET("/v1/admin/notification-templates"));
  const template = templates.find((candidate) => candidate.id === templateId);
  if (!template) notFound();
  const versions = [...template.versions].sort((a, b) => b.version - a.version);
  const published = versions.find((version) => version.state === "published") ?? null;
  return (
    <ConsolePage testId="template-detail">
      <PageHeader
        title={templateName(t, template.key) ?? template.key}
        crumbs={[{ label: template.key }]}
        description={`${t(`channel.${template.channel}`)} · ${t(`audience.${template.audience}`)} · ${template.key}`}
      />
      <DetailLayout
        panel={
          <ActionPanel
            title={t("panelTitle")}
            description={template.description}
            facts={[
              { key: "channel", label: t("col.channel"), value: t(`channel.${template.channel}`) },
              { key: "audience", label: t("col.audience"), value: t(`audience.${template.audience}`) },
              {
                key: "published",
                label: t("col.published"),
                value: published
                  ? t("versionLabel", { version: published.version, language: language(published.language) })
                  : "—",
              },
            ]}
            primary={<NewTemplateVersion template={template} base={versions[0] ?? null} />}
          />
        }
      >
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
                  {t("versionLabel", { version: version.version, language: language(version.language) })}
                  <StatusBadgeOf map={TEMPLATE_VERSION_STATUS} value={version.state} size="sm" />
                </span>
              }
              description={
                version.publishedAt
                  ? t("publishedAt", { date: formatDateTime(version.publishedAt, locale) })
                  : undefined
              }
              action={<TemplateVersionActions template={template} version={version} />}
            />
            {version.subject ? <p className="mb-2 font-semibold">{version.subject}</p> : null}
            <pre className="bg-bg-subtle rounded-control relative m-0 overflow-x-auto p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">
              {version.body}
            </pre>
          </Card>
        ))}
      </DetailLayout>
    </ConsolePage>
  );
}

import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { GUIDE_STATUS } from "@/domain/status/guide";
import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime } from "@/i18n/format";
import { unwrap, unwrapWithETag } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { section, type AdminContext } from "../shared/server";
import { EditGuide, EditGuideContent, NewGuide, PublishGuide, UnpublishGuide } from "./GuideActions";

type Guide = Schemas["AdminGuideDto"];

/** Guides of the public site (D-271): both languages of each, draft or published, reviewed when. */
export async function GuidesView({ context }: { context: AdminContext }) {
  const t = await getTranslations("admin.platform.guides");
  const { api, locale } = context;
  const guides = await section(unwrap(api.GET("/v1/admin/guides")));
  return (
    <ConsolePage testId="guides">
      <PageHeader title={t("title")} description={t("description")} actions={<NewGuide />} />
      {!guides.data ? (
        <SectionError error={guides.error} />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="guide-table"
          minWidth="48rem"
          columns={[
            { key: "title", header: t("col.title") },
            { key: "locale", header: t("col.locale") },
            { key: "category", header: t("col.category") },
            { key: "state", header: t("col.state") },
            { key: "reviewed", header: t("col.reviewed") },
          ]}
          rows={guides.data.map((guide) => ({
            key: guide.id,
            testId: "guide-row",
            data: { slug: guide.slug, locale: guide.locale },
            cells: {
              title: (
                <a href={`/guides/${guide.id}`} className="flex flex-col hover:underline">
                  <span className="font-semibold">{guide.title}</span>
                  <span className="text-muted font-mono text-xs">{guide.slug}</span>
                </a>
              ),
              locale: t(`locale.${guide.locale}`),
              category: t(`category.${guide.category}`),
              state: <StatusBadgeOf map={GUIDE_STATUS} value={guide.state} size="sm" />,
              reviewed: formatDate(guide.reviewed, locale),
            },
          }))}
        />
      )}
    </ConsolePage>
  );
}

/** One guide: what it says (title, summary, answer), its facts, its body, and who reviewed it. */
export async function GuideDetail({ context, guideId }: { context: AdminContext; guideId: string }) {
  const t = await getTranslations("admin.platform.guides");
  const { api, locale } = context;
  let guide: Guide;
  let etag: string | null;
  try {
    ({ data: guide, etag } = await unwrapWithETag(
      api.GET("/v1/admin/guides/{guideId}", { params: { path: { guideId } } }),
    ));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const blocks = guide.sections.reduce(
    (n, s) =>
      n + (Array.isArray((s as { blocks?: unknown[] }).blocks) ? (s as { blocks: unknown[] }).blocks.length : 0),
    0,
  );
  return (
    <ConsolePage testId="guide-detail">
      <PageHeader
        title={guide.title}
        crumbs={[{ label: guide.title }]}
        description={`${guide.slug} · ${t(`locale.${guide.locale}`)}`}
        actions={guide.state === "published" ? <UnpublishGuide guide={guide} /> : <PublishGuide guide={guide} />}
      />
      <div className="flex flex-wrap items-center gap-3" data-testid="guide-state" data-state={guide.state}>
        <StatusBadgeOf map={GUIDE_STATUS} value={guide.state} />
        <span className="text-muted text-sm">
          {guide.state === "published" && guide.publishedAt
            ? t("publishedAt", { date: formatDateTime(guide.publishedAt, locale) })
            : t("draftHint")}
        </span>
      </div>
      {guide.state === "draft" ? <Callout tone="info">{t("reviewHint")}</Callout> : null}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card as="section" aria-labelledby="guide-text" className="flex flex-col gap-4">
          <CardHeader
            title={<span id="guide-text">{t("text")}</span>}
            action={<EditGuide guide={guide} etag={etag} />}
          />
          <DescriptionList
            columns={1}
            items={[
              { id: "summary", term: t("field.summary"), description: guide.summary },
              { id: "answer", term: t("field.answer"), description: guide.answer },
            ]}
          />
        </Card>
        <Card as="section" aria-labelledby="guide-facts" className="flex flex-col gap-4">
          <CardHeader title={<span id="guide-facts">{t("facts")}</span>} />
          <DescriptionList
            columns={1}
            items={[
              { id: "category", term: t("col.category"), description: t(`category.${guide.category}`) },
              { id: "audience", term: t("field.audience"), description: t(`audience.${guide.audience}`) },
              { id: "minutes", term: t("field.readMinutes"), description: t("minutes", { count: guide.readMinutes }) },
              { id: "general", term: t("field.general"), description: guide.general ? t("yes") : t("no") },
              { id: "reviewed", term: t("col.reviewed"), description: formatDate(guide.reviewed, locale) },
              { id: "published", term: t("field.published"), description: formatDate(guide.published, locale) },
            ]}
          />
        </Card>
      </div>
      <Card as="section" aria-labelledby="guide-body" className="flex flex-col gap-4">
        <CardHeader
          title={<span id="guide-body">{t("body")}</span>}
          description={t("bodyCount", {
            sections: guide.sections.length,
            blocks,
            faq: guide.faq.length,
            sources: guide.sources.length,
          })}
          action={<EditGuideContent guide={guide} etag={etag} />}
        />
        <ol className="m-0 flex list-decimal flex-col gap-1 ps-5 text-sm">
          {guide.sections.map((s, index) => (
            <li key={index}>{String((s as { heading?: unknown }).heading ?? "")}</li>
          ))}
        </ol>
      </Card>
    </ConsolePage>
  );
}

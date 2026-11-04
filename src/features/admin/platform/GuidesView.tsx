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
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { Paper, PaperSection } from "@/ui/components/Paper";
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
          stackOnPhones
          minWidth="48rem"
          columns={[
            { key: "title", header: t("col.title"), phone: "title" },
            { key: "locale", header: t("col.locale"), phone: "meta" },
            { key: "category", header: t("col.category"), phone: "meta" },
            { key: "state", header: t("col.state"), phone: "status" },
            { key: "reviewed", header: t("col.reviewed"), phone: "hidden" },
          ]}
          rows={guides.data.map((guide) => ({
            key: guide.id,
            href: `/guides/${guide.id}`,
            testId: "guide-row",
            data: { slug: guide.slug, locale: guide.locale },
            cells: {
              title: (
                <span className="flex flex-col">
                  <span className="font-semibold">{guide.title}</span>
                  <span className="text-muted font-mono text-xs font-normal">{guide.slug}</span>
                </span>
              ),
              locale: t(`locale.${guide.locale}`),
              category: t(`category.${guide.category}`),
              state: <StatusBadgeOf map={GUIDE_STATUS} value={guide.state} size="sm" />,
              reviewed: <span className="whitespace-nowrap">{formatDate(guide.reviewed, locale)}</span>,
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
  const heading = (section: unknown) =>
    String((section as { heading?: unknown }).heading ?? "").replace(/^\d+\.\s*/, "");
  return (
    <ConsolePage testId="guide-detail">
      <PageHeader
        title={guide.title}
        crumbs={[{ label: guide.title }]}
        description={`${t(`locale.${guide.locale}`)} · ${t(`category.${guide.category}`)}`}
        status={
          <span data-testid="guide-state" data-state={guide.state}>
            <StatusBadgeOf map={GUIDE_STATUS} value={guide.state} />
          </span>
        }
      />
      <DetailLayout
        panel={
          <ActionPanel
            title={t("panelTitle")}
            description={
              guide.state === "published" && guide.publishedAt
                ? t("publishedAt", { date: formatDateTime(guide.publishedAt, locale) })
                : t("draftHint")
            }
            facts={[
              { key: "slug", label: t("slug"), value: <span className="font-mono text-sm">{guide.slug}</span> },
              { key: "audience", label: t("field.audience"), value: t(`audience.${guide.audience}`) },
              { key: "minutes", label: t("field.readMinutes"), value: t("minutes", { count: guide.readMinutes }) },
              { key: "general", label: t("field.general"), value: guide.general ? t("yes") : t("no") },
              { key: "reviewed", label: t("col.reviewed"), value: formatDate(guide.reviewed, locale) },
              { key: "published", label: t("field.published"), value: formatDate(guide.published, locale) },
            ]}
            primary={guide.state === "published" ? undefined : <PublishGuide guide={guide} />}
            secondary={
              <div className="flex flex-col gap-2 [&>button]:w-full">
                <EditGuide guide={guide} etag={etag} />
                <EditGuideContent guide={guide} etag={etag} />
              </div>
            }
            destructive={guide.state === "published" ? <UnpublishGuide guide={guide} /> : undefined}
          />
        }
      >
        {guide.state === "draft" ? <Callout tone="info">{t("reviewHint")}</Callout> : null}
        <Paper label={guide.title} testId="guide-preview">
          <header className="flex flex-col gap-3">
            <p className="text-muted m-0 text-sm font-medium">{t("previewLabel")}</p>
            <h2 className="m-0 text-2xl font-semibold text-balance">{guide.title}</h2>
            <p className="text-muted m-0 max-w-prose text-base">{guide.summary}</p>
          </header>
          <section aria-labelledby="guide-answer" className="bg-bg-subtle rounded-control flex flex-col gap-1.5 p-4">
            <h3 id="guide-answer" className="m-0 text-sm font-semibold">
              {t("field.answer")}
            </h3>
            <p className="m-0 max-w-prose">{guide.answer}</p>
          </section>
          <PaperSection
            title={t("body")}
            aside={
              <span className="text-muted text-sm">
                {t("bodyCount", {
                  sections: guide.sections.length,
                  blocks,
                  faq: guide.faq.length,
                  sources: guide.sources.length,
                })}
              </span>
            }
          >
            <ol className="m-0 flex list-decimal flex-col gap-1.5 ps-5">
              {guide.sections.map((section, index) => (
                <li key={index}>{heading(section)}</li>
              ))}
            </ol>
          </PaperSection>
        </Paper>
      </DetailLayout>
    </ConsolePage>
  );
}

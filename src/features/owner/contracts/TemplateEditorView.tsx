import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { LEGAL_REVIEW_STATUS, TEMPLATE_VERSION_STATUS } from "@/domain/status";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";

import { ownerPath } from "../shared/links";
import { ownerCan, readOnly, section, type OwnerContext } from "../shared/server";
import { ContractDisclaimer } from "./ContractDisclaimer";
import { CopyTemplate } from "./LibraryActions";
import { TemplateEditor } from "./TemplateEditor";

/**
 * One template of the library (G3, D-294): my copy opens in the editor (text, variables, clause list, live preview,
 * diff against the library version it was copied from, the compliance check and publishing); a platform draft opens
 * read-only with *Copy*. The legal-review state and the disclaimer stay visible on every draft (O-025).
 */
export async function TemplateEditorView({ context, templateId }: { context: OwnerContext; templateId: string }) {
  const t = await getTranslations("owner.contracts");
  const { api, locale, me } = context;
  let detail: Schemas["ContractTemplateDetailDto"];
  try {
    detail = await unwrap(api.GET("/v1/owner/contract-templates/{templateId}", { params: { path: { templateId } } }));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const diff = await section(
    unwrap(api.GET("/v1/owner/contract-templates/{templateId}/diff", { params: { path: { templateId } } })),
  );
  const mayManage = !readOnly(me) && ownerCan(me, "lease.manage");
  const canEdit = mayManage && !detail.platform;
  const published = detail.versions.filter((version) => version.state === "published");
  const { current, base } = detail;

  return (
    <OwnerPage testId="contract-editor">
      <PageHeader
        title={detail.name}
        testId="template-title"
        description={`${t(`kind.${detail.kind}`)} · ${t("versionLabel", {
          language: t(`language.${current.language}`),
          version: current.version,
        })}`}
        crumbs={[{ label: t("library.title"), href: ownerPath(locale, "/contracts") }, { label: detail.name }]}
        status={
          <span className="flex flex-wrap gap-2" data-testid="template-status">
            <StatusBadgeOf map={TEMPLATE_VERSION_STATUS} value={current.state} />
            <StatusBadgeOf map={LEGAL_REVIEW_STATUS} value={current.legalReviewState} />
          </span>
        }
        actions={
          detail.platform && mayManage && published.length ? (
            <CopyTemplate
              name={detail.name}
              versions={published.map((version) => ({
                id: version.id,
                label: t("versionLabel", { language: t(`language.${version.language}`), version: version.version }),
              }))}
            />
          ) : null
        }
      />
      <ContractDisclaimer disclaimer={detail.disclaimer} locale={locale} />
      {detail.platform ? (
        <Callout tone="info" title={t("editor.platformTitle")}>
          {t("editor.platformBody")}
        </Callout>
      ) : base ? (
        <p className="text-muted text-sm" data-testid="template-base">
          {t("editor.copiedFrom", {
            version: t("versionLabel", { language: t(`language.${base.language}`), version: base.version }),
            date: base.publishedAt ? formatDate(base.publishedAt, locale) : "—",
          })}
        </p>
      ) : null}
      <p className="text-muted text-sm">{current.legalRef}</p>
      <TemplateEditor key={current.id} detail={detail} diff={diff.data ?? null} canEdit={canEdit} />
    </OwnerPage>
  );
}

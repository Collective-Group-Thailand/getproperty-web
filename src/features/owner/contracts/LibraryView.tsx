import { getTranslations } from "next-intl/server";

import { LEGAL_REVIEW_STATUS, TEMPLATE_VERSION_STATUS } from "@/domain/status";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconBook } from "@/ui/icons/glyphs/book";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconShow } from "@/ui/icons/glyphs/show";

import { ownerPath } from "../shared/links";
import { ownerCan, param, readOnly, section, type OwnerContext } from "../shared/server";
import { ContractDisclaimer } from "./ContractDisclaimer";
import { ContractsNav } from "./ContractsNav";
import { CONTRACT_KINDS, LANGUAGES } from "./labels";
import { CopyTemplate } from "./LibraryActions";

type Template = Schemas["ContractTemplateDto"];
type SearchParams = Record<string, string | string[] | undefined>;
type T = Awaited<ReturnType<typeof getTranslations<"owner.contracts">>>;

/**
 * The contract library (G3, D-290, D-294): the platform's drafts of every kind in Thai and English and the tenant's
 * own templates, each version with its legal-review state — every draft is `pending_legal_verification` until counsel
 * signs it off (O-025 / O-030) and the API's disclaimer stays on the page. Copying a published draft opens the editor.
 */
export async function LibraryView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.contracts");
  const { api, locale, me } = context;
  const kindParam = param(searchParams.kind);
  const languageParam = param(searchParams.language);
  const kind = CONTRACT_KINDS.find((value) => value === kindParam);
  const language = LANGUAGES.find((value) => value === languageParam);
  const library = await section(
    unwrap(api.GET("/v1/owner/contract-library", { params: { query: { kind, language } } })),
  );
  const canManage = !readOnly(me) && ownerCan(me, "lease.manage");
  const templates = library.data?.data ?? [];
  const platform = templates.filter((template) => template.platform);
  const mine = templates.filter((template) => !template.platform);

  return (
    <OwnerPage testId="contract-library">
      <PageHeader title={t("library.title")} description={t("library.description")} />
      <ContractsNav current="/contracts" locale={locale} />
      {library.data ? <ContractDisclaimer disclaimer={library.data.disclaimer} locale={locale} /> : null}
      <FilterBar
        fields={[
          {
            name: "kind",
            label: t("library.filter.kind"),
            type: "select",
            placeholder: t("library.filter.allKinds"),
            options: CONTRACT_KINDS.map((value) => ({ value, label: t(`kind.${value}`) })),
          },
          {
            name: "language",
            label: t("library.filter.language"),
            type: "select",
            placeholder: t("library.filter.allLanguages"),
            options: LANGUAGES.map((value) => ({ value, label: t(`language.${value}`) })),
          },
        ]}
      />
      {!library.data ? (
        <SectionError error={library.error} />
      ) : (
        <>
          <Card as="section" padding="none" aria-labelledby="library-mine" data-testid="library-mine">
            <div className="px-4 pt-4 md:px-5">
              <CardHeader
                title={<span id="library-mine">{t("library.mine")}</span>}
                description={t("library.mineHint")}
              />
            </div>
            {mine.length === 0 ? (
              <div className="px-4 pb-4 md:px-5">
                <EmptyState icon={IconEdit} title={t("library.mineEmpty")} description={t("library.mineEmptyHint")} />
              </div>
            ) : (
              <TemplateList templates={mine} t={t} locale={locale} canManage={canManage} />
            )}
          </Card>
          <Card as="section" padding="none" aria-labelledby="library-platform" data-testid="library-platform">
            <div className="px-4 pt-4 md:px-5">
              <CardHeader
                title={<span id="library-platform">{t("library.platform")}</span>}
                description={t("library.platformHint")}
              />
            </div>
            {platform.length === 0 ? (
              <div className="px-4 pb-4 md:px-5">
                <EmptyState icon={IconBook} title={t("library.empty")} />
              </div>
            ) : (
              <TemplateList templates={platform} t={t} locale={locale} canManage={canManage} />
            )}
          </Card>
        </>
      )}
    </OwnerPage>
  );
}

function TemplateList({
  templates,
  t,
  locale,
  canManage,
}: {
  templates: Template[];
  t: T;
  locale: Locale;
  canManage: boolean;
}) {
  return (
    <ul className="divide-border border-border m-0 list-none divide-y border-t p-0">
      {templates.map((template) => {
        const published = template.versions.filter((version) => version.state === "published");
        return (
          <li
            key={template.id}
            className="flex flex-wrap items-start justify-between gap-4 px-4 py-4 md:px-5"
            data-testid="library-template"
            data-kind={template.kind}
            data-platform={template.platform ? "true" : "false"}
          >
            <div className="flex min-w-0 flex-col gap-2">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{template.name}</span>
                <Badge size="sm">{t(`kind.${template.kind}`)}</Badge>
              </span>
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
                {template.versions.map((version) => (
                  <li
                    key={version.id}
                    className="flex flex-wrap items-center gap-2"
                    data-testid="library-version"
                    data-language={version.language}
                  >
                    <span className="font-medium">
                      {t("versionLabel", { language: t(`language.${version.language}`), version: version.version })}
                    </span>
                    <StatusBadgeOf map={TEMPLATE_VERSION_STATUS} value={version.state} size="sm" />
                    <StatusBadgeOf map={LEGAL_REVIEW_STATUS} value={version.legalReviewState} size="sm" />
                    {version.publishedAt ? (
                      <span className="text-muted">
                        {t("publishedOn", { date: formatDate(version.publishedAt, locale) })}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm" iconStart={template.platform ? IconShow : IconEdit}>
                <a href={ownerPath(locale, `/contracts/templates/${template.id}`)} data-testid="library-open">
                  {template.platform || !canManage ? t("library.view") : t("library.edit")}
                </a>
              </Button>
              {canManage && published.length ? (
                <CopyTemplate
                  name={template.name}
                  versions={published.map((version) => ({
                    id: version.id,
                    label: t("versionLabel", {
                      language: t(`language.${version.language}`),
                      version: version.version,
                    }),
                  }))}
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

import { getTranslations } from "next-intl/server";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";

import { ownerPath } from "../shared/links";
import { focusedBuilding, ownerCan, pageParam, param, readOnly, type OwnerContext } from "../shared/server";
import { CommunityNav } from "./CommunityNav";
import { announcementState } from "./server";

type SearchParams = Record<string, string | string[] | undefined>;
const TONE = { draft: "neutral", published: "success", archived: "neutral" } as const;

/**
 * Announcements (F2 2.7, D-073, D-212): drafts, published and archived notices of the focused building (and
 * the tenant-wide ones) with their read counts; compose opens the editor.
 */
export async function AnnouncementsView({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("owner.community.announcements");
  const states = await getTranslations("owner.community.state");
  const { api, locale, me } = context;
  const building = focusedBuilding(context);
  const view = param(searchParams.view);
  const list = await unwrap(
    api.GET("/v1/owner/announcements", {
      params: {
        query: {
          page: pageParam(searchParams.page),
          perPage: 25,
          buildingId: building?.id,
          published: view === "draft" ? false : view === "published" ? true : undefined,
          q: param(searchParams.q),
        },
      },
    }),
  );
  const canManage = ownerCan(me, "announcement.manage") && !readOnly(me);
  const buildingName = (id: string | null) =>
    id ? (context.buildings.find((candidate) => candidate.id === id)?.name ?? "") : t("wholeTenant");

  return (
    <OwnerPage testId="announcements">
      <PageHeader
        title={t("title")}
        description={t("description")}
        crumbs={[{ label: t("title") }]}
        actions={
          canManage ? (
            <Button asChild iconStart={IconAdd}>
              <a href={ownerPath(locale, "/announcements/new")} data-testid="announcement-new">
                {t("compose")}
              </a>
            </Button>
          ) : null
        }
      />
      <CommunityNav current="/announcements" locale={locale} />
      <FilterBar
        fields={[
          { name: "q", label: t("search"), type: "search" },
          {
            name: "view",
            label: t("show"),
            type: "select",
            placeholder: t("all"),
            options: [
              { value: "draft", label: states("draft") },
              { value: "published", label: states("published") },
            ],
          },
        ]}
      />
      {list.data.length === 0 ? (
        <Card>
          <EmptyState icon={IconMegaphone} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="announcement-table"
          minWidth="44rem"
          columns={[
            { key: "title", header: t("col.title") },
            { key: "scope", header: t("col.scope") },
            { key: "state", header: t("col.state") },
            { key: "reads", header: t("col.reads"), align: "end" },
          ]}
          rows={list.data.map((announcement) => {
            const state = announcementState(announcement);
            return {
              key: announcement.id,
              testId: "announcement-row",
              data: { state },
              cells: {
                title: (
                  <span className="flex flex-col">
                    <a
                      className="font-medium underline-offset-4 hover:underline"
                      href={ownerPath(locale, `/announcements/${announcement.id}`)}
                    >
                      {announcement.title}
                    </a>
                    <span className="text-muted text-xs">
                      {announcement.publishedAt
                        ? t("publishedAt", { at: formatDateTime(announcement.publishedAt, locale) })
                        : t("createdAt", { at: formatDateTime(announcement.createdAt, locale) })}
                    </span>
                  </span>
                ),
                scope: (
                  <span className="flex flex-col">
                    <span>{buildingName(announcement.buildingId)}</span>
                    {announcement.audienceFilter.floorIds?.length || announcement.audienceFilter.unitIds?.length ? (
                      <span className="text-muted text-xs">{t("someResidents")}</span>
                    ) : null}
                  </span>
                ),
                state: (
                  <span className="flex flex-wrap gap-1">
                    <Badge tone={TONE[state]} size="sm">
                      {states(state)}
                    </Badge>
                    {announcement.pinned ? (
                      <Badge tone="primary" size="sm">
                        {t("pinned")}
                      </Badge>
                    ) : null}
                  </span>
                ),
                reads: announcement.publishedAt ? String(announcement.readCount) : "—",
              },
            };
          })}
        />
      )}
      <ListPagination
        meta={list.meta}
        path={ownerPath(locale, "/announcements")}
        searchParams={searchParams}
        locale={locale}
      />
    </OwnerPage>
  );
}

import { getTranslations } from "next-intl/server";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { formatDateTime, formatNumber } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconArchive } from "@/ui/icons/glyphs/archive";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconStar } from "@/ui/icons/glyphs/star";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";

import { ownerPath, withQuery } from "../shared/links";
import { focusedBuilding, ownerCan, pageParam, param, readOnly, type OwnerContext } from "../shared/server";
import { viewCounts } from "../shared/views";
import { announcementState } from "./server";

type SearchParams = Record<string, string | string[] | undefined>;
const TONE = { draft: "neutral", published: "success", archived: "neutral" } as const;
const STATE_ICON = { draft: IconEdit, published: IconCheckCircle, archived: IconArchive } as const;

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
  const view =
    param(searchParams.view) === "draft" ? "draft" : param(searchParams.view) === "published" ? "published" : "all";
  const count = (published?: boolean) =>
    unwrap(
      api.GET("/v1/owner/announcements", { params: { query: { buildingId: building?.id, published, perPage: 1 } } }),
    );
  const [list, counts] = await Promise.all([
    unwrap(
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
    ),
    viewCounts(["all", "draft", "published"] as const, (key) =>
      count(key === "draft" ? false : key === "published" ? true : undefined),
    ),
  ]);
  const canManage = ownerCan(me, "announcement.manage") && !readOnly(me);
  const buildingName = (id: string | null) =>
    id ? (context.buildings.find((candidate) => candidate.id === id)?.name ?? "") : t("wholeTenant");
  const path = (query: Record<string, string | undefined>) => ownerPath(locale, withQuery("/announcements", query));
  const searched = Boolean(param(searchParams.q));

  return (
    <OwnerPage testId="announcements">
      <PageHeader
        title={t("title")}
        description={t("description")}
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
      <ListToolbar
        tabs={
          <ViewTabs
            label={t("show")}
            current={view}
            tabs={[
              { key: "all", href: path({}), label: t("all"), count: counts.all },
              { key: "draft", href: path({ view: "draft" }), label: states("draft"), count: counts.draft },
              {
                key: "published",
                href: path({ view: "published" }),
                label: states("published"),
                count: counts.published,
              },
            ]}
          />
        }
        filters={
          <FilterBar
            variant="toolbar"
            fields={[{ name: "q", label: t("search"), type: "search", placeholder: t("searchPlaceholder") }]}
          />
        }
      />
      {list.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconMegaphone}
          title={searched || view !== "all" ? t("empty.filteredTitle") : t("empty.title")}
          description={t("empty.body")}
          action={
            searched || view !== "all" ? (
              <Button asChild variant="secondary">
                <a href={path({})}>{t("empty.clear")}</a>
              </Button>
            ) : canManage ? (
              <Button asChild variant="secondary" iconStart={IconAdd}>
                <a href={ownerPath(locale, "/announcements/new")}>{t("compose")}</a>
              </Button>
            ) : (
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/community/rules")}>{t("empty.rules")}</a>
              </Button>
            )
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="announcement-table"
          stackOnPhones
          minWidth="48rem"
          columns={[
            { key: "title", header: t("col.title"), phone: "title" },
            { key: "scope", header: t("col.scope"), phone: "meta", className: "md:w-48" },
            { key: "state", header: t("col.state"), phone: "status", className: "md:w-44" },
            { key: "reads", header: t("col.reads"), align: "end", phone: "figure", className: "md:w-28" },
          ]}
          rows={list.data.map((announcement) => {
            const state = announcementState(announcement);
            return {
              key: announcement.id,
              href: ownerPath(locale, `/announcements/${announcement.id}`),
              testId: "announcement-row",
              data: { state },
              cells: {
                title: (
                  <span className="flex flex-col gap-0.5">
                    <span>{announcement.title}</span>
                    <span className="text-muted text-sm font-normal">
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
                      <span className="text-muted text-sm">{t("someResidents")}</span>
                    ) : null}
                  </span>
                ),
                state: (
                  <span className="flex flex-wrap gap-1">
                    <Badge tone={TONE[state]} size="sm" icon={STATE_ICON[state]}>
                      {states(state)}
                    </Badge>
                    {announcement.pinned ? (
                      <Badge tone="primary" size="sm" icon={IconStar}>
                        {t("pinned")}
                      </Badge>
                    ) : null}
                  </span>
                ),
                reads: announcement.publishedAt ? (
                  <span className="tabular-nums">{formatNumber(announcement.readCount, locale)}</span>
                ) : (
                  <span className="text-muted">—</span>
                ),
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

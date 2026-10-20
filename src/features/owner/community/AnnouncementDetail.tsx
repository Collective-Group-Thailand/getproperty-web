import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { section } from "@/features/shared/console/params";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { Badge } from "@/ui/components/Badge";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { ownerPath } from "../shared/links";
import { ownerCan, readOnly, type OwnerContext } from "../shared/server";
import { AnnouncementActions } from "./AnnouncementActions";
import { AnnouncementForm } from "./AnnouncementForm";
import { announcementState, audienceChoices } from "./server";

const LANGUAGES = ["en", "my", "km", "lo", "zh"] as const;

/**
 * One announcement (F2 2.7, D-212): a draft is edited here and published; a published one shows its text, the
 * translations, the audience and the **read receipts** (who read it, of how many residents in the audience).
 */
export async function AnnouncementDetail({
  context,
  announcementId,
}: {
  context: OwnerContext;
  announcementId: string;
}) {
  const t = await getTranslations("owner.community.announcement");
  const states = await getTranslations("owner.community.state");
  const compose = await getTranslations("owner.community.compose");
  const { api, locale, me } = context;
  const announcement = await unwrap(
    api.GET("/v1/owner/announcements/{announcementId}", { params: { path: { announcementId } } }),
  ).catch((error: unknown) => {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  });
  const state = announcementState(announcement);
  const canManage = ownerCan(me, "announcement.manage") && !readOnly(me);
  const [reads, choices] = await Promise.all([
    section(
      unwrap(api.GET("/v1/owner/announcements/{announcementId}/reads", { params: { path: { announcementId } } })),
    ),
    state === "draft" && canManage
      ? audienceChoices(
          api,
          context.buildings.filter((building) => building.id === announcement.buildingId),
        )
      : Promise.resolve([]),
  ]);
  const building = context.buildings.find((candidate) => candidate.id === announcement.buildingId);

  return (
    <OwnerPage testId="announcement">
      <PageHeader
        title={announcement.title}
        testId="announcement-title"
        status={
          <Badge tone={state === "published" ? "success" : "neutral"} size="md">
            {states(state)}
          </Badge>
        }
        description={building?.name ?? t("wholeTenant")}
        crumbs={[{ label: t("crumb"), href: ownerPath(locale, "/announcements") }, { label: announcement.title }]}
        actions={
          canManage ? <AnnouncementActions announcement={announcement} audience={reads.data?.audience ?? null} /> : null
        }
      />
      {state === "draft" && canManage ? (
        <AnnouncementForm buildings={choices} initialBuildingId={announcement.buildingId} announcement={announcement} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2" as="section" aria-labelledby="announcement-text">
            <CardHeader title={<span id="announcement-text">{t("text")}</span>} />
            <p className="whitespace-pre-line" data-testid="announcement-body">
              {announcement.bodyTh}
            </p>
            {LANGUAGES.filter((language) => announcement.translations[language]?.body).map((language) => (
              <div key={language} className="border-border mt-4 border-t pt-3" data-testid={`translation-${language}`}>
                <p className="text-muted text-xs font-medium">{compose(`languages.${language}`)}</p>
                {announcement.translations[language]?.title ? (
                  <p className="font-medium">{announcement.translations[language]?.title}</p>
                ) : null}
                <p className="whitespace-pre-line">{announcement.translations[language]?.body}</p>
              </div>
            ))}
          </Card>
          <Card as="section" aria-labelledby="announcement-facts">
            <CardHeader title={<span id="announcement-facts">{t("facts")}</span>} />
            <DescriptionList
              items={[
                {
                  id: "published",
                  term: t("publishedAt"),
                  description: announcement.publishedAt ? formatDateTime(announcement.publishedAt, locale) : null,
                },
                {
                  id: "audience",
                  term: t("audience"),
                  description: announcement.audienceFilter.unitIds?.length
                    ? t("audienceUnits", { count: announcement.audienceFilter.unitIds.length })
                    : announcement.audienceFilter.floorIds?.length
                      ? t("audienceFloors", { count: announcement.audienceFilter.floorIds.length })
                      : t("audienceAll"),
                },
                { id: "pinned", term: t("pinned"), description: announcement.pinned ? t("yes") : t("no") },
                {
                  id: "expires",
                  term: t("expiresAt"),
                  description: announcement.expiresAt ? formatDateTime(announcement.expiresAt, locale) : null,
                },
                {
                  id: "archived",
                  term: t("archivedAt"),
                  description: announcement.archivedAt ? formatDateTime(announcement.archivedAt, locale) : null,
                },
              ]}
            />
          </Card>
        </div>
      )}
      {state !== "draft" ? (
        <Card as="section" aria-labelledby="announcement-reads" data-testid="announcement-reads">
          <CardHeader
            title={<span id="announcement-reads">{t("reads")}</span>}
            description={
              reads.data ? (
                <span data-testid="read-count">
                  {t("readsOf", { read: reads.data.data.length, audience: reads.data.audience })}
                </span>
              ) : null
            }
          />
          {reads.error ? (
            <SectionError error={reads.error} />
          ) : reads.data && reads.data.data.length ? (
            <SimpleTable
              caption={t("reads")}
              testId="read-table"
              columns={[
                { key: "name", header: t("reader") },
                { key: "at", header: t("readAt") },
              ]}
              rows={reads.data.data.map((read) => ({
                key: read.partyId,
                testId: "read-row",
                cells: { name: read.name, at: formatDateTime(read.readAt, locale) },
              }))}
            />
          ) : (
            <p className="text-muted text-sm">{t("noReads")}</p>
          )}
        </Card>
      ) : null}
    </OwnerPage>
  );
}

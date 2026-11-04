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
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { IconArchive } from "@/ui/icons/glyphs/archive";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { SimpleTable } from "@/ui/components/SimpleTable";

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
          <Badge
            tone={state === "published" ? "success" : "neutral"}
            size="md"
            icon={state === "published" ? IconCheckCircle : state === "draft" ? IconEdit : IconArchive}
          >
            {states(state)}
          </Badge>
        }
        description={building?.name ?? t("wholeTenant")}
        actions={
          canManage && state === "draft" ? (
            <AnnouncementActions announcement={announcement} audience={reads.data?.audience ?? null} />
          ) : null
        }
      />
      {state === "draft" && canManage ? (
        <AnnouncementForm
          buildings={choices}
          initialBuildingId={announcement.buildingId}
          announcement={announcement}
          sender={context.me.currentTenant?.displayName ?? ""}
        />
      ) : (
        <DetailLayout
          panel={
            <ActionPanel
              testId="announcement-panel"
              title={t("facts")}
              facts={[
                ...(announcement.publishedAt
                  ? [
                      {
                        key: "published",
                        label: t("publishedAt"),
                        value: formatDateTime(announcement.publishedAt, locale),
                      },
                    ]
                  : []),
                {
                  key: "audience",
                  label: t("audience"),
                  value: announcement.audienceFilter.unitIds?.length
                    ? t("audienceUnits", { count: announcement.audienceFilter.unitIds.length })
                    : announcement.audienceFilter.floorIds?.length
                      ? t("audienceFloors", { count: announcement.audienceFilter.floorIds.length })
                      : t("audienceAll"),
                },
                ...(reads.data
                  ? [
                      {
                        key: "reads",
                        label: t("reads"),
                        value: (
                          <span data-testid="read-count">
                            {t("readsOf", { read: reads.data.data.length, audience: reads.data.audience })}
                          </span>
                        ),
                      },
                    ]
                  : []),
                { key: "pinned", label: t("pinned"), value: announcement.pinned ? t("yes") : t("no") },
                {
                  key: "expires",
                  label: t("expiresAt"),
                  value: announcement.expiresAt ? formatDateTime(announcement.expiresAt, locale) : "—",
                },
                ...(announcement.archivedAt
                  ? [
                      {
                        key: "archived",
                        label: t("archivedAt"),
                        value: formatDateTime(announcement.archivedAt, locale),
                      },
                    ]
                  : []),
              ]}
              primary={
                canManage && !announcement.archivedAt ? (
                  <AnnouncementActions
                    announcement={announcement}
                    audience={reads.data?.audience ?? null}
                    layout="panel"
                  />
                ) : undefined
              }
            />
          }
        >
          <Card as="section" aria-labelledby="announcement-text" padding="lg">
            <h2 id="announcement-text" className="sr-only">
              {t("text")}
            </h2>
            <p className="text-lg leading-relaxed whitespace-pre-line" data-testid="announcement-body">
              {announcement.bodyTh}
            </p>
            {LANGUAGES.filter((language) => announcement.translations[language]?.body).map((language) => (
              <div key={language} className="border-border mt-5 border-t pt-4" data-testid={`translation-${language}`}>
                <p className="text-muted mb-1 text-sm font-medium">{compose(`languages.${language}`)}</p>
                {announcement.translations[language]?.title ? (
                  <p className="font-medium">{announcement.translations[language]?.title}</p>
                ) : null}
                <p className="whitespace-pre-line">{announcement.translations[language]?.body}</p>
              </div>
            ))}
          </Card>
          <Card as="section" aria-labelledby="announcement-reads" data-testid="announcement-reads">
            <CardHeader title={<span id="announcement-reads">{t("reads")}</span>} />
            {reads.error ? (
              <SectionError error={reads.error} />
            ) : reads.data && reads.data.data.length ? (
              <SimpleTable
                caption={t("reads")}
                testId="read-table"
                stackOnPhones
                minWidth="24rem"
                columns={[
                  { key: "name", header: t("reader"), phone: "title" },
                  { key: "at", header: t("readAt"), phone: "meta" },
                ]}
                rows={reads.data.data.map((read) => ({
                  key: read.partyId,
                  testId: "read-row",
                  cells: {
                    name: read.name,
                    at: <span className="tabular-nums">{formatDateTime(read.readAt, locale)}</span>,
                  },
                }))}
              />
            ) : (
              <p className="text-muted text-sm">{t("noReads")}</p>
            )}
          </Card>
        </DetailLayout>
      )}
    </OwnerPage>
  );
}

"use client";

import { useTranslations } from "next-intl";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog } from "@/features/shared/console/FormDialog";
import { bangkokInstant, bangkokLocal } from "@/features/shared/console/time";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { IconArchive } from "@/ui/icons/glyphs/archive";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";

/**
 * A draft is published (LINE to the audience; quiet hours and consent apply); a published announcement keeps
 * its text — only its pin and expiry change; archiving hides it from residents and keeps the read receipts.
 */
export function AnnouncementActions({
  announcement,
  audience,
}: {
  announcement: Pick<
    Schemas["AnnouncementDto"],
    "id" | "title" | "publishedAt" | "archivedAt" | "pinned" | "expiresAt"
  >;
  audience: number | null;
}) {
  const t = useTranslations("owner.community.announcement");
  const path = { announcementId: announcement.id };
  return (
    <div className="flex flex-wrap gap-2" data-testid="announcement-actions">
      {!announcement.publishedAt ? (
        <ConfirmAction
          label={t("publish")}
          icon={IconMegaphone}
          testId="announcement-publish"
          title={t("publishTitle", { title: announcement.title })}
          description={audience !== null ? t("publishBody", { count: audience }) : t("publishBodyUnknown")}
          confirmLabel={t("publish")}
          successMessage={t("published")}
          onConfirm={() =>
            unwrap(browserApi().POST("/v1/owner/announcements/{announcementId}/actions/publish", { params: { path } }))
          }
        />
      ) : null}
      {announcement.publishedAt && !announcement.archivedAt ? (
        <FormDialog
          label={t("pinExpiry")}
          icon={IconEdit}
          testId="announcement-pin"
          title={t("pinExpiryTitle")}
          description={t("pinExpiryBody")}
          submitLabel={t("save")}
          successMessage={t("saved")}
          onSubmit={(data) =>
            unwrap(
              browserApi().PATCH("/v1/owner/announcements/{announcementId}", {
                params: { path },
                body: {
                  pinned: data.get("pinned") === "true",
                  expiresAt: bangkokInstant(String(data.get("expiresAt") ?? "")) ?? null,
                },
              }),
            )
          }
        >
          {(errors) => (
            <>
              <Checkbox name="pinned" value="true" defaultChecked={announcement.pinned} label={t("pinned")} />
              <Field label={t("expiresAt")} error={errors.expiresAt}>
                <Input type="datetime-local" name="expiresAt" defaultValue={bangkokLocal(announcement.expiresAt)} />
              </Field>
            </>
          )}
        </FormDialog>
      ) : null}
      {!announcement.archivedAt ? (
        <ConfirmAction
          label={t("archive")}
          icon={IconArchive}
          variant="secondary"
          testId="announcement-archive"
          title={t("archiveTitle", { title: announcement.title })}
          description={t("archiveBody")}
          confirmLabel={t("archive")}
          successMessage={t("archived")}
          onConfirm={() =>
            unwrap(browserApi().POST("/v1/owner/announcements/{announcementId}/actions/archive", { params: { path } }))
          }
        />
      ) : null}
    </div>
  );
}

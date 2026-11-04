import { getTranslations } from "next-intl/server";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";

import { focusedBuilding, type OwnerContext } from "../shared/server";
import { AnnouncementForm } from "./AnnouncementForm";
import { audienceChoices } from "./server";

/** Compose an announcement (F2 2.7): the building's floors and units are the audience choices. */
export async function ComposeView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.community.compose");
  const { api } = context;
  const buildings = await audienceChoices(api, context.buildings);
  return (
    <OwnerPage testId="announcement-compose">
      <PageHeader title={t("pageTitle")} description={t("pageBody")} />
      <AnnouncementForm
        buildings={buildings}
        initialBuildingId={focusedBuilding(context)?.id ?? null}
        sender={context.me.currentTenant?.displayName ?? ""}
      />
    </OwnerPage>
  );
}

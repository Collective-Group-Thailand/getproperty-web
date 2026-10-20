import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ConsolePage, PageHeader } from "@/features/shared/console/PageHeader";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";

/**
 * Integration events (`bridge.integration_event`, B5 warranty hook, D-205): the menu entry exists for
 * `admin.integration_event.read`, but the contract pinned here publishes no list endpoint yet
 * (docs/contract-requests.md). Until it does, the page says so and points at the event outbox, where
 * failed deliveries of the same events are replayed.
 */
export async function IntegrationEventsView() {
  const t = await getTranslations("admin.operations.integration");
  return (
    <ConsolePage testId="integration-events">
      <PageHeader title={t("title")} description={t("description")} />
      <Card>
        <EmptyState
          title={t("pendingTitle")}
          description={t("pendingBody")}
          action={
            <Link href="/outbox" className="text-primary underline-offset-4 hover:underline">
              {t("outbox")}
            </Link>
          }
        />
      </Card>
    </ConsolePage>
  );
}

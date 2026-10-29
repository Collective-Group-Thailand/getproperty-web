import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { LISTING_STATUS } from "@/domain/status/listing";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { isApiError } from "@/lib/api/errors";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { IconExternal } from "@/ui/icons/glyphs/external";

import { ListingGrowth } from "../growth/ListingGrowth";
import { ownerPath } from "../shared/links";
import { section, type OwnerContext } from "../shared/server";
import { ListingActions } from "./ListingActions";
import { ListingAvailabilityForm } from "./ListingAvailabilityForm";
import { ListingDetailsForm } from "./ListingDetailsForm";
import { ListingInsights } from "./ListingInsights";
import { ListingPhotos } from "./ListingPhotos";
import { ListingSharePanel } from "./ListingSharePanel";
import { selfViewingRules } from "../viewings/selfViewing";
import { VerificationCard } from "./VerificationCard";

/**
 * One listing (F6.2, D-252): where it stands and the next step at the top (with the moderator's reason or the
 * reports when there are any), then photos, details and terms, viewing times and owner verification — the order a
 * landlord fills them in. Nothing here decides state: every button asks the API and the page shows what it answers.
 */
export async function ListingEditorView({ context, listingId }: { context: OwnerContext; listingId: string }) {
  const t = await getTranslations("owner.listings");
  const { api, locale } = context;
  const result = await section(unwrap(api.GET("/v1/owner/listings/{listingId}", { params: { path: { listingId } } })));
  if (!result.data) {
    if (isApiError(result.error) && result.error.status === 404) notFound();
    return (
      <OwnerPage>
        <SectionError error={result.error} />
      </OwnerPage>
    );
  }
  const listing = result.data;
  const [verification, settings, assistant] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/units/{unitId}/verification", { params: { path: { unitId: listing.unitId } } }))),
    // G7 (D-295): whether self-viewing windows can be offered (`viewing.self.enabled`, off until O-024).
    section(unwrap(api.GET("/v1/owner/settings"))),
    // G9 (D-301): the AI listing assistant's availability and this month's quota.
    section(unwrap(api.GET("/v1/owner/listing-assistant"))),
  ]);
  const view =
    listing.state === "published" && !listing.hidden ? (
      <Button asChild variant="secondary" iconStart={IconExternal}>
        <a
          href={ownerPath(locale, `/rent/${listing.slug}`)}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="listing-view"
        >
          {t("editor.view")}
        </a>
      </Button>
    ) : null;

  return (
    <OwnerPage testId="listing-editor">
      <PageHeader
        title={listing.titleTh}
        description={listing.address ?? undefined}
        status={<StatusBadgeOf map={LISTING_STATUS} value={listing.state} />}
        actions={view}
        crumbs={[{ label: listing.titleTh }]}
      />

      <Card as="section" aria-labelledby="listing-state" className="flex flex-col gap-4">
        <p id="listing-state" className="text-muted text-sm" data-testid="listing-state-hint">
          {t(`editor.state.${listing.state}`)}
        </p>
        {listing.state === "pending_review" && listing.reviewReasons.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{t("reasons.label")}</span>
            {listing.reviewReasons.map((reason) => (
              <Badge key={reason} tone="info" size="sm">
                {t(`reasons.${reason}`)}
              </Badge>
            ))}
          </div>
        ) : null}
        {listing.state === "rejected" && listing.rejectedReason ? (
          <Callout tone="warning" title={t("editor.rejectedTitle")}>
            <span data-testid="listing-rejected-reason">{listing.rejectedReason}</span>
          </Callout>
        ) : null}
        {listing.hidden ? (
          <Callout tone="warning" title={t("editor.hiddenTitle")}>
            {t("editor.hiddenBody")}
          </Callout>
        ) : null}
        <ListingActions listing={listing} />
      </Card>

      <Card as="section" aria-labelledby="listing-photos" className="flex flex-col gap-4">
        <CardHeader
          title={<span id="listing-photos">{t("photos.title")}</span>}
          description={t("photos.description")}
        />
        <ListingPhotos listingId={listing.id} unitId={listing.unitId} photos={listing.photos} />
      </Card>

      <Card as="section" aria-labelledby="listing-details" className="flex flex-col gap-4">
        <CardHeader
          title={<span id="listing-details">{t("details.title")}</span>}
          description={t("details.description")}
        />
        <ListingDetailsForm listing={listing} assistant={assistant.data} />
      </Card>

      <ListingInsights context={context} listing={listing} />

      {listing.state === "published" && !listing.hidden ? (
        <Card as="section" aria-labelledby="listing-share" className="flex flex-col gap-4">
          <CardHeader title={<span id="listing-share">{t("share.title")}</span>} description={t("share.description")} />
          <ListingSharePanel listingId={listing.id} />
        </Card>
      ) : null}

      {/* G4 / G5: promote the listing, photo services, its Facebook Page posts. */}
      <ListingGrowth context={context} listing={listing} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card as="section" aria-labelledby="listing-availability" className="flex flex-col gap-4">
          <CardHeader
            title={<span id="listing-availability">{t("availability.title")}</span>}
            description={t("availability.description")}
          />
          <ListingAvailabilityForm
            listingId={listing.id}
            availability={listing.availability}
            selfViewing={selfViewingRules(settings.data)}
          />
        </Card>
        <Card as="section" aria-labelledby="listing-verification" className="flex flex-col gap-4">
          <CardHeader
            title={<span id="listing-verification">{t("verification.title")}</span>}
            description={t("verification.description")}
          />
          {verification.data ? (
            <VerificationCard unitId={listing.unitId} verification={verification.data} />
          ) : (
            <SectionError error={verification.error} />
          )}
        </Card>
      </div>
    </OwnerPage>
  );
}

import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { LISTING_STATUS } from "@/domain/status/listing";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { isApiError } from "@/lib/api/errors";
import { unwrap } from "@/lib/api/client";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { DetailLayout } from "@/ui/components/DetailLayout";
import { FormSection } from "@/ui/components/FormLayout";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconHide } from "@/ui/icons/glyphs/hide";

import { ListingGrowth } from "../growth/ListingGrowth";
import { ownerPath } from "../shared/links";
import { section, type OwnerContext } from "../shared/server";
import { selfViewingRules } from "../viewings/selfViewing";
import { ListingPanel } from "./ListingActions";
import { ListingAvailabilityForm } from "./ListingAvailabilityForm";
import { ListingDetailsForm } from "./ListingDetailsForm";
import { ListingComparables, ListingUtilityPreview } from "./ListingInsights";
import { ListingPhotos } from "./ListingPhotos";
import { ListingSaveProvider } from "./ListingSave";
import { ListingSharePanel } from "./ListingSharePanel";
import { VerificationCard } from "./VerificationCard";

/**
 * One listing (F6.2, D-252) as a numbered editor beside a sticky review panel (G5): 1 photos, 2 details, 3 rent and
 * terms (with the rent of similar homes), 4 facilities and transport, 5 what renters see, 6 viewing times, 7 owner
 * verification — the order a landlord fills them in — then the share kit and promotion once it is live. The panel
 * says where the listing stands (the moderator's reasons, hidden after reports) and carries its one filled action.
 * Nothing here decides state: every button asks the API and the page shows what it answers.
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
  const live = listing.state === "published" && !listing.hidden;
  const status = <StatusBadgeOf map={LISTING_STATUS} value={listing.state} />;

  const reasons =
    listing.state === "pending_review" && listing.reviewReasons.length ? (
      <Callout tone="neutral" size="sm" live={false} icon={IconClock} title={t("reasons.label")}>
        <ul className="text-muted m-0 list-none p-0">
          {listing.reviewReasons.map((reason) => (
            <li key={reason}>{t(`reasons.${reason}`)}</li>
          ))}
        </ul>
      </Callout>
    ) : null;
  const rejected =
    listing.state === "rejected" && listing.rejectedReason ? (
      <Callout tone="danger" size="sm" live={false} title={t("editor.rejectedTitle")}>
        <span data-testid="listing-rejected-reason">{listing.rejectedReason}</span>
      </Callout>
    ) : null;
  const hidden = listing.hidden ? (
    <Callout tone="warning" size="sm" live={false} icon={IconHide} title={t("editor.hiddenTitle")}>
      {t("editor.hiddenBody")}
    </Callout>
  ) : null;
  const notice =
    reasons || rejected || hidden ? (
      <>
        {rejected}
        {hidden}
        {reasons}
      </>
    ) : null;

  return (
    <OwnerPage testId="listing-editor">
      <PageHeader
        title={listing.titleTh}
        description={listing.address ?? undefined}
        status={status}
        crumbs={[{ label: listing.titleTh }]}
      />

      <ListingSaveProvider>
        <DetailLayout
          panel={
            <ListingPanel
              listing={listing}
              status={status}
              notice={notice}
              viewHref={live ? ownerPath(locale, `/rent/${listing.slug}`) : null}
            />
          }
        >
          <FormSection number={1} title={t("photos.title")} description={t("photos.description")}>
            <ListingPhotos listingId={listing.id} unitId={listing.unitId} photos={listing.photos} />
          </FormSection>

          <ListingDetailsForm
            listing={listing}
            assistant={assistant.data}
            comparables={<ListingComparables context={context} listing={listing} />}
            utility={<ListingUtilityPreview context={context} listing={listing} />}
          />

          <FormSection number={6} title={t("availability.title")} description={t("availability.description")}>
            <ListingAvailabilityForm
              listingId={listing.id}
              availability={listing.availability}
              selfViewing={selfViewingRules(settings.data)}
            />
          </FormSection>

          <FormSection number={7} title={t("verification.title")} description={t("verification.description")}>
            {verification.data ? (
              <VerificationCard unitId={listing.unitId} verification={verification.data} />
            ) : (
              <SectionError error={verification.error} />
            )}
          </FormSection>

          {live ? (
            <Card as="section" aria-labelledby="listing-share" className="flex flex-col gap-4">
              <CardHeader
                title={<span id="listing-share">{t("share.title")}</span>}
                description={t("share.description")}
              />
              <ListingSharePanel listingId={listing.id} />
            </Card>
          ) : null}

          {/* G4 / G5: promote the listing, photo services, its Facebook Page posts. */}
          <ListingGrowth context={context} listing={listing} />
        </DetailLayout>
      </ListingSaveProvider>
    </OwnerPage>
  );
}

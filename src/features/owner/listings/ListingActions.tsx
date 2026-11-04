"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { ActionPanel } from "@/ui/components/DetailLayout";
import { MobileActionBar } from "@/ui/components/FormLayout";
import { IconArchive } from "@/ui/icons/glyphs/archive";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconExternal } from "@/ui/icons/glyphs/external";
import { IconHide } from "@/ui/icons/glyphs/hide";
import { IconPlay } from "@/ui/icons/glyphs/play";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";

import { ListingSaveButton } from "./ListingSave";

type Action = "submit" | "pause" | "resume";
const PATH = {
  submit: "/v1/owner/listings/{listingId}/actions/submit",
  pause: "/v1/owner/listings/{listingId}/actions/pause",
  resume: "/v1/owner/listings/{listingId}/actions/resume",
} as const;

/**
 * The listing's review panel (F6.2, G5): where it stands (the state in words, the moderator's reasons), then one
 * filled action — publish a draft or a returned listing, otherwise save the details — the public page and pause /
 * resume / relist outlined, and closing the listing last. When the API says the listing is incomplete, the missing
 * items are listed in plain words instead of a generic error. Nothing here decides state: every button asks the API.
 */
export function ListingPanel({
  listing,
  status,
  notice,
  viewHref,
}: {
  listing: Schemas["ListingDto"];
  status: React.ReactNode;
  /** Why it is in review, the moderator's reason, hidden after reports — from the server. */
  notice?: React.ReactNode;
  /** The public page, while the listing is live. */
  viewHref: string | null;
}) {
  const t = useTranslations("owner.listings.editor");
  const action = useApiAction<Schemas["ListingDto"]>();
  const router = useRouter();
  const params = { params: { path: { listingId: listing.id } } };
  const run = (which: Action) => action.run(() => unwrap(browserApi().POST(PATH[which], params)));
  const incomplete =
    isApiError(action.error) && action.error.code === "listing.incomplete" ? action.error.errors : null;
  const publishFirst = listing.state === "draft" || listing.state === "rejected";

  const submit = (
    <Button
      iconStart={IconCheckCircle}
      loading={action.busy}
      onClick={() => run("submit")}
      data-testid="listing-submit"
    >
      {t("submit")}
    </Button>
  );
  const others = (
    <>
      {viewHref ? (
        <Button asChild variant="secondary" iconStart={IconExternal}>
          <a href={viewHref} target="_blank" rel="noopener noreferrer" data-testid="listing-view">
            {t("view")}
          </a>
        </Button>
      ) : null}
      {listing.state === "published" ? (
        <Button
          variant="secondary"
          iconStart={IconHide}
          loading={action.busy}
          onClick={() => run("pause")}
          data-testid="listing-pause"
        >
          {t("pause")}
        </Button>
      ) : null}
      {listing.state === "paused" && !listing.hidden ? (
        <Button
          variant="secondary"
          iconStart={IconPlay}
          loading={action.busy}
          onClick={() => run("resume")}
          data-testid="listing-resume"
        >
          {t("resume")}
        </Button>
      ) : null}
      {listing.state === "closed" ? (
        <Button
          variant="secondary"
          iconStart={IconRefresh}
          loading={action.busy}
          onClick={() =>
            action.run(
              () => unwrap(browserApi().POST("/v1/owner/listings/{listingId}/actions/relist", params)),
              (fresh) => router.push(`../listings/${fresh.id}`),
            )
          }
          data-testid="listing-relist"
        >
          {t("relist")}
        </Button>
      ) : null}
    </>
  );

  return (
    <>
      <ActionPanel
        testId="listing-panel"
        title={t("panelTitle")}
        status={status}
        description={
          <span id="listing-state" data-testid="listing-state-hint">
            {t(`state.${listing.state}`)}
          </span>
        }
        primary={
          <>
            {notice ? <div className="flex flex-col gap-2 [&>*]:w-full">{notice}</div> : null}
            {publishFirst ? (
              submit
            ) : (
              <ListingSaveButton testId="listing-details-save" label={t("save")} className="max-md:hidden" />
            )}
          </>
        }
        secondary={
          <>
            {publishFirst ? (
              <ListingSaveButton testId="listing-details-save" label={t("save")} variant="secondary" />
            ) : null}
            {others}
            {incomplete ? (
              <Callout tone="warning" title={t("incompleteTitle")}>
                <ul className="m-0 list-disc ps-5" data-testid="listing-missing">
                  {incomplete.map((error) => {
                    const key = `missing.${error.path.split(".").pop()}`;
                    return <li key={error.path}>{t.has(key) ? t(key, { message: error.message }) : error.message}</li>;
                  })}
                </ul>
              </Callout>
            ) : (
              <ProblemNotice error={action.error} />
            )}
          </>
        }
        destructive={
          listing.state !== "closed" ? (
            <ConfirmAction
              label={t("close")}
              icon={IconArchive}
              variant="destructive"
              tone="destructive"
              testId="listing-close"
              title={t("closeTitle")}
              description={t("closeBody")}
              confirmLabel={t("close")}
              successMessage={t("closed")}
              onConfirm={() => unwrap(browserApi().POST("/v1/owner/listings/{listingId}/actions/close", params))}
            />
          ) : undefined
        }
      />
      <MobileActionBar>
        <ListingSaveButton testId="listing-details-save-phone" label={t("save")} className="flex-1" />
      </MobileActionBar>
    </>
  );
}

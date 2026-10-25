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
import { IconArchive } from "@/ui/icons/glyphs/archive";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconHide } from "@/ui/icons/glyphs/hide";
import { IconPlay } from "@/ui/icons/glyphs/play";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";

type Action = "submit" | "pause" | "resume";
const PATH = {
  submit: "/v1/owner/listings/{listingId}/actions/submit",
  pause: "/v1/owner/listings/{listingId}/actions/pause",
  resume: "/v1/owner/listings/{listingId}/actions/resume",
} as const;

/**
 * The listing's next step (F6.2): publish a draft (or a rejected listing after fixing it), pause, resume, close. When
 * the API says the listing is incomplete, the missing items are listed in plain words instead of a generic error.
 */
export function ListingActions({ listing }: { listing: Schemas["ListingDto"] }) {
  const t = useTranslations("owner.listings.editor");
  const action = useApiAction<Schemas["ListingDto"]>();
  const router = useRouter();
  const params = { params: { path: { listingId: listing.id } } };
  const run = (which: Action) => action.run(() => unwrap(browserApi().POST(PATH[which], params)));
  const incomplete =
    isApiError(action.error) && action.error.code === "listing.incomplete" ? action.error.errors : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {listing.state === "draft" || listing.state === "rejected" ? (
          <Button
            iconStart={IconCheckCircle}
            loading={action.busy}
            onClick={() => run("submit")}
            data-testid="listing-submit"
          >
            {t("submit")}
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
          <Button iconStart={IconPlay} loading={action.busy} onClick={() => run("resume")} data-testid="listing-resume">
            {t("resume")}
          </Button>
        ) : null}
        {listing.state === "closed" ? (
          <Button
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
        {listing.state !== "closed" ? (
          <ConfirmAction
            label={t("close")}
            icon={IconArchive}
            variant="secondary"
            tone="destructive"
            testId="listing-close"
            title={t("closeTitle")}
            description={t("closeBody")}
            confirmLabel={t("close")}
            successMessage={t("closed")}
            onConfirm={() => unwrap(browserApi().POST("/v1/owner/listings/{listingId}/actions/close", params))}
          />
        ) : null}
      </div>
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
    </div>
  );
}

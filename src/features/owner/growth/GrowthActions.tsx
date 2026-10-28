"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";
import { IconCamera } from "@/ui/icons/glyphs/camera";
import { IconMegaphone } from "@/ui/icons/glyphs/megaphone";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";

/**
 * Buys a boost (G5, D-297) for one listing or one building: the dialog restates the product, what it promotes, how
 * long and the price incl. VAT the API quoted — or that it is free for this tenant (`boost.building.free`). One
 * Idempotency-Key per opening. The API issues a purchase invoice; the boost starts when it is paid, after a boost of
 * the same target still running. No credits or wallet (D-298).
 */
export function BuyBoost({
  target,
  targetId,
  targetName,
  productId,
  name,
  duration,
  total,
  free,
  testId,
}: {
  target: Schemas["BoostTarget"];
  targetId: string;
  targetName: string;
  productId: string;
  name: string;
  /** "7 วัน" / "1 month". */
  duration: string;
  /** Formatted price incl. VAT from the API; null when free. */
  total: string | null;
  free: boolean;
  testId?: string;
}) {
  const t = useTranslations("owner.growth.boost");
  return (
    <ConfirmAction
      label={free ? t("startFree") : t("buy")}
      icon={IconMegaphone}
      size="sm"
      variant={free ? "secondary" : "primary"}
      testId={testId ?? "boost-buy"}
      title={t("buyTitle", { name })}
      description={
        free || !total
          ? t("freeBody", { target: targetName, duration })
          : t("buyBody", { target: targetName, duration, total })
      }
      confirmLabel={free ? t("startFree") : t("confirmBuy")}
      successMessage={free ? t("started") : t("bought")}
      onConfirm={(idempotencyKey) =>
        target === "listing"
          ? unwrap(
              browserApi().POST("/v1/owner/listings/{listingId}/boosts", {
                params: { path: { listingId: targetId }, header: { "Idempotency-Key": idempotencyKey } },
                body: { productId },
              }),
            )
          : unwrap(
              browserApi().POST("/v1/owner/buildings/{buildingId}/boosts", {
                params: { path: { buildingId: targetId }, header: { "Idempotency-Key": idempotencyKey } },
                body: { productId },
              }),
            )
      }
    />
  );
}

/**
 * Orders a verified photo / 360° visit for one listing (G5, D-297): restates the service, the listing and the price
 * incl. VAT; an optional note for the photographer. The platform books the partner once the invoice is paid (O-032).
 */
export function OrderMediaService({
  listingId,
  listingTitle,
  service,
  name,
  total,
}: {
  listingId: string;
  listingTitle: string;
  service: Schemas["MediaServiceKind"];
  name: string;
  total: string;
}) {
  const t = useTranslations("owner.growth.media");
  const [note, setNote] = useState("");
  return (
    <ConfirmAction
      label={t("order")}
      icon={IconCamera}
      size="sm"
      testId={`media-order-${service}`}
      title={t("orderTitle", { name })}
      description={t("orderBody", { listing: listingTitle, total })}
      confirmLabel={t("confirmOrder")}
      successMessage={t("ordered")}
      onConfirm={(idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/owner/media-service-orders", {
            params: { header: { "Idempotency-Key": idempotencyKey } },
            body: { listingId, service, note: note.trim() || null },
          }),
        )
      }
    >
      <Field label={t("note")} hint={t("noteHint")}>
        <Textarea
          value={note}
          maxLength={1000}
          onChange={(event) => setNote(event.target.value)}
          data-testid="media-order-note"
        />
      </Field>
    </ConfirmAction>
  );
}

/**
 * Asks the worker to try a failed Page post again (G4, D-288): whatever the listing needs now — publish, edit or
 * delete. Idempotency-Key per click; `social.post_invalid_state` (the Page is not verified any more) is explained.
 */
export function RetrySocialPost({ listingId, postId }: { listingId: string; postId: string }) {
  const t = useTranslations("owner.growth.posts");
  const action = useApiAction<Schemas["SocialPostDto"]>();
  // One key per attempt; an unanswered attempt (network failure) is retried with the same key (review L2).
  const key = useRef("");
  return (
    <span className="flex flex-col items-start gap-2">
      <Button
        size="sm"
        variant="secondary"
        iconStart={IconRefresh}
        loading={action.busy}
        data-testid="social-post-retry"
        onClick={() => {
          if (!key.current || !action.unansweredAttempt()) key.current = crypto.randomUUID();
          void action.run(
            () =>
              unwrap(
                browserApi().POST("/v1/owner/listings/{listingId}/social-posts/{postId}/actions/retry", {
                  params: { path: { listingId, postId }, header: { "Idempotency-Key": key.current } },
                }),
              ),
            () => {
              toast.success(t("retried"));
            },
          );
        }}
      >
        {t("retry")}
      </Button>
      <ProblemNotice error={action.error} />
    </span>
  );
}

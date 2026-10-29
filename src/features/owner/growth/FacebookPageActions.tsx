"use client";

import { useTranslations } from "next-intl";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { SECRET_FIELD_PROPS } from "@/features/shared/console/secret-field";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";
import { IconLink } from "@/ui/icons/glyphs/link";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";
import { IconRemove } from "@/ui/icons/glyphs/remove";

type Page = Schemas["SocialChannelDto"];

/**
 * Connects the tenant's own Facebook Page (G4, D-288): the Page id and a Page access token from Meta → the API asks
 * Facebook first (a refused token stores nothing, `facebook.page_refused`), then seals the token — it is never shown
 * again. Connecting replaces the Page connected before. Idempotency-Key per opening.
 */
export function ConnectFacebookPage({ replacing }: { replacing: boolean }) {
  const t = useTranslations("owner.growth.facebook");
  return (
    <FormDialog
      label={replacing ? t("replace") : t("connect")}
      icon={IconLink}
      variant={replacing ? "secondary" : "primary"}
      testId="facebook-connect"
      title={t("connectTitle")}
      description={t("connectHint")}
      submitLabel={t("submit")}
      successMessage={t("connected")}
      onSubmit={(data, _ack, idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/owner/social-channels", {
            params: { header: { "Idempotency-Key": idempotencyKey } },
            body: {
              pageId: (text(data, "pageId") ?? "").replace(/\D/g, ""),
              pageAccessToken: (text(data, "pageAccessToken") ?? "").trim(),
              autoPost: data.get("autoPost") === "on",
            },
          }),
        )
      }
    >
      {(errors) => (
        <>
          <Field label={t("pageId")} hint={t("pageIdHint")} error={errors.pageId} required>
            <Input
              name="pageId"
              required
              inputMode="numeric"
              pattern="\d{5,30}"
              autoComplete="off"
              className="font-mono"
              data-testid="facebook-page-id"
            />
          </Field>
          <Field label={t("token")} hint={t("tokenHint")} error={errors.pageAccessToken} required>
            <Input
              name="pageAccessToken"
              {...SECRET_FIELD_PROPS}
              required
              minLength={10}
              data-testid="facebook-token"
            />
          </Field>
          <Switch name="autoPost" defaultChecked label={t("autoPost")} description={t("autoPostHint")} />
          {replacing ? <p className="text-muted text-sm">{t("replaceNote")}</p> : null}
        </>
      )}
    </FormDialog>
  );
}

/** `POST …/actions/verify`: asks Facebook for the Page again (after renewing the token or the Page role). */
export function VerifyFacebookPage({ page }: { page: Page }) {
  const t = useTranslations("owner.growth.facebook");
  const action = useApiAction<Page>();
  return (
    <span className="flex flex-col items-start gap-2">
      <Button
        size="sm"
        variant="secondary"
        iconStart={IconRefresh}
        loading={action.busy}
        data-testid="facebook-verify"
        onClick={() =>
          void action.run(
            () =>
              unwrap(
                browserApi().POST("/v1/owner/social-channels/{channelId}/actions/verify", {
                  params: { path: { channelId: page.id } },
                }),
              ),
            (checked) => {
              if (checked.state === "verified") toast.success(t("verified"));
              else toast.error(t("stillFailing"));
            },
          )
        }
      >
        {t("verify")}
      </Button>
      <ProblemNotice error={action.error} />
    </span>
  );
}

/** `POST …/actions/revoke`: nothing more is posted; waiting posts are dropped; posts already there stay. */
export function RevokeFacebookPage({ page }: { page: Page }) {
  const t = useTranslations("owner.growth.facebook");
  return (
    <ConfirmAction
      label={t("revoke")}
      icon={IconRemove}
      size="sm"
      variant="destructive"
      tone="destructive"
      testId="facebook-revoke"
      title={t("revokeTitle", { name: page.pageName ?? page.pageId })}
      description={t("revokeBody")}
      confirmLabel={t("revoke")}
      successMessage={t("revoked")}
      onConfirm={() =>
        unwrap(
          browserApi().POST("/v1/owner/social-channels/{channelId}/actions/revoke", {
            params: { path: { channelId: page.id } },
          }),
        )
      }
    />
  );
}

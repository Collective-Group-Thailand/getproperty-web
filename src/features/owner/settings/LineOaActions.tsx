"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { text } from "@/features/shared/console/FormDialog";
import { SECRET_FIELD_PROPS } from "@/features/shared/console/secret-field";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { vatPercent } from "@/features/shared/growth/sponsored";
import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { LazyDialog } from "@/ui/components/overlays";
import { toast } from "@/ui/components/Toast";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCopy } from "@/ui/icons/glyphs/copy";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";
import { IconRemove } from "@/ui/icons/glyphs/remove";

type Channel = Schemas["MessagingChannelDto"];

/** The LINE OA integration prices in force (G4, D-287): from the add-on offer or a `messaging.addon_terms_required`. */
export interface AddonTerms {
  versionId: string;
  monthlyFee: string;
  setupFee: string;
  vatRate: string;
  /** Whether the setup fee was invoiced already (it is charged once). */
  setupCharged: boolean;
}

const ADDON_TERMS_REQUIRED = "messaging.addon_terms_required";

/**
 * Connect an own LINE OA (D-254): the channel's id, secret and long-lived access token from LINE Developers →
 * `POST /v1/owner/messaging/channels`, which checks the token with LINE at once. A token LINE refuses is kept as
 * `failing` with the reason, so the owner fixes it on the channel and re-checks instead of typing it all again.
 */
export function ConnectLineOa({
  buildings,
  addon = null,
}: {
  buildings: { id: string; name: string }[];
  /** The agency add-on's prices while it is on sale (D-287); null = connecting is free. */
  addon?: AddonTerms | null;
}) {
  const t = useTranslations("owner.settings.lineOa");
  const common = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [terms, setTerms] = useState<AddonTerms | null>(addon);
  const [accepted, setAccepted] = useState(false);
  const [changed, setChanged] = useState(false);
  const action = useApiAction<Channel>({ refresh: false });
  const termsError = isApiError(action.error) && action.error.code === ADDON_TERMS_REQUIRED;
  const close = () => {
    setOpen(false);
    router.refresh();
  };
  return (
    <>
      <Button
        iconStart={IconAdd}
        onClick={() => {
          action.reset();
          setAccepted(false);
          setChanged(false);
          setOpen(true);
        }}
        data-testid="line-oa-connect"
      >
        {t("connect")}
      </Button>
      <LazyDialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        title={t("connectTitle")}
        description={t("connectHint")}
        closeLabel={common("close")}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={action.busy}>
              {common("cancel")}
            </Button>
            <Button
              type="submit"
              form="line-oa-form"
              loading={action.busy}
              disabled={terms !== null && !accepted}
              data-testid="line-oa-submit"
            >
              {t("submit")}
            </Button>
          </>
        }
      >
        <form
          id="line-oa-form"
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void action.run(
              () =>
                unwrap(
                  browserApi().POST("/v1/owner/messaging/channels", {
                    body: {
                      buildingId: text(data, "buildingId") ?? null,
                      lineChannelId: (text(data, "lineChannelId") ?? "").replace(/\D/g, ""),
                      channelSecret: (text(data, "channelSecret") ?? "").trim(),
                      accessToken: (text(data, "accessToken") ?? "").trim(),
                      ...(terms && accepted ? { acceptAddonVersionId: terms.versionId } : {}),
                    },
                  }),
                ).catch((failure: unknown) => {
                  // The prices changed (or were published) since the page loaded: show the ones in force, ask again.
                  const priced =
                    isApiError(failure) && failure.code === ADDON_TERMS_REQUIRED ? failure.problem.addon : null;
                  if (priced) {
                    setTerms({ ...priced, setupCharged: terms?.setupCharged ?? false });
                    setAccepted(false);
                    setChanged(true);
                  }
                  throw failure;
                }),
              (channel) => {
                if (channel.state === "verified") toast.success(t("connected", { name: channel.botName ?? "LINE OA" }));
                else toast.error(t("failedConnect"));
                close();
              },
            );
          }}
        >
          {buildings.length > 1 ? (
            <Field label={t("scope")} hint={t("scopeHint")}>
              <NativeSelect
                name="buildingId"
                defaultValue=""
                options={[
                  { value: "", label: t("scopeAll") },
                  ...buildings.map((building) => ({ value: building.id, label: building.name })),
                ]}
              />
            </Field>
          ) : null}
          <Field label={t("channelId")} required>
            <Input
              name="lineChannelId"
              required
              inputMode="numeric"
              pattern="\d{6,20}"
              autoComplete="off"
              className="font-mono"
              data-testid="line-oa-channel-id"
            />
          </Field>
          <Field label={t("channelSecret")} required>
            <Input name="channelSecret" {...SECRET_FIELD_PROPS} required minLength={16} data-testid="line-oa-secret" />
          </Field>
          <Field label={t("accessToken")} required>
            <Input name="accessToken" {...SECRET_FIELD_PROPS} required minLength={20} data-testid="line-oa-token" />
          </Field>
          <p className="text-muted text-sm">{t("replaceNote")}</p>
          {terms ? (
            <div
              className="border-border rounded-card flex flex-col gap-3 border p-4"
              data-testid="line-oa-addon-terms"
            >
              {changed ? <Callout tone="warning">{t("addon.changed")}</Callout> : null}
              <p className="m-0 font-semibold">{t("addon.termsTitle")}</p>
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm tabular-nums">
                <li>{t("addon.monthly", { amount: formatTHB(terms.monthlyFee, locale) })}</li>
                <li>
                  {terms.setupCharged
                    ? t("addon.setupCharged")
                    : t("addon.setup", { amount: formatTHB(terms.setupFee, locale) })}
                </li>
                <li className="text-muted">{t("addon.vat", { rate: vatPercent(terms.vatRate, locale) })}</li>
              </ul>
              <p className="text-muted m-0 text-sm">{t("addon.how")}</p>
              <Checkbox
                checked={accepted}
                onCheckedChange={(value) => setAccepted(value === true)}
                label={t("addon.accept")}
                data-testid="line-oa-addon-accept"
              />
            </div>
          ) : null}
          <ProblemNotice error={termsError ? null : action.error} />
        </form>
      </LazyDialog>
    </>
  );
}

/** The channel's webhook URL, to paste in LINE Developers. */
export function CopyWebhookUrl({ url }: { url: string }) {
  const t = useTranslations("owner.settings.lineOa");
  return (
    <Button
      size="sm"
      variant="secondary"
      iconStart={IconCopy}
      onClick={() =>
        void navigator.clipboard
          ?.writeText(url)
          .then(() => toast.success(t("copied")))
          .catch(() => undefined)
      }
      data-testid="line-oa-copy"
    >
      {t("copy")}
    </Button>
  );
}

/** `POST …/actions/verify`: asks LINE again (after fixing the token or turning the webhook on). */
export function VerifyLineOa({ channel }: { channel: Channel }) {
  const t = useTranslations("owner.settings.lineOa");
  const action = useApiAction<Channel>();
  return (
    <span className="flex flex-col gap-2">
      <Button
        size="sm"
        variant="secondary"
        iconStart={IconRefresh}
        loading={action.busy}
        data-testid={`line-oa-verify-${channel.id}`}
        onClick={() =>
          void action.run(
            () =>
              unwrap(
                browserApi().POST("/v1/owner/messaging/channels/{channelId}/actions/verify", {
                  params: { path: { channelId: channel.id } },
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

/** `POST …/actions/revoke` — messages go back to the shared getproperty OA. */
export function RevokeLineOa({ channel }: { channel: Channel }) {
  const t = useTranslations("owner.settings.lineOa");
  const name = channel.botName ?? channel.lineChannelId;
  return (
    <ConfirmAction
      label={t("revoke")}
      icon={IconRemove}
      size="sm"
      variant="destructive"
      tone="destructive"
      testId={`line-oa-revoke-${channel.id}`}
      title={t("revokeTitle", { name })}
      description={t("revokeBody")}
      confirmLabel={t("revoke")}
      successMessage={t("revoked")}
      onConfirm={() =>
        unwrap(
          browserApi().POST("/v1/owner/messaging/channels/{channelId}/actions/revoke", {
            params: { path: { channelId: channel.id } },
          }),
        )
      }
    />
  );
}

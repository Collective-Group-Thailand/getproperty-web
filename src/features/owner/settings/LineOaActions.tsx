"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { text } from "@/features/shared/console/FormDialog";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
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

/**
 * Connect an own LINE OA (D-254): the channel's id, secret and long-lived access token from LINE Developers →
 * `POST /v1/owner/messaging/channels`, which checks the token with LINE at once. A token LINE refuses is kept as
 * `failing` with the reason, so the owner fixes it on the channel and re-checks instead of typing it all again.
 */
export function ConnectLineOa({ buildings }: { buildings: { id: string; name: string }[] }) {
  const t = useTranslations("owner.settings.lineOa");
  const common = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const action = useApiAction<Channel>({ refresh: false });
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
            <Button type="submit" form="line-oa-form" loading={action.busy} data-testid="line-oa-submit">
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
                    },
                  }),
                ),
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
            <Input
              name="channelSecret"
              type="password"
              required
              minLength={16}
              autoComplete="off"
              spellCheck={false}
              data-testid="line-oa-secret"
            />
          </Field>
          <Field label={t("accessToken")} required>
            <Input
              name="accessToken"
              type="password"
              required
              minLength={20}
              autoComplete="off"
              spellCheck={false}
              data-testid="line-oa-token"
            />
          </Field>
          <p className="text-muted text-sm">{t("replaceNote")}</p>
          <ProblemNotice error={action.error} />
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

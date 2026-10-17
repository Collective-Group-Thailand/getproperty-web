"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { formatDateTime } from "@/i18n/format";
import { useLocale } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { LazyDialog } from "@/ui/components/overlays";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { IconCopy } from "@/ui/icons/glyphs/copy";
import { IconQr } from "@/ui/icons/glyphs/qr";

import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";

/**
 * Invite a party of a lease to the resident app (F2 2.2, D-175): a one-time code shown once — as a QR
 * to scan on the spot (LINE), sent by SMS, or as a link — that opens `getproperty-liff`'s link page.
 * Accepting it links the resident's login to the party; the code is never retrievable later.
 */
export function LeaseInviteButton({
  leaseId,
  parties,
  size = "sm",
}: {
  leaseId: string;
  parties: Pick<Schemas["LeasePartyViewDto"], "partyId" | "displayName" | "role">[];
  size?: "sm" | "md";
}) {
  const t = useTranslations("owner.leases.invite");
  const common = useTranslations("common");
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<Schemas["LeaseInvitationChannel"]>("line_qr");
  const [partyId, setPartyId] = useState(parties[0]?.partyId ?? "");
  const [created, setCreated] = useState<Schemas["LeaseInvitationCreatedDto"] | null>(null);
  const action = useApiAction();

  return (
    <>
      <Button
        size={size}
        variant="secondary"
        iconStart={IconQr}
        onClick={() => {
          setCreated(null);
          action.reset();
          setOpen(true);
        }}
        data-testid="invite-resident"
      >
        {t("button")}
      </Button>
      <LazyDialog
        open={open}
        onOpenChange={setOpen}
        title={t("title")}
        description={t("body")}
        closeLabel={common("close")}
      >
        {created ? (
          <div
            className="flex flex-col items-center gap-3"
            data-testid="invitation-created"
            data-channel={created.channel}
          >
            {created.channel === "sms" ? (
              <Callout tone="success">{t("smsSent")}</Callout>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- the API's PNG data URL of the invitation QR
              <img
                src={created.qrPngDataUrl}
                alt={t("qrAlt")}
                width={240}
                height={240}
                className="rounded-md border"
                data-testid="invitation-qr"
              />
            )}
            <p className="font-mono text-lg tracking-wider" data-testid="invitation-code">
              {created.code}
            </p>
            <p className="text-muted text-sm">{t("expires", { at: formatDateTime(created.expiresAt, locale) })}</p>
            <Button
              size="sm"
              variant="ghost"
              iconStart={IconCopy}
              onClick={() => void navigator.clipboard?.writeText(created.url).catch(() => undefined)}
            >
              {t("copyLink")}
            </Button>
            <p className="text-muted text-center text-xs">{t("once")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <SegmentedControl
              label={t("channel")}
              value={channel}
              onValueChange={(value) => setChannel(value as Schemas["LeaseInvitationChannel"])}
              options={[
                { value: "line_qr", label: t("lineQr") },
                { value: "sms", label: t("sms") },
                { value: "link", label: t("link") },
              ]}
            />
            {parties.length > 1 ? (
              <Field label={t("party")}>
                <NativeSelect
                  value={partyId}
                  onChange={(event) => setPartyId(event.target.value)}
                  options={parties.map((party) => ({
                    value: party.partyId,
                    label: party.displayName ?? party.partyId,
                  }))}
                />
              </Field>
            ) : null}
            <ProblemNotice error={action.error} />
            <div className="flex justify-end">
              <Button
                loading={action.busy}
                onClick={() =>
                  void action.run(
                    () =>
                      unwrap(
                        browserApi().POST("/v1/owner/leases/{leaseId}/invitations", {
                          params: { path: { leaseId } },
                          body: { channel, partyId: partyId || undefined, language: locale },
                        }),
                      ),
                    (result) => setCreated(result as Schemas["LeaseInvitationCreatedDto"]),
                  )
                }
                data-testid="invitation-create"
              >
                {t("create")}
              </Button>
            </div>
          </div>
        )}
      </LazyDialog>
    </>
  );
}

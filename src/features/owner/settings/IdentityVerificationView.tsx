import { getTranslations } from "next-intl/server";

import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";

import { section, type OwnerContext } from "../shared/server";
import { PendingIdentityVerification, StartIdentityVerification } from "./IdentityVerificationActions";
import { SettingsNav } from "./SettingsNav";

/**
 * Settings › Identity (D-267) — personal, so every member sees it: verify once at a licensed e-KYC provider (ID card
 * and selfie, O-021) and the "identity verified" badge shows on the owner's listings and public page. Only the
 * outcome is kept. Without a provider configured the page says it is not offered yet.
 */
export async function IdentityVerificationView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.settings.verification");
  const { api, locale, me } = context;
  const status = await section(unwrap(api.GET("/v1/owner/me/identity-verification")));
  const s = status.data;
  const latest = s?.latest ?? null;
  return (
    <OwnerPage testId="identity-verification">
      <PageHeader title={t("title")} description={t("description")} />
      <SettingsNav me={me} current="/settings/verification" locale={locale} />
      {!s ? (
        <SectionError error={status.error} />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card
            as="section"
            className="flex flex-col gap-5"
            data-testid="verification-status"
            data-state={s.verified ? "verified" : (latest?.state ?? "none")}
          >
            <CardHeader
              title={t("statusTitle")}
              action={
                s.verified ? (
                  <Badge tone="success" icon={IconCheckCircle}>
                    {t("verified")}
                  </Badge>
                ) : latest?.state === "pending" ? (
                  <Badge tone="warning">{t("pending")}</Badge>
                ) : (
                  <Badge tone="neutral">{t("notVerified")}</Badge>
                )
              }
            />
            {s.verified ? (
              <p className="text-sm" data-testid="verification-verified">
                {t("verifiedBody", { date: s.verifiedAt ? formatDateTime(s.verifiedAt, locale) : "" })}
              </p>
            ) : !s.available ? (
              <Callout tone="info" title={t("unavailableTitle")}>
                {t("unavailableBody")}
              </Callout>
            ) : latest?.state === "pending" && latest.verificationUrl ? (
              <>
                <p className="text-sm">{t("pendingBody", { date: formatDateTime(latest.expiresAt, locale) })}</p>
                <PendingIdentityVerification url={latest.verificationUrl} />
              </>
            ) : (
              <>
                {latest?.state === "rejected" ? (
                  <Callout tone="danger" title={t("rejectedTitle")}>
                    <span data-testid="verification-reason">{latest.failureReason ?? t("rejectedNoReason")}</span>
                  </Callout>
                ) : null}
                {latest?.state === "expired" ? <Callout tone="warning">{t("expired")}</Callout> : null}
                <ol className="m-0 flex list-none flex-col gap-3 p-0">
                  {(["card", "selfie", "result"] as const).map((step, index) => (
                    <li key={step} className="flex gap-3">
                      <span
                        className="bg-primary-subtle text-primary-subtle-fg flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums"
                        aria-hidden="true"
                      >
                        {index + 1}
                      </span>
                      <span className="flex flex-col">
                        <span className="font-medium">{t(`steps.${step}.title`)}</span>
                        <span className="text-muted text-sm">{t(`steps.${step}.body`)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <StartIdentityVerification again={latest?.state === "rejected" || latest?.state === "expired"} />
              </>
            )}
          </Card>
          <Card as="section" className="flex flex-col gap-3" aria-labelledby="verification-why">
            <CardHeader title={<span id="verification-why">{t("whyTitle")}</span>} />
            <ul className="text-muted m-0 flex list-disc flex-col gap-2 ps-5 text-sm">
              <li>{t("why.badge")}</li>
              <li>{t("why.trust")}</li>
              <li>{t("why.privacy")}</li>
            </ul>
          </Card>
        </div>
      )}
    </OwnerPage>
  );
}

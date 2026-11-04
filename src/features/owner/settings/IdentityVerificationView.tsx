import { getTranslations } from "next-intl/server";

import { SectionError } from "@/features/shared/console/SectionError";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconIdentify } from "@/ui/icons/glyphs/identify";

import { section, type OwnerContext } from "../shared/server";
import { PendingIdentityVerification, StartIdentityVerification } from "./IdentityVerificationActions";
import { SettingsCard, SettingsFrame } from "./SettingsNav";

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
  const badge = !s ? null : s.verified ? (
    <Badge tone="success" icon={IconCheckCircle}>
      {t("verified")}
    </Badge>
  ) : latest?.state === "pending" ? (
    <Badge tone="warning" icon={IconClock}>
      {t("pending")}
    </Badge>
  ) : (
    <Badge tone="neutral" icon={IconIdentify}>
      {t("notVerified")}
    </Badge>
  );
  return (
    <SettingsFrame
      me={me}
      locale={locale}
      current="/settings/verification"
      title={t("title")}
      description={t("description")}
      testId="identity-verification"
    >
      {!s ? (
        <SectionError error={status.error} />
      ) : (
        <>
          <section
            aria-labelledby="verification-status-title"
            className="rounded-card border-border bg-surface shadow-card flex flex-col gap-5 border p-5 md:p-6"
            data-testid="verification-status"
            data-state={s.verified ? "verified" : (latest?.state ?? "none")}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="verification-status-title" className="text-lg font-semibold">
                {t("statusTitle")}
              </h2>
              {badge}
            </div>
            {s.verified ? (
              <p className="text-base" data-testid="verification-verified">
                {t("verifiedBody", { date: s.verifiedAt ? formatDateTime(s.verifiedAt, locale) : "" })}
              </p>
            ) : !s.available ? (
              <Callout tone="info" title={t("unavailableTitle")}>
                {t("unavailableBody")}
              </Callout>
            ) : latest?.state === "pending" && latest.verificationUrl ? (
              <>
                <p className="text-base">{t("pendingBody", { date: formatDateTime(latest.expiresAt, locale) })}</p>
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
                <p className="text-base">{t("startBody")}</p>
                <div>
                  <StartIdentityVerification again={latest?.state === "rejected" || latest?.state === "expired"} />
                </div>
              </>
            )}
          </section>

          {!s.verified ? (
            <SettingsCard id="verification-how" title={t("howTitle")}>
              <ol className="m-0 flex list-none flex-col gap-4 p-0">
                {(["card", "selfie", "result"] as const).map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span
                      className="border-border-strong text-fg grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums"
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
            </SettingsCard>
          ) : null}

          <SettingsCard id="verification-why" title={t("whyTitle")}>
            <ul className="text-muted m-0 flex list-disc flex-col gap-2 ps-5 text-sm">
              <li>{t("why.badge")}</li>
              <li>{t("why.trust")}</li>
              <li>{t("why.privacy")}</li>
            </ul>
          </SettingsCard>
        </>
      )}
    </SettingsFrame>
  );
}

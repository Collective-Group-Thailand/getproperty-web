"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { IconExternal } from "@/ui/icons/glyphs/external";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";
import { IconShield } from "@/ui/icons/glyphs/shield";

type Status = Schemas["IdentityVerificationDto"];

/**
 * `POST /v1/owner/me/identity-verification` — opens (or resumes) a session at the e-KYC provider (D-267, O-021) and
 * goes to its page; the provider sends the owner back to Settings › Identity, where the outcome shows.
 */
export function StartIdentityVerification({ again = false }: { again?: boolean }) {
  const t = useTranslations("owner.settings.verification");
  const action = useApiAction<Status>();
  return (
    <span className="flex flex-col items-start gap-2">
      <Button
        iconStart={IconShield}
        loading={action.busy}
        data-testid="verification-start"
        onClick={() =>
          void action.run(
            () => unwrap(browserApi().POST("/v1/owner/me/identity-verification", { body: {} })),
            (status) => {
              const url = status.latest?.state === "pending" ? status.latest.verificationUrl : null;
              if (url) window.location.assign(url);
            },
          )
        }
      >
        {again ? t("startAgain") : t("start")}
      </Button>
      <ProblemNotice error={action.error} />
    </span>
  );
}

/** While pending: continue at the provider's page, or read the outcome again. */
export function PendingIdentityVerification({ url }: { url: string }) {
  const t = useTranslations("owner.settings.verification");
  const router = useRouter();
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Button asChild iconStart={IconExternal}>
        <a href={url} data-testid="verification-continue">
          {t("continue")}
        </a>
      </Button>
      <Button
        variant="secondary"
        iconStart={IconRefresh}
        onClick={() => router.refresh()}
        data-testid="verification-refresh"
      >
        {t("refresh")}
      </Button>
    </span>
  );
}

"use client";

import { useTranslations } from "next-intl";

import { oauthStartHref } from "@/features/shared/auth/OAuthButtons";
import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { Button } from "@/ui/components/Button";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconRemove } from "@/ui/icons/glyphs/remove";

type Provider = "google" | "apple" | "line";

/** Adds Google / Apple / LINE: through the provider, back to this page (`?linked=`). */
export function AddSignInMethod({ provider, locale }: { provider: Provider; locale: Locale }) {
  const t = useTranslations("owner.settings.signIn");
  return (
    <Button asChild variant="secondary" size="sm" iconStart={IconAdd}>
      <a href={oauthStartHref(provider, "link", locale)} data-testid={`sign-in-add-${provider}`}>
        {t("add", { provider: t(`providers.${provider}`) })}
      </a>
    </Button>
  );
}

/** Removes Google / Apple (the API keeps at least one way to sign in, `auth.identity_last`). */
export function RemoveSignInMethod({ identityId, provider }: { identityId: string; provider: Provider }) {
  const t = useTranslations("owner.settings.signIn");
  const name = t(`providers.${provider}`);
  return (
    <ConfirmAction
      label={t("remove")}
      icon={IconRemove}
      size="sm"
      variant="secondary"
      testId={`sign-in-remove-${provider}`}
      title={t("removeTitle", { provider: name })}
      description={t("removeBody", { provider: name })}
      confirmLabel={t("remove")}
      successMessage={t("removed", { provider: name })}
      onConfirm={() =>
        unwrap(browserApi().DELETE("/v1/owner/me/identities/{identityId}", { params: { path: { identityId } } }))
      }
    />
  );
}

import { getTranslations } from "next-intl/server";

import { OAuthError } from "@/features/shared/auth/OAuthError";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { oauthProviders } from "@/lib/auth/oauth/enabled";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Icon, type IconGlyph } from "@/ui/icons";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconLink } from "@/ui/icons/glyphs/link";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconPhone } from "@/ui/icons/glyphs/phone";

import { param, section, type OwnerContext } from "../shared/server";
import { SettingsCard, SettingsFrame } from "./SettingsNav";
import { AddSignInMethod, RemoveSignInMethod } from "./SignInMethodActions";

type Provider = "google" | "apple" | "line";
const API_PROVIDER: Record<Provider, string> = { google: "firebase_google", apple: "firebase_apple", line: "line" };

/** One way to sign in: its icon, name and value on the left, its state or action on the right (56-px row). */
function MethodRow({
  icon,
  title,
  value,
  end,
  testId,
  linked,
}: {
  icon: IconGlyph;
  title: React.ReactNode;
  value: React.ReactNode;
  end?: React.ReactNode;
  testId?: string;
  linked?: boolean;
}) {
  return (
    <li
      className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 md:px-6"
      data-testid={testId}
      data-linked={linked === undefined ? undefined : linked ? "true" : "false"}
    >
      <Icon icon={icon} className="text-subtle shrink-0 text-xl" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{title}</span>
        <span className="text-muted text-sm tabular-nums">{value}</span>
      </span>
      {end ? <span className="flex shrink-0 items-center gap-2">{end}</span> : null}
    </li>
  );
}

/**
 * My ways to sign in (D-255, D-283) — personal, so every member sees it: the verified phone, whether a password is
 * set, and Google / Apple / LINE. Adding one goes through the provider and comes back here; Google and Apple can be
 * removed while another way remains; LINE stays (it carries my LINE notifications).
 */
export async function SignInMethodsView({
  context,
  searchParams = {},
}: {
  context: OwnerContext;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const t = await getTranslations("owner.settings.signIn");
  const { api, locale, me } = context;
  const methods = await section(unwrap(api.GET("/v1/owner/me/identities")));
  const linked = param(searchParams.linked);
  const error = param(searchParams.oauthError);
  const offered = oauthProviders();
  return (
    <SettingsFrame
      me={me}
      locale={locale}
      current="/settings/sign-in"
      title={t("title")}
      description={t("description")}
      testId="sign-in-methods"
    >
      <OAuthError code={error?.slice(0, 64)} />
      {linked && (["google", "apple", "line"] as const).includes(linked as Provider) ? (
        <div data-testid="sign-in-linked">
          <Callout tone="success">{t("linked", { provider: t(`providers.${linked}`) })}</Callout>
        </div>
      ) : null}
      {!methods.data ? (
        <SectionError error={methods.error} />
      ) : (
        <SettingsCard id="sign-in-list" title={t("listTitle")} description={t("listHint")} flush>
          <ul className="divide-border m-0 flex list-none flex-col divide-y p-0">
            <MethodRow
              icon={IconPhone}
              title={t("phone")}
              value={methods.data.phoneMasked ?? t("phoneNone")}
              testId="sign-in-phone"
              end={
                methods.data.phoneMasked ? (
                  <Badge tone="success" icon={IconCheckCircle}>
                    {t("verified")}
                  </Badge>
                ) : null
              }
            />
            <MethodRow
              icon={IconLock}
              title={t("password")}
              value={methods.data.hasPassword ? t("passwordSet") : t("passwordNone")}
            />
            {(["google", "apple", "line"] as const).map((provider) => {
              const identity = methods.data!.identities.find((row) => row.provider === API_PROVIDER[provider]);
              if (!identity && !offered.includes(provider)) return null;
              return (
                <MethodRow
                  key={provider}
                  icon={IconLink}
                  title={t(`providers.${provider}`)}
                  testId={`sign-in-${provider}`}
                  linked={Boolean(identity)}
                  value={
                    identity
                      ? [
                          identity.email ?? identity.displayName,
                          t("since", { date: formatDateTime(identity.linkedAt, locale) }),
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : t("notLinked")
                  }
                  end={
                    identity ? (
                      identity.removable ? (
                        <RemoveSignInMethod identityId={identity.id} provider={provider} />
                      ) : (
                        <span className="text-muted text-sm">{t("kept")}</span>
                      )
                    ) : (
                      <AddSignInMethod provider={provider} locale={locale} />
                    )
                  }
                />
              );
            })}
          </ul>
        </SettingsCard>
      )}
      <p className="text-muted text-sm">{t("footnote")}</p>
    </SettingsFrame>
  );
}

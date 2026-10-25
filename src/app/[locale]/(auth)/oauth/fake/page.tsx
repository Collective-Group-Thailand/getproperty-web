import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { AuthFrame } from "@/features/shared/auth/AuthFrame";
import type { Locale } from "@/i18n/routing";
import { isOAuthProvider } from "@/lib/auth/oauth/providers";
import { serverEnv } from "@/lib/env/server";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";

export async function generateMetadata() {
  const t = await getTranslations("auth.oauth.fake");
  return { title: t("pageTitle"), robots: { index: false } };
}

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ provider?: string; state?: string }>;
};

/**
 * The stand-in for Google / Apple / LINE with `OAUTH_MODE=fake` (D-283): pick a test identity and continue, or
 * cancel. It posts to the same callback the provider would, with the attempt's `state`, so the rest of the flow is
 * the live one. Not found unless the fake mode is on.
 */
export default async function FakeProviderPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (serverEnv().OAUTH_MODE !== "fake") notFound();
  const { provider, state } = await searchParams;
  if (!isOAuthProvider(provider) || !state) notFound();
  const t = await getTranslations("auth.oauth");
  const action = `/bff/oauth/${provider}/callback`;
  return (
    <AuthFrame zone="owner" title={t("fake.title", { provider: t(`providers.${provider}`) })} subtitle={t("fake.lead")}>
      <div className="flex flex-col gap-5" data-testid="oauth-fake">
        <Callout tone="warning">{t("fake.notice")}</Callout>
        <form method="post" action={action} className="flex flex-col gap-4">
          <input type="hidden" name="state" value={state} />
          <Field label={t("fake.uid")} hint={t("fake.uidHint")} required>
            <Input
              name="uid"
              defaultValue={`test-${provider}-1`}
              pattern="[\w.\-]{1,64}"
              inputSize="lg"
              data-testid="oauth-fake-uid"
            />
          </Field>
          <Field label={t("fake.name")}>
            <Input name="name" defaultValue={t("fake.defaultName")} inputSize="lg" data-testid="oauth-fake-name" />
          </Field>
          {provider === "line" ? null : (
            <Field label={t("fake.email")} hint={t("fake.emailHint")}>
              <Input
                name="email"
                type="email"
                defaultValue={`test-${provider}-1@example.com`}
                inputSize="lg"
                data-testid="oauth-fake-email"
              />
            </Field>
          )}
          <Button type="submit" size="lg" block data-testid="oauth-fake-continue">
            {t("fake.continue")}
          </Button>
        </form>
        <form method="post" action={action}>
          <input type="hidden" name="state" value={state} />
          <input type="hidden" name="error" value="access_denied" />
          <Button type="submit" variant="ghost" size="lg" block data-testid="oauth-fake-cancel">
            {t("fake.cancel")}
          </Button>
        </form>
      </div>
    </AuthFrame>
  );
}

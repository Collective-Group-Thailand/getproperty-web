import { getTranslations } from "next-intl/server";

import { Callout } from "@/ui/components/Callout";

/**
 * Suspended subscription (D-082): driven by `me.subscription.readOnly` from the API, never decided
 * here. Mutations are disabled by the shell's `ReadOnlyProvider`; the API refuses them anyway with
 * `tenant.read_only`.
 */
export async function ReadOnlyBanner({ subscriptionHref }: { subscriptionHref?: string }) {
  const t = await getTranslations("shell.readOnly");
  return (
    <div className="px-4 pt-4" data-testid="read-only-banner">
      <Callout
        tone="warning"
        title={t("title")}
        action={
          subscriptionHref ? (
            <a className="font-medium underline underline-offset-4" href={subscriptionHref}>
              {t("action")}
            </a>
          ) : undefined
        }
      >
        {t("body")}
      </Callout>
    </div>
  );
}

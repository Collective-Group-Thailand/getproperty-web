import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/ui/components/EmptyState";

/** The not-found page body of every zone: says what happened, offers the way home. */
export async function ZoneNotFound({ homeHref }: { homeHref: string }) {
  const t = await getTranslations("errors.notFound");
  return (
    <div className="mx-auto max-w-lg px-4 py-16" data-testid="not-found">
      <EmptyState
        icon="search"
        title={t("title")}
        description={t("body")}
        action={
          <a className="text-primary underline underline-offset-4" href={homeHref}>
            {t("home")}
          </a>
        }
      />
    </div>
  );
}

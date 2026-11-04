import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { ConsolePage } from "@/features/shared/console/PageHeader";
import { isApiError } from "@/lib/api/errors";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconLock } from "@/ui/icons/glyphs/lock";

import type { AdminContext } from "./server";

/** Whether an API refusal means "your role may not do this" (403), not a broken page. */
export function isForbidden(error: unknown): boolean {
  return isApiError(error) && error.status === 403;
}

/**
 * The page a platform role may not open (redesign G8 — the support role on `/settings/broadcast`, a platform invoice):
 * a calm "not allowed" card naming the person's role, who can grant access, and the way back — never a 404 or a crash.
 * The API stays the enforcement point; this only says so kindly.
 */
export async function NotAllowed({ context }: { context: AdminContext }) {
  const t = await getTranslations("admin.shell.notAllowed");
  const roles = await getTranslations("glossary.platformRole");
  const role = context.me.roles.map((one) => roles(one)).join(", ");
  return (
    <ConsolePage testId="not-allowed">
      <EmptyState
        variant="card"
        icon={IconLock}
        title={t("title")}
        description={t("body", { role })}
        action={
          <Button asChild variant="secondary">
            <Link href="/">{t("home")}</Link>
          </Button>
        }
        className="mt-8"
      />
    </ConsolePage>
  );
}

/**
 * Render a record page, or the "not allowed" card when the API refuses this role (403) the record's own read — the
 * page's first request, so a support user opening a tariff or a rollout link gets a calm answer instead of a crash.
 */
export async function orNotAllowed(context: AdminContext, render: () => Promise<React.ReactNode>) {
  try {
    return await render();
  } catch (error) {
    if (isForbidden(error)) return <NotAllowed context={context} />;
    throw error;
  }
}

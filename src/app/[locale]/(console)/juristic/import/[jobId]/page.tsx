import { getTranslations, setRequestLocale } from "next-intl/server";

import { ImportWizardView } from "@/features/owner/juristic/imports/ImportsView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.imports.wizard");
  return { title: t("title") };
}

/** One import job as a five-step wizard: upload → validate → reconcile → commit → parallel cycle and go-live (JW3a). */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; jobId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, jobId } = await params;
  setRequestLocale(locale);
  return <ImportWizardView context={await ownerContext()} jobId={jobId} searchParams={await searchParams} />;
}

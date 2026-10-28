import { getTranslations, setRequestLocale } from "next-intl/server";

import { TemplateEditorView } from "@/features/owner/contracts/TemplateEditorView";
import { ownerContext } from "@/features/owner/shared/server";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("owner.contracts");
  return { title: t("editor.metaTitle") };
}

/** One template of the library: editor, diff, compliance check, publish (G3, D-294). */
export default async function Page({ params }: { params: Promise<{ locale: Locale; templateId: string }> }) {
  const { locale, templateId } = await params;
  setRequestLocale(locale);
  return <TemplateEditorView context={await ownerContext()} templateId={templateId} />;
}

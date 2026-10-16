import { getTranslations } from "next-intl/server";

import { ErrorState } from "@/ui/components/ErrorState";

export default async function OwnerNotFound() {
  const t = await getTranslations("common");
  return <ErrorState title={t("noResults")} />;
}

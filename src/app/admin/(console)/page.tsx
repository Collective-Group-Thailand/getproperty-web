import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("tenants") };
}

/** The admin home — tenants and the rest of the back office are F5. */
export default async function AdminHome() {
  const t = await getTranslations("admin.nav");
  return (
    <div className="px-4 py-6 md:px-8" data-testid="admin-home">
      <h1 className="text-2xl font-semibold">{t("tenants")}</h1>
    </div>
  );
}

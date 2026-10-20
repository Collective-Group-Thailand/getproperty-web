import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { RequestScreen } from "@/features/staff/work/RequestScreen";
import { requireOperator } from "@/lib/auth/guards";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { serverApi } from "@/lib/api/server";

export async function generateMetadata() {
  const t = await getTranslations("staff.work.request");
  return { title: t("title") };
}

/** One service request: triage and "take it" (F4 4.4). */
export default async function StaffServiceRequest({ params }: { params: Promise<{ serviceRequestId: string }> }) {
  const { serviceRequestId } = await params;
  const [api, actor] = await Promise.all([
    serverApi("staff"),
    requireOperator("staff", { login: "/login", selectTenant: "/select-tenant" }),
  ]);
  const request = await unwrap(
    api.GET("/v1/staff/service-requests/{serviceRequestId}", { params: { path: { serviceRequestId } } }),
  ).catch((error: unknown) => {
    if (isApiError(error) && (error.status === 404 || error.status === 422)) notFound();
    throw error;
  });
  return <RequestScreen key={`${request.id}-${request.version}`} request={request} userId={actor.me.user.id} />;
}

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

/** One service request: triage, "take it" and the message thread (F4 4.4, D-218). */
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
  const messages = await unwrap(
    api.GET("/v1/staff/service-requests/{serviceRequestId}/messages", { params: { path: { serviceRequestId } } }),
  )
    .then((body) => body.data)
    .catch(() => null);
  return (
    <RequestScreen
      key={`${request.id}-${request.version}`}
      request={request}
      userId={actor.me.user.id}
      messages={messages}
      canWrite={actor.me.permissions.includes("service_request.handle") && !(actor.me.subscription?.readOnly ?? false)}
    />
  );
}

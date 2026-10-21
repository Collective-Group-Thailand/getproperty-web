import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { WorkOrderScreen } from "@/features/staff/work/WorkOrderScreen";
import { requireOperator } from "@/lib/auth/guards";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { serverApi } from "@/lib/api/server";

export async function generateMetadata() {
  const t = await getTranslations("staff.work");
  return { title: t("workOrder") };
}

/**
 * One work order (F4 4.4): its steps, photos and costs; the request it serves; the message thread with the
 * resident and the office (D-218). The door codes issued to me for the visit (`GET …/access`, D-211) are **not**
 * read here: the screen fetches them when tapped, so no PIN is ever in the rendered HTML/RSC payload (review H2).
 */
export default async function StaffWorkOrder({ params }: { params: Promise<{ workOrderId: string }> }) {
  const { workOrderId } = await params;
  const [api, actor] = await Promise.all([
    serverApi("staff"),
    requireOperator("staff", { login: "/login", selectTenant: "/select-tenant" }),
  ]);
  const workOrder = await unwrap(
    api.GET("/v1/staff/work-orders/{workOrderId}", { params: { path: { workOrderId } } }),
  ).catch((error: unknown) => {
    if (isApiError(error) && (error.status === 404 || error.status === 422)) notFound();
    throw error;
  });
  const [request, messages] = await Promise.all([
    workOrder.serviceRequestId
      ? unwrap(
          api.GET("/v1/staff/service-requests/{serviceRequestId}", {
            params: { path: { serviceRequestId: workOrder.serviceRequestId } },
          }),
        ).catch(() => null)
      : Promise.resolve(null),
    unwrap(api.GET("/v1/staff/work-orders/{workOrderId}/messages", { params: { path: { workOrderId } } }))
      .then((body) => body.data)
      .catch(() => null),
  ]);
  return (
    <WorkOrderScreen
      key={`${workOrder.id}-${workOrder.version}`}
      workOrder={workOrder}
      request={request}
      messages={messages}
      canWrite={actor.me.permissions.includes("service_request.handle") && !(actor.me.subscription?.readOnly ?? false)}
    />
  );
}

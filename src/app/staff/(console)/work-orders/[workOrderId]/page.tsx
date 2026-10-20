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
 * One work order (F4 4.4): its steps, photos and costs; the request it serves; the access codes issued to me
 * for the visit (`GET …/access`, only the assignee's own codes are revealed, D-211); the message thread with the
 * resident and the office (D-218).
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
  const [request, access, messages] = await Promise.all([
    workOrder.serviceRequestId
      ? unwrap(
          api.GET("/v1/staff/service-requests/{serviceRequestId}", {
            params: { path: { serviceRequestId: workOrder.serviceRequestId } },
          }),
        ).catch(() => null)
      : Promise.resolve(null),
    unwrap(api.GET("/v1/staff/work-orders/{workOrderId}/access", { params: { path: { workOrderId } } }))
      .then((body) => body.data)
      .catch(() => null),
    unwrap(api.GET("/v1/staff/work-orders/{workOrderId}/messages", { params: { path: { workOrderId } } }))
      .then((body) => body.data)
      .catch(() => null),
  ]);
  return (
    <WorkOrderScreen
      key={`${workOrder.id}-${workOrder.version}`}
      workOrder={workOrder}
      request={request}
      access={access}
      messages={messages}
      canWrite={actor.me.permissions.includes("service_request.handle") && !(actor.me.subscription?.readOnly ?? false)}
    />
  );
}

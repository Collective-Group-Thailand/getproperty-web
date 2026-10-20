import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { WorkOrderScreen } from "@/features/staff/work/WorkOrderScreen";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { serverApi } from "@/lib/api/server";

export async function generateMetadata() {
  const t = await getTranslations("staff.work");
  return { title: t("workOrder") };
}

/**
 * One work order (F4 4.4): its steps, photos and costs; the request it serves; the access codes issued to me
 * for the visit (`GET …/access`, only the assignee's own codes are revealed, D-211).
 */
export default async function StaffWorkOrder({ params }: { params: Promise<{ workOrderId: string }> }) {
  const { workOrderId } = await params;
  const api = await serverApi("staff");
  const workOrder = await unwrap(
    api.GET("/v1/staff/work-orders/{workOrderId}", { params: { path: { workOrderId } } }),
  ).catch((error: unknown) => {
    if (isApiError(error) && (error.status === 404 || error.status === 422)) notFound();
    throw error;
  });
  const [request, access] = await Promise.all([
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
  ]);
  return (
    <WorkOrderScreen
      key={`${workOrder.id}-${workOrder.version}`}
      workOrder={workOrder}
      request={request}
      access={access}
    />
  );
}

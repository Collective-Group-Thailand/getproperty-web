import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { DeviceDetail } from "@/features/staff/devices/DeviceDetail";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { serverApi } from "@/lib/api/server";

export async function generateMetadata() {
  const t = await getTranslations("staff.devices");
  return { title: t("title") };
}

/** One device with channels, configs and events (`GET /v1/staff/devices/{deviceId}`). */
export default async function StaffDevice({ params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params;
  const api = await serverApi("staff");
  const detail = await unwrap(api.GET("/v1/staff/devices/{deviceId}", { params: { path: { deviceId } } })).catch(
    (error: unknown) => {
      if (isApiError(error) && (error.status === 404 || error.status === 422)) notFound();
      throw error;
    },
  );
  return <DeviceDetail detail={detail} />;
}

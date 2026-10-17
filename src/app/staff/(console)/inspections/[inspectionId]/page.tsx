import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { InspectionChecklist } from "@/features/staff/inspections/InspectionChecklist";
import { ReportButton } from "@/features/staff/inspections/ReportButton";
import { unwrap, unwrapWithETag } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { serverApi } from "@/lib/api/server";
import type { Schemas } from "@/lib/api/types";

export async function generateMetadata() {
  const t = await getTranslations("staff.inspections");
  return { title: t("title") };
}

const SIGNED_OFF = new Set<Schemas["InspectionStatus"]>(["completed", "signed"]);

/**
 * One inspection (F4 4.2): the checklist with its ETag for `If-Match`; a move-out also loads the
 * lease's move-in inspection so every line can be compared on the spot (D-023).
 */
export default async function StaffInspection({ params }: { params: Promise<{ inspectionId: string }> }) {
  const { inspectionId } = await params;
  const api = await serverApi("staff");
  let loaded: { data: Schemas["InspectionDto"]; etag: string | null };
  try {
    loaded = await unwrapWithETag(
      api.GET("/v1/staff/inspections/{inspectionId}", { params: { path: { inspectionId } } }),
    );
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 422)) notFound();
    throw error;
  }
  const inspection = loaded.data;
  const moveIn =
    inspection.type === "move_out" && inspection.leaseId
      ? await unwrap(
          api.GET("/v1/staff/inspections", {
            params: { query: { leaseId: inspection.leaseId, type: "move_in", perPage: 5 } },
          }),
        )
          .then((page) => page.data.find((candidate) => SIGNED_OFF.has(candidate.status)) ?? null)
          .catch(() => null)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <InspectionChecklist
        key={`${inspection.id}-${inspection.status}`}
        inspection={inspection}
        etag={loaded.etag}
        moveIn={moveIn}
      />
      {SIGNED_OFF.has(inspection.status) ? (
        <div className="pb-6">
          <ReportButton inspectionId={inspection.id} />
        </div>
      ) : null}
    </div>
  );
}

import { unwrap, type ApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

/** The key of one end of a meter segment: the assignment and the register read. */
export function segmentKey(assignmentId: string, register: string): string {
  return `${assignmentId}:${register}`;
}

/**
 * Evidence photos of the readings an invoice's meter lines were billed from (design-system.md §1 "show
 * the evidence"). `MeterSegmentEndDto` carries the reading id and register but not its photo, so the
 * unit's meter history (`GET /v1/owner/units/{unitId}/meter-history`) is matched by reading id, then by
 * assignment + register. A photo that cannot be matched is simply not shown.
 * CONTRACT-REQUEST: `photoDocumentId` on `MeterSegmentEndDto` (docs/contract-requests.md).
 */
export async function segmentPhotos(
  api: ApiClient,
  unitId: string | null,
  lines: Pick<Schemas["InvoiceLineDto"], "meterSegments">[],
): Promise<Record<string, string>> {
  if (!unitId || !lines.some((line) => line.meterSegments.length > 0)) return {};
  const history = await unwrap(
    api.GET("/v1/owner/units/{unitId}/meter-history", { params: { path: { unitId } } }),
  ).catch(() => null);
  if (!history) return {};
  const byId = new Map<string, string>();
  const byRegister = new Map<string, string>();
  for (const assignment of history.assignments) {
    for (const reading of assignment.readings) {
      if (!reading.evidenceDocumentId) continue;
      byId.set(reading.id, reading.evidenceDocumentId);
      byRegister.set(segmentKey(assignment.id, reading.register), reading.evidenceDocumentId);
    }
  }
  const photos: Record<string, string> = {};
  for (const line of lines)
    for (const segment of line.meterSegments)
      for (const end of [segment.from, segment.to]) {
        if (!end) continue;
        const key = segmentKey(segment.meterAssignmentId, end.register);
        const photo = (end.readingId ? byId.get(end.readingId) : undefined) ?? byRegister.get(key);
        if (photo) photos[key] = photo;
      }
  return photos;
}

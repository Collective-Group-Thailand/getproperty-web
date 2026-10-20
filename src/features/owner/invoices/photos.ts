import { unwrap, type ApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

/** The key of one end of a meter segment: the assignment and the register read. */
export function segmentKey(assignmentId: string, register: string): string {
  return `${assignmentId}:${register}`;
}

/**
 * Evidence photos of the readings an invoice's meter lines were billed from (design-system.md §1 "show
 * the evidence"): each segment end carries the photo stored with it at compute time
 * (`MeterSegmentEndDto.photoDocumentId`, D-208). Segments computed before the field existed have none;
 * for those only, the unit's meter history (`GET /v1/owner/units/{unitId}/meter-history`) is matched by
 * reading id, then by assignment + register. A photo that cannot be found is simply not shown.
 */
export async function segmentPhotos(
  api: ApiClient,
  unitId: string | null,
  lines: Pick<Schemas["InvoiceLineDto"], "meterSegments">[],
): Promise<Record<string, string>> {
  const photos: Record<string, string> = {};
  const missing: { key: string; readingId: string | null }[] = [];
  for (const line of lines)
    for (const segment of line.meterSegments)
      for (const end of [segment.from, segment.to]) {
        if (!end) continue;
        const key = segmentKey(segment.meterAssignmentId, end.register);
        if (end.photoDocumentId) photos[key] = end.photoDocumentId;
        else if (end.readingId) missing.push({ key, readingId: end.readingId });
      }
  if (!unitId || missing.length === 0) return photos;
  const history = await unwrap(
    api.GET("/v1/owner/units/{unitId}/meter-history", { params: { path: { unitId } } }),
  ).catch(() => null);
  if (!history) return photos;
  const byId = new Map<string, string>();
  const byRegister = new Map<string, string>();
  for (const assignment of history.assignments) {
    for (const reading of assignment.readings) {
      if (!reading.evidenceDocumentId) continue;
      byId.set(reading.id, reading.evidenceDocumentId);
      byRegister.set(segmentKey(assignment.id, reading.register), reading.evidenceDocumentId);
    }
  }
  for (const { key, readingId } of missing) {
    const photo = (readingId ? byId.get(readingId) : undefined) ?? byRegister.get(key);
    if (photo) photos[key] = photo;
  }
  return photos;
}

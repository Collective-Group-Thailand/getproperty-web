import { NextResponse, type NextRequest } from "next/server";

import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { serverApi } from "@/lib/api/server";
import { sameOrigin } from "@/lib/bff/handler";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function problem(status: number, code: string, title: string) {
  return NextResponse.json(
    { type: `https://errors.getproperty.co/${code}`, title, status, code, detail: title },
    { status, headers: { "content-type": "application/problem+json", "cache-control": "no-store" } },
  );
}

/**
 * `POST /bff/tm30-exports/{tm30ExportId}/download` (owner zone, D-052, D-216): the Immigration Bureau upload file
 * a TM30 notification went into, streamed as an attachment from this origin. The member's own session reads
 * `GET /v1/owner/tm30-exports/{id}/file` (`tm30.manage`, tenant-scoped — another tenant's id is a 404; the API
 * audits the download and marks the file's notifications `downloaded`); its 5-minute signed URL is fetched
 * here and piped through, so the file with passport numbers never sits behind a URL in the page.
 *
 * A POST from this origin only (review L4): the download changes state upstream (audited, notifications marked
 * `downloaded`), so a cross-site link or `<img>` must not trigger it with the `SameSite=Lax` session. The page
 * submits a plain same-origin form; `Origin` (and `Sec-Fetch-Site` where sent) must be this host. A GET is 405.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ tm30ExportId: string }> }) {
  if (!sameOrigin(request)) return problem(403, "bff.csrf_rejected", "Cross-site request refused");
  const { tm30ExportId } = await params;
  if (!UUID.test(tm30ExportId)) return problem(404, "http.not_found", "Not found");
  const api = await serverApi("owner");
  let file;
  try {
    file = await unwrap(api.GET("/v1/owner/tm30-exports/{tm30ExportId}/file", { params: { path: { tm30ExportId } } }));
  } catch (error) {
    if (isApiError(error)) return problem(error.status, error.code, error.title || error.code);
    return problem(502, "upstream.unavailable", "The API could not be reached");
  }
  const upstream = await fetch(file.url, { cache: "no-store" }).catch(() => null);
  if (!upstream?.ok || !upstream.body) return problem(502, "tm30.download_failed", "The file could not be fetched");
  const name = file.title.replace(/[^\w.\-ก-๙]/g, "_") || "tm30.xlsx";
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export function GET() {
  return new NextResponse(null, { status: 405, headers: { allow: "POST", "cache-control": "no-store" } });
}

import { NextResponse } from "next/server";

import { exportFileName } from "@/features/owner/reports/exportFile";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { serverApi } from "@/lib/api/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function problem(status: number, code: string, title: string) {
  return NextResponse.json(
    { type: `https://errors.getproperty.co/${code}`, title, status, code, detail: title },
    { status, headers: { "content-type": "application/problem+json", "cache-control": "no-store" } },
  );
}

/**
 * `GET /bff/exports/{exportId}/download` (owner zone, F2 2.6): streams a finished export to the browser
 * as an attachment from this origin. The job is read with the member's own session (`GET
 * /v1/owner/exports/{id}` — tenant-scoped, so another tenant's id is a 404), and its short-lived signed
 * URL is fetched server-side and piped through unbuffered; the signed URL never reaches the page and
 * the file name says what it is (`income_expense-2026-10.xlsx`).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ exportId: string }> }) {
  const { exportId } = await params;
  if (!UUID.test(exportId)) return problem(404, "http.not_found", "Not found");
  const api = await serverApi("owner");
  let job;
  try {
    job = await unwrap(api.GET("/v1/owner/exports/{exportId}", { params: { path: { exportId } } }));
  } catch (error) {
    if (isApiError(error)) return problem(error.status, error.code, error.title || error.code);
    return problem(502, "upstream.unavailable", "The API could not be reached");
  }
  if (job.status !== "done" || !job.download) return problem(409, "export.not_ready", "The export is not ready yet");
  const upstream = await fetch(job.download.url, { cache: "no-store" }).catch(() => null);
  if (!upstream?.ok || !upstream.body)
    return problem(502, "export.download_failed", "The export file could not be fetched");
  const name = exportFileName(job);
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "content-disposition": `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

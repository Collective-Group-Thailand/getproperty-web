/** The staff and admin hosts are tools, never indexed (00-master-plan.md §2): nothing to crawl. */
export function GET() {
  return new Response("User-agent: *\nDisallow: /\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}

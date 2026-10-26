import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { GUIDES_EN } from "../data/guides/content.en";
import { GUIDES_TH } from "../data/guides/content.th";
import { json, problem } from "../handlers/support";
import { state } from "../state";
import { body, notFound, platform, validation } from "./support";

type Schemas = components["schemas"];
type Guide = Schemas["AdminGuideDto"];

/**
 * Guides (B7.13, D-271) like getproperty-api: the five seeded guides in Thai and English, published; the platform
 * team writes drafts, a second platform user publishes (`guide.same_reviewer` for the last editor). The public read
 * serves published ones. State lives in `state.guides` (reset with the platform world).
 */
export function initialGuides(): Guide[] {
  return [...GUIDES_TH, ...GUIDES_EN].map((g, index) => ({
    ...g,
    sections: g.sections as unknown as Record<string, never>[],
    id: `6d0e0000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    state: "published",
    reviewedBy: null,
    updatedBy: null,
    publishedAt: "2026-10-24T09:00:00+07:00",
    updatedAt: "2026-10-24T09:00:00+07:00",
    version: 1,
  }));
}

const guides = () => (state.guides ??= initialGuides());
const etag = (g: Guide) => `"${g.id}.${g.version}"`;
const summary = ({
  sections,
  faq,
  sources,
  id,
  state: s,
  reviewedBy,
  updatedBy,
  publishedAt,
  updatedAt,
  version,
  ...rest
}: Guide) => {
  void [sections, faq, sources, id, s, reviewedBy, updatedBy, publishedAt, updatedAt, version];
  return rest;
};
const detail = ({ id, state: s, reviewedBy, updatedBy, publishedAt, updatedAt, version, ...rest }: Guide) => {
  void [id, s, reviewedBy, updatedBy, publishedAt, updatedAt, version];
  return rest;
};

/** The body rules of the API (`guide-content.ts`), enough for the console's error path. */
function bodyProblem(g: Partial<Guide>): string | null {
  if (g.sections !== undefined && (!Array.isArray(g.sections) || g.sections.length === 0)) return "sections";
  for (const section of (g.sections ?? []) as { blocks?: unknown[] }[]) {
    if (!Array.isArray(section.blocks) || section.blocks.length === 0) return "sections";
    for (const block of section.blocks as Record<string, unknown>[]) {
      if (!["p", "ul", "ol", "note", "affiliate"].some((key) => key in block)) return "sections";
    }
  }
  if (g.sources?.some((s) => !/^https:\/\//.test(s.url))) return "sources";
  return null;
}

export const guideHandlers: HttpHandler[] = [
  // --- public (D-271)
  http.get("*/v1/public/guides", ({ request }) => {
    const locale = new URL(request.url).searchParams.get("locale") ?? "th";
    return json({
      data: guides()
        .filter((g) => g.state === "published" && g.locale === locale)
        .map(summary),
    });
  }),
  http.get("*/v1/public/guides/:slug", ({ request, params }) => {
    const locale = new URL(request.url).searchParams.get("locale") ?? "th";
    const g = guides().find((x) => x.slug === params.slug && x.locale === locale && x.state === "published");
    return g ? json(detail(g)) : problem("public.guides.get", "http.not_found");
  }),

  // --- admin
  http.get("*/v1/admin/guides", ({ request }) => {
    const ok = platform(request, "admin.guides.list", "admin.guide.manage");
    if (ok instanceof Response) return ok;
    const q = new URL(request.url).searchParams;
    return json(
      guides()
        .filter(
          (g) => (!q.get("locale") || g.locale === q.get("locale")) && (!q.get("state") || g.state === q.get("state")),
        )
        .sort((a, b) => a.slug.localeCompare(b.slug) || a.locale.localeCompare(b.locale)),
    );
  }),
  http.get("*/v1/admin/guides/:guideId", ({ request, params }) => {
    const op = "admin.guides.get";
    const ok = platform(request, op, "admin.guide.manage");
    if (ok instanceof Response) return ok;
    const g = guides().find((x) => x.id === params.guideId);
    return g ? json(g, 200, { etag: etag(g) }) : notFound(op);
  }),
  http.post("*/v1/admin/guides", async ({ request }) => {
    const op = "admin.guides.create";
    const ok = platform(request, op, "admin.guide.manage");
    if (ok instanceof Response) return ok;
    const input = await body<Schemas["GuideCreateDto"]>(request);
    if (!/^[a-z0-9-]{1,80}$/.test(input.slug ?? "")) return validation(op, "slug", "lowercase letters, digits, -");
    if (guides().some((g) => g.slug === input.slug && g.locale === input.locale))
      return problem(op, "guide.slug_taken");
    const bad = bodyProblem(input as unknown as Partial<Guide>);
    if (bad) return validation(op, bad, `${bad}: invalid`);
    const now = new Date().toISOString();
    const created: Guide = {
      ...input,
      sections: input.sections as Record<string, never>[],
      id: crypto.randomUUID(),
      state: "draft",
      reviewedBy: null,
      updatedBy: ok.userId,
      publishedAt: null,
      updatedAt: now,
      version: 1,
    };
    guides().push(created);
    return json(created, 201, { etag: etag(created) });
  }),
  http.patch("*/v1/admin/guides/:guideId", async ({ request, params }) => {
    const op = "admin.guides.update";
    const ok = platform(request, op, "admin.guide.manage");
    if (ok instanceof Response) return ok;
    const g = guides().find((x) => x.id === params.guideId);
    if (!g) return notFound(op);
    const ifMatch = request.headers.get("if-match");
    if (!ifMatch) return problem(op, "concurrency.precondition_required");
    if (ifMatch !== "*" && ifMatch !== etag(g)) return problem(op, "concurrency.stale");
    const input = await body<Schemas["GuideUpdateDto"]>(request);
    const bad = bodyProblem(input as unknown as Partial<Guide>);
    if (bad) return validation(op, bad, `${bad}: invalid`);
    Object.assign(g, Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)), {
      updatedBy: ok.userId,
      updatedAt: new Date().toISOString(),
      version: g.version + 1,
    });
    return json(g, 200, { etag: etag(g) });
  }),
  http.post("*/v1/admin/guides/:guideId/actions/:action", ({ request, params }) => {
    const action = String(params.action);
    const op = action === "publish" ? "admin.guides.publish" : "admin.guides.unpublish";
    const ok = platform(request, op, "admin.guide.manage");
    if (ok instanceof Response) return ok;
    const g = guides().find((x) => x.id === params.guideId);
    if (!g || (action !== "publish" && action !== "unpublish")) return notFound(op);
    if (action === "publish" && g.state === "draft") {
      if (g.updatedBy === ok.userId) return problem(op, "guide.same_reviewer");
      Object.assign(g, {
        state: "published",
        reviewedBy: ok.userId,
        publishedAt: new Date().toISOString(),
        version: g.version + 1,
      });
    }
    if (action === "unpublish" && g.state === "published")
      Object.assign(g, { state: "draft", publishedAt: null, version: g.version + 1 });
    return json(g);
  }),
];

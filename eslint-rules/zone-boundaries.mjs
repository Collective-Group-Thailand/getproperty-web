/**
 * `getproperty/zone-boundaries` — a zone may not import another zone's features
 * (00-master-plan.md §3, CLAUDE.md "Zone isolation").
 *
 * One app serves four audiences. This rule is what keeps admin code out of the tenant bundle and,
 * more to the point, keeps a tenant screen from ever rendering something that assumes an owner or
 * platform session. The zone a file belongs to is read from its path:
 *
 *   src/app/tenant/**, src/features/tenant/**     → tenant
 *   src/app/staff/**,  src/features/staff/**      → staff
 *   src/app/admin/**,  src/features/admin/**      → admin
 *   src/app/**  (anything else), src/features/owner/** → owner
 *
 * and an import is refused when it resolves into `src/features/<other zone>/`, whether written as
 * the alias (`@/features/admin/...`, `@/features/admin`) or as a relative path that climbs out of
 * the zone (`../../admin/orgs`). `src/ui`, `src/features/shared`, `src/domain`, `src/i18n` and
 * `src/lib` stay importable from everywhere: they are the shared middle.
 *
 * Options: `{ root }` — the repository root the `src/` paths are relative to (defaults to cwd).
 * Tests pass fixtures as virtual paths under that root.
 */

import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

export const ZONES = ["owner", "tenant", "staff", "admin"];

/** The zone a repo-relative, forward-slashed path belongs to, or null for the shared middle. */
export function zoneOf(relPath) {
  const m = /^src\/(app|features)\/([^/]+)(?:\/|$)/.exec(relPath);
  if (!m) return null;
  const [, area, segment] = m;
  if (area === "features") return ZONES.includes(segment) ? segment : null;
  // src/app: the three prefixed zones, and the owner zone is everything else ([locale], bff, …).
  return ZONES.includes(segment) && segment !== "owner" ? segment : "owner";
}

/** The zone whose `src/features/<zone>/` an import specifier lands in, or null. */
export function importedZone(specifier, fromRelPath) {
  const alias = /^@\/features\/([^/]+)(?:\/|$)/.exec(specifier);
  if (alias) return ZONES.includes(alias[1]) ? alias[1] : null;
  if (specifier.startsWith(".")) {
    const target = resolve("/", dirname(fromRelPath), specifier).slice(1).split(sep).join("/");
    const m = /^src\/features\/([^/]+)(?:\/|$)/.exec(target);
    return m && ZONES.includes(m[1]) ? m[1] : null;
  }
  return null;
}

const rule = {
  meta: {
    type: "problem",
    docs: { description: "A zone's app routes and features may not import another zone's features." },
    messages: {
      crossZone:
        "Zone boundary (00-master-plan.md §3): {{from}} code may not import features/{{to}}. Move the shared part to src/features/shared, src/ui, src/domain or src/lib.",
    },
    schema: [{ type: "object", properties: { root: { type: "string" } }, additionalProperties: false }],
  },
  create(context) {
    const root = context.options[0]?.root ?? context.cwd ?? process.cwd();
    const filename = context.filename ?? context.getFilename();
    const rel = (isAbsolute(filename) ? relative(root, filename) : filename).split(sep).join("/");
    const from = zoneOf(rel);
    if (!from) return {};

    const check = (node, specifier) => {
      if (typeof specifier !== "string") return;
      const to = importedZone(specifier, rel);
      if (to && to !== from) context.report({ node, messageId: "crossZone", data: { from, to } });
    };

    return {
      ImportDeclaration(node) {
        check(node.source, node.source.value);
      },
      ExportNamedDeclaration(node) {
        if (node.source) check(node.source, node.source.value);
      },
      ExportAllDeclaration(node) {
        check(node.source, node.source.value);
      },
      ImportExpression(node) {
        if (node.source.type === "Literal") check(node.source, node.source.value);
      },
    };
  },
};

export default rule;

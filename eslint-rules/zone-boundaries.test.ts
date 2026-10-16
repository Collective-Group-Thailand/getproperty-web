import { type ESLint, Linter } from "eslint";
import { describe, expect, it } from "vitest";

import rule, { importedZone, zoneOf } from "./zone-boundaries.mjs";

/**
 * The fixture test F0 asks for: the rule must *fail* on the import it exists to catch, in every
 * direction, and stay quiet on the shared middle. Files are virtual paths under a fake root.
 */
const ROOT = "/repo";
// The rule is plain .mjs; ESLint's RuleDefinition type wants literal unions it cannot infer from JS.
const plugin = { rules: { "zone-boundaries": rule } } as unknown as ESLint.Plugin;

function lint(file: string, code: string) {
  const linter = new Linter({ configType: "flat", cwd: ROOT });
  return linter.verify(
    code,
    [
      {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: { ecmaVersion: "latest", sourceType: "module" },
        plugins: { getproperty: plugin },
        rules: { "getproperty/zone-boundaries": ["error", { root: ROOT }] },
      },
    ],
    { filename: `${ROOT}/${file}` },
  );
}

describe("zoneOf", () => {
  it("reads the zone from the path", () => {
    expect(zoneOf("src/features/tenant/bills/BillCard.tsx")).toBe("tenant");
    expect(zoneOf("src/app/staff/today/page.tsx")).toBe("staff");
    expect(zoneOf("src/app/admin/(console)/orgs/page.tsx")).toBe("admin");
    expect(zoneOf("src/app/[locale]/(console)/dashboard/page.tsx")).toBe("owner");
    expect(zoneOf("src/app/bff/[...path]/route.ts")).toBe("owner");
    expect(zoneOf("src/features/owner/dashboard/Queue.tsx")).toBe("owner");
  });
  it("treats the shared middle as no zone", () => {
    expect(zoneOf("src/features/shared/bill/BillCard.tsx")).toBeNull();
    expect(zoneOf("src/ui/components/Button.tsx")).toBeNull();
    expect(zoneOf("src/lib/api/client.ts")).toBeNull();
  });
});

describe("importedZone", () => {
  it("resolves alias and relative specifiers", () => {
    expect(importedZone("@/features/admin/orgs", "src/features/owner/x.ts")).toBe("admin");
    expect(importedZone("@/features/admin", "src/features/owner/x.ts")).toBe("admin");
    expect(importedZone("../../admin/orgs", "src/features/owner/dashboard/x.ts")).toBe("admin");
    expect(importedZone("@/features/shared/bill", "src/features/owner/x.ts")).toBeNull();
    expect(importedZone("@/ui", "src/features/owner/x.ts")).toBeNull();
    expect(importedZone("react", "src/features/owner/x.ts")).toBeNull();
  });
});

describe("getproperty/zone-boundaries", () => {
  const zones = ["owner", "tenant", "staff", "admin"] as const;

  it.each(zones.flatMap((from) => zones.filter((to) => to !== from).map((to) => [from, to] as const)))(
    "fails when %s features import features/%s",
    (from, to) => {
      const messages = lint(`src/features/${from}/thing.ts`, `import { x } from "@/features/${to}/x";`);
      expect(messages).toHaveLength(1);
      expect(messages[0]?.message).toContain(`features/${to}`);
    },
  );

  it("fails on a relative import that climbs into another zone", () => {
    const messages = lint("src/features/owner/dashboard/Queue.tsx", `import { Orgs } from "../../admin/orgs";`);
    expect(messages).toHaveLength(1);
  });

  it("fails on a zone route importing another zone's features", () => {
    const messages = lint("src/app/tenant/home/page.tsx", `import { Dashboard } from "@/features/owner/dashboard";`);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.message).toMatch(/tenant code may not import features\/owner/);
  });

  it("fails on re-exports and dynamic imports too", () => {
    expect(lint("src/features/staff/x.ts", `export * from "@/features/admin/x";`)).toHaveLength(1);
    expect(lint("src/features/staff/x.ts", `const m = import("@/features/tenant/x");`)).toHaveLength(1);
  });

  it("allows the shared middle and a zone's own features", () => {
    const code = [
      `import { Button } from "@/ui";`,
      `import { BillCard } from "@/features/shared/bill";`,
      `import { Queue } from "@/features/owner/dashboard";`,
      `import { formatTHB } from "@/i18n/format";`,
      `import { api } from "@/lib/api";`,
      `import { billStatus } from "@/domain/status";`,
    ].join("\n");
    expect(lint("src/features/owner/leases/Wizard.tsx", code)).toHaveLength(0);
    expect(lint("src/app/[locale]/(console)/dashboard/page.tsx", code)).toHaveLength(0);
  });

  it("is silent outside the zones", () => {
    expect(lint("src/features/shared/x.ts", `import { x } from "@/features/admin/x";`)).toHaveLength(0);
  });
});

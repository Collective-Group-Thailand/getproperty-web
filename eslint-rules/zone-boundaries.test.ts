import { type ESLint, Linter } from "eslint";
import { describe, expect, it } from "vitest";

import rule, { importedRetiredZone, importedZone, retiredZoneOf, zoneOf } from "./zone-boundaries.mjs";

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
    expect(zoneOf("src/features/staff/readings/Round.tsx")).toBe("staff");
    expect(zoneOf("src/app/staff/today/page.tsx")).toBe("staff");
    expect(zoneOf("src/app/admin/(console)/tenants/page.tsx")).toBe("admin");
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
    expect(importedZone("@/features/admin/tenants", "src/features/owner/x.ts")).toBe("admin");
    expect(importedZone("@/features/admin", "src/features/owner/x.ts")).toBe("admin");
    expect(importedZone("../../admin/tenants", "src/features/owner/dashboard/x.ts")).toBe("admin");
    expect(importedZone("@/features/shared/bill", "src/features/owner/x.ts")).toBeNull();
    expect(importedZone("@/ui", "src/features/owner/x.ts")).toBeNull();
    expect(importedZone("react", "src/features/owner/x.ts")).toBeNull();
  });
});

describe("retired zones (D-151, D-154)", () => {
  it("recognises files and imports under tenant/ and resident/", () => {
    expect(retiredZoneOf("src/app/tenant/page.tsx")).toBe("tenant");
    expect(retiredZoneOf("src/features/resident/bills/x.ts")).toBe("resident");
    expect(retiredZoneOf("src/features/staff/x.ts")).toBeNull();
    expect(importedRetiredZone("@/features/tenant/x", "src/features/owner/x.ts")).toBe("tenant");
    expect(importedRetiredZone("../resident/x", "src/features/owner/x.ts")).toBe("resident");
    expect(importedRetiredZone("@/features/staff/x", "src/features/owner/x.ts")).toBeNull();
  });
});

describe("getproperty/zone-boundaries", () => {
  const zones = ["owner", "staff", "admin"] as const;

  it.each(zones.flatMap((from) => zones.filter((to) => to !== from).map((to) => [from, to] as const)))(
    "fails when %s features import features/%s",
    (from, to) => {
      const messages = lint(`src/features/${from}/thing.ts`, `import { x } from "@/features/${to}/x";`);
      expect(messages).toHaveLength(1);
      expect(messages[0]?.message).toContain(`features/${to}`);
    },
  );

  it("fails on a relative import that climbs into another zone", () => {
    const messages = lint("src/features/owner/dashboard/Queue.tsx", `import { Tenants } from "../../admin/tenants";`);
    expect(messages).toHaveLength(1);
  });

  it("fails on a zone route importing another zone's features", () => {
    const messages = lint("src/app/staff/today/page.tsx", `import { Dashboard } from "@/features/owner/dashboard";`);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.message).toMatch(/staff code may not import features\/owner/);
  });

  it("fails on re-exports and dynamic imports too", () => {
    expect(lint("src/features/staff/x.ts", `export * from "@/features/admin/x";`)).toHaveLength(1);
    expect(lint("src/features/staff/x.ts", `const m = import("@/features/owner/x");`)).toHaveLength(1);
  });

  it("fails on any file in a retired zone and on imports into one, from anywhere", () => {
    const route = lint("src/app/tenant/page.tsx", `export default function Page() { return null; }`);
    expect(route).toHaveLength(1);
    expect(route[0]?.message).toMatch(/getproperty-liff/);
    expect(lint("src/features/resident/home/Home.tsx", `export const x = 1;`)).toHaveLength(1);
    expect(lint("src/features/owner/x.ts", `import { Bill } from "@/features/tenant/bills";`)).toHaveLength(1);
    expect(lint("src/features/shared/x.ts", `const m = import("@/features/resident/x");`)).toHaveLength(1);
    expect(lint("src/lib/x.ts", `import { y } from "../features/tenant/y";`)).toHaveLength(1);
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

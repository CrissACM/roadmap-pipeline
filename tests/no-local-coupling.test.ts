import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The core must stay stack-agnostic: no private repo, stack or machine identifiers. */
const FORBIDDEN = [
  "ogrosgameshop",
  "/Users/",
  "better-auth",
  "apps/api",
  "deepseek",
  "@ogrosgameshop",
  "autonomous-pipeline",
];

const CORE_DIRS = ["skills", "bin", "consumers"];

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
}

describe("no local coupling", () => {
  it("keeps the core and the generic profile free of private identifiers", () => {
    const files: string[] = [];
    for (const dir of CORE_DIRS) walk(join(ROOT, dir), files);
    files.push(join(ROOT, "profiles/generic.md"));

    const violations: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const token of FORBIDDEN) {
        if (text.includes(token))
          violations.push(`${file.slice(ROOT.length + 1)} contains "${token}"`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("lets the concrete profile carry stack specifics", () => {
    const profile = readFileSync(join(ROOT, "profiles/bun-nestjs-ddd.md"), "utf8");

    expect(profile).toContain("apps/api/src/<module>");
    expect(profile).toContain("public-api.ts");
  });
});

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseProfile, placeholderFields } from "../consumers/scripts/pipeline-profile";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function load(name: string) {
  const result = parseProfile(readFileSync(join(ROOT, "profiles", `${name}.md`), "utf8"));
  if (!("profile" in result)) throw new Error(`${name}: ${result.error}`);
  return result.profile;
}

describe("built-in profiles", () => {
  it("parses the generic profile and keeps its placeholders explicit", () => {
    const profile = load("generic");

    expect(profile.name).toBe("generic");
    expect(placeholderFields(profile)).toEqual(["gates[0]"]);
    expect(profile.tiers).toEqual({ deep: "", fast: "" });
  });

  it("ships a complete, placeholder-free stack profile", () => {
    const profile = load("bun-nestjs-ddd");

    expect(profile.name).toBe("bun-nestjs-ddd");
    expect(placeholderFields(profile)).toEqual([]);
    expect(profile.gates.length).toBeGreaterThan(0);
    expect(profile.sourceRoots).toEqual(["apps", "packages"]);
    expect(profile.layers).toContain("domain");
  });

  it("keeps every gate command free of comments and shell operators", () => {
    for (const name of ["generic", "bun-nestjs-ddd"]) {
      const { gates } = load(name);
      // A gate is one command the implementer can run verbatim; no `&&`, no `#`.
      for (const gate of gates) {
        expect(gate).not.toContain("&&");
        expect(gate).not.toContain("#");
      }
    }
  });
});

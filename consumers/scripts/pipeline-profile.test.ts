import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseProfile, placeholderFields, readProfile } from "./pipeline-profile";

const REPO_ROOT = resolve(import.meta.dir, "..");
const REPO_PROFILE = join(REPO_ROOT, "docs/pipeline/profile.md");

const valid = `# Pipeline Profile: test

\`\`\`json pipeline-profile
{
  "name": "test",
  "version": "0.1.0",
  "moduleRoot": "src/<module>",
  "layers": ["domain"],
  "sourceRoots": ["src"],
  "contracts": "docs/contracts/<module>.contract.md",
  "specs": "<moduleRoot>/SPEC.md",
  "gates": ["bun test"],
  "graph": [],
  "tiers": { "deep": "", "fast": "" }
}
\`\`\`
`;

describe("pipeline profile", () => {
  it("parses the tagged json block", () => {
    const result = parseProfile(valid);

    expect("profile" in result).toBe(true);
    if ("profile" in result) {
      expect(result.profile.name).toBe("test");
      expect(result.profile.gates).toEqual(["bun test"]);
    }
  });

  it("rejects a document without the tagged block", () => {
    expect(parseProfile("# no block")).toEqual({
      error: "missing ```json pipeline-profile block in docs/pipeline/profile.md",
    });
  });

  it("rejects invalid json and missing keys", () => {
    expect(parseProfile("```json pipeline-profile\n{ nope }\n```")).toMatchObject({
      error: expect.any(String),
    });
    expect(parseProfile("```json pipeline-profile\n{}\n```")).toEqual({
      error: 'docs/pipeline/profile.md: "name" must be a non-empty string',
    });
  });

  it("rejects empty gates and non-string tiers", () => {
    const emptyGates = valid.replace('"gates": ["bun test"]', '"gates": []');
    expect(parseProfile(emptyGates)).toEqual({
      error: 'docs/pipeline/profile.md: "gates" must list at least one command',
    });

    const badTier = valid.replace('"deep": ""', '"deep": 3');
    expect(parseProfile(badTier)).toEqual({
      error: 'docs/pipeline/profile.md: "tiers.deep" must be a string (may be empty)',
    });
  });

  it("reports placeholders without blocking parsing", () => {
    const withPlaceholder = valid.replace('"bun test"', '"<the exact test command>"');
    const result = parseProfile(withPlaceholder);
    if (!("profile" in result)) throw new Error("fixture must parse");

    expect(placeholderFields(result.profile)).toEqual(["gates[0]"]);
  });

  it("returns null when the file does not exist", () => {
    const root = mkdtempSync(join(tmpdir(), "pipeline-profile-"));
    try {
      expect(readProfile(root)).toBeNull();
      mkdirSync(join(root, "docs/pipeline"), { recursive: true });
      writeFileSync(join(root, "docs/pipeline/profile.md"), valid);
      expect(readProfile(root)?.name).toBe("test");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.skipIf(!existsSync(REPO_PROFILE))("validates this repository's profile", () => {
    const result = parseProfile(readFileSync(REPO_PROFILE, "utf8"));
    if (!("profile" in result)) throw new Error(result.error);

    const { profile } = result;
    const placeholders = placeholderFields(profile);

    expect(placeholders, `fill docs/pipeline/profile.md: ${placeholders.join(", ")}`).toEqual([]);
    expect(profile.gates.length).toBeGreaterThan(0);

    const missingRoots = profile.sourceRoots.filter((root) => !existsSync(join(REPO_ROOT, root)));
    expect(missingRoots, `profile sourceRoots missing on disk: ${missingRoots.join(", ")}`).toEqual(
      [],
    );
  });
});

import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "bin/cli.ts");

const PROFILE = `# Pipeline Profile: smoke

\`\`\`json pipeline-profile
{
  "name": "smoke",
  "version": "${JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version}",
  "moduleRoot": "src/modules",
  "layers": ["domain", "application", "infrastructure", "presentation"],
  "sourceRoots": ["src"],
  "contracts": "docs/contracts",
  "specs": "src/SPEC.md",
  "gates": ["bun test"],
  "graph": [],
  "tiers": { "deep": "", "fast": "" }
}
\`\`\`
`;

describe("init in a clean repository", () => {
  it("scaffolds the skill, profile, state and green guards", () => {
    const root = mkdtempSync(join(tmpdir(), "roadmap-pipeline-smoke-"));

    try {
      writeFileSync(
        join(root, "package.json"),
        `${JSON.stringify({ name: "smoke", private: true }, null, 2)}\n`,
      );
      mkdirSync(join(root, "src/modules"), { recursive: true });
      const profilePath = join(root, "profile-fixture.md");
      writeFileSync(profilePath, PROFILE);

      const init = Bun.spawnSync({
        cmd: ["bun", CLI, "init", "--profile", profilePath, "--project", root, "--skip-agents"],
        cwd: ROOT,
        stdout: "pipe",
        stderr: "pipe",
      });

      expect(init.exitCode, `${init.stdout.toString()}\n${init.stderr.toString()}`).toBe(0);

      for (const path of [
        ".agents/skills/roadmap-pipeline/SKILL.md",
        "docs/pipeline/profile.md",
        "docs/pipeline/kanban.md",
        "docs/pipeline/fragments/.gitkeep",
        "docs/pipeline/kanban/.gitkeep",
        "scripts/pipeline-profile.test.ts",
        "scripts/pipeline-debt.ts",
        "scripts/pipeline-fragment-budget.test.ts",
        "scripts/pipeline-skill-budget.test.ts",
      ]) {
        expect(existsSync(join(root, path)), `${path} missing`).toBe(true);
      }

      const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
      expect(manifest.scripts["roadmap:check"]).toContain("pipeline-skill-budget.test.ts");
      expect(manifest.scripts["roadmap:debt"]).toBe("bun scripts/pipeline-debt.ts");

      const guards = Bun.spawnSync({
        cmd: ["bun", "test", "scripts/"],
        cwd: root,
        stdout: "pipe",
        stderr: "pipe",
      });

      expect(guards.exitCode, `${guards.stdout.toString()}\n${guards.stderr.toString()}`).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects an unknown profile without touching the target", () => {
    const root = mkdtempSync(join(tmpdir(), "roadmap-pipeline-smoke-"));

    try {
      const init = Bun.spawnSync({
        cmd: ["bun", CLI, "init", "--profile", "does-not-exist", "--project", root],
        cwd: ROOT,
        stdout: "pipe",
        stderr: "pipe",
      });

      expect(init.exitCode).toBe(1);
      expect(init.stderr.toString()).toContain('unknown profile "does-not-exist"');
      expect(existsSync(join(root, ".agents"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

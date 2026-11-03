import { describe, expect, it } from "bun:test";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_DIR = join(ROOT, "skills/roadmap-pipeline");

/**
 * The guards are shipped as-is to consumers. Run them the way a consumer would,
 * with the skill path pointed at this package's copy.
 */
describe("consumer guards", () => {
  it("pass against the packaged skill", () => {
    const result = Bun.spawnSync({
      cmd: [
        "bun",
        "test",
        "consumers/scripts/pipeline-profile.test.ts",
        "consumers/scripts/pipeline-debt.test.ts",
        "consumers/scripts/pipeline-skill-budget.test.ts",
      ],
      cwd: ROOT,
      env: { ...process.env, PIPELINE_SKILL_DIR: SKILL_DIR },
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = `${result.stdout.toString()}\n${result.stderr.toString()}`;
    expect(result.exitCode, output).toBe(0);
  });
});

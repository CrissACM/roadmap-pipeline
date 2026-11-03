import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_ROOT =
  process.env["PIPELINE_SKILL_DIR"] ?? join(REPO_ROOT, ".agents/skills/roadmap-pipeline");

/**
 * Hard budgets per artifact (protocol §6). The hot path is what every
 * `/roadmap` invocation pays for; references are read on demand.
 * A rule that must grow one of these has to compress or move something first.
 */
const BUDGETS: Record<string, number> = {
  "SKILL.md": 40, // router: always visible
  "commands/roadmap.md": 65, // hot path
  "references/pipeline-protocol.md": 200, // hot path
  "references/subagent-definitions.md": 100,
  "references/ddd-code-review.md": 80,
  "references/contract-guards.md": 180,
};

const ROLE_BUDGET = 40;
const TEMPLATE_BUDGET = 60;

function listMarkdown(relativeDir: string): string[] {
  const dir = join(SKILL_ROOT, relativeDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => `${relativeDir}/${entry.name}`)
    .sort();
}

const roleFiles = listMarkdown("references/roles");
const templateFiles = listMarkdown("references/templates");
const referenceFiles = listMarkdown("references");

function lines(relativePath: string): number {
  const text = readFileSync(join(SKILL_ROOT, relativePath), "utf8");
  return text === "" ? 0 : text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}

function text(relativePath: string): string {
  return readFileSync(join(SKILL_ROOT, relativePath), "utf8");
}

function relativeLinks(relativePath: string): string[] {
  const source = text(relativePath);
  const pattern = /\[[^\]]*\]\(([^)]+)\)/g;
  const links: string[] = [];
  let match: RegExpExecArray | null = pattern.exec(source);
  while (match !== null) {
    const target = match[1]!.split("#")[0]!.trim();
    if (target && !target.startsWith("http") && !target.startsWith("mailto")) {
      links.push(target);
    }
    match = pattern.exec(source);
  }
  return links;
}

describe("PipelineSkillBudget", () => {
  it("keeps every artifact within its line budget", () => {
    const violations: string[] = [];

    for (const [file, budget] of Object.entries(BUDGETS)) {
      const count = lines(file);
      if (count > budget) violations.push(`${file}: ${count} lines (max ${budget})`);
    }

    for (const file of roleFiles) {
      const count = lines(file);
      if (count > ROLE_BUDGET) violations.push(`${file}: ${count} lines (max ${ROLE_BUDGET})`);
    }

    for (const file of templateFiles) {
      const count = lines(file);
      if (count > TEMPLATE_BUDGET)
        violations.push(`${file}: ${count} lines (max ${TEMPLATE_BUDGET})`);
    }

    expect(violations).toEqual([]);
  });

  it("resolves every relative link in the skill documents", () => {
    const documents = [
      "SKILL.md",
      "commands/roadmap.md",
      "references/pipeline-protocol.md",
      "references/subagent-definitions.md",
      "references/ddd-code-review.md",
      ...roleFiles,
    ];

    const missing: string[] = [];
    for (const document of documents) {
      for (const link of relativeLinks(document)) {
        const target = resolve(dirname(join(SKILL_ROOT, document)), link);
        if (!existsSync(target)) missing.push(`${document} -> ${link}`);
      }
    }

    expect(missing).toEqual([]);
  });

  it("keeps every reference, role and template reachable from the router", () => {
    const router = text("SKILL.md");
    const handoffs = text("references/subagent-definitions.md");
    const protocol = text("references/pipeline-protocol.md");

    const orphaned = [
      ...referenceFiles
        .filter((file) => file !== "references/pipeline-protocol.md")
        .filter((file) => !router.includes(file.slice("references/".length)))
        .map((file) => `${file} is not linked from SKILL.md`),
      ...roleFiles
        .filter((file) => !handoffs.includes(file.slice("references/roles/".length)))
        .map((file) => `${file} is not named in references/subagent-definitions.md`),
      ...templateFiles
        .filter((file) => !protocol.includes(file.slice("references/templates/".length)))
        .map((file) => `${file} is not named in references/pipeline-protocol.md`),
    ];

    expect(orphaned).toEqual([]);
  });
});

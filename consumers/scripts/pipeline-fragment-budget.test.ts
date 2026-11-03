import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FRAGMENTS_DIR = join(REPO_ROOT, "docs/pipeline/fragments");

/** Hard budget for `docs/pipeline/fragments/<ID>.md` (pipeline-protocol §6.D). */
const BUDGET_LINES = 300;

const fragmentFiles = existsSync(FRAGMENTS_DIR)
  ? readdirSync(FRAGMENTS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => entry.name)
      .sort()
  : [];

function countLines(file: string): number {
  const text = readFileSync(join(FRAGMENTS_DIR, file), "utf8");
  return text === "" ? 0 : text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}

function relativeLinks(text: string): string[] {
  const links: string[] = [];
  const pattern = /\[[^\]]*\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null = pattern.exec(text);
  while (match !== null) {
    const target = match[1]!.split("#")[0]!.trim();
    if (target && !target.startsWith("http") && !target.startsWith("mailto")) {
      links.push(target);
    }
    match = pattern.exec(text);
  }
  return links;
}

describe("PipelineFragmentBudget", () => {
  it("keeps every fragment within the 300-line budget", () => {
    const violations = fragmentFiles
      .map((file) => ({ file, lines: countLines(file) }))
      .filter((entry) => entry.lines > BUDGET_LINES)
      .map((entry) => `${entry.file}: ${entry.lines} lines (max ${BUDGET_LINES})`);

    expect(violations).toEqual([]);
  });

  it("resolves every relative annex link inside a fragment", () => {
    const missing: string[] = [];

    for (const file of fragmentFiles) {
      const text = readFileSync(join(FRAGMENTS_DIR, file), "utf8");
      for (const link of relativeLinks(text)) {
        const target = resolve(FRAGMENTS_DIR, link);
        if (!existsSync(target)) {
          missing.push(`${file} -> ${link}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});

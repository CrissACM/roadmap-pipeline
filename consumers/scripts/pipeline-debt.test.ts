import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseShortcutLine, renderMarkdown, scanShortcuts, SHORTCUT_FORMAT } from "./pipeline-debt";

describe("shortcut markers", () => {
  it("parses a line comment with a limit and an upgrade condition", () => {
    const parsed = parseShortcutLine(
      "// shortcut: in-memory cache; upgrade when more than one instance runs",
    );

    expect(parsed).toEqual({
      ok: true,
      limit: "in-memory cache",
      upgradeWhen: "more than one instance runs",
    });
  });

  it("parses a block comment and strips its closer", () => {
    const parsed = parseShortcutLine(
      " * shortcut: 1k page size; upgrade when a client asks for more */",
    );

    expect(parsed).toEqual({
      ok: true,
      limit: "1k page size",
      upgradeWhen: "a client asks for more",
    });
  });

  it("ignores object keys that are not comments", () => {
    expect(parseShortcutLine('      shortcut: ["/icon"],')).toBeNull();
  });

  it("ignores unrelated code that mentions the word", () => {
    expect(parseShortcutLine("const shortcut = buildShortcut();")).toBeNull();
  });

  it("rejects a marker without an upgrade condition", () => {
    const parsed = parseShortcutLine("// shortcut: sleep 100ms");

    expect(parsed).not.toBeNull();
    expect(parsed && "ok" in parsed && parsed.ok).toBe(false);
  });

  it("rejects an empty limit or condition", () => {
    expect(parseShortcutLine("// shortcut: ; upgrade when something")).toMatchObject({ ok: false });
    expect(parseShortcutLine("// shortcut: cache; upgrade when")).toMatchObject({ ok: false });
  });

  it("finds no malformed markers in the repository", () => {
    const report = scanShortcuts();
    const offenders = report.malformed.map((item) => `${item.file}:${item.line} ${item.reason}`);

    expect(offenders).toEqual([]);
  });

  it("scans product source, derives the module and ignores a missing clause", () => {
    const root = mkdtempSync(join(tmpdir(), "pipeline-debt-"));

    try {
      mkdirSync(join(root, "src/api"), { recursive: true });
      writeFileSync(
        join(root, "src/api/thing.ts"),
        [
          "const page = 1; // shortcut: sync read; upgrade when files > 10k",
          "// shortcut: no upgrade clause",
          "",
        ].join("\n"),
      );

      const report = scanShortcuts(root);

      expect(report.markers).toEqual([
        {
          file: "src/api/thing.ts",
          line: 1,
          module: "api",
          limit: "sync read",
          upgradeWhen: "files > 10k",
        },
      ]);
      expect(report.malformed.map((item) => item.line)).toEqual([2]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("renders a markdown table with the canonical format documented", () => {
    const report = scanShortcuts("/path/that/does/not/exist");
    const markdown = renderMarkdown(report);

    expect(markdown).toContain("No `shortcut:` markers found.");
    expect(markdown).toContain(SHORTCUT_FORMAT);
  });
});

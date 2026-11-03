#!/usr/bin/env bun
/**
 * Debt harvest for the autonomous pipeline (protocol §3.5 / §5 Phase 0c).
 *
 * A deliberate limit is marked next to the code as:
 *
 *   shortcut: <the limit>; upgrade when <condition>
 *
 * `/roadmap debt` reads this output and turns markers into backlog cards.
 * Usage: bun scripts/pipeline-debt.ts [--json|--check]
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { readProfile } from "./pipeline-profile";

export const SHORTCUT_FORMAT = "shortcut: <the limit>; upgrade when <condition>";

const ROOT = resolve(import.meta.dir, "..");
// Used when the workspace has no profile yet; the profile's `sourceRoots` wins.
const DEFAULT_SOURCE_ROOTS = ["src", "apps", "packages", "lib"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".sql", ".sh"]);
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".turbo",
  "coverage",
  ".codegraph",
]);

/** A comment marker, not an object key: `shortcut: [...]` in code never matches. */
const COMMENT = /(?:\/\/+|\/\*+|\*|#|--|<!--)\s*shortcut:\s*(.*)$/;
const UPGRADE_SEPARATOR = "; upgrade when ";
const CLOSERS = /\s*(?:\*\/|-->)\s*$/;

export interface ShortcutMarker {
  readonly file: string;
  readonly line: number;
  readonly module: string;
  readonly limit: string;
  readonly upgradeWhen: string;
}

export interface MalformedShortcut {
  readonly file: string;
  readonly line: number;
  readonly reason: string;
  readonly text: string;
}

export interface DebtReport {
  readonly markers: readonly ShortcutMarker[];
  readonly malformed: readonly MalformedShortcut[];
}

export function parseShortcutLine(
  line: string,
): { ok: true; limit: string; upgradeWhen: string } | { ok: false; reason: string } | null {
  const match = COMMENT.exec(line);
  if (match === null) return null;

  const body = match[1]!.replace(CLOSERS, "").trim();
  const separator = body.toLowerCase().indexOf(UPGRADE_SEPARATOR);

  if (separator === -1) {
    return { ok: false, reason: `missing "${UPGRADE_SEPARATOR.trim()}" clause` };
  }

  const limit = body.slice(0, separator).trim();
  const upgradeWhen = body.slice(separator + UPGRADE_SEPARATOR.length).trim();

  if (limit === "" || upgradeWhen === "") {
    return { ok: false, reason: "empty limit or upgrade condition" };
  }

  return { ok: true, limit, upgradeWhen };
}

function moduleOf(root: string, file: string): string {
  const parts = relative(root, file).split(/[\\/]/);
  if (parts[0] === "apps" || parts[0] === "packages") return parts[1] ?? parts[0]!;
  if (parts[0] === "src") return parts[1] ?? "app";
  return parts[0] ?? "app";
}

function walk(dir: string, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      walk(full, out);
      continue;
    }
    if (entry.isFile() && EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
      out.push(full);
    }
  }
}

export function scanShortcuts(root: string = ROOT): DebtReport {
  const files: string[] = [];
  const sourceRoots = readProfile(root)?.sourceRoots ?? DEFAULT_SOURCE_ROOTS;
  for (const dir of sourceRoots) walk(join(root, dir), files);

  const markers: ShortcutMarker[] = [];
  const malformed: MalformedShortcut[] = [];

  for (const file of files) {
    const relativePath = relative(root, file);
    const lines = readFileSync(file, "utf8").split("\n");

    lines.forEach((text, index) => {
      const parsed = parseShortcutLine(text);
      if (parsed === null) return;

      if (!parsed.ok) {
        malformed.push({
          file: relativePath,
          line: index + 1,
          reason: parsed.reason,
          text: text.trim(),
        });
        return;
      }

      markers.push({
        file: relativePath,
        line: index + 1,
        module: moduleOf(root, file),
        limit: parsed.limit,
        upgradeWhen: parsed.upgradeWhen,
      });
    });
  }

  return {
    markers: markers.sort(
      (a, b) => a.module.localeCompare(b.module) || a.file.localeCompare(b.file),
    ),
    malformed,
  };
}

export function renderMarkdown(report: DebtReport): string {
  const lines: string[] = ["# Shortcut debt", ""];

  if (report.markers.length === 0) {
    lines.push("No `shortcut:` markers found.", "");
  } else {
    lines.push(
      "| Module | Marker | Limit | Upgrade when |",
      "| :----- | :----- | :---- | :----------- |",
    );
    for (const marker of report.markers) {
      lines.push(
        `| \`${marker.module}\` | \`${marker.file}:${marker.line}\` | ${marker.limit} | ${marker.upgradeWhen} |`,
      );
    }
    lines.push("");
  }

  if (report.malformed.length > 0) {
    lines.push("## Malformed markers (fix the comment)", "");
    for (const item of report.malformed) {
      lines.push(`- \`${item.file}:${item.line}\` — ${item.reason}: \`${item.text}\``);
    }
    lines.push("");
  }

  lines.push(`Format: \`${SHORTCUT_FORMAT}\``);
  return lines.join("\n");
}

if (import.meta.main) {
  const args = new Set(process.argv.slice(2));
  const report = scanShortcuts();

  if (args.has("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderMarkdown(report));
  }

  if (args.has("--check") && report.malformed.length > 0) {
    process.exitCode = 1;
  }
}

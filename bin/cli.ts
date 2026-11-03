#!/usr/bin/env bun
/**
 * roadmap-pipeline CLI.
 *
 *   init     install the skill, the profile, the state skeleton and the guards
 *   check    run the guards that live in this repo
 *   debt     print the `shortcut:` ledger
 *   install  forward to the multi-harness installer (global or project)
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { renderMarkdown, scanShortcuts } from "../consumers/scripts/pipeline-debt";
import {
  parseProfile,
  placeholderFields,
  PROFILE_PATH,
  readProfile,
} from "../consumers/scripts/pipeline-profile";

const PKG_ROOT = resolve(import.meta.dir, "..");
const SKILL_NAME = "roadmap-pipeline";
const SKILL_SRC = join(PKG_ROOT, "skills", SKILL_NAME);
const PROFILES_DIR = join(PKG_ROOT, "profiles");
const CONSUMERS_DIR = join(PKG_ROOT, "consumers");

const GUARDS = [
  "pipeline-profile.ts",
  "pipeline-profile.test.ts",
  "pipeline-debt.ts",
  "pipeline-debt.test.ts",
  "pipeline-fragment-budget.test.ts",
  "pipeline-skill-budget.test.ts",
] as const;

const CHECK_SCRIPT =
  "bun test scripts/pipeline-profile.test.ts scripts/pipeline-debt.test.ts scripts/pipeline-fragment-budget.test.ts scripts/pipeline-skill-budget.test.ts";

const pkg = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8")) as { version: string };

interface Options {
  readonly profile: string;
  readonly project: string;
  readonly harness: string;
  readonly link: boolean;
  readonly force: boolean;
  readonly dryRun: boolean;
  readonly skipAgents: boolean;
}

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function run(command: string[], cwd: string, env?: Record<string, string | undefined>): void {
  const result = Bun.spawnSync({
    cmd: command,
    cwd,
    env: { ...process.env, ...env },
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) fail(`${command.join(" ")} exited with ${result.exitCode}`);
}

function gitRoot(cwd: string): string {
  const result = Bun.spawnSync({
    cmd: ["git", "rev-parse", "--show-toplevel"],
    cwd,
    stdout: "pipe",
    stderr: "ignore",
  });
  return result.exitCode === 0 ? result.stdout.toString().trim() : cwd;
}

function parseOptions(args: string[]): Options {
  const value = (flag: string, fallback: string): string => {
    const index = args.indexOf(flag);
    return index === -1 ? fallback : (args[index + 1] ?? fail(`${flag} needs a value`));
  };

  return {
    profile: value("--profile", "generic"),
    project: resolve(value("--project", process.cwd())),
    harness: value("--harness", "auto"),
    link: args.includes("--link"),
    force: args.includes("--force"),
    dryRun: args.includes("--dry-run"),
    skipAgents: args.includes("--skip-agents"),
  };
}

function resolveProfileSource(name: string): string {
  if (name.endsWith(".md") || name.includes("/")) {
    const path = resolve(name);
    if (!existsSync(path)) fail(`profile not found: ${path}`);
    return path;
  }

  const path = join(PROFILES_DIR, `${name}.md`);
  if (!existsSync(path)) {
    const available = ["generic", "bun-nestjs-ddd"];
    fail(`unknown profile "${name}". Built-in: ${available.join(", ")} (or pass a .md path)`);
  }
  return path;
}

function writeFile(path: string, content: string, options: Options, label: string): void {
  if (existsSync(path) && !options.force) {
    console.log(`· ${label} exists, skipped (use --force to overwrite)`);
    return;
  }
  console.log(`${options.dryRun ? "would write" : "✔"} ${label}`);
  if (!options.dryRun) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
}

function installSkill(root: string, options: Options): string {
  const dest = join(root, ".agents/skills", SKILL_NAME);
  const relativeDest = relative(root, dest);

  if (options.link) {
    console.log(`${options.dryRun ? "would link" : "✔"} ${relativeDest} -> ${SKILL_SRC}`);
    if (!options.dryRun) {
      mkdirSync(dirname(dest), { recursive: true });
      if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
      symlinkSync(relative(dirname(dest), SKILL_SRC), dest);
    }
    return dest;
  }

  if (existsSync(dest) && !options.force) {
    console.log(`· ${relativeDest} exists, skipped (use --force to refresh)`);
    return dest;
  }

  console.log(`${options.dryRun ? "would copy" : "✔"} ${relativeDest}`);
  if (!options.dryRun) {
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(SKILL_SRC, dest, { recursive: true });
  }
  return dest;
}

function writeState(root: string, profileSource: string, options: Options): void {
  const stateDir = join(root, "docs/pipeline");

  writeFile(
    join(stateDir, "profile.md"),
    readFileSync(profileSource, "utf8"),
    options,
    PROFILE_PATH,
  );

  for (const dir of ["fragments", "kanban"]) {
    const keep = join(stateDir, dir, ".gitkeep");
    if (!existsSync(keep)) writeFile(keep, "", options, `docs/pipeline/${dir}/.gitkeep`);
  }

  const kanban = join(SKILL_SRC, "references/templates/kanban-index.md");
  if (existsSync(kanban)) {
    writeFile(
      join(stateDir, "kanban.md"),
      readFileSync(kanban, "utf8"),
      options,
      "docs/pipeline/kanban.md",
    );
  }

  const readme = join(CONSUMERS_DIR, "docs/pipeline-readme.md");
  if (existsSync(readme)) {
    writeFile(
      join(stateDir, "README.md"),
      readFileSync(readme, "utf8"),
      options,
      "docs/pipeline/README.md",
    );
  }
}

function installGuards(root: string, options: Options): void {
  for (const guard of GUARDS) {
    const source = join(CONSUMERS_DIR, "scripts", guard);
    const dest = join(root, "scripts", guard);
    if (existsSync(dest) && !options.force) {
      console.log(`· scripts/${guard} exists, skipped`);
      continue;
    }
    console.log(`${options.dryRun ? "would copy" : "✔"} scripts/${guard}`);
    if (!options.dryRun) {
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, readFileSync(source, "utf8"));
    }
  }
}

function patchPackageJson(root: string, options: Options): void {
  const path = join(root, "package.json");
  const current = existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>)
    : { name: basename(root), private: true };

  const scripts = { ...(current["scripts"] as Record<string, string> | undefined) };
  scripts["roadmap:check"] = CHECK_SCRIPT;
  scripts["roadmap:debt"] = "bun scripts/pipeline-debt.ts";

  const next = { ...current, scripts };
  const content = `${JSON.stringify(next, null, 2)}\n`;

  if (existsSync(path) && readFileSync(path, "utf8") === content) {
    console.log("· package.json scripts already current");
    return;
  }

  console.log(
    `${options.dryRun ? "would add" : "✔"} package.json scripts: roadmap:check, roadmap:debt`,
  );
  if (!options.dryRun) writeFileSync(path, content);
}

function init(args: string[]): void {
  const options = parseOptions(args);
  const root = gitRoot(options.project);
  const profileSource = resolveProfileSource(options.profile);

  console.log(`\nroadmap-pipeline ${pkg.version} → ${root}\n`);

  const skillDir = installSkill(root, options);
  writeState(root, profileSource, options);
  installGuards(root, options);
  patchPackageJson(root, options);

  if (!options.skipAgents) {
    const installer = join(skillDir, "scripts/install-harnesses.sh");
    const profile = readProfile(root);
    const env: Record<string, string | undefined> = {};

    if (profile?.tiers.deep) env["OPENCODE_MODEL_DEEP"] = profile.tiers.deep;
    if (profile?.tiers.fast) env["OPENCODE_MODEL_FAST"] = profile.tiers.fast;

    if (options.dryRun) {
      console.log(
        `would run ${relative(root, installer)} --project ${root} --harness ${options.harness}`,
      );
    } else {
      console.log("✔ agents + /roadmap command");
      run(["bash", installer, "--project", root, "--harness", options.harness], root, env);
    }
  }

  const source = parseProfile(readFileSync(profileSource, "utf8"));
  const placeholders = "profile" in source ? placeholderFields(source.profile) : [];

  console.log("");
  if (placeholders.length > 0) {
    console.log(`! profile placeholders remain: ${placeholders.join(", ")}`);
    console.log(`  fill ${PROFILE_PATH}, then run: bun run roadmap:check`);
  } else {
    console.log("✔ profile is complete");
  }
  console.log("Next: /roadmap status\n");
}

function check(args: string[]): void {
  const root = resolve(
    args.find((arg) => arg.startsWith("--project="))?.slice("--project=".length) ?? process.cwd(),
  );
  const guards = GUARDS.filter(
    (guard) => guard.endsWith(".test.ts") && existsSync(join(root, "scripts", guard)),
  );

  if (guards.length === 0)
    fail(`no guards found in ${join(root, "scripts")}; run \`roadmap-pipeline init\``);

  run(["bun", "test", ...guards.map((guard) => `scripts/${guard}`)], root);
}

function debt(args: string[]): void {
  const root = resolve(
    args.find((arg) => arg.startsWith("--project="))?.slice("--project=".length) ??
      (args.includes("--project")
        ? (args[args.indexOf("--project") + 1] ?? process.cwd())
        : process.cwd()),
  );
  const report = scanShortcuts(root);

  if (args.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderMarkdown(report));
  }

  if (args.includes("--check") && report.malformed.length > 0) process.exitCode = 1;
}

function install(args: string[]): void {
  const installer = join(SKILL_SRC, "scripts/install-harnesses.sh");
  run(["bash", installer, ...args], process.cwd());
}

function help(): void {
  console.log(`roadmap-pipeline ${pkg.version}

Usage:
  roadmap-pipeline init [options]     scaffold this repo
  roadmap-pipeline check              run the guards installed in this repo
  roadmap-pipeline debt [--json]      print the shortcut ledger
  roadmap-pipeline install [flags]    forward to install-harnesses.sh
  roadmap-pipeline --version

init options:
  --profile <name|file>   generic (default) | bun-nestjs-ddd | path to a .md
  --project <dir>         target repo (default: cwd, resolved to the git root)
  --harness <name>        opencode | claude | codex | auto (default: auto)
  --link                  symlink the skill instead of copying (skill development)
  --force                 overwrite existing files
  --skip-agents           write the skill, profile, state and guards only
  --dry-run               print the plan, touch nothing

Docs: https://github.com/CrissACM/roadmap-pipeline`);
}

const [command, ...rest] = process.argv.slice(2);

switch (command) {
  case "init":
    init(rest);
    break;
  case "check":
    check(rest);
    break;
  case "debt":
    debt(rest);
    break;
  case "install":
    install(rest);
    break;
  case "--version":
  case "-v":
  case "version":
    console.log(pkg.version);
    break;
  case undefined:
  case "--help":
  case "-h":
  case "help":
    help();
    break;
  default:
    fail(`unknown command "${command}". Run \`roadmap-pipeline --help\`.`);
}

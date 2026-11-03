/**
 * Workspace profile reader (`docs/pipeline/profile.md`).
 *
 * The profile is a Markdown document whose first fenced block is tagged
 * `json pipeline-profile`. Everything else in the file is prose for humans.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const PROFILE_BLOCK = /```json pipeline-profile\r?\n([\s\S]*?)```/;
export const PROFILE_PATH = "docs/pipeline/profile.md";

export interface PipelineProfile {
  readonly name: string;
  readonly version: string;
  readonly moduleRoot: string;
  readonly layers: readonly string[];
  readonly sourceRoots: readonly string[];
  readonly contracts: string;
  readonly specs: string;
  readonly gates: readonly string[];
  readonly graph: readonly string[];
  readonly tiers: { readonly deep: string; readonly fast: string };
}

const REQUIRED_STRING = ["name", "version", "moduleRoot", "contracts", "specs"] as const;
const REQUIRED_ARRAY = ["layers", "sourceRoots", "gates", "graph"] as const;

export function profilePath(root: string): string {
  return join(root, PROFILE_PATH);
}

export function parseProfile(source: string): { profile: PipelineProfile } | { error: string } {
  const match = PROFILE_BLOCK.exec(source);
  if (match === null)
    return { error: `missing \`\`\`json pipeline-profile block in ${PROFILE_PATH}` };

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]!);
  } catch (error) {
    return { error: `invalid JSON in ${PROFILE_PATH}: ${(error as Error).message}` };
  }

  const candidate = parsed as Record<string, unknown>;

  for (const key of REQUIRED_STRING) {
    if (typeof candidate[key] !== "string" || candidate[key] === "") {
      return { error: `${PROFILE_PATH}: "${key}" must be a non-empty string` };
    }
  }

  for (const key of REQUIRED_ARRAY) {
    if (!Array.isArray(candidate[key]))
      return { error: `${PROFILE_PATH}: "${key}" must be an array` };
  }

  if (!Array.isArray(candidate["gates"]) || candidate["gates"].length === 0) {
    return { error: `${PROFILE_PATH}: "gates" must list at least one command` };
  }

  const tiers = candidate["tiers"];
  if (typeof tiers !== "object" || tiers === null) {
    return { error: `${PROFILE_PATH}: "tiers" must be an object with deep/fast` };
  }
  for (const tier of ["deep", "fast"] as const) {
    if (typeof (tiers as Record<string, unknown>)[tier] !== "string") {
      return { error: `${PROFILE_PATH}: "tiers.${tier}" must be a string (may be empty)` };
    }
  }

  return { profile: candidate as unknown as PipelineProfile };
}

export function readProfile(root: string): PipelineProfile | null {
  const path = profilePath(root);
  if (!existsSync(path)) return null;
  const result = parseProfile(readFileSync(path, "utf8"));
  return "profile" in result ? result.profile : null;
}

/** Placeholders are allowed while editing, but they block the Plan Gate. */
const SUBSTITUTIONS = /<module(Root)?>/g;

export function placeholderFields(profile: PipelineProfile): string[] {
  const values = [
    ["moduleRoot", profile.moduleRoot],
    ["contracts", profile.contracts],
    ["specs", profile.specs],
    ...profile.gates.map((gate, index) => [`gates[${index}]`, gate] as const),
  ] as const;

  return values
    .filter(([, value]) => value.replace(SUBSTITUTIONS, "").includes("<"))
    .map(([key]) => key);
}

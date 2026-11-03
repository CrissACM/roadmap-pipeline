# Adapters: profiles, harnesses, models, graph tools

## 1. The profile is the adapter

Everything stack-specific lives in `docs/pipeline/profile.md`, inside a fenced block tagged
`json pipeline-profile`. The protocol reads it and never invents a path or a command.

| Key           | Type     | Used by                                 | Rules                                                                                       |
| :------------ | :------- | :-------------------------------------- | :------------------------------------------------------------------------------------------ |
| `name`        | string   | humans, CLI                             | Profile identifier.                                                                         |
| `version`     | string   | CLI                                     | Pipeline version the profile was written for; `check` warns on drift.                       |
| `moduleRoot`  | string   | planner, implementer, reviewer, auditor | Path pattern of one bounded context. `<module>` is substituted.                             |
| `layers`      | string[] | planner, reviewer                       | Directories under `moduleRoot` that the plan and review must respect.                       |
| `sourceRoots` | string[] | `pipeline-debt`                         | Top-level dirs scanned for `shortcut:` markers; must exist on disk.                         |
| `contracts`   | string   | planner, reviewer, auditor              | Published-language contract path pattern.                                                   |
| `specs`       | string   | planner, reviewer                       | Living BDD spec path.                                                                       |
| `gates`       | string[] | implementer, reviewer                   | Exact commands, run verbatim and in order. No `&&`, no comments.                            |
| `graph`       | string[] | every role                              | `codebase-memory-mcp`, `codegraph`, or `[]`.                                                |
| `tiers`       | object   | installer                               | `deep` (planner/reviewer) and `fast` (implementer/auditor); empty string = harness default. |

`<module>` and `<moduleRoot>` are **substitutions**, not unfilled placeholders. Any other `<…>` is a
placeholder: `bun run roadmap:check` fails until it is replaced.

### Writing one

```bash
# copy the block from the profile you want to start from:
#   node_modules/roadmap-pipeline/profiles/generic.md
# then edit the json block and prove it:
bun run roadmap:check
```

Keep gates slowest-last: the implementer stops at the first failure. If a suite is conditional, say so in the
prose of the profile, not by removing it from `gates` silently.

## 2. Harnesses

| Harness     | Agents                                                   | Command                                                  | Skill discovery                                            |
| :---------- | :------------------------------------------------------- | :------------------------------------------------------- | :--------------------------------------------------------- |
| OpenCode    | `.opencode/agents/*.md` (or `~/.config/opencode/agents`) | `.opencode/commands/roadmap.md`                          | `.agents/skills/roadmap-pipeline` or the global skills dir |
| Claude Code | `.claude/agents/*.md`                                    | `.claude/commands/roadmap.md`                            | preloaded via the agent frontmatter                        |
| Codex CLI   | `.codex/agents/*.toml`                                   | invoke `$roadmap-pipeline` and follow the modes manually | skill directory on the Codex path                          |

```bash
roadmap-pipeline init --harness opencode     # or claude | codex | auto | all
roadmap-pipeline install --global --harness all   # agents only, no project scaffold
```

`init` is idempotent and backs up previous agents/commands under `<base>/.install-backups/<timestamp>/`.
`--link` symlinks the skill instead of copying it, for developing the skill itself.

## 3. Model tiers

- `tiers.deep` → planner and reviewer. `tiers.fast` → implementer and auditor.
- Empty tier = let the harness choose. The installer then writes no `model:` line; nothing is silently
  downgraded to a cheaper model.
- On a free-limit or rate-limit error, re-dispatch the _same role_ with the paid fallback and note it in the
  fragment. Never edit generated agent files by hand: the next install overwrites them.

Environment overrides (no file edits):

```bash
OPENCODE_MODEL_DEEP=<provider/model> OPENCODE_MODEL_FAST=<provider/model> \
  bash .agents/skills/roadmap-pipeline/scripts/install-harnesses.sh --project . --harness opencode
```

## 4. Graph tools

`graph` is optional. When it lists tools and the repo is indexed, roles must use the graph to discover symbols,
callers and blast radius, and may only `read` ranges the graph or docs cite. When it is empty or the repo is not
indexed, roles fall back to bounded `read`/`grep` and say so. `graph=0` in the audit line is valid; a _claimed_
graph that was never queried is not.

## 5. Guards in CI

```yaml
- run: bun run roadmap:check
- run: bun run roadmap:debt --check
```

`roadmap:check` runs the four guards copied by `init`:
fragment budget and annex links, `shortcut:` format, profile integrity, skill budget. If you prefer not to
keep copies, `bunx roadmap-pipeline check` runs the same guards from the package.

## 6. Upgrading

```bash
bunx roadmap-pipeline@latest init --force --project .
```

`--force` refreshes the skill and the guards, overwrites the state templates (profile, kanban, README) and
re-runs the installer. Fragments are never touched. Compare `profile.version` with the package version: a
mismatch means the profile was written for another protocol version, and `check` warns instead of failing.

## 7. Adding a built-in profile

1. Add `profiles/<name>.md` with the tagged JSON block and no placeholders.
2. Add it to the list in `bin/cli.ts` (`resolveProfileSource`).
3. Add a case to `tests/profiles.test.ts`.
4. Keep it free of private identifiers: `tests/no-local-coupling.test.ts` only exempts `profiles/bun-nestjs-ddd.md`.

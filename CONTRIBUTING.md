# Contributing

This repository is a product, not a collection of prompts. Before changing anything, read
[`docs/methodology.md`](docs/methodology.md) and the protocol in
[`skills/roadmap-pipeline/references/pipeline-protocol.md`](skills/roadmap-pipeline/references/pipeline-protocol.md).

## Where a change belongs

| Change                                                      | Target                                          | Why                                                             |
| :---------------------------------------------------------- | :---------------------------------------------- | :-------------------------------------------------------------- |
| A gate, a phase, a role contract                            | `skills/roadmap-pipeline/references/`           | It is methodology, not stack.                                   |
| A stack command, a directory layout, a framework convention | `profiles/`                                     | The protocol must name no framework.                            |
| A guard, a scanner, a CLI behaviour                         | `consumers/` or `bin/`                          | `consumers/` is copied into user repos; `bin/` is package-only. |
| A new state template                                        | `skills/roadmap-pipeline/references/templates/` | Single source; never copy it into `docs/`.                      |

`tests/no-local-coupling.test.ts` enforces that `skills/`, `bin/`, `consumers/` and `profiles/generic.md` stay
free of private identifiers (`ogrosgameshop`, absolute paths, provider names, `apps/api`).

## Budgets are part of the contract

| Artifact                          |    Budget | Test                               |
| :-------------------------------- | --------: | :--------------------------------- |
| `SKILL.md`                        |  40 lines | `pipeline-skill-budget.test.ts`    |
| `commands/roadmap.md`             |  65 lines | same                               |
| `references/pipeline-protocol.md` | 200 lines | same                               |
| Each role                         |  40 lines | same                               |
| Each template                     |  60 lines | same                               |
| `docs/pipeline/fragments/<ID>.md` | 300 lines | `pipeline-fragment-budget.test.ts` |

A new rule must declare its tier (router / protocol / role / reference) and **what it compresses or moves**.
Never append to the hot path without a displacement: move the detail to a reference and link it.

## Local development

```bash
bun install
bun run test          # package tests (guards + profiles + smoke init)
bun run lint
bun run format:check
bun run typecheck
```

Test the CLI against a throwaway repo:

```bash
bun bin/cli.ts init --profile generic --project /tmp/consumer --dry-run
bun bin/cli.ts init --profile generic --project /tmp/consumer --skip-agents
cd /tmp/consumer && bun test scripts/
```

Develop the skill against a real repo without copying it:

```bash
bun bin/cli.ts init --link --project /path/to/repo --skip-agents
# the consumer now points at this checkout; edits are live
```

To run the consumer guards against a non-default skill location:

```bash
PIPELINE_SKILL_DIR=/path/to/skills/roadmap-pipeline bun test scripts/pipeline-skill-budget.test.ts
```

## Pull requests

1. One concern per PR; do not mix a protocol change with a CLI change.
2. `bun run test`, `bun run lint`, `bun run format:check`, `bun run typecheck` green.
3. If you touched the protocol, state the tier and the displacement in the PR description.
4. If you touched a guard, prove it fails on the regression you are fixing (show the red run).
5. Adding a profile: no placeholders, no private identifiers, one test case in `tests/profiles.test.ts`.

## Versioning

`0.x` until the protocol survives two real consumer repos. A protocol change that alters the Plan Gate or the
`0B/0M` standard is a minor bump and must update `CHANGELOG.md`; everything else is a patch.

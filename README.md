# roadmap-pipeline

**Autonomous delivery for coding agents, with state on disk and gates that cannot be skipped.**

A [skill](https://opencode.ai) plus four dispatched subagents that take a card from _human intent_ to a
reviewed, committed change through DDD + SDD + BDD: a persistent kanban in your repo, a zero-ambiguity plan
gate, auditable Red→Green TDD, and a fresh reviewer that re-runs the gates itself.

```bash
bunx roadmap-pipeline init --profile bun-nestjs-ddd
/roadmap intent live order tracking
/roadmap next ORD-01
```

---

## Why another agent workflow?

Most agent workflows keep the plan in the conversation. When the context compacts, the plan is gone, the
reviewer inherits the implementer's reasoning, and "tests pass" is a claim rather than evidence. This one
refuses all three:

| Principle                        | What it means in practice                                                                                                                   |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| **State on disk, never in chat** | Kanban index, one board per workstream, one fragment per card, commit hashes. `/roadmap resume` recovers the exact phase from disk.         |
| **The plan must be closed**      | A **7-criteria Plan Gate** rejects "consider whether…". The implementer is a fast model that executes mechanically, not a second architect. |
| **Evidence, not claims**         | Red→Green is proven with a `git stash`; the reviewer is a fresh session that re-runs the gates and reports `0B/0M`.                         |
| **The smallest complete change** | Reuse first, no speculative abstraction, deliberate limits marked `shortcut: …; upgrade when …` and harvested into the backlog.             |
| **No stack in the protocol**     | Paths, gates, graph tools and model tiers live in `docs/pipeline/profile.md`. The core never names your framework.                          |

## Quickstart

Requirements: **Bun ≥ 1.3**, macOS or Linux, a git repository.

```bash
# 1. Scaffold: skill, profile, state skeleton, guards, /roadmap command, agents
bunx roadmap-pipeline init --profile generic

# 2. Fill the placeholders (moduleRoot, contracts, gates)
$EDITOR docs/pipeline/profile.md

# 3. Prove the guards are green
bun run roadmap:check
```

`init` copies the skill into `.agents/skills/roadmap-pipeline`, writes `docs/pipeline/{profile,kanban,README}.md`,
installs the guards in `scripts/` and generates the four subagents plus the `/roadmap` command for the harnesses
it finds (`opencode`, `claude`, `codex`). Everything is idempotent, and `--dry-run` shows the plan first.

## The modes

`/roadmap` has ten modes; each one reads and writes only what it needs.

| Mode            | What it does                                                                                                                                               |
| :-------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `intent <desc>` | The only mode that asks questions. Reads the code, plays the request back, asks **one** question, records who/why + Given/When/Then + non-goals as a card. |
| `audit [flow…]` | Parallel read-only auditors over an E2E flow; consolidates findings into stable card IDs and boards.                                                       |
| `debt`          | Harvests `shortcut:` markers into backlog cards, so "later" does not become "never".                                                                       |
| `plan <ID…>`    | Dispatches the deep-tier planner and enforces the Plan Gate.                                                                                               |
| `next [ID…]`    | One full cycle: plan → gate → implement (TDD) → fresh review → two-commit close.                                                                           |
| `review <ID…>`  | Fresh reviewer over the working tree, then the `APPROVE / REJECT` decision tree.                                                                           |
| `close <ID…>`   | Two-commit close, only when the fragment already says `APPROVE (0B/0M)`.                                                                                   |
| `loop [max]`    | Repeats `next` until the backlog is empty, the budget is reached, the tree is dirty, or a card is blocked.                                                 |
| `resume`        | Cold start: recover the exact phase from disk.                                                                                                             |
| `status`        | Read-only report of board, active fragment and next action.                                                                                                |

## How a card moves

```text
intent ──▶ card ──▶ planner ──▶ Plan Gate (7 checks) ──▶ implementer (Red→Green)
                                      │                          │
                                      ▼                          ▼
                              BLOCKED → human            fresh reviewer (0B/0M)
                                                                 │
                                    B>0 / M>0 ──▶ rework (max 2) │
                                                                 ▼
                                              functional commit → state commit
```

**The Plan Gate** (all seven required, verified by the orchestrator):

1. Intent present (`## 0`: who/why, Given/When/Then, non-goals).
2. Exact file paths across the profile's layers.
3. Closed contracts and types, including typed errors.
4. Red→Green test strategy, case by case.
5. Zero open architectural decisions.
6. Minimum necessary design (`Design ladder:` line; no dependency or abstraction without a second consumer).
7. Fragment ≤300 lines and every annex link resolves.

**The review gate**: a session that never saw the implementation receives the fragment ID, reads the code the
diff _touches_, re-runs the gates and classifies every finding as Blocker, Major or Follow-up. `APPROVE`
requires `0B/0M`. Auto-injected cross-session memory is explicitly forbidden there: it would destroy the
independence the gate depends on.

## Profiles: your stack, not the protocol's

```json pipeline-profile
{
  "name": "bun-nestjs-ddd",
  "version": "0.1.0",
  "moduleRoot": "apps/api/src/<module>",
  "layers": ["domain", "application", "infrastructure", "presentation"],
  "sourceRoots": ["apps", "packages"],
  "contracts": "docs/contracts/<module>.contract.md",
  "specs": "apps/api/src/<module>/SPEC.md",
  "gates": ["bun run lint", "bun run typecheck", "bun run --cwd apps/api test"],
  "graph": ["codebase-memory-mcp", "codegraph"],
  "tiers": { "deep": "", "fast": "" }
}
```

Built-in: `generic` (fill the placeholders) and `bun-nestjs-ddd` (a worked monorepo example). Pass
`--profile path/to/your-profile.md` for your own. See [docs/adapters.md](docs/adapters.md).

## Guards

The pipeline ships its own ratchets, so the process cannot rot silently:

- `pipeline-fragment-budget.test.ts` — fragments stay under 300 lines; every annex link resolves.
- `pipeline-debt.test.ts` — every `shortcut:` marker is well formed.
- `pipeline-profile.test.ts` — the profile parses, has no placeholders and its source roots exist.
- `pipeline-skill-budget.test.ts` — the skill's own hot path stays under budget.

```bash
bun run roadmap:check   # all of the above
bun run roadmap:debt    # the declared-debt table
```

## Relationship to other agent skills

| Project                                                | What it optimizes                                                     | How this differs                                                                                                                         |
| :----------------------------------------------------- | :-------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| [Superpowers](https://github.com/obra/superpowers)     | Behaviour: brainstorming, plans, TDD, review as auto-triggered skills | This is infrastructure: on-disk kanban, dispatched roles with permissions, gates enforced by the orchestrator and by tests.              |
| [Ponytail](https://github.com/DietrichGebert/ponytail) | The smallest change; no over-engineering                              | Its best rules (reuse ladder, `shortcut:` ledger, "never cut validation") are built into the planner, implementer and `0B/0M` checklist. |
| [claude-mem](https://github.com/thedotmack/claude-mem) | Persistent memory across sessions                                     | Deliberately rejected for the reviewer. This keeps state in versioned files you can read, diff and audit.                                |

They compose: if you already run a behavioural skill, this one governs the process and the reviewer gate.

## Documentation

- [Methodology](docs/methodology.md) — the triad, the `0B/0M` standard, why four roles.
- [Adapters](docs/adapters.md) — write a profile, support a harness, tune model tiers.
- [Español](docs/i18n/README.es.md) — guía rápida.

## Requirements and limits

- Bun ≥ 1.3 (`bunx`); the installer is bash, so macOS/Linux. Windows is untested.
- One card at a time per working tree; the orchestrator refuses to run on a dirty tree.
- The pipeline is opinionated about DDD + contracts + living specs. If your repo has none of that, start with
  `modular monolith` boundaries and the `generic` profile.

## License

MIT © crissacm

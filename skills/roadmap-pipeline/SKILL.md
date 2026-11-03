---
name: roadmap-pipeline
description: Batch-oriented autonomous delivery workflow driven by DDD, SDD contracts, living BDD specs, Kanban state, and TDD Red-Green cycles. Entry point for `/roadmap`, including intent intake and debt harvest.
---

# Roadmap Pipeline

This skill only routes. The protocol lives in **one** place: do not restate it here.

| Need                                                    | Read                                                                     |
| :------------------------------------------------------ | :----------------------------------------------------------------------- |
| Modes, phases, gates, templates, resume                 | [references/pipeline-protocol.md](references/pipeline-protocol.md)       |
| Your workspace paths, gates, graph tools and tiers      | `docs/pipeline/profile.md` (created by `roadmap-pipeline init`)          |
| Mode targets and orchestrator rules                     | [commands/roadmap.md](commands/roadmap.md)                               |
| Role contracts, harness matrix, install/invoke, handoff | [references/subagent-definitions.md](references/subagent-definitions.md) |
| Canonical role prompts (single source)                  | [references/roles/](references/roles/)                                   |
| Artifact templates (fragment §0, index, board, intent)  | [references/templates/](references/templates/)                           |
| `0B/0M` layer-by-layer audit checklist                  | [references/ddd-code-review.md](references/ddd-code-review.md)           |
| `SPEC.md`, contract and drift-guard templates           | [references/contract-guards.md](references/contract-guards.md)           |
| Boundary rules and Bounded Context anatomy              | the companion `ddd-architecture` skill, when installed                   |

## Invocation

Use the `/roadmap` command: `intent | status | audit | debt | plan | next | review | close | loop | resume` (e.g. `/roadmap intent live order tracking`, `/roadmap next ORD-01`, `/roadmap debt`). The command runs in the current session as the Orchestrator and dispatches the canonical subagents.

Without the command, read [`commands/roadmap.md`](commands/roadmap.md) for the mode contract, then execute [`references/pipeline-protocol.md`](references/pipeline-protocol.md) §2.

## Hard rules (details in the protocol)

- **State on disk, never in chat**: kanban index + one board per workstream + fragment + commit hashes.
- **The profile is the only source of paths and gates**: never hardcode a command or a directory the profile does not declare (§1.1).
- **Intent before cards**: `/roadmap intent` records who/why + Given/When/Then; Plan Gate criterion 0 rejects an empty `## 0`.
- **Tiering**: `deep` (planner/reviewer) and `fast` (implementer/auditor) come from the profile's `tiers`; the installer pins them (§3.2).
- **Fresh reviewer, two-commit close, `0B/0M` gate** (§3.2, §5 Phase 4–5): never inject cross-session memory into the reviewer ([ddd-code-review.md](references/ddd-code-review.md)).
- **Smallest complete change**: reuse first; no dependency or abstraction without a second consumer; complexity is `M`; deliberate limits carry `shortcut: <limit>; upgrade when <condition>` (§3.5).
- **Stop conditions beat throughput**: `B > 0` / `M > 0` after 2 iterations, `Requires Human Supervision`, an unverifiable gate, a `BLOCKED` Plan Gate (command rule 6).
- **Fragment budget ≤300 lines**: verbatim evidence and long literals go to `docs/pipeline/fragments/<ID>/` (§6.D).
- **Skill budget is ratcheted**: every rule declares its tier (router / protocol / role / reference) and what it compresses; `pipeline-skill-budget.test.ts` enforces the caps. Never append to the hot path without a displacement.
- **Tool honesty**: the workspace need not be graph-indexed. If `.codegraph/` or a `codebase-memory-mcp` project exists, the graph is the discovery tool; if not, roles use bounded `read`/`grep` and say so. Never claim graph evidence you did not collect (§3.4).

# Methodology

This document explains _why_ the pipeline is shaped the way it is. The normative protocol lives in the skill
([`skills/roadmap-pipeline/references/pipeline-protocol.md`](../skills/roadmap-pipeline/references/pipeline-protocol.md));
this is the reasoning behind it.

## The triad

| Level             | Method                | Artifact                                                 | Question it answers                   |
| :---------------- | :-------------------- | :------------------------------------------------------- | :------------------------------------ |
| Internal model    | DDD + CQRS + ROP      | Aggregates, Value Objects, Domain Events, `Result<T, E>` | What is true regardless of transport? |
| Front integration | SDD / contract-driven | `docs/contracts/<module>.contract.md` + drift guards     | What may a consumer rely on?          |
| Product alignment | BDD / living specs    | `SPEC.md` with Given/When/Then                           | What must the user observe?           |

Each level has a guard: layer rules for DDD, drift guards for the contract, scenario/invariant links for the
spec. A change that updates one without the others is a Blocker, not a style issue.

## Why four roles

| Role                  | Tier | Access                            | Why it is separate                                                                                    |
| :-------------------- | :--- | :-------------------------------- | :---------------------------------------------------------------------------------------------------- |
| `flow-auditor`        | fast | read-only                         | Discovery has no business writing. Parallel readers scale; a writer in the swarm corrupts the board.  |
| `roadmap-planner`     | deep | writes `docs/pipeline/**`         | Planning is where ambiguity is expensive. It must not be able to "fix it while planning".             |
| `roadmap-implementer` | fast | writes code                       | Execution is mechanical _because_ the plan is closed. A fast model is enough and cheaper.             |
| `roadmap-reviewer`    | deep | writes `docs/pipeline/**` + shell | A fresh session that never saw the implementation is the only reviewer that can certify independence. |

Permissions are part of the contract, not advice: a prompt is not a security boundary. On OpenCode the
installer writes deny rules; on Claude Code it restricts `tools`; on Codex the role prompt is the only boundary,
so keep the working tree clean and review the diff anyway.

## Why state on disk

Conversation memory does not survive compaction. Real sessions have re-implemented work whose commits already
existed. The pipeline keeps four artifacts:

- **Kanban index** — the mirror of what is in progress and blocked.
- **One board per workstream** — the source of truth for cards with that ID prefix.
- **Fragments** — intent, plan, execution evidence, review verdicts and closure, one file per card.
- **Git** — the hash registry that proves each closed card exists.

`/roadmap resume` reads those four and recovers the exact phase. Nothing is reconstructed from chat.

## The `0B/0M` standard

A card is approved only with **zero Blockers and zero Majors**:

- **Blocker**: broken invariant, layer violation, contract drift, false-positive test, regression, security leak.
- **Major**: wrong error model, mutable Aggregate state, coupling, `any`, unnecessary complexity, unmarked shortcut.
- **Follow-up**: out of scope; goes to `## 6` and the board.

Every finding must state: what the code does, what goes wrong, how to fix it, and what happens if it is skipped.

## Evidence, not claims

A test written after the fact proves nothing: it passes immediately and encodes whatever the code already does.
The implementer must show the test failing without the production change (temporary `git stash`), then passing
with it. The reviewer re-runs the gates in its own session; a gate nobody executed is not a gate.

## The smallest complete change

The reviewer's checklist has a necessity axis, because correctness is not enough:

- Reuse before invention: a parallel implementation of something the repo already has is a Major.
- No speculative generality: a new abstraction, option, config or dependency needs a second consumer.
- Deliberate limits are allowed, but marked `shortcut: <the limit>; upgrade when <condition>`, harvested by
  `/roadmap debt`. An unmarked shortcut is a Major.

## Budgets

| Artifact                  |    Budget | Enforced by                        |
| :------------------------ | --------: | :--------------------------------- |
| Fragment                  | 300 lines | `pipeline-fragment-budget.test.ts` |
| Skill router (`SKILL.md`) |  40 lines | `pipeline-skill-budget.test.ts`    |
| Protocol (hot path)       | 200 lines | `pipeline-skill-budget.test.ts`    |
| Role prompt               |  40 lines | `pipeline-skill-budget.test.ts`    |

The budgets exist because instructions dilute: the more rules a model reads, the less each one is followed.
A new rule must declare its tier (router, protocol, role, reference) and what it compresses or displaces.
Verbatim output goes to annexes; the fragment keeps commands and numbers.

## Non-goals

- **Not a chat workflow.** It does not "keep the plan in mind"; it writes it down.
- **Not a test framework.** It runs the commands the profile declares, never invents one.
- **Not stack-specific.** The protocol names no framework; the profile does.
- **Not a memory plugin.** Cross-session memory is rejected for the reviewer by design.

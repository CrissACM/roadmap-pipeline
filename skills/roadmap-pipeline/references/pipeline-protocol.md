---
name: roadmap-pipeline
description: >-
  Batch-oriented autonomous delivery workflow driven by DDD + SDD (Contract-Driven) + BDD (Living Specs)
  with multi-agent orchestration over a persistent Kanban board and dynamic task fragments: Intent Intake
  (human intent before cards), Discovery Swarm (parallel read-only auditors), Planner (deep tier), Implementer
  (fast tier with strict Red->Green TDD and quality gates), and Reviewer (deep tier in a fresh session enforcing
  0B/0M). Use when capturing intent, auditing E2E flows, building complex features, executing refactors,
  resolving bug batches, or synchronizing backend/frontend contracts.
---

# Roadmap Pipeline (DDD + SDD + BDD & Multi-Agent Kanban)

Normative protocol for autonomous feature delivery and codebase audits in cohesive batches, with strict
quality gates, model tiering, DDD, and context hygiene backed by on-disk state.

---

## 1. Methodological Triad (`DDD + SDD + BDD`)

| Level                 | Methodology               | Location                                                         | Purpose & Core Rules                                                                                                                                                                                          |
| :-------------------- | :------------------------ | :--------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Internal Modeling** | **DDD + CQRS + ROP**      | `<moduleRoot>/domain/` & `application/` (see the profile)        | Aggregates, Value Objects, Domain Events, strict Command/Query separation, and _Railway Oriented Programming_ (`Result<T, E>` with typed domain errors — never raw unhandled exceptions for domain failures). |
| **Front Integration** | **SDD / Contract-Driven** | `<contracts>/<module>.contract.md` & guard tests                 | The backend models in DDD and exports a formal contract consumed by web/admin agents. Protected by automated _drift-guards_ for schemas, DTOs, and enums.                                                     |
| **Product Alignment** | **Living Specs / BDD**    | `SPEC.md` inside each module (`<moduleRoot>/SPEC.md` by default) | Living business rules in Ubiquitous Language using **Given / When / Then** scenarios.                                                                                                                         |

> Templates and guard tests (`SPEC.md`, module contract, enum drift-guard, coverage guard): [references/contract-guards.md](contract-guards.md).
> `0B/0M` layer-by-layer review checklist: [references/ddd-code-review.md](ddd-code-review.md).
> Artifact templates (fragment, kanban index, workstream board): [references/templates/](templates/).
> Boundary rules and Bounded Context anatomy: companion `ddd-architecture` skill, when installed.

### 1.1 Workspace Profile (`docs/pipeline/profile.md`)

The protocol never names a stack. Every consumer declares its paths, gates and tools in one file, created by
`roadmap-pipeline init`; roles use those values verbatim and never invent a command.

```json pipeline-profile
{
  "version": "0.1.0",
  "moduleRoot": "src/<module>",
  "layers": ["domain", "application", "infrastructure", "presentation"],
  "sourceRoots": ["src"],
  "contracts": "docs/contracts/<module>.contract.md",
  "specs": "<moduleRoot>/SPEC.md",
  "gates": ["<your test command>"],
  "graph": [],
  "tiers": { "deep": "", "fast": "" }
}
```

Missing or unparsable profile → `BLOCKED` at the Plan Gate; the Orchestrator proposes `roadmap-pipeline init`.

---

## 2. Orchestrator Invocation Modes

The single entrypoint is `/roadmap` (`commands/roadmap.md`): `$ARGUMENTS` = `<mode> [targets...]`, run in the current session with the `build` agent, so the Orchestrator can commit and dispatch subagents. Targets and required actions per mode are defined **only** there.

Mode semantics: `intent` → §5 Phase 0a · `audit` → §5 Phase 0b · `debt` → §5 Phase 0c · `next`/`loop` → §5 Phases 2–5 · `plan` → §5 Phase 2 · `review` → §5 Phase 4 · `close` → §5 Phase 5 · `resume` → §7 · `status` → read-only (index + owning board + `git status`).

---

## 3. Operating Principles & Multi-Harness Dispatch

1. **Stateless Orchestrator (disk-backed state).** The Orchestrator never accumulates implementation work in its own context and never relies on chat history. State lives in four artifacts: the **Kanban Index** (`docs/pipeline/kanban.md`), one **Workstream Board** per ID prefix (`docs/pipeline/kanban/<prefix>.md`), **Dynamic Task Fragments** (`docs/pipeline/fragments/<ID>.md`), and git history (hash registry). Board resolution follows the card ID (`ORD-01` → `kanban/ord.md`) and is enforced by the command's orchestrator rules.
2. **Subagent dispatch & model tiering.** The 4 canonical roles (`flow-auditor`, `roadmap-planner`, `roadmap-implementer`, `roadmap-reviewer`) are authored once in [`references/roles/`](roles/) and translated into each harness by the idempotent [`scripts/install-harnesses.sh`](../scripts/install-harnesses.sh); never edit generated files by hand.
   - **Tier contract**: the profile's `tiers.deep` (planner + reviewer) and `tiers.fast` (implementer + auditor); the installer writes them into the agent files so a parent session cannot silently downgrade. Empty tier = harness default, never a silent downgrade to a free model.
   - **Free-limit fallback**: on a free-limit/rate-limit error, re-dispatch the same role with the profile's paid fallback and note it in §3; if the Orchestrator's own session hits the limit, ask the user to `/models` → paid tier and continue from disk (`/roadmap resume`).
   - **`access`** is enforced by harness permissions: the auditor has no write/shell, planner and reviewer write only under `docs/pipeline/`, the implementer alone touches production code.
3. **Auditable TDD evidence (`Red -> Green`).** Every fix or feature must prove the new/updated test fails without the production implementation (before writing it, or via a temporary `git stash` on production changes) and passes with it.
4. **Tool honesty.** This workspace is not required to be graph-indexed. Roles use the graph when `.codegraph/` or a `codebase-memory-mcp` project exists and fall back to bounded `read`/`grep` when it does not, stating which case applies. No role ever claims graph evidence it did not collect; `graph=0` is a valid audit line on an unindexed repo.
5. **Shortcut ledger, not silent debt.** A deliberate limit is allowed and must be marked where the code lives: `shortcut: <the limit>; upgrade when <condition>`. `/roadmap debt` harvests them into the owning board's backlog; an unmarked deliberate shortcut is an `M` finding in Phase 4.

---

## 4. End-to-End Flow

```text
/roadmap intent (human) .... card with Intent block
Kanban (index + owning board) -> planner -> Plan Gate -> implementer (TDD + gates) -> fresh reviewer
  B > 0 or M > 0 ............ implementer (max 2 iterations, then stop)
  Human decision ............ card -> Blocked / Human Supervision
  APPROVE (0B/0M) ........... functional commit -> hash-registry commit -> Kanban
/roadmap debt ............. shortcut: markers -> backlog cards
```

---

## 5. Execution Phases

### Phase 0a: Intent Intake (`/roadmap intent`)

It runs in the Orchestrator session because the human is present; it is the only phase that asks questions.

1. **Look before asking.** Read the modules, `SPEC.md` and contracts the request touches. Never ask what the repository already answers.
2. **Play it back** in ≤200 words: what is wanted, for whom and why, in the human's own terms. Anything you inferred is labelled as your proposal, with the reason.
3. **One question**: the biggest thing the request leaves open, and what its answer would change about what gets built.
4. **Fix the scope**: the failing or missing behaviour as `Given / When / Then`, plus explicit non-goals.
5. **Write the card** in the owning board's backlog with an `Intent` block (`references/templates/workstream-board.md`) and `Intent source: human`; commit pipeline state only.

One round is the budget: if the human keeps answering, continue, but do not turn this into a design session (approaches belong to the Planner). The Planner carries the card's `Intent` block into fragment `## 0`; Plan Gate criterion 0 verifies it.

### Phase 0b: Flow Discovery Swarm (E2E audits and large epics)

1. **Partition** the primary actors and end-to-end journeys across modules.
2. **Swarm**: spawn parallel `flow-auditor` subagents (e.g. 4 per flow, split by stage or module) auditing `SPEC.md` + contracts against the implementation. Every dispatch carries exactly three things — the routing contract, the tool-honesty rule and the audit line already live in the role prompt:
   - `Target`: the flow/stage slice and its modules.
   - `Graph project`: the `list_projects` entry whose `root_path` contains the workspace, when the repo is indexed (never a folder name).
   - `Output contract`: findings with `path:LXX` + violated invariant, and the `tools:` audit line (graph may be 0 when not indexed).
     In an indexed repo, a report built on grep/read with zero graph calls is re-dispatched once with the routing contract restated; a second failure is recorded in the board, not accepted silently.
3. **Kanban initialization**: consolidate findings into stable IDs (`ORD-01`, `ORD-02`, ...), batch items that touch the same Aggregate/module, assign a workstream prefix per batch, write one board per prefix plus the index, then commit (`chore(pipeline): initialize kanban and discovery findings`). Existing `Intent source: human` blocks are never overwritten by the swarm.

### Phase 0c: Debt Harvest (`/roadmap debt`)

`bun scripts/pipeline-debt.ts` prints every marked `shortcut:` with its module, limit and upgrade condition. The Orchestrator groups them by module into the owning board's backlog (one card per module or per existing batch) and commits pipeline state only. Pre-existing markers are not retroactive review findings: they become cards.

### Phase 1: Specification & Contract (`SPEC.md` + `<contracts>/<module>.contract.md`)

Before implementing a feature or fixing an architectural gap, make the specification explicit: `SPEC.md` (BDD, Given/When/Then) and the module contract (SDD/DDD published language). Both templates live in [references/contract-guards.md](contract-guards.md); do not inline them here.

### Phase 2: Planning & Plan Gate (Planner)

The Orchestrator picks the next item (or cohesive batch) from the board and delegates to `roadmap-planner`; the planner owns analysis, design, migrations, and follow-ups.

**Recall first (no extra tooling).** Before designing, the planner searches previous decisions for the affected module, invariants and Aggregate — `grep -rn "<INV-…>\|<module>\|<Aggregate>" docs/pipeline/fragments <contracts> docs/pipeline/kanban` plus the board's Done registry — and records one line in `## 2`: `Prior art: <ID> (<what happened and why it was rejected>)` or `Prior art: none`. A design that contradicts a previously rejected one is `BLOCKED` until it states what is different this time.

**Plan Gate** (`0 blockers / 0 ambiguity`, seven checks) — the Orchestrator verifies all of them before invoking the Implementer:

- [ ] **Intent present**: fragment `## 0` filled from the card (`who/why` + Given/When/Then), or `Intent source: finding <ID>` / `debt <marker>` with the violated invariant or the marker.
- [ ] **Exact file paths** to create/modify across the profile's `layers` under its `moduleRoot`.
- [ ] **Closed contracts & types**: exact signatures for Commands, Domain Events, DTOs, and typed errors (`Result<T, E>` for new code; `<Module>Error`-style typed failures for unmigrated slices).
- [ ] **Red → Green test strategy**: exact unit, integration/auth, and drift-guard cases that must fail before and pass after.
- [ ] **Zero open architectural decisions**: no "consider whether…", "maybe…".
- [ ] **Minimum necessary design**: a `Design ladder:` line states what was reused (existing helper/pattern, stdlib, platform, installed dependency), and every new dependency or abstraction has a second consumer or a one-line justification.
- [ ] **Within budget**: fragment ≤300 lines and every annex link resolves (§6.D).

### Phase 3: Execution & Field Notes (Implementer)

Once the Plan Gate passes, the Orchestrator moves the card to `IN_PROGRESS` and delegates to `roadmap-implementer`, which owns the TDD cycle, contract/spec updates, and gate execution. The Orchestrator only verifies the handoff line.

The implementer ships the **smallest complete change**: it reuses what the codebase already has, adds no dependency or abstraction the plan does not justify, and never cuts validation, error handling, security or any gate below. Every deliberate limit is marked `shortcut: <the limit>; upgrade when <condition>`; the fragment records how many were added in `## 3`.

Required gates are exactly the profile's `gates` list, run verbatim (never a subset, never an invented command). The Implementer never creates the closing commit; it leaves the tree ready for audit and records execution notes, test metrics, migrations, and touched contracts in the fragment.

### Phase 4: Independent Fresh-Session Review (Reviewer)

On implementer completion the Orchestrator moves the card to `IN_REVIEW` and spawns a **fresh** `roadmap-reviewer`, which reads the code the diff touches (not only the diff), inspects `git diff`, reads the fragment, independently re-runs the profile's gates, and classifies findings under `0B/0M` (definitions: [references/ddd-code-review.md](ddd-code-review.md)).

**Independence is a gate, not a preference.** The reviewer receives the fragment ID only. Its session must not carry implementation notes, and no automatic cross-session memory may be injected into it; a reviewer that saw the implementer's reasoning cannot certify `0B/0M`.

**Orchestrator decision tree:**

- **`APPROVE (0B/0M)`** → Phase 5.
- **`B > 0` or `M > 0`** → re-invoke the Implementer on the same fragment (max 2–3 iterations before escalating).
- **Human supervision required** → document the decision in the fragment, move the card to `Blocked / Human Supervision`, continue with an independent item or notify the user.

### Phase 5: Two-Commit Close & Triage

1. **Commit 1 — Functional** (code + tests + `SPEC.md` + contracts), message `ORD-01 + ORD-02: <concise domain/contract summary>`; capture `git rev-parse --short HEAD`.
2. **Triage & stamp**: write `APPROVE (0B/0M)` under `**Final Verdict:**` and the short hash under `**Commit:**` in the fragment; move the card to the board's `✅ Completed & Hash Registry (Done)` table with its hash; promote approved `## 6. Follow-ups` as new cards in the matching board's backlog.
3. **Commit 2 — Pipeline state**: stage the fragment, its annexes (`docs/pipeline/fragments/<ID>/**`), the board and the index (when counters or the mirror changed); message `chore(pipeline): record commit hash (<ID>)`; leave the tree 100% clean.

---

## 6. State Artifacts & Budget

**A/B/C — templates.** `references/templates/fragment.md` (§A), `kanban-index.md` (§B) and `workstream-board.md` (§C). Read the template when creating or restructuring an artifact; never keep an inline copy anywhere else.

### D. Fragment Size Budget & Annexes (300 lines)

The fragment is an **index of decisions and verdicts, not a log**. Hard budget: **300 lines** for `docs/pipeline/fragments/<ID>.md`, enforced by `pipeline-fragment-budget.test.ts` (ratchet: fragments written before this rule may only shrink).

**Stays in the fragment**: §0 intent + origin; §1 problem + invariants; §2 closed decisions (`D<n>`: decision + exact paths/signatures), `Prior art` and `Design ladder` + scope table; §3 one row per iteration + Red→Green evidence + gates as command → result; §4 verdicts + findings table; §5 closure registry; §6 open follow-ups, one line each.

**Goes to `docs/pipeline/fragments/<ID>/` (append-only annexes)**

| Annex               | Content                                                     |
| :------------------ | :---------------------------------------------------------- |
| `plan-payloads.md`  | literal file contents and code blocks **>20 lines**         |
| `iterations/<n>.md` | closed narrative + verbatim command output of iteration `n` |
| `full-<date>.md`    | byte-identical previous fragment when rewritten to fit      |
| `README.md`         | annex index + sha256 of the archived original               |

**Rules**

1. **Verbatim output is never inlined**: the fragment keeps the command and numbers, the output is linked.
2. **Literal file contents beyond 20 lines are never inlined** — link the annex.
3. **Rotate at every hand-off** (iteration end, review, close): closed iterations move to `iterations/<n>.md`, the fragment keeps one row per iteration with its anchor.
4. **Rewriting to fit requires a byte-identical archive first**: copy to `<ID>/full-<date>.md`, record its sha256, then rebuild the index. Never rewrite without the archive.
5. **Annexes are append-only**; new work means a new fragment.
6. **Anchors must resolve**: every relative link points to an existing annex file.

---

## 7. Clean-Context Resume Protocol (`/roadmap resume`)

1. **Physical state**: run `git status` and `git log -n 5 --oneline`; read `docs/pipeline/kanban.md` and, when a card is active, its board.
2. **Active transaction recovery**: if a card is `IN_PROGRESS`/`IN_REVIEW`, open its fragment — `## 3` filled and `Final Verdict` blank → dispatch `roadmap-reviewer`; unresolved `B > 0`/`M > 0` → dispatch `roadmap-implementer`; verdict `APPROVE (0B/0M)` without its commits → Phase 5.
3. **Queue advancement**: with a clean tree and no active transaction, take the next item (or cohesive batch) from `Prioritized Backlog` and dispatch `roadmap-planner`.
4. **Card source**: a backlog card with `Intent source: human` and no fragment → `/roadmap plan <ID>`; a card born from `shortcut:` markers → plan it like any other; a fragment with `## 0` empty is `BLOCKED` (criterion 0).

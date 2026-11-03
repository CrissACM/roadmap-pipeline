# Multi-Harness Subagent Definitions (`OpenCode`, `Claude Code`, `Codex`)

The 4 canonical pipeline roles are authored **once** as Markdown files with a small frontmatter and a system-prompt body:

```
references/roles/flow-auditor.md
references/roles/roadmap-planner.md
references/roles/roadmap-implementer.md
references/roles/roadmap-reviewer.md
```

```yaml
---
role: roadmap-reviewer
description: Independent fresh-session reviewer agent that audits git diff against contract and fragment under 0B/0M
tier: deep # deep -> planner/reviewer | fast -> implementer/auditor
access: review # readonly | plan | write | review  (enforced by harness permissions)
---
<system prompt>
```

Generated harness files are build artifacts. Edit `references/roles/*.md` and re-run the installer (idempotent); never edit `~/.config/opencode/agents/*.md` by hand, because the next install overwrites it.

---

## 1. Harness Adaptation Matrix

Models come from the workspace profile's `tiers` (`deep` → planner + reviewer, `fast` → implementer + auditor). The installer pins them into the generated agent so a parent session cannot silently change them; an empty tier means "use the harness default", never a silent downgrade.

| Pipeline Role             | Model Tier | **OpenCode** (`.opencode/agents/*.md`)                     | **Claude Code** (`.claude/agents/*.md`)                    | **Codex CLI** (`.codex/agents/*.toml`) |
| :------------------------ | :--------- | :--------------------------------------------------------- | :--------------------------------------------------------- | :------------------------------------- |
| **`flow-auditor`**        | `fast`     | `tiers.fast`, `permissions`: no edit/shell/webfetch        | `tiers.fast`, `tools: Read, Grep, Glob`                    | `model_reasoning_effort = "medium"`    |
| **`roadmap-planner`**     | `deep`     | `tiers.deep`, `permissions`: write only `docs/pipeline/**` | `tiers.deep`, `tools: Read, Grep, Glob, Write, Edit`       | `model_reasoning_effort = "high"`      |
| **`roadmap-implementer`** | `fast`     | `tiers.fast`, edit + shell allowed                         | `tiers.fast`, `tools: Read, Grep, Glob, Write, Edit, Bash` | `model_reasoning_effort = "medium"`    |
| **`roadmap-reviewer`**    | `deep`     | `tiers.deep`, edit only `docs/pipeline/**`, shell allowed  | `tiers.deep`, `tools: Read, Grep, Glob, Write, Edit, Bash` | `model_reasoning_effort = "high"`      |

`access` exists because the prompt alone is not a security boundary: the reviewer and planner must not be able to patch production code, and the auditor must not be able to run shell commands at all.

**Tool routing is part of the contract.** Every role prompt carries its own `Tool routing (mandatory)` block (graph-first when indexed, bounded `read`/`grep` when not) and closes with `tools: graph=<n>, read=<n>, grep=<n>`; `graph=0` is valid on an unindexed repo, never a claimed graph. The graph servers (`codebase-memory-mcp`, `codegraph`) are optional: enable them in the profile's `graph` list when installed.

**Reviewer isolation.** The reviewer is dispatched with the fragment ID only, in a session that never saw the implementation. Harnesses with persistent or auto-injected cross-session memory must not inject it into reviewer sessions: memory from the implementer's session destroys the independence that makes `0B/0M` meaningful.

---

## 2. Install & Invoke

```bash
# Recommended: let the CLI do the whole scaffold
bunx roadmap-pipeline init --profile bun-nestjs-ddd --project "$PWD"

# Or call the installer directly (it lives inside the skill)
bash .agents/skills/roadmap-pipeline/scripts/install-harnesses.sh --global
bash .agents/skills/roadmap-pipeline/scripts/install-harnesses.sh --project "$PWD" --harness opencode
bash .agents/skills/roadmap-pipeline/scripts/install-harnesses.sh --global --harness all
```

Model overrides (env vars, no file edits):

```bash
OPENCODE_MODEL_DEEP=<provider/model> \
OPENCODE_MODEL_FAST=<provider/model> \
  bash .agents/skills/roadmap-pipeline/scripts/install-harnesses.sh --global

CLAUDE_MODEL_DEEP=opus CLAUDE_MODEL_FAST=sonnet \
  bash .agents/skills/roadmap-pipeline/scripts/install-harnesses.sh --global
```

`roadmap-pipeline init` reads `tiers` from the profile and passes them through these variables, so a normal
install never needs them.

- **OpenCode**: subagents are invoked by the Orchestrator through the `subagent` tool by ID (`roadmap-planner`, `roadmap-implementer`, `roadmap-reviewer`, `flow-auditor`). Entrypoint: `/roadmap`.
- **Claude Code**: same IDs through `Task`/`Agent`; the agents preload the `roadmap-pipeline` skill (and `ddd-architecture` when it is installed).
- **Codex CLI**: roles are discovered from `.codex/agents/*.toml`; invoke the skill with `$roadmap-pipeline` and follow the `/roadmap` modes manually.

The installer backs up the previous agents/commands under `<base>/.install-backups/<timestamp>/` before writing.

---

## 3. Handoff Contract

Every role ends its final message with a single machine-readable line so the Orchestrator can decide without reading the whole transcript:

```text
flow-auditor        -> <flow>; findings: <n>; batches: <ids>; skipped: <n>; risk: <none|one line>
roadmap-planner     -> <ID>; plan gate: READY | BLOCKED (<reason>); prior art: <ID|none>; risk: <none|one line>
roadmap-implementer -> <ID>; red->green: proven | not-proven; gates: <pass/fail>; blockers: <n>; skipped: <n>; risk: <none|one line>
roadmap-reviewer    -> <ID>; verdict: APPROVE (0B/0M) | REJECT (<n>B/<m>M); human: yes|no; risk: <none|one line>
```

`skipped` counts work consciously left out (files not read, flows not exercised, cases not tested); `risk` is the one thing the Orchestrator must know before deciding. Both must be honest: an empty `skipped` on a partial audit is a false report.

The authoritative record is still the fragment on disk; the handoff line is only a routing hint and must never replace `## 3. Execution Notes`, `## 4. Review Audit`, or `## 5. Closure & Traceability`.

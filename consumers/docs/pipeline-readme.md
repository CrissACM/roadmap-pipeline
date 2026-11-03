# Roadmap Pipeline — on-disk state

Operational state for the autonomous pipeline. The normative protocol lives in the installed skill
(`.agents/skills/roadmap-pipeline/references/pipeline-protocol.md`); this directory only holds state.

```text
docs/pipeline/
├── profile.md             # this workspace's paths, gates, graph tools and model tiers
├── kanban.md              # index (mirror of in-progress/blocked + counters)
├── kanban/<prefix>.md     # one board per workstream (ORD → kanban/ord.md)
└── fragments/<ID>.md      # intent, plan, execution, review and closure of each card
    └── <ID>/              # annexes: plan-payloads.md, iterations/<n>.md, full-<date>.md
```

## Start here

1. Fill `profile.md`: remove every `<placeholder>`, list the real gate commands.
2. `/roadmap intent <description>`: records who/why + Given/When/Then + non-goals as a card.
3. `/roadmap audit <flow...>`: discovers findings and creates IDs + boards.
4. `/roadmap debt`: harvests `shortcut:` markers into backlog cards.
5. `/roadmap next <ID>`: plan → Plan Gate (7 criteria) → TDD implementation → fresh review → two-commit close.
6. `/roadmap status`: reads index + active board + `git status`, writes nothing.

## Annex rules (§6.D)

| Annex               | Content                                                 |
| :------------------ | :------------------------------------------------------ |
| `plan-payloads.md`  | literal content and code blocks >20 lines from the plan |
| `iterations/<n>.md` | closed narrative + verbatim output of iteration n       |
| `full-<date>.md`    | previous fragment, byte-identical, before rewriting it  |
| `README.md`         | annex index + sha256 of the archived original           |

## Guards

- `bun run roadmap:check` — fragment budget (≤300 lines), annex links, `shortcut:` convention and the
  skill's own budget (`scripts/pipeline-skill-budget.test.ts`).
- `bun run roadmap:debt` — declared debt table; `--check` fails on a malformed marker.
- `bunx roadmap-pipeline check` — the same guards, run from the package without local copies.

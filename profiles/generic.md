# Pipeline Profile: generic

The machine-readable block is the contract the protocol reads. Replace every `<placeholder>` with the real
value for this repository before the first Plan Gate; `bun run roadmap:check` fails while placeholders remain.

```json pipeline-profile
{
  "name": "generic",
  "version": "0.1.0",
  "moduleRoot": "src/<module>",
  "layers": ["domain", "application", "infrastructure", "presentation"],
  "sourceRoots": ["src"],
  "contracts": "docs/contracts/<module>.contract.md",
  "specs": "<moduleRoot>/SPEC.md",
  "gates": ["<the exact command that runs this repo's tests>"],
  "graph": [],
  "tiers": { "deep": "", "fast": "" }
}
```

## What each key means

| Key           | Used by                                 | Meaning                                                                                                     |
| :------------ | :-------------------------------------- | :---------------------------------------------------------------------------------------------------------- |
| `moduleRoot`  | planner, implementer, reviewer, auditor | Path pattern of one bounded context. `<module>` is replaced by the module name.                             |
| `layers`      | planner, reviewer                       | The directories under `moduleRoot` the plan and the review must respect.                                    |
| `sourceRoots` | `pipeline-debt.ts`                      | Top-level directories scanned for `shortcut:` markers.                                                      |
| `contracts`   | planner, reviewer, auditor              | Published-language contract per module.                                                                     |
| `specs`       | planner, reviewer                       | Living BDD spec per module.                                                                                 |
| `gates`       | implementer, reviewer                   | Exact commands, run verbatim and in order. Never invent one.                                                |
| `graph`       | every role                              | Graph tools available (`codebase-memory-mcp`, `codegraph`) or `[]`.                                         |
| `tiers`       | installer                               | Provider model ids for `deep` (planner/reviewer) and `fast` (implementer/auditor); empty = harness default. |

## Notes

- Keep `gates` slowest-last: the implementer stops at the first failure and reports it.
- If a gate is conditional (integration only when the slice touches HTTP), name it in the prose below, not in
  `gates`: the pipeline never sub-selects a gate.
- `tiers` is optional in practice; leaving it empty is honest and avoids pinning a provider you do not use.

# Changelog

All notable changes to this project are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), [SemVer](https://semver.org/).

## [0.1.0] - 2026-11-03

### Added

- **Skill** `roadmap-pipeline`: `/roadmap` with ten modes — `intent`, `status`, `audit`, `debt`, `plan`, `next`,
  `review`, `close`, `loop`, `resume`.
- **Four canonical roles**: `flow-auditor`, `roadmap-planner`, `roadmap-implementer`, `roadmap-reviewer`, with a
  multi-harness installer (OpenCode, Claude Code, Codex CLI) that pins model tiers and permission boundaries.
- **Seven-criteria Plan Gate**, including intent presence and minimum necessary design.
- **`0B/0M` review standard** with a finding format (what it does, what goes wrong, how to fix, cost of skipping)
  and a complexity axis for speculative abstraction.
- **Shortcut ledger**: `shortcut: <limit>; upgrade when <condition>` plus `/roadmap debt` harvest.
- **On-disk state**: kanban index, one board per workstream, fragments with a 300-line budget and append-only
  annexes, two-commit close with a hash registry.
- **Workspace profiles** (`generic`, `bun-nestjs-ddd`): paths, gates, graph tools and model tiers live in
  `docs/pipeline/profile.md`, never in the protocol.
- **CLI**: `init`, `check`, `debt`, `install`, `--version`, plus `--dry-run`, `--link`, `--force`, `--skip-agents`.
- **Guards**: fragment budget and annex links, shortcut format, profile integrity, and a ratchet on the skill's
  own hot path.

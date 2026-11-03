# Roadmap Pipeline Kanban — Index

> Single entry point. Each workstream has its own board under `kanban/<prefix>.md`;
> the tables below are a **mirror** written by the Orchestrator in the same edit as the board.

## 🟢 In Progress / In Review

| ID       | Board                  | Title                      | Current Phase | Fragment                            |
| :------- | :--------------------- | :------------------------- | :------------ | :---------------------------------- |
| `ORD-01` | [`ORD`](kanban/ord.md) | Checkout coupon validation | `IN_REVIEW`   | `docs/pipeline/fragments/ORD-01.md` |

## ⏸️ Requires Human Supervision (Blocked)

| ID  | Board | Pending Decision / Blocker | Fragment |
| :-- | :---- | :------------------------- | :------- |

## 🗂️ Boards

| Board | Prefix | In Progress | Blocked | Backlog | Done | File                             |
| :---- | :----- | ----------: | ------: | ------: | ---: | :------------------------------- |
| `ORD` | `ORD-` |           1 |       0 |       0 |    6 | [`kanban/ord.md`](kanban/ord.md) |

## 📌 Rules

- One board per ID prefix; a card lives in exactly one board. The Orchestrator owns all board edits, in the state commit.
- New follow-ups inherit the origin prefix unless a different workstream is deliberately assigned.
- A card created by `/roadmap intent` carries an `Intent` block and `Intent source: human`; a card created by `/roadmap debt` carries `Intent source: debt <marker>`.

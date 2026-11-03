# Kanban — `<PREFIX>` workstream

> Source of truth for cards whose ID starts with `<PREFIX>-`.
> Index: [`../kanban.md`](../kanban.md) · Fragments: [`../fragments/`](../fragments/)

## 🟢 In Progress / In Review

| ID       | Flow / Context | Title             | Current Phase | Fragment                            |
| :------- | :------------- | :---------------- | :------------ | :---------------------------------- |
| `ORD-01` | Checkout       | Coupon validation | `IN_REVIEW`   | `docs/pipeline/fragments/ORD-01.md` |

## ⏸️ Requires Human Supervision (Blocked)

| ID  | Context | Pending Decision / Blocker | Fragment |
| :-- | :------ | :------------------------- | :------- |

## 📋 Prioritized Backlog (Ready for Planner)

| ID  | Flow / Context | Title | Suggested Batching |
| :-- | :------------- | :---- | :----------------- |

## ✅ Completed & Hash Registry (Done)

| ID(s)             | Summary                                     | Verdict           | Commit Hash |
| :---------------- | :------------------------------------------ | :---------------- | :---------- |
| `ORD-02 + ORD-03` | Coupon limits, checkout totals, drift-guard | `APPROVE (0B/0M)` | `94ef505`   |

## 🧭 Intent blocks (cards from `/roadmap intent`)

A card created from human intent carries this block under its backlog row:

```markdown
### `ORD-07` — <title>

- **Intent source:** `human`
- **Who / why:** <who needs it and what changes for them>
- **Given / When / Then:** <the behaviour that must start holding>
- **Non-goals:** <what is deliberately out>
- **Open question (asked, not answered):** <the one thing the human left open>
```

The Planner copies the block into fragment `## 0` verbatim; it never rewrites the human's words into jargon.

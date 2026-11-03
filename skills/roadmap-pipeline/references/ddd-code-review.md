# DDD Code Review Checklist (`ddd-code-review` — `0B/0M` Standard)

This reference defines the exact audit checklist used by `roadmap-reviewer` (or any senior architectural review) when inspecting a `git diff` in a DDD + SDD + BDD codebase.

**Read the code the diff touches, not only the diff.** A signature change reaches callers, config, fixtures and consumers that may not appear in the patch; blast radius is part of the review (use the graph when the repo is indexed).

---

## 1. Severity Classification (`0B/0M` Gate)

Every finding must be classified into one of three tiers. A change can only be approved (`APPROVE (0B/0M)`) when **Blockers = 0** and **Majors = 0**:

| Tier                  | Symbol | Definition                                                                                                                                                                                                                                                                                                                                                                           |
| :-------------------- | :----- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Blocker**           | `B`    | Broken domain invariant, layer boundary violation, cross-module import bypassing `<other>/public-api.ts`, contract/code drift, missing or false-positive test, unhandled runtime error, or security/authorization leak.                                                                                                                                                              |
| **Major**             | `M`    | Improper ROP error handling (throwing raw exceptions for domain errors), Aggregate exposing mutable setters, missing Object Mother usage in domain tests, N+1 query in read model, `any` type usage, **unnecessary complexity** (new dependency without plan justification, abstraction/option/config with a single consumer, "for later" code), or an unmarked deliberate shortcut. |
| **Minor / Follow-up** | `F`    | Out-of-scope refactoring opportunities or adjacent improvements. Must be logged in `## 6. Follow-ups` of the fragment without blocking the current commit.                                                                                                                                                                                                                           |

**Finding format (mandatory).** Every `B`/`M` states four things, or it is not actionable and does not count as reported:

1. **What the code does** (`path:LXX`).
2. **What goes wrong** — the invariant, boundary, contract clause or user-visible failure.
3. **How to fix it** — the minimal concrete change.
4. **What happens if it is skipped** — the cost of approving it anyway.

---

## 2. Layer-by-Layer Audit Checklist

Paths below are the profile's `moduleRoot` + `layers`.

### A. Domain Layer (`<moduleRoot>/domain/`)

- [ ] **Zero Framework/I/O Leakage (`B`)**: Does `domain/` import anything from `application/`, `infrastructure/`, `presentation/`, the ORM, the HTTP framework, or Node/Bun I/O?
- [ ] **Private Constructors & Factory Methods (`M`)**: Do Entities and Aggregate Roots use `private constructor` with `static create(...): Result<T, DomainError>` (for creation with invariant checks + Domain Events) and `static rehydrate(...): T` (for persistence mappers without emitting events)?
- [ ] **Encapsulated State Transitions (`B`/`M`)**: Are state mutations performed exclusively through intention-revealing domain methods that enforce invariants and record `DomainEvent`s?
- [ ] **Value Object Immutability (`M`)**: Are primitives (`string`, `number`) wrapped in self-validating Value Objects where domain rules exist?

### B. Application Layer (`<moduleRoot>/application/`)

- [ ] **CQRS Separation (`M`)**: Do Commands strictly mutate state (returning minimal acknowledgments or IDs via `Result<T, DomainError>`) while Queries strictly read projections without side effects?
- [ ] **Error modeling (`B`/`M`)**: Does new code return explicit `Result<Output, DomainError>` for expected business failures? In slices not yet migrated, a typed domain exception (`<Module>Error` with `failure.code`) mapped by an error filter is acceptable; introducing a generic `throw` or a bare string is `B`.
- [ ] **Atomicity (`B`)**: Are Aggregate persistence and Domain Event publication inside the same unit of work/transaction, or is the event published before the commit?

### C. Cross-Module Boundaries (`public-api.ts` & the module registration file)

- [ ] **Public API Encapsulation (`B`)**: Do imports from other modules target **exclusively** `<other>/public-api.ts` (never `<other>/domain/*`, `<other>/application/*`, `<other>/infrastructure/*`)? If the module does not expose `public-api.ts` and an internal is imported, it is `B`.
- [ ] **No Internal Leaks in `public-api.ts` (`B`)**: Does `public-api.ts` export only safe DTOs, Query/Command contracts, Value Object constants, and Domain Event payloads (never Aggregate Roots or concrete Repositories)?
- [ ] **Composition Root Registration (`B`)**: Is the module registered in the app's composition root and are its ports wired in its module file (module-registration guard green)?

### D. Infrastructure & Presentation (`infrastructure/` & `presentation/`)

- [ ] **Persistence Mapper Round-Trip (`B`)**: Does the Mapper accurately translate between Domain Aggregates (`rehydrate`) and ORM table rows without leaking ORM models into `application/` or `domain/`?
- [ ] **Authorization & data isolation (`B`)**: Does every query and mutation apply the role/permission scoping of the auth provider and avoid exposing other tenants' data?
- [ ] **Thin Presentation Controllers (`M`)**: Do controllers only validate transport, dispatch use cases and delegate error mapping to a deterministic filter?

### E. Specifications, Contracts & Tests (`SPEC.md`, contracts, `*.test.ts`)

- [ ] **Living Spec & Contract Sync (`B`)**: Are new Commands, Queries, Enums, and Invariants reflected in `<specs>` and `<contracts>/<module>.contract.md`?
- [ ] **Auditable TDD (`Red -> Green`) (`B`)**: Do tests genuinely assert the business invariant (would fail if the production fix were reverted via `git stash`) rather than testing mock wiring?
- [ ] **Intent preserved (`B`)**: Does the diff solve the fragment's `## 0. Intent` (who/why + Given/When/Then) rather than a different, larger problem?

### F. Necessity & Complexity (`M`)

- [ ] **Reuse before invention**: Is there an existing helper, component, pattern or installed dependency that already does this? A parallel implementation of something the repo already has is `M`.
- [ ] **No speculative generality**: any new abstraction, option, config, dependency or "for later" branch has a second consumer named in the fragment, or it is `M`.
- [ ] **Shortcuts are ledgered**: every deliberate limit carries `shortcut: <the limit>; upgrade when <condition>` next to the code and is counted in the fragment `## 3`. An unmarked shortcut is `M`.

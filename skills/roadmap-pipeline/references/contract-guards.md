# Living Specs (`SPEC.md`) & Automated Contract Drift-Guards

So that the **DDD + SDD + BDD** triad does not drift, each module protects its rules with a living
specification (`SPEC.md`) and automated contract-coverage tests. Paths below are the profile's defaults;
resolve them from `docs/pipeline/profile.md`.

---

## 0. Bounded Context Contract Template (`<contracts>/<module>.contract.md`)

The _Published Language_ between backend and frontend/admin (protocol §1, SDD + DDD). This is the template the
planner uses when opening a new contract:

```markdown
# [Bounded Context] Contract: [Module Name]

## 1. Ubiquitous Language & Core Entities

- **[Entity/Aggregate]**: Exact business definition (free of SQL/HTTP transport jargon).

## 2. Domain Invariants & Business Rules (BDD Reference)

- **INV-01**: [Non-negotiable invariant enforced by the Aggregate — ref. Given/When/Then scenario in SPEC.md].
- **INV-02**: [Security, authorization, or domain policy rule].

## 3. Commands — Write Model (CQRS + ROP)

### `ExecuteActionCommand`

- **Input / Payload**: Strict schema (Zod / TypeScript).
- **Preconditions**: Invariants validated before state mutation.
- **Result (`Result<Output, DomainError>`)**:
  - **Ok**: Resulting state + emitted Domain Events (`ActionExecutedEvent`).
  - **Err (Typed Domain Errors)**: Explicit error codes and exact failure conditions.

## 4. Queries & Projections — Read Model

- Read-optimized DTOs for UI/consumers and consistency guarantees (e.g., on-read computed status).

## 5. State Machine & Drift-Guards

- Legal transitions: `[Draft] -> [UnderReview] -> [Approved] | [Rejected]`
- Associated guard tests: `ApiContractCoverageGuard.test.ts` / enum drift-guards.
```

---

## 1. `SPEC.md` Template (Living Specs / BDD per module)

Location: `<moduleRoot>/SPEC.md`

```markdown
# Living Spec: [Module Name]

## Ubiquitous Language

- **[Concept A]**: exact business definition.
- **[Concept B]**: exact business definition.

## Business Scenarios (Given / When / Then)

### SCEN-01: [Name, e.g. checkout with insufficient stock]

- **Associated Invariant:** `INV-ORD-03`
- **Given** a cart with a product whose `stock` is 0
- **When** the customer runs `CreateOrderCommand`
- **Then** the order is not created, the use case returns the typed error
  `PRODUCT_INSUFFICIENT_STOCK` and the error filter responds `409` without persisting rows.

### SCEN-02: [Name, e.g. invalid state transition]

- **Associated Invariant:** `INV-ORD-05`
- **Given** an order in `DELIVERED`
- **When** an admin sends `PATCH /orders/:id/status` to `PENDING`
- **Then** the domain policy rejects the transition with `ORDER_INVALID_TRANSITION` and the order
  stays immutable.
```

Rules:

- Every scenario references one concrete invariant (`INV-<MODULE>-NN`).
- States and error codes cited must exist in the shared types package and in the slice's code.
- `SPEC.md` is updated in the same functional commit as the behaviour change.

---

## 2. Enum & Write/Read Model Drift-Guard (`<testDir>/<module>/*.drift-guard.test.ts`)

Prevents the Write Model (`domain/`), the Read Model (`application/`) and the published contract
(`<contracts>/<module>.contract.md`) from separating when someone adds or renames a state or an error code.

```typescript
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { orderStatuses } from "<types-package>";

// Adjust to the profile's contracts path.
const CONTRACTS_DIR = join(import.meta.dir, "../../../docs/contracts");

describe("Orders Contract & Enum Drift-Guard", () => {
  const contract = readFileSync(join(CONTRACTS_DIR, "orders.contract.md"), "utf-8");

  it("documents every OrderStatus value in the contract", () => {
    for (const status of orderStatuses) {
      expect(contract).toContain(`\`${status}\``);
    }
  });
});
```

---

## 3. Contract Coverage Guard (`<testDir>/contracts/*.contract-coverage.test.ts`)

Verifies that every capability exposed by a module is declared in its contract, so an agent cannot change the
backend without updating the contract that web and admin consume.

```typescript
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Adjust both roots from the profile.
const MODULES_DIR = join(import.meta.dir, "../../src");
const CONTRACTS_DIR = join(import.meta.dir, "../../../../docs/contracts");

describe("ApiContractCoverageGuard", () => {
  it("documents every use case of every module with a contract", () => {
    const modules = readdirSync(MODULES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    const violations: string[] = [];

    for (const moduleName of modules) {
      const contractPath = join(CONTRACTS_DIR, `${moduleName}.contract.md`);
      const useCasesDir = join(MODULES_DIR, moduleName, "application");
      const hasUseCases = readdirSync(useCasesDir, { withFileTypes: true }).some((entry) =>
        entry.isFile(),
      );
      if (!hasUseCases) continue;

      const contract = readFileSync(contractPath, "utf-8");
      for (const entry of readdirSync(useCasesDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
        const name = entry.name.replace(/\.ts$/, "");
        if (!contract.includes(name)) {
          violations.push(`${moduleName}: '${name}' missing from ${moduleName}.contract.md`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
```

Adoption notes (ratchet):

- The guard only requires a contract for modules that already have `application/` with use cases and a
  `<contracts>/<module>.contract.md`; the rest join as they migrate.
- When a module has no contract yet, the guard lists it as debt on the board instead of breaking the build.

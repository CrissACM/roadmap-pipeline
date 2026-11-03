# Pipeline Profile: bun-nestjs-ddd

A worked example for a Bun monorepo with a NestJS API, DDD layers, published contracts and drift guards.
Adjust the paths and commands to match your repository.

```json pipeline-profile
{
  "name": "bun-nestjs-ddd",
  "version": "0.1.0",
  "moduleRoot": "apps/api/src/<module>",
  "layers": ["domain", "application", "infrastructure", "presentation"],
  "sourceRoots": ["apps", "packages"],
  "contracts": "docs/contracts/<module>.contract.md",
  "specs": "apps/api/src/<module>/SPEC.md",
  "gates": [
    "bun run lint",
    "bun run format:check",
    "bun run typecheck",
    "bun run --cwd apps/api test",
    "bun run test:integration",
    "bun run test:e2e"
  ],
  "graph": ["codebase-memory-mcp", "codegraph"],
  "tiers": { "deep": "", "fast": "" }
}
```

## Stack conventions the roles must respect

- **Layers**: `domain/` has zero framework or I/O imports; `application/` holds Commands, Queries and ports;
  `infrastructure/` holds adapters, repositories and migrations; `presentation/` holds thin controllers.
- **Cross-module imports** go through `<module>/public-api.ts`. Importing another module's `domain/`,
  `application/` or `infrastructure/` is a Blocker.
- **Error model**: `Result<T, E>` with typed domain errors for new code. Slices not yet migrated may throw a
  typed `<Module>Error` and let the error filter map it; a generic `throw` or a bare string is a Blocker.
- **Persistence**: mappers expose `static rehydrate(...)`; Aggregate persistence and Domain Event publication
  happen inside the same unit of work.
- **Contracts**: `docs/contracts/<module>.contract.md` is the published language consumed by web/admin, and
  `apps/api/src/<module>/SPEC.md` is the living BDD spec. Both change in the same functional commit as the code.
- **Drift guards**: the API test suite includes `test:architecture` plus enum and contract-coverage guards; a
  green unit run that skips them is not a green gate.
- **Auth**: authorization is enforced by the auth provider's guards; every query and mutation applies the
  role/tenant scoping. Missing scoping is a Blocker.
- **Lint**: `oxlint`, no `any`, no new violations in the diff.

## Conditional gates

`test:integration` and `test:e2e` are listed because they always exist in this repo. The implementer runs the
whole list; if a suite is irrelevant to the slice it still runs, and a failure is reported — never skipped
silently. If your repo cannot afford that, remove the command from `gates` and document the decision in the
fragment.

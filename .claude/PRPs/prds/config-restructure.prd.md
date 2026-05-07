# Config System Restructure

## Problem Statement

The `jahia-cli` configuration file (`jahia-cli.config.yml`) puts all properties at the root level — `name`, `provider`, `components`, and `tests` are siblings — making the format ambiguous and unextensible. As the CLI grows to manage both environment provisioning and test scaffolding, a flat structure conflates two distinct concerns and makes it unclear what each section controls. This blocks future expansion of the `tests` configuration with additional properties.

## Evidence

- Current `EnvironmentConfig` type holds both environment fields **and** `tests` — a naming/responsibility mismatch.
- `config init` generates the same flat structure whether the user wants environment config, test config, or both.
- `tests init` writes a separate `tests/config.yml` instead of the main config — fragmenting configuration.
- The `buildConfigFromState` mode generates config from runtime state, but config should be user-authored (source of truth, not derived artifact).

## Proposed Solution

Restructure `jahia-cli.config.yml` into two explicit top-level sections:

```yaml
environment:
  name: my-env
  provider: docker
  components:
    - jahia
    - pgsql

tests:
  jahia-cypress: v1.2.3
```

Remove the `--state` / derive-from-state mode. Make `config init` always generate a blank scaffold. Update `tests init` to write into the unified config file's `tests:` section.

## Key Hypothesis

We believe a structured, user-authored config with explicit `environment` and `tests` sections will make the CLI's configuration intuitive and extensible for developers.
We'll know we're right when new properties can be added to either section without type-system gymnastics or structural ambiguity.

## What We're NOT Building

- Config file auto-migration from old format — it's v0.1, just break it
- Config validation UI or interactive config editing
- Config schema publishing (JSON Schema, etc.) — can come later
- Multiple environment support in one config file — one environment per file for now

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| All existing tests pass after restructure | 100% pass | `npm test` |
| Single config file used by all commands | 1 file (`jahia-cli.config.yml`) | Manual verification |
| No `buildConfigFromState` references remain | 0 references | grep |

## Open Questions

- [ ] Should the config file support a `version` field for future schema versioning?
- [ ] Should `environment create` without `--config` auto-detect `jahia-cli.config.yml` in cwd?

---

## Users & Context

**Primary User**
- **Who**: Developer using `jahia-cli` to spin up local Jahia environments and run tests
- **Current behavior**: Creates config manually or via `config init`, uses `environment create --config`
- **Trigger**: Setting up a new project or CI pipeline that needs both environment + test config
- **Success state**: One YAML file clearly defines both the environment and test setup

**Job to Be Done**
When setting up a Jahia development environment, I want to define environment and test configuration in one clear file, so I can version-control my full local setup without ambiguity.

**Non-Users**
This is not for end-users of Jahia — it's for developers and CI systems that operate `jahia-cli`.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | New `JahiaCliConfig` top-level type with `environment` + `tests` sections | Core structural fix |
| Must | Update `config init` to generate blank scaffold in new format | Entry point for users |
| Must | Update `loadConfigFile` / `validateConfig` to parse new format | All consumers must understand it |
| Must | Update `environment create --config` to read from `environment:` section | Primary consumer |
| Must | Update `tests init` to read/write `tests:` in unified config | Eliminates separate file |
| Must | Update `configToYaml` to serialize new structure | Output must match new format |
| Must | Remove `buildConfigFromState` and `--state` flag from `config init` | Dead mode |
| Must | Update all tests to reflect new structure | CI must pass |
| Should | Remove stale `--blank` flag from `config init` (it's now the only mode) | Simplification |
| Could | Add a config `version` field for future schema evolution | Forward-thinking |
| Won't | Backward-compatible parsing of old flat format | v0.1, clean break |

### MVP Scope

1. New types: `JahiaCliConfig` (top-level), `EnvironmentConfig` (environment section only), `TestsConfig` (tests section)
2. Updated parser to handle nested YAML structure
3. Updated serializer (`configToYaml`) for new structure
4. `config init` produces blank scaffold — no `--blank` / `--state` flags
5. `environment create --config` reads from `config.environment`
6. `tests init` reads/writes `config.tests` in `jahia-cli.config.yml`
7. All tests updated

### User Flow

```
1. User runs: jahia-cli config init
   → Creates jahia-cli.config.yml with blank scaffold

2. User edits config:
   environment:
     name: my-env
     provider: docker
     components: [jahia, pgsql]

3. User runs: jahia-cli environment create --config ./jahia-cli.config.yml
   → Reads environment: section, creates containers

4. User runs: jahia-cli tests init v1.2.3
   → Writes tests.jahia-cypress into jahia-cli.config.yml
```

---

## Technical Approach

**Feasibility**: HIGH

The change is a refactor of existing working code — no new external dependencies, no new architecture patterns. All affected files are in `src/lib/config/` and a handful of command files.

**Architecture Notes**
- Rename current `EnvironmentConfig` to avoid confusion — it becomes the `environment:` subsection type
- New top-level `JahiaCliConfig` interface wraps both sections
- Parser gains a top-level validation step before delegating to section parsers
- `configToYaml` wraps output in the nested structure

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| State file still references old `EnvironmentConfig` shape | Medium | State type is separate from config type — decouple cleanly |
| Test coverage drops during refactor | Low | Update tests in same PR |
| `tests init` config write creates race with manual edits | Low | Read-modify-write pattern with explicit overwrite |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Type definitions | New `JahiaCliConfig`, revised `EnvironmentConfig`, `TestsConfig` types | pending | - | - | - |
| 2 | Parser & serializer | Update `validateConfig`, `loadConfigFile`, `configToYaml` for nested format | pending | - | 1 | - |
| 3 | Config init command | Simplify to blank-only scaffold, remove state derivation | pending | with 4 | 2 | - |
| 4 | Environment create | Read from `config.environment` section | pending | with 3 | 2 | - |
| 5 | Tests init integration | Read/write `tests:` section in unified config | pending | - | 2 | - |
| 6 | Cleanup & tests | Remove dead code, update all tests, verify CI | pending | - | 3, 4, 5 | - |

### Phase Details

**Phase 1: Type definitions**
- **Goal**: Establish the new type hierarchy
- **Scope**: `src/lib/config/types.ts` — new `JahiaCliConfig` interface, adjust `EnvironmentConfig` to only hold environment fields, keep `TestsConfig` as-is
- **Success signal**: Types compile cleanly

**Phase 2: Parser & serializer**
- **Goal**: Config reading/writing works with new nested format
- **Scope**: `parser.ts`, `config-to-yaml.ts`, `build-blank-config.ts`
- **Success signal**: Can round-trip a nested YAML through parse → serialize

**Phase 3: Config init command**
- **Goal**: `config init` generates a clean blank scaffold in new format
- **Scope**: `src/commands/config/init.ts`, remove `buildConfigFromState`, remove `--state`/`--blank` flags
- **Success signal**: `jahia-cli config init` produces correct nested YAML

**Phase 4: Environment create**
- **Goal**: `--config` flag reads `environment:` section from new format
- **Scope**: `src/commands/environment/create.ts` — adjust `loadConfigFile` call site
- **Success signal**: `environment create --config` works with new format

**Phase 5: Tests init integration**
- **Goal**: `tests init` writes `jahia-cypress` version into unified config's `tests:` section
- **Scope**: `src/commands/tests/init.ts`, potentially new `update-config-tests.ts` helper
- **Success signal**: After `tests init v1.2.3`, the `jahia-cli.config.yml` has `tests.jahia-cypress: v1.2.3`

**Phase 6: Cleanup & tests**
- **Goal**: Remove dead code, update all tests, ensure CI passes
- **Scope**: Delete `build-config-from-state.ts`, update all test files, run full suite
- **Success signal**: `npm run lint && npm test` passes, no dead code references

### Parallelism Notes

Phases 3 and 4 can run in parallel once phase 2 is complete — they both consume the new parser but don't interact with each other.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Config structure | Nested `environment:` + `tests:` siblings | Flat root (current), separate files | Extensible, clear ownership |
| Backward compat | None — clean break | Deprecation period, format detection | v0.1, no users depending on old format |
| State derivation | Remove entirely | Keep as secondary mode | Config is user-authored source of truth |
| Tests config location | Unified `jahia-cli.config.yml` | Separate `tests/config.yml` | Single source of truth, simpler mental model |

---

## Research Summary

**Market Context**
Standard CLI tools (docker-compose, terraform, k8s) all use structured YAML with clear top-level sections. Flat configs that mix concerns become unmaintainable.

**Technical Context**
- All config logic is isolated in `src/lib/config/` (6 files)
- 3 commands consume config: `config init`, `environment create`, `tests init`
- State system (`src/lib/state/`) is separate — stores runtime data, not config
- 29 test files exist; ~8 directly test config functions
- Feasibility is HIGH — surgical refactor of well-isolated modules

---

*Generated: 2026-05-06T21:45:00+02:00*
*Status: DRAFT — ready for implementation*

# Named Workflows (workflow → workflows)

## Problem Statement

The jahia-cli workflow model only supports a single workflow per configuration file. Teams building CI/CD pipelines and developers iterating locally need to decompose execution into smaller, reusable steps — running just the "setup" portion during development, or the full end-to-end pipeline in CI. Today the only workaround is maintaining separate config files, which creates drift and duplication.

## Evidence

- Current `JahiaCliConfig.workflow` is a single `WorkflowConfig` with one `steps[]` array
- CI pipelines typically need setup → test → teardown as independently runnable stages
- Developers iterate faster when they can run just the environment setup without the full pipeline
- Assumption — needs validation through early adopter feedback

## Proposed Solution

Replace the singular `workflow:` YAML key with a `workflows:` map of named workflows. Each workflow has a `name` (the map key), an optional `default: true` flag, and a `steps[]` array. The CLI selects which workflow to run via `--name` flag, falling back to the default. Workflows can call other workflows using the existing `uses: workflow:run` mechanism with `with: { name: <target> }`. Circular call chains are detected and rejected.

## Key Hypothesis

We believe named, composable workflows will allow CI/CD pipelines to define a single config file that covers both full pipeline execution and local developer iteration workflows.
We'll know we're right when teams can run partial workflows (setup-only, test-only) from the same config file without maintaining duplicates.

## What We're NOT Building

- Parallel workflow execution — workflows remain sequential
- Workflow parameters/inputs — workflows share state via env vars and state file
- Conditional steps (if/unless) — deferred to future iteration
- Backward compatibility with old `workflow:` key — clean break

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| All existing tests updated and passing | 356+ tests green | `npm test` |
| Lint and build clean | 0 errors, 0 warnings | `npm run lint && npm run build` |
| Circular workflow detection | Tested with unit tests | Specific test cases |
| Config generators updated | All scaffolding uses `workflows:` | Manual verification |

## Open Questions

- [ ] Should `workflow:run --name X` show which sub-workflows are being called in the output?
- [ ] Should there be a `workflow:list` command to show available workflows in a config?

---

## Users & Context

**Primary User**
- **Who**: Developers and CI/CD pipelines using jahia-cli to manage Jahia test environments
- **Current behavior**: One workflow per config file; separate files for different execution scenarios
- **Trigger**: Need to run a subset of the pipeline (e.g., just environment setup) during local development
- **Success state**: Single config file with named workflows covering setup, test, full pipeline

**Job to Be Done**
When developing locally, I want to run just the environment setup workflow, so I can iterate on my code without waiting for the full CI pipeline.

**Non-Users**
Users who only ever run one workflow — they just mark it `default: true` and their experience is unchanged (minus the YAML key rename).

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | `workflows:` map with named entries | Core feature — decompose into named parts |
| Must | `default: true` flag on one workflow | CLI fallback when `--name` not specified |
| Must | `--name` flag on `workflow:run` | Select which workflow to execute |
| Must | Workflow-calls-workflow via `uses: workflow:run` | Composition — build full pipeline from parts |
| Must | Circular call detection | Prevent infinite loops |
| Must | Exactly one default required (error otherwise) | Clear, unambiguous behavior |
| Should | Update `workflow:init` scaffolding | Show named workflow pattern |
| Should | Update `init` command config assembly | Generate `workflows:` not `workflow:` |
| Could | `workflow:list` command | Show available workflows in a config |
| Won't | Parallel execution — deferred | |
| Won't | Workflow parameters — deferred | |
| Won't | Backward compat with `workflow:` — clean break | |

### MVP Scope

1. Type system: `WorkflowConfig` gains `name` + `default` fields; `JahiaCliConfig.workflows` replaces `.workflow`
2. Parser: validates `workflows:` map, enforces exactly-one-default rule
3. Executor: `--name` flag selects workflow; circular chain detection
4. Commands: `workflow:run` and `workflow:init` updated
5. Config generators: `buildSampleWorkflow`, `assembleConfig`, `configToYaml`, comments all updated
6. Tests: all existing tests migrated + new tests for naming, defaults, composition, circular detection

### YAML Structure

```yaml
workflows:
  setup:
    steps:
      - name: Create Jahia environment
        uses: environment:create
        with:
          force: 'true'
      - name: Wait for Jahia to be healthy
        uses: jahia:alive
        with:
          timeout: '300'

  test:
    steps:
      - name: Install test dependencies
        run: yarn
      - name: Run tests
        run: yarn run e2e:ci

  full:
    default: true
    steps:
      - name: Setup environment
        uses: workflow:run
        with:
          name: setup
      - name: Run tests
        uses: workflow:run
        with:
          name: test
      - name: Cleanup
        uses: environment:delete
```

### CLI Usage

```bash
# Run default workflow
jahia-cli workflow run --config jahia-cli.config.yml

# Run named workflow
jahia-cli workflow run --config jahia-cli.config.yml --name setup

# Scaffold sample workflows
jahia-cli workflow init --config jahia-cli.config.yml
```

---

## Technical Approach

**Feasibility**: HIGH — the existing architecture cleanly separates types, parsing, execution, and commands. The change is primarily a structural rename + map iteration.

**Architecture Notes**
- `JahiaCliConfig.workflow` → `JahiaCliConfig.workflows` (map of `WorkflowConfig` entries)
- `WorkflowConfig` gains `readonly default?: boolean | undefined`
- Parser validates map structure, enforces exactly-one-default
- Executor receives resolved `WorkflowConfig` (already selected by name)
- Circular detection: pass a `callStack: readonly string[]` through workflow execution; error if name already present
- `workflow:run` command gains `--name` flag; resolves default if not provided

**Key Files to Change**

| File | Change |
|------|--------|
| `src/lib/config/types.ts` | `WorkflowConfig` + `JahiaCliConfig.workflows` |
| `src/lib/config/parser.ts` | New `parseWorkflowsConfig()` replacing `parseWorkflowConfig()` |
| `src/lib/workflow/executor.ts` | Add `callStack` param for circular detection |
| `src/lib/workflow/types.ts` | Update result types if needed |
| `src/lib/workflow/build-sample-workflow.ts` | Return map of named workflows |
| `src/lib/workflow/merge-workflow-into-config.ts` | Merge `workflows` map |
| `src/commands/workflow/run.ts` | Add `--name` flag, resolve default, pass callStack |
| `src/commands/workflow/init.ts` | Generate named workflow scaffold |
| `src/commands/init.ts` | `assembleConfig()` uses `workflows:` |
| `src/lib/config/config-to-yaml.ts` | Serialize `workflows:` key |
| `src/lib/config/config-to-yaml-with-comments.ts` | Update comment for `workflows:` |
| All test files referencing `workflow` | Migrate to `workflows:` |

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Missing a reference to old `workflow:` key | Medium | Comprehensive grep + test suite catches regressions |
| Circular detection false positives | Low | Simple callStack check; tested explicitly |
| Breaking `uses: workflow:run` subprocess invocation | Medium | Integration test with actual subprocess |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Type system & parser | Update types, parser validation, and config serialization | pending | - | - | - |
| 2 | Executor & circular detection | Update executor with name resolution and call stack | pending | - | 1 | - |
| 3 | Commands & config generators | Update workflow:run, workflow:init, init, sample workflow | pending | - | 2 | - |
| 4 | Tests & documentation | Migrate all tests, add new test cases, update docs | pending | - | 3 | - |

### Phase Details

**Phase 1: Type System & Parser**
- **Goal**: New type definitions and YAML validation for `workflows:` map
- **Scope**: `types.ts` (add `default` field, change `JahiaCliConfig`), `parser.ts` (new map parser with default validation), `config-to-yaml.ts` and `config-to-yaml-with-comments.ts` (serialize map)
- **Success signal**: `npm run build` passes with new types

**Phase 2: Executor & Circular Detection**
- **Goal**: Executor supports name-based workflow selection and prevents circular calls
- **Scope**: `executor.ts` (add `callStack` parameter), new `resolve-workflow.ts` (find workflow by name or default)
- **Success signal**: Unit tests for resolution and circular detection pass

**Phase 3: Commands & Config Generators**
- **Goal**: CLI commands work with named workflows
- **Scope**: `workflow/run.ts` (add `--name` flag), `workflow/init.ts` (scaffold named workflow), `init.ts` (assembleConfig), `build-sample-workflow.ts` (return named map), `merge-workflow-into-config.ts` (merge map)
- **Success signal**: `bin/dev.js workflow run --name X` works end-to-end

**Phase 4: Tests & Documentation**
- **Goal**: Full test coverage and documentation for new model
- **Scope**: Migrate all ~30 existing workflow tests, add tests for: naming, default resolution, circular detection, map parsing, config generation. Update README, CLAUDE.md, Agents.md.
- **Success signal**: `npm test` all green, `npm run test:coverage` meets threshold

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| YAML structure | Map keyed by name | Array with name field | Maps are more natural in YAML, enforce unique names |
| Workflow calling | Reuse `uses: workflow:run` | New `workflow:` keyword | Consistent with existing step model, no parser changes |
| No default behavior | Error | Pick first workflow | Explicit is better than implicit; prevents surprises |
| Backward compatibility | Clean break | Support both keys | Simpler implementation; early stage project, few users |
| Circular protection | Detect via callStack | No protection | Prevents subtle infinite loops in CI |
| Init scaffolding | Single named workflow | Multiple sample workflows | Keep simple, avoid overwhelming new users |

---

## Research Summary

**Technical Context**
- 30+ files reference `workflow` key — comprehensive migration required
- Executor already supports subprocess spawning via `uses:` — natural extension point for workflow composition
- Parser has clean validation pipeline (`validateWorkflowStep` → `parseWorkflowConfig` → `validateConfig`)
- Config serialization (`config-to-yaml.ts`) conditionally includes sections — straightforward to update
- Test suite is comprehensive (342+ tests) — provides safety net for migration

---

*Generated: 2026-05-14*
*Status: DRAFT — ready for implementation*

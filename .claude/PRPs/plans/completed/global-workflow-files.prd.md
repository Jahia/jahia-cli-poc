# Global Workflow Files

## Problem Statement

Teams using jahia-cli across multiple test codebases must copy-paste the same workflow definitions into every `jahia-cli.config.yml` file. When a workflow changes (e.g., adding a step, fixing an order), the change must be propagated manually to every codebase. This creates drift, maintenance overhead, and inconsistencies in CI/CD pipelines.

## Evidence

- The scaffolding mechanism (`tests:init`) already syncs shared assets from jahia-cypress, proving that shared configuration distribution is an established pattern.
- Workflow definitions are currently inlined in each project's config, leading to duplication across repositories.
- CI/CD pipelines for different modules run identical provisioning/testing workflows with only environment variables differing.

## Proposed Solution

Introduce a **global workflow file** (`jahia-cli.workflows.global.yml` by default) that contains shared workflow definitions in the same `workflows:` format as the config file. The `workflow:run` command merges workflows from both sources, with **local config overriding global** on name collisions. The command becomes significantly more verbose — logging where workflows come from, what's available, and which one was selected.

## Key Hypothesis

We believe shared workflow files will eliminate workflow duplication for teams managing multiple Jahia test codebases.
We'll know we're right when workflow definitions only need to be updated in one place (the global file) and all consuming projects pick up the changes.

## What We're NOT Building

- **Scaffolding sync for the global file** — the existing `tests:init` mechanism handles file distribution; this PRD only adds the loading/merge logic
- **Remote workflow fetching** — no HTTP/Git fetch of workflow files; they must be local
- **Workflow inheritance or composition** — a global workflow is either used as-is or entirely overridden by a local one (no partial merge of steps)

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Workflow duplication | 0 duplicate definitions across codebases using scaffolding | Config file audit |
| Transparency | Every `workflow:run` invocation logs sources, available workflows, and selection | Manual verification |
| Graceful degradation | Missing global file produces a warning, not a failure | Integration test |

## Open Questions

- [ ] Should `workflow init` also generate a sample global file, or only the local config?

---

## Users & Context

**Primary User**
- **Who**: Developer or CI/CD engineer maintaining Jahia end-to-end test suites across multiple modules
- **Current behavior**: Copies workflow YAML blocks between config files; manually propagates changes
- **Trigger**: Updating a shared workflow (e.g., adding a provisioning step) and needing it everywhere
- **Success state**: Edit the global file once, all projects pick it up on next CI run

**Job to Be Done**
When I update a shared testing workflow, I want to define it in one place, so I can avoid manual propagation and drift across repositories.

**Non-Users**
- Users with a single codebase and unique workflows — they continue using inline config workflows only.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Load workflows from a separate global YAML file | Core feature — enables shared workflows |
| Must | Merge global + local workflows with local-wins precedence | Allows per-project overrides |
| Must | Verbose logging in `workflow:run` showing sources, available workflows, and selection | User explicitly requested transparency |
| Must | Graceful handling of missing global file (warn, don't fail) | CI/CD resilience — file may not exist yet |
| Must | Support `${VAR:-default}` env var resolution in global file | Consistent with existing config resolution |
| Must | `--workflows-file` CLI flag on `workflow:run` | Direct specification of global file path |
| Must | `workflowsFile` config key in YAML config | Avoids repeating the flag every invocation |
| Should | `default: true` conflict resolution (local always wins) | Predictable behavior |
| Won't | Scaffolding sync for the global file | Already handled by `tests:init` |
| Won't | Partial merge of workflow steps | Too complex, unclear semantics |

### MVP Scope

1. New config key `workflowsFile` and `--workflows-file` CLI flag (flag overrides config key)
2. Loader for the global workflows file (YAML with `workflows:` section only)
3. Merge function: global workflows ← local workflows (local wins on name collision)
4. Enhanced `workflow:run` logging: sources loaded → all available workflows → selected workflow
5. Warn-and-continue when global file doesn't exist
6. Env var resolution applied to global file content

### User Flow

**Typical CI/CD flow:**
```
# Global file (from scaffolding) at: jahia-cli.workflows.global.yml
# Local config at: jahia-cli.config.yml with workflowsFile: jahia-cli.workflows.global.yml

$ jahia-cli workflow run -c jahia-cli.config.yml

▶ Workflow sources:
  ✓ Local config: jahia-cli.config.yml
  ✓ Global file:  jahia-cli.workflows.global.yml (3 workflows loaded)

▶ Available workflows:
    setup        (global)
    test         (global)
    cleanup      (global)
  → main         (local, default)        ← selected

▶ Running workflow "main" (5 steps)
  ...
```

**Missing global file:**
```
$ jahia-cli workflow run -c jahia-cli.config.yml --workflows-file missing.yml

▶ Workflow sources:
  ✓ Local config: jahia-cli.config.yml
  ⚠ Global file:  missing.yml (file not found, skipping)

▶ Available workflows:
  → main         (local, default)        ← selected

▶ Running workflow "main" (5 steps)
  ...
```

**Override selection:**
```
$ jahia-cli workflow run -c jahia-cli.config.yml --name cleanup

▶ Workflow sources:
  ✓ Local config: jahia-cli.config.yml
  ✓ Global file:  jahia-cli.workflows.global.yml (3 workflows loaded)

▶ Available workflows:
    setup        (global)
    test         (global)
  → cleanup      (local, overrides global)        ← selected
    main         (local, default)

▶ Running workflow "cleanup" (2 steps)
  ...
```

### Global Workflow File Format

The global file uses the same `workflows:` structure as the main config, but contains **only** the `workflows` section:

```yaml
# jahia-cli.workflows.global.yml
workflows:
  setup:
    steps:
      - name: Create environment
        uses: environment create
        with:
          config: ${JAHIA_CLI_CONFIG}
      - name: Wait for health
        uses: environment alive
        with:
          config: ${JAHIA_CLI_CONFIG}

  test:
    steps:
      - name: Build test image
        uses: tests build
        with:
          config: ${JAHIA_CLI_CONFIG}
      - name: Run tests
        uses: tests run
        with:
          config: ${JAHIA_CLI_CONFIG}

  cleanup:
    steps:
      - name: Collect artifacts
        uses: tests artifacts
        with:
          config: ${JAHIA_CLI_CONFIG}
      - name: Destroy environment
        uses: environment destroy
        with:
          config: ${JAHIA_CLI_CONFIG}
```

### Config Key

```yaml
# jahia-cli.config.yml
workflowsFile: jahia-cli.workflows.global.yml    # relative to config file location

environment:
  name: my-env
  components:
    - jahia
    - victorialogs

workflows:
  main:
    default: true
    steps:
      - uses: workflow:run
        with:
          name: setup
      - uses: workflow:run
        with:
          name: test
      - uses: workflow:run
        with:
          name: cleanup
```

---

## Technical Approach

**Feasibility**: HIGH

The existing codebase already has:
- YAML loading and parsing (`loadConfigFile`, `parseWorkflowsConfig`)
- Workflow resolution and merging (`resolve-workflow.ts`, `merge-workflow-into-config.ts`)
- Env var resolution (`resolveEnvVars`)
- Executor with nested workflow support (`executor.ts`)

This feature primarily adds a new file loading step and a merge layer before the existing resolve logic.

**Architecture Notes**
- New function `loadGlobalWorkflowsFile(filePath)` — loads YAML, validates `workflows:` section, returns `WorkflowsMap | undefined`
- New function `mergeWorkflowSources(global, local)` — spread-based merge, local wins
- New function `resolveWorkflowsFilePath(configPath, configKey, flagValue)` — resolves the path with flag > config key > default precedence
- New function `formatWorkflowSources(...)` — builds the verbose logging output
- Config type `JahiaCliConfig` gets optional `workflowsFile?: string | undefined`
- `RawConfig` gets optional `workflowsFile?: unknown`
- `workflow:run` command gets `--workflows-file` flag
- `workflow:run` run() method updated to: load global → merge → log sources → log available → resolve → execute

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Path resolution confusion (relative to CWD vs config file) | M | Resolve relative to config file directory, document clearly |
| `default: true` in both global and local | L | Local always wins; if both have different defaults, local's default is used |
| Nested `workflow:run` can't find global workflow | L | Pass merged workflows map to executor (already passed) |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Global file loading & merge | Add loader, merge function, config key, CLI flag, types | pending | - | - | - |
| 2 | Verbose workflow:run logging | Enhanced output showing sources, available workflows, selection | pending | - | 1 | - |
| 3 | Tests & documentation | Unit tests for all new functions, integration tests, update README | pending | - | 2 | - |

### Phase Details

**Phase 1: Global file loading & merge**
- **Goal**: Load a separate global workflows file and merge with local config
- **Scope**:
  - Add `workflowsFile` to `JahiaCliConfig` and `RawConfig` types
  - Parse `workflowsFile` in config parser (as a plain string, with env var resolution)
  - New `load-global-workflows.ts` — loads the file, validates structure, returns `WorkflowsMap | undefined`
  - New `merge-workflow-sources.ts` — merges global + local with local-wins precedence
  - Add `--workflows-file` flag to `workflow:run`
  - Resolve path: flag > config key > default filename (relative to config file directory)
  - Wire into `workflow:run` before workflow resolution
- **Success signal**: Global workflows available in the merged map; local overrides work; missing file warns

**Phase 2: Verbose workflow:run logging**
- **Goal**: Make `workflow:run` transparent about what's happening
- **Scope**:
  - Log "Workflow sources" section (which files loaded, how many workflows from each)
  - Log "Available workflows" section (name, source, default marker, override indicator)
  - Log selected workflow with arrow indicator
  - Respect `--json` flag (structured source/selection info in JSON output)
- **Success signal**: Running `workflow:run` without `--json` produces the verbose output shown in User Flow above

**Phase 3: Tests & documentation**
- **Goal**: Comprehensive test coverage and updated docs
- **Scope**:
  - Unit tests for `loadGlobalWorkflowsFile` (valid file, missing file, invalid YAML, no workflows key)
  - Unit tests for `mergeWorkflowSources` (no overlap, overlap with local winning, empty global, empty local)
  - Unit tests for path resolution logic
  - Unit tests for formatting functions
  - Integration tests via `bin/dev.js` (global + local combo, missing file warning)
  - Update config documentation comments
- **Success signal**: All tests pass, lint clean, build clean

### Parallelism Notes

Phases are sequential — Phase 2 depends on the merge logic from Phase 1, and Phase 3 validates both.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Merge strategy | Local always wins on name collision | Deep merge of steps, error on conflict | Simple, predictable, no surprise partial merges |
| `default: true` conflict | Local's default wins | Global default honored, error | Consistent with "local overrides global" |
| Global file format | `workflows:` section only | Full config format | Minimal scope, avoids conflicting env/tests sections |
| Path resolution | Relative to config file directory | Relative to CWD | Config files often live together; CWD varies |
| Missing file handling | Warn and continue | Fail, silent skip | User requested explicit logging; CI must not break |
| CLI flag + config key | Both supported, flag overrides config | Only flag, only config | Config avoids repetition; flag allows overrides |

---

## Research Summary

**Technical Context**
- Config parser (`src/lib/config/parser.ts`) already handles YAML loading, validation, and env var resolution — the global file loader follows the same pattern.
- `WorkflowsMap` type is a simple `Record<string, WorkflowConfig>` — merging is a straightforward spread operation.
- The executor already receives the full `WorkflowsMap` for nested workflow calls — passing the merged map means global workflows are automatically available for `uses: workflow:run`.
- `resolveEnvVars` is already used in config parsing and can be applied to global file content identically.

---

*Generated: 2026-05-14T17:55+02:00*
*Status: DRAFT - needs validation*

# Workflow Runner

## Problem Statement

Jahia CLI users currently have three separate config-driven capabilities (tests scaffolding via `tests:init`, environment creation via `environment:create`, and config management) but no way to orchestrate them into a single automated run. A developer wanting to run end-to-end tests must manually invoke multiple commands in sequence, which is error-prone, hard to reproduce, and hostile to CI/CD automation. There's no single-command path from "empty folder + config file" to "full test results."

## Evidence

- The existing `tests:init`, `environment:create`, `config:init` commands are already config-driven but require manual sequential invocation
- CI/CD pipelines (GitHub Actions, Jenkins) solve this with YAML step definitions — developers are familiar with this pattern
- The PRD for environment creation explicitly mentions "accelerating developing and testing Jahia in the Agentic era" — agentic workflows need single-command execution
- Assumption - needs validation: users currently write shell scripts to glue these commands together

## Proposed Solution

Add a `workflow` section to the `jahia-cli.config.yml` that defines an ordered list of steps. Each step is either a jahia-cli command (referenced by name + args) or a shell command. A new `workflow:run` command reads this section and executes steps sequentially, stopping on first failure.

**Implementation approach**: Use `execa` (the de-facto standard Node.js library for process execution, 9B+ npm downloads) for all command execution. The orchestration layer is intentionally minimal — just a sequential iterator with env accumulation and fail-fast semantics. No custom workflow DSL or engine is needed because:
- `execa` handles cross-platform shell execution, streaming output, error handling, and environment management
- `js-yaml` (already in the project) handles config parsing
- The orchestration logic is ~30 lines: iterate steps, accumulate env, stop on failure

**Environment variable propagation**: Following GitHub Actions' proven `$GITHUB_ENV` pattern — environment variables exported/sourced in one step automatically propagate to subsequent steps. This is achieved by accumulating the environment across steps (each step inherits the env of all previous steps).

The syntax follows GitHub Actions' `steps` pattern (`name`, `run`, `uses`) because it's the most widely known YAML workflow format among the target developer audience — stripped down to only sequential execution (no matrix, expressions, or conditionals).

## Key Hypothesis

We believe a declarative workflow section in the config file will enable single-command end-to-end test runs for Jahia developers and AI agents.
We'll know we're right when a user can run `jahia-cli workflow:run --config ./jahia-cli.config.yml` in an empty directory and get complete test results without any other manual intervention.

## What We're NOT Building

- **Parallel step execution** — sequential only; parallelism adds complexity with no clear need yet
- **Conditional logic / expressions** — no `if:` conditions; keep it linear
- **Matrix strategies** — no multi-dimensional runs; one workflow = one execution
- **Step outputs / variable passing** — no `${{ steps.x.outputs.y }}`; steps are independent
- **Retry logic** — fail fast on first error; user can re-run
- **Remote workflow imports** — workflows are local to the config file only
- **A DAG/dependency graph** — steps execute top-to-bottom, period
- **Per-step `--step` execution** — not needed for debugging
- **`workflow:validate` dry-run** — not needed
- **Environment variables in config** — no `env:` in YAML; env vars are set by sourcing in `run:` steps and propagated naturally

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Single-command e2e run | Works from empty folder + config | Manual test: `workflow:run` in empty dir |
| Step types supported | jahia-cli commands + shell commands | Feature completeness check |
| Failure handling | Clear error with failed step name and output | Manual test |
| Config readability | A new user understands a workflow config in < 30 seconds | User feedback |
| Env propagation | `export FOO=bar` in step 1 available in step 2 | Integration test |

## Open Questions

- [ ] Should `working_dir` be configurable per-step? (Leaning yes — test runners need to run from subdirectories)
- [ ] Should there be a cleanup/teardown mechanism that runs even on failure? (e.g., always delete the environment)

---

## Users & Context

**Primary User**
- **Who**: Jahia developer or QA engineer who needs to run integration/e2e tests against a Jahia environment
- **Current behavior**: Manually runs `tests:init`, then `environment:create`, then test runner commands in sequence — or maintains a shell script that does this
- **Trigger**: Needs to validate a Jahia module change against a real environment with tests
- **Success state**: Runs one command, gets pass/fail test results with logs accessible

**Secondary User**
- **Who**: AI agent (Claude Code, GitHub Copilot) automating Jahia testing workflows
- **Current behavior**: Must be instructed to run multiple commands in sequence
- **Trigger**: User requests "run the tests" or CI pipeline dispatches
- **Success state**: Single command with structured (JSON) output indicating pass/fail

**Job to Be Done**
When I have a config file describing my test environment, I want to run one command, so I can get complete test results without remembering or scripting the sequence of setup steps.

**Non-Users**
- Users who need complex conditional workflows (use GitHub Actions / Jenkins directly)
- Users who need parallel orchestration across multiple environments simultaneously

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Sequential step execution (`workflow:run`) | Core value proposition |
| Must | `run:` steps — arbitrary shell commands via `execa` | Flexibility for test runners, scripts |
| Must | `uses:` steps — invoke jahia-cli commands by name | First-class integration with existing commands |
| Must | Step naming (`name:`) for clear output | Debugging and readability |
| Must | Fail-fast on first error with clear reporting | Must know what broke |
| Must | `--config` flag to specify config file | Consistent with other commands |
| Must | Env var propagation between steps | `export FOO=bar` in step 1 usable in step 2 |
| Must | `workflow:init` — generate sample workflow section in config | Quick onboarding with ~5 example steps |
| Should | `--json` output for AI/CI consumption | Agentic use case |
| Should | Step-level `working_dir:` override | Tests may need to run from a subdirectory |
| Won't | Conditional execution (`if:`) | Keeps system simple and predictable |
| Won't | Parallel steps | Not needed for sequential test workflows |
| Won't | Step outputs / variable interpolation | Too complex for v1 |
| Won't | `env:` in config | Users source env vars in `run:` steps instead |
| Won't | `--step` / `workflow:validate` | Not needed |

### MVP Scope

The minimum to validate the hypothesis:

1. A `workflow` section in `jahia-cli.config.yml` with a `steps` array
2. Each step has `name` (optional), and either `run` (shell) or `uses` (jahia-cli command)
3. `workflow:run` command that executes steps sequentially
4. Stops on first failure, reports which step failed
5. Human-readable output showing step progress (✓/✗ with step names)
6. `workflow:init` command that merges a sample workflow (~5 steps) into an existing config file (preserving environment/tests sections)

### User Flow

**Getting started with workflow:init:**
```
1. User has an existing jahia-cli.config.yml (with environment + tests sections)
2. User runs: jahia-cli workflow init --config ./jahia-cli.config.yml
3. CLI reads the existing config, merges a sample workflow section, writes back
4. User edits the sample steps to match their actual needs
5. User runs: jahia-cli workflow run --config ./jahia-cli.config.yml
```

**Running a workflow:**
```
1. User has `jahia-cli.config.yml` with environment + tests + workflow sections
2. User runs: jahia-cli workflow run --config ./jahia-cli.config.yml
3. CLI reads workflow.steps[]
4. For each step:
   a. Print "▶ Step N: {name}"
   b. Execute (shell command or jahia-cli command)
   c. Print "✓ Step N: {name}" on success
   d. Print "✗ Step N: {name}" + error details on failure → STOP
5. Print summary: "Workflow complete: N/M steps passed"
```

### Example Config

```yaml
environment:
  provider: docker
  components:
    - name: jahia
      overrides:
        tag: 8.2.3.0

tests:
  jahia-cypress: "^4"
  scaffolding:
    repository: https://github.com/Jahia/jahia-cypress-tests
    path: tests
    version: main

workflow:
  steps:
    - name: Initialize test scaffolding
      uses: tests:init

    - name: Create Jahia environment
      uses: environment:create

    - name: Wait for Jahia to be healthy
      uses: environment:alive
      with:
        timeout: "300"

    - name: Run Cypress tests
      run: npx cypress run --config-file tests/cypress.config.ts
      working_dir: ./tests

    - name: Cleanup environment
      uses: environment:delete
```

**Environment variable propagation example:**

```yaml
workflow:
  steps:
    - name: Set up environment variables
      run: export JAHIA_URL=http://localhost:8080 && export TEST_USER=root

    - name: Run tests (has access to JAHIA_URL and TEST_USER)
      run: npx cypress run
      working_dir: ./tests
```

---

## Technical Approach

**Feasibility**: HIGH

The existing codebase already has:
- YAML config parsing with validation (`src/lib/config/parser.ts`)
- Config type system (`src/lib/config/types.ts`)
- Command structure that can be programmatically invoked
- Output formatting patterns (human + JSON)

**Key dependency**: `execa` (sindresorhus, 9B+ npm downloads, MIT) — the de-facto standard for process execution in Node.js. Provides:
- Cross-platform shell execution with proper argument escaping
- Promise-based API with automatic rejection on non-zero exit codes
- Streaming stdout/stderr (stdio inherit for real-time output)
- Environment variable passing and extension
- Proper error objects with exit codes, stderr, and command details

**Architecture Notes**
- New types: `WorkflowConfig`, `WorkflowStep` in `src/lib/config/types.ts`
- New parser section: `parseWorkflowConfig()` in `src/lib/config/parser.ts`
- New lib module: `src/lib/workflow/` with step executor
- New command: `src/commands/workflow/run.ts`
- `uses:` steps invoke OCLIF commands programmatically via `this.config.runCommand()`
- `run:` steps use `execa` with `{ shell: true, stdio: 'inherit', env: accumulatedEnv }`
- Env propagation: after each `run:` step, capture env changes by running `env` in the same shell and diffing against the pre-step environment
- Config serializer (`config-to-yaml.ts`) extended to handle `workflow` section

**Env var propagation strategy:**
For `run:` steps, execute the command wrapped to dump the environment afterward:
```
bash -c '<user_command> && env'
```
Parse the output to capture new/modified env vars. Pass them to subsequent steps via `execa`'s `env` option. This is the same pattern used by GitHub Actions runners.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Env capture via `bash -c 'cmd && env'` mixes stdout with env dump | Medium | Use a separator marker or write env to temp file instead |
| OCLIF `runCommand` may not cleanly propagate errors | Medium | Wrap in try/catch, check exit codes |
| Shell commands behave differently cross-platform | Medium | Use `execa` with `shell: true`; document platform notes |
| Long-running steps (e.g., Cypress) need streaming output | Low | Use `stdio: 'inherit'` for `run:` steps |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Types, parsing & execa setup | Add WorkflowConfig types, parser, install execa, YAML serialization | pending | - | - | - |
| 2 | `workflow:init` command | Generate sample workflow section merged into existing config | pending | - | 1 | - |
| 3 | Step executor with env propagation | Build sequential executor using execa, with env var accumulation between steps | pending | - | 1 | - |
| 4 | `workflow:run` command | Wire executor into OCLIF command with output formatting and config passthrough | pending | - | 3 | - |

### Phase Details

**Phase 1: Types, parsing & execa setup**
- **Goal**: Define the workflow schema, parse it from YAML, add `execa` dependency
- **Scope**: `WorkflowConfig` and `WorkflowStep` interfaces, `parseWorkflowConfig()` validator, extend `JahiaCliConfig` with optional `workflow` field, extend `configToYaml()`, extend `RawConfig`, `npm install execa`
- **Success signal**: `loadConfigFile()` correctly parses a config with a workflow section; unit tests pass

**Phase 2: `workflow:init` command**
- **Goal**: Let users quickly scaffold a sample workflow section
- **Scope**: `src/commands/workflow/init.ts` — reads existing config file (or creates one), builds a sample workflow with ~5 representative steps (tests:init, environment:create, environment:alive, a shell command example, environment:delete), merges only the workflow section (preserving environment/tests), writes back. Follows the same merge pattern as `environment:export` (load existing → spread → replace section → write).
- **Success signal**: Running `workflow init --config ./existing.yml` adds a workflow section without touching other sections; unit + integration tests pass

**Phase 3: Step executor with env propagation**
- **Goal**: Build the engine that runs steps sequentially with environment accumulation
- **Scope**: `src/lib/workflow/executor.ts` — takes steps array + OCLIF config, executes each via `execa` (for `run:`) or `config.runCommand()` (for `uses:`), accumulates env vars between steps, stops on first failure. Returns step results array.
- **Success signal**: Unit tests covering shell steps, CLI steps, env propagation, failure handling

**Phase 4: `workflow:run` command**
- **Goal**: Expose the executor as a CLI command with output formatting
- **Scope**: `src/commands/workflow/run.ts` with `--config`, `--json`, `--state` flags. Human-readable progress output (✓/✗ per step). JSON output with step results. Auto-passes `--config` and `--state` to `uses:` steps. Supports per-step `working_dir`.
- **Success signal**: Running `workflow:run --config ./test.yml` executes all steps, propagates env, reports results

### Parallelism Notes

Phases 2 and 3 can run in parallel — `workflow:init` (scaffolding) and the step executor (runtime) are independent. Both depend only on Phase 1 (types).

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Workflow syntax | GitHub Actions-inspired (`steps`, `run`, `uses`, `name`) | Taskfile (`cmds`), Makefile, custom | Most widely known by target audience; minimal learning curve |
| Execution library | `execa` (sindresorhus, 9B+ downloads) | `child_process` directly, `zx`, `shelljs` | De-facto standard; cross-platform; promise-based; proper error handling |
| Step execution | Sequential, fail-fast | Parallel, continue-on-error | Simplest mental model; matches the use case of setup → test → teardown |
| CLI step invocation | `uses: command:name` with `with:` for args | Inline `run: jahia-cli ...` | Allows config auto-passthrough; distinguishes CLI steps from shell steps |
| `with:` parameter format | Key-value map → converted to `--key value` flags | Positional args, JSON | Consistent with how OCLIF commands accept flags |
| Env propagation | Accumulate env between steps (GitHub Actions pattern) | Shared shell session, dotenv files | Proven pattern; works with `execa`'s env option |
| No env in config | Users `export` in `run:` steps | `env:` per-step in YAML | Simpler config; leverages natural shell behavior |

---

## Research Summary

**Market Context**
- **GitHub Actions**: The dominant YAML workflow format. Steps with `name`, `run`, `uses`, `with`, `env`, `working-directory`. Widely understood. Complex features (expressions, matrix, conditionals) add weight.
- **Taskfile (go-task)**: Simpler task runner. Tasks have `cmds` lists. Less known but popular in Go ecosystem. ~45k GitHub stars.
- **Wand**: Minimal YAML command runner. Very lightweight but lacks step sequencing semantics.
- **Makefile**: Universal but syntax is arcane and error-prone for YAML-native users.
- **`@generacy-ai/workflow-engine`**: Full YAML workflow engine for Node.js with shell actions, retry, interpolation. Promising but too niche/new for production dependency.
- **Pattern**: All successful tools use ordered lists of named commands with clear success/failure semantics.

**Technical Context**
- jahia-cli already uses `js-yaml` for parsing — adding a `workflow` section is trivial
- OCLIF's `this.config.runCommand()` allows programmatic command invocation
- `execa` is the most popular Node.js process execution library — handles all cross-platform concerns
- Existing pattern of `--config` and `--state` flags means workflow can pass these through automatically
- The `configToYaml()` function uses spread patterns — easily extended for new sections
- Env propagation: `execa` supports `env` option that extends `process.env` — perfect for accumulation pattern

**Why not a full workflow engine library?**
- `@generacy-ai/workflow-engine` is the closest match but is too new/niche for a production dependency
- `zx` (Google) is excellent but requires JS scripts, not YAML configuration
- The actual orchestration code needed is ~30 lines (iterate + try/catch + env accumulate)
- Using `execa` for execution means we get all the hard parts (cross-platform, streaming, errors) for free
- The "workflow engine" is intentionally trivial — that's a feature, not a limitation

---

*Generated: 2026-05-08T20:08:54+02:00*
*Updated: 2026-05-08T20:16:01+02:00*
*Status: DRAFT - ready for implementation*

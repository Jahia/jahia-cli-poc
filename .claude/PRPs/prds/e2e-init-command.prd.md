# E2E Testing Framework — Init Command

## Problem Statement

The jahia-cli has unit and integration tests (vitest) but no end-to-end tests that validate the full user journey: running `init`, creating a Jahia environment, and executing Cypress tests from scaffolding. Without e2e coverage, regressions in the interactive init flow, Docker orchestration, or scaffolding sync can ship undetected. The `init` command is the primary entry point for new users and the most critical path to validate.

## Evidence

- The CLI is in PoC stage — the full init → workflow → Cypress pipeline has no automated validation
- The init command has 9 interactive prompts and generates a multi-step workflow; manual testing is slow and error-prone
- Scaffolding version resolution, file sync, and Docker orchestration form a complex chain where any break is silent until a user reports it

## Proposed Solution

Add an e2e test suite using Vitest in a separate `e2e/` directory with a dedicated configuration, targeting Ubuntu-only in a new GitHub Actions workflow. The first test covers the `init` command end-to-end: create a temp directory, pipe stdin answers to the interactive wizard (using `test-jahia-cli` scaffolding version), then run the generated workflow which creates a Jahia Docker environment, waits for it to be alive, and executes Cypress tests from the scaffolding. Key milestone assertions verify the pipeline at critical points. A `finally` cleanup block guarantees Docker resource teardown even on failure.

## Key Hypothesis

We believe automated e2e testing of the init → workflow → Cypress pipeline will catch integration regressions before they reach users.
We'll know we're right when the e2e CI workflow catches a breaking change that unit/integration tests missed.

## What We're NOT Building

- E2e tests for other commands (provision, alive, config) — deferred to future PRDs
- Windows/macOS e2e CI — Ubuntu only for now
- Browser-based testing (Playwright for web) — this is CLI testing via stdin piping
- Custom terminal automation library — using simple child_process stdin piping
- Parallel test execution — single test for now, sequential is fine

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| E2e test passes in CI | 100% green on main | GitHub Actions workflow status |
| Pipeline execution time | < 30 minutes | CI workflow duration |
| Docker cleanup reliability | Zero orphaned containers/networks | finally-block + CI job verification |

## Open Questions

- [ ] Does the `test-jahia-cli` scaffolding tag include a minimal Cypress test set or the full suite?
- [ ] Should the e2e workflow run on every push to main, or only on PRs / manual dispatch?
- [ ] What Jahia Docker image tag should the e2e test use — the default `8.2.1.0` or a specific stable tag?

---

## Users & Context

**Primary User**
- **Who**: jahia-cli developers and CI pipeline
- **Current behavior**: Manual testing of the init → workflow → Cypress flow on local machines
- **Trigger**: Any change to init, scaffolding, config, workflow execution, or Docker provider
- **Success state**: CI automatically validates the full pipeline; developers get fast feedback on breakage

**Job to Be Done**
When I push changes to jahia-cli, I want the full init → environment → Cypress pipeline validated automatically, so I can catch integration regressions before merging.

**Non-Users**
End users of jahia-cli — they don't interact with e2e tests. This is developer/CI infrastructure only.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | E2e test of init command with stdin piping | Core deliverable — validates interactive wizard |
| Must | Workflow execution with Docker (environment create + alive) | Validates the full pipeline the user runs |
| Must | Cypress test execution from scaffolding (version: test-jahia-cli) | End goal — proves the entire flow works |
| Must | Docker cleanup in finally block | Prevents CI resource leaks |
| Must | Separate GitHub Actions workflow (Ubuntu, Docker) | CI automation |
| Must | Key milestone assertions (config created, state exists, workflow exit 0) | Validates pipeline at critical checkpoints |
| Should | Vitest in separate `e2e/` directory with own config | Clean separation from unit/integration tests |
| Should | `npm run e2e` script in package.json | Consistent developer experience |
| Could | Timeout configuration tuning | Optimize CI run time |
| Won't | E2e for other commands | Deferred to future PRDs |
| Won't | Windows/macOS e2e CI | Not needed yet |

### MVP Scope

Single e2e test file (`e2e/init.e2e.test.ts`) that:
1. Creates a temp directory
2. Runs `jahia-cli init` with stdin-piped answers (defaults + `test-jahia-cli` version)
3. Asserts config YAML was created with correct structure
4. Runs `jahia-cli workflow run` against the generated config
5. Asserts workflow completed successfully (exit code 0)
6. Cleans up Docker resources in a finally block

### User Flow (E2e Test Execution)

```
Developer runs: npm run e2e
  │
  ├── Vitest loads e2e/vitest.config.ts (long timeout, e2e/ test dir)
  │
  ├── e2e/init.e2e.test.ts
  │   ├── beforeAll: create temp directory
  │   │
  │   ├── test: "init creates valid config"
  │   │   ├── Spawn: node bin/dev.js init (with stdin pipe)
  │   │   ├── Send: Enter × 7 (defaults) + "test-jahia-cli" + Enter + "n" (don't run workflow)
  │   │   ├── Assert: jahia-cli.config.yml exists
  │   │   ├── Assert: YAML has environment.name, tests.scaffolding.version = "test-jahia-cli"
  │   │   └── Assert: workflows.main.steps has 6 steps
  │   │
  │   ├── test: "workflow runs full pipeline with Cypress"
  │   │   ├── Spawn: node bin/dev.js workflow run --config <path>
  │   │   ├── Assert: exit code 0 (all 6 steps passed)
  │   │   └── (Includes: tests:init, environment:create, alive, yarn, e2e:ci, delete)
  │   │
  │   └── afterAll: cleanup
  │       ├── Run: jahia-cli environment delete (if state exists)
  │       ├── Run: docker network prune -f (safety net)
  │       └── Remove temp directory
  │
  └── Report results
```

---

## Technical Approach

**Feasibility**: HIGH

The CLI already has integration tests using `execFile` + `bin/dev.js`. E2e tests extend this pattern with stdin piping for interactive prompts and longer timeouts for Docker operations.

**Architecture Notes**
- **Test runner**: Vitest with separate config (`e2e/vitest.config.ts`) — longer timeouts (30min), different test directory
- **Process spawning**: `node:child_process.spawn` with `stdin: 'pipe'` for interactive prompt automation
- **Stdin piping**: Write answers as text + newlines; `@inquirer/prompts` reads from stdin when not a TTY
- **Assertions**: Parse YAML with `js-yaml`, check file existence with `fs.access`, check exit codes
- **Cleanup**: `afterAll` hook with `try/finally` pattern; also run `docker` CLI cleanup as safety net
- **CI**: Separate workflow file `.github/workflows/e2e.yml` — Ubuntu only, Docker pre-installed on GitHub runners

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Stdin piping doesn't work with @inquirer/prompts | Medium | inquirer supports non-TTY stdin; test locally first. Fallback: use `--json` flag or env vars to skip prompts |
| Jahia container takes too long to start (>10min) | Medium | 30min timeout; use known-good image tag; health check polling |
| Scaffolding clone fails (network/auth) | Low | `test-jahia-cli` tag is on a public repo; retry logic in CI |
| Docker cleanup fails, leaving orphans | Low | Multiple cleanup layers: finally block + docker prune + CI job cleanup |
| Flaky test due to timing | Medium | Use generous timeouts; assert on outcomes not timing |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | E2e test infrastructure | Vitest config, directory structure, npm script, helper utilities | pending | - | - | - |
| 2 | Init command e2e test | Stdin piping, config assertions, workflow execution test | pending | - | 1 | - |
| 3 | CI workflow | GitHub Actions e2e.yml for Ubuntu with Docker | pending | - | 2 | - |
| 4 | Documentation | Update CLAUDE.md, Agents.md with e2e testing patterns | pending | - | 3 | - |

### Phase Details

**Phase 1: E2e test infrastructure**
- **Goal**: Set up the e2e testing foundation that future command tests will reuse
- **Scope**:
  - Create `e2e/` directory
  - Create `e2e/vitest.config.ts` with 30-minute timeout, e2e test directory
  - Create `e2e/helpers/` with spawn utility (stdin piping), cleanup utility, assertion helpers
  - Add `npm run e2e` script to package.json
- **Success signal**: `npm run e2e` runs (with no tests yet) and exits cleanly

**Phase 2: Init command e2e test**
- **Goal**: Validate the full init → workflow → Cypress pipeline
- **Scope**:
  - Create `e2e/init.e2e.test.ts`
  - Test 1: Run `init` with stdin piping, assert config YAML structure
  - Test 2: Run `workflow run` against generated config, assert exit code 0
  - Include `afterAll` cleanup with Docker resource teardown
  - Handle the `test-jahia-cli` scaffolding version override
- **Success signal**: `npm run e2e` passes locally with Docker running

**Phase 3: CI workflow**
- **Goal**: Automate e2e testing in GitHub Actions
- **Scope**:
  - Create `.github/workflows/e2e.yml`
  - Ubuntu-latest only, Node 22
  - Docker pre-installed (default on GitHub runners)
  - 30-minute job timeout
  - Run `npm run e2e` after build
  - Cleanup step that always runs (Docker prune)
- **Success signal**: E2e workflow passes on GitHub Actions

**Phase 4: Documentation**
- **Goal**: Document e2e testing patterns for future command tests
- **Scope**:
  - Update CLAUDE.md with e2e section (commands, directory structure, how to add new e2e tests)
  - Update Agents.md with e2e testing harness
- **Success signal**: A developer can add a new e2e test by following the documentation

### Parallelism Notes

All phases are sequential — each builds on the previous. Phase 1 creates the infrastructure that Phase 2 uses. Phase 3 needs Phase 2 to have a working test. Phase 4 documents the final result.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Test framework | Vitest (separate config) | Playwright, shell scripts, Jest | Already in the project; lightweight; supports long timeouts |
| Interactive automation | stdin piping via child_process.spawn | node-pty, expect-style lib | Simplest approach; @inquirer/prompts supports non-TTY stdin |
| Workflow trigger | Separate `workflow run` command | Answer "yes" to prompt 9 in init | Better control, clearer assertions, easier debugging |
| CI platform | Ubuntu only | Multi-OS matrix | Docker works reliably on Ubuntu runners; Windows/macOS deferred |
| Cleanup strategy | finally block + docker prune | Manual cleanup, no cleanup | Guarantees no orphaned resources in CI |
| Test directory | `e2e/` separate from `test/` | Same `test/` directory | Clear separation; different vitest config (timeout, patterns) |
| Scaffolding version | `test-jahia-cli` (hardcoded in test) | `latest`, configurable | PoC stage; known-good minimal test set |

---

## Research Summary

**Market Context**
- CLI e2e testing commonly uses child_process spawning with stdin piping (oclif's own test suite does this)
- Playwright is for browser testing, not CLI testing — not applicable here
- Tools like `node-pty` add complexity for marginal benefit when stdin piping works

**Technical Context**
- The codebase already has integration tests using `execFile` on `bin/dev.js` — e2e extends this pattern
- `@inquirer/prompts` reads from stdin in non-TTY mode (CI/piped input)
- GitHub Actions Ubuntu runners include Docker by default — no special setup needed
- The `test-jahia-cli` tag exists on `https://github.com/Jahia/jahia-cypress`
- Full pipeline (init → environment → alive → Cypress) takes ~5-15 minutes depending on Jahia startup time

---

*Generated: 2026-05-17T11:40:07+02:00*
*Status: DRAFT - needs validation*

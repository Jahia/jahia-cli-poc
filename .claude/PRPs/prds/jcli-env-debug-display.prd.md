# JCLI Environment Variables Debug Display

## Problem Statement

When troubleshooting jahia-cli runs (locally or in CI), developers must manually inspect their shell environment to understand which `JCLI_*` variables are active. This happens *after* a failure, requires extra steps, and the information is disconnected from the CLI's own logs — making it harder to correlate configuration state with behavior.

## Evidence

- Developers currently run `env | grep JCLI_` manually after failures — reactive, not proactive
- CI pipeline logs don't capture the environment state unless explicitly scripted
- Assumption — needs validation through first usage in real debugging sessions

## Proposed Solution

Add a `--debug` flag (backed by the `JCLI_DEBUG` environment variable) to all commands and the workflow executor. When active, it prints a clearly formatted section at the start of execution listing all `JCLI_*` environment variables sorted alphabetically. Variables prefixed with `JCLI_SECRET_*` are masked to prevent secret leakage. The section appears even when no variables are found (showing "none detected") to confirm the debug feature is active.

## Key Hypothesis

We believe displaying `JCLI_*` environment variables at run start will reduce debugging time for developers and CI operators. We'll know we're right when troubleshooting sessions no longer require manual `env | grep` as the first debugging step.

## What We're NOT Building

- File-based logging — output goes to stdout only
- Display of non-`JCLI_` variables — out of scope for this feature
- Verbose/trace-level debugging beyond env var display — separate concern
- Automatic detection of misconfiguration — display only, no validation

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Debug section displays correctly | 100% of commands | Unit + integration tests |
| Secrets never leak full values | 0 leaks | Test coverage for masking logic |
| No performance impact when disabled | <1ms overhead | Flag check is O(1) |

## Open Questions

- [ ] Should a future version support additional debug sections (e.g., resolved config, Docker context)?

---

## Users & Context

**Primary User**
- **Who**: Developer or CI pipeline operator debugging a failed jahia-cli run
- **Current behavior**: Manually runs `env | grep JCLI_` after a failure, cross-references with logs
- **Trigger**: A command or workflow fails or behaves unexpectedly
- **Success state**: Seeing environment context inline with CLI output, immediately identifying missing/wrong variables

**Job to Be Done**
When a jahia-cli command or workflow fails, I want to see all `JCLI_*` variables that were active at execution time, so I can quickly determine if a misconfiguration caused the issue.

**Non-Users**
Users who never set `JCLI_*` environment variables — they'll see "none detected" if they enable debug, confirming the feature works but providing no actionable info. This is fine.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Collect all `JCLI_*` env vars from `process.env` | Core data source |
| Must | Sort variables alphabetically | Consistent, scannable output |
| Must | Mask `JCLI_SECRET_*` values (first 2 + `***` + last 2 chars) | Prevent secret leakage in logs |
| Must | Display "none detected" when no `JCLI_*` vars exist | Confirms debug mode is active |
| Must | `--debug` flag on all commands with `JCLI_DEBUG` env var | Consistent activation mechanism |
| Must | Include debug info in JSON output when `--json` is active | AI agents need the data too |
| Must | Display at workflow execution start (in executor) | Workflows are the primary use case |
| Should | Clear visual section header ("── Debug: JCLI Environment ──") | Scannable in long output |
| Won't | Log to file | Separate concern for later |

### MVP Scope

1. Pure utility functions in `src/lib/debug/` (one function per file)
2. A shared `--debug` flag definition (reusable across commands)
3. Integration into all existing commands' `run()` methods
4. Integration into the workflow executor before step execution
5. Full test coverage for the utility functions

### User Flow

```
$ JCLI_DEBUG=true jahia-cli environment create --config ./config.yml

  ── Debug: JCLI Environment ──
  JCLI_DEBUG              = true
  JCLI_SECRET_DB_PASS     = se***ss
  JCLI_SOME_SETTING       = my-value

  (3 variables detected)

  ... normal command output ...
```

When no variables are found:
```
$ jahia-cli environment create --config ./config.yml --debug

  ── Debug: JCLI Environment ──
  No JCLI_* environment variables detected.

  ... normal command output ...
```

---

## Technical Approach

**Feasibility**: HIGH

**Architecture Notes**

Each function lives in its own file under `src/lib/debug/`:

| File | Function | Purpose |
|------|----------|---------|
| `collect-jcli-vars.ts` | `collectJcliVars` | Filters `process.env` for `JCLI_*` keys, returns sorted entries |
| `mask-secret-value.ts` | `maskSecretValue` | Masks a value: first 2 + `***` + last 2 chars |
| `format-debug-vars.ts` | `formatDebugVars` | Formats collected vars into indented key=value lines (human) |
| `build-debug-json.ts` | `buildDebugJson` | Builds structured object for JSON output |
| `format-debug-section.ts` | `formatDebugSection` | Wraps formatted vars with section header/footer |
| `debug-flag.ts` | `debugFlag` | Shared OCLIF flag definition (`--debug` + `JCLI_DEBUG` env) |
| `log-debug-section.ts` | `logDebugSection` | Orchestrates: collect → format → log (called by commands) |
| `index.ts` | barrel | Re-exports public API |

**Key decisions:**
- Pure functions with no side effects (except `logDebugSection` which calls `this.log`)
- Masking rule: if value length ≤ 4, show `****` (don't reveal partial content for short secrets)
- The `--debug` flag uses `env: 'JCLI_DEBUG'` so it can be activated via env var without modifying command invocations

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Adding `--debug` to all commands is repetitive | LOW | Shared flag definition; one import per command |
| Workflow executor runs in subprocess — debug may print twice | MEDIUM | Only print in the executor entry point, not in nested workflows |
| Short secret values reveal too much with 2+2 masking | LOW | Values ≤ 4 chars show `****` instead |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Core utility functions | Create `src/lib/debug/` with all pure functions + tests | complete | - | - | `.claude/PRPs/plans/jcli-env-debug-display.plan.md` |
| 2 | Flag definition | Shared `--debug` flag with `JCLI_DEBUG` env var | complete | with 1 | - | `.claude/PRPs/plans/jcli-env-debug-display.plan.md` |
| 3 | Command integration | Add `--debug` flag and debug section call to all commands | complete | - | 1, 2 | `.claude/PRPs/plans/jcli-env-debug-display.plan.md` |
| 4 | Workflow integration | Add debug display at workflow executor entry point | complete | with 3 | 1, 2 | `.claude/PRPs/plans/jcli-env-debug-display.plan.md` |
| 5 | Verification | Build, lint, test, coverage check | complete | - | 3, 4 | - |

### Phase Details

**Phase 1: Core utility functions**
- **Goal**: Implement and test all pure functions for collecting, masking, and formatting env vars
- **Scope**: 6 function files + barrel + full unit test coverage
- **Success signal**: All unit tests pass, 100% coverage on debug module

**Phase 2: Flag definition**
- **Goal**: Create reusable `--debug` flag tied to `JCLI_DEBUG` env var
- **Scope**: Single file with OCLIF flag definition
- **Success signal**: Flag importable and usable in any command

**Phase 3: Command integration**
- **Goal**: Every command displays the debug section when `--debug` is active
- **Scope**: Add flag + call to all 16 command files
- **Success signal**: Integration tests verify debug output appears

**Phase 4: Workflow integration**
- **Goal**: Workflow executor displays debug section before executing steps
- **Scope**: Modify `workflow/run.ts` to call debug display before execution
- **Success signal**: `workflow run --debug` shows env vars before step output

**Phase 5: Verification**
- **Goal**: Full quality gate pass
- **Scope**: `npm run build && npm run lint && npm test`
- **Success signal**: Zero errors, zero warnings, all tests pass

### Parallelism Notes

Phases 1 and 2 are independent and can be built simultaneously. Phases 3 and 4 both depend on 1+2 but are independent of each other. Phase 5 gates the final result.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Activation mechanism | `--debug` flag + `JCLI_DEBUG` env | Always-on, `--verbose` | Explicit opt-in avoids noise; env var enables CI without flag changes |
| Masking strategy | First 2 + `***` + last 2 | Full mask, partial reveal | Fixed `***` hides value length; 2+2 aids identification without leaking |
| Short value handling | `****` for ≤4 chars | Same 2+2 rule | Prevents full reveal of short secrets |
| Display when empty | Show "none detected" | Hide section | Confirms debug mode is active and working |
| JSON mode | Include debug object in JSON | Skip debug in JSON | AI agents benefit from env context for debugging |
| Integration point for workflows | `workflow/run.ts` command only | Inside executor | Avoids duplicate output in nested workflows |

---

## Research Summary

**Market Context**
- Standard practice in CLI tools (e.g., `terraform`, `docker`, `kubectl`) to have a `--debug` or `--verbose` flag showing internal state
- Masking secrets in debug output is a common pattern in CI/CD tools (GitHub Actions, GitLab CI)

**Technical Context**
- Codebase uses functional programming style with one function per file
- OCLIF supports shared flag definitions via exported objects
- No existing base class or hook system — explicit calls required per command
- Workflow executor is the single entry point for all workflow execution

---

*Generated: 2026-05-24T11:13:00Z*
*Status: DRAFT - needs validation*

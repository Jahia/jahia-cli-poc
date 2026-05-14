# Jahia Provision Command Enhancements

## Problem Statement

The `jahia:provision` command currently only supports submitting a full provisioning manifest (with optional file attachments). In CI/CD and local testing workflows, developers frequently need to perform simpler operations — uploading individual modules (JARs) or executing provisioning scripts from a folder — without writing a manifest file for each case. Today this requires manual `curl` commands or custom shell scripts, which defeats the purpose of having a CLI tool.

## Evidence

- The user's existing CI/CD scripts use raw `curl` commands for module uploads (`installOrUpgradeBundle`) and script execution (`executeScript`), duplicating logic the CLI should provide.
- The `--manifest` flag is currently required even when the user only wants to upload modules or run scripts, forcing unnecessary ceremony.
- Filtering files in a directory (e.g., only `*-SNAPSHOT.jar` modules) requires shell-level glob handling outside the CLI.

## Proposed Solution

Extend `jahia:provision` with three mutually exclusive operational modes:

1. **Manifest mode** (existing) — `--manifest [--assets] [--file]` — submits a YAML manifest with optional attachments.
2. **Modules mode** (new) — `--modules <dir>` — uploads each file in the directory as a module via `installOrUpgradeBundle`.
3. **Scripts mode** (new) — `--scripts <dir>` — executes each file in the directory as a provisioning script via `executeScript`.

A new `--filter` flag applies a glob pattern to any directory-based flag (`--assets`, `--modules`, `--scripts`) to limit which files are processed.

## Key Hypothesis

We believe adding `--modules`, `--scripts`, and `--filter` flags will eliminate the need for raw `curl` commands in CI/CD pipelines and local workflows.
We'll know we're right when provisioning operations can be performed entirely through the CLI without shell script wrappers.

## What We're NOT Building

- Parallel file uploads — files are uploaded sequentially, one at a time
- Remote module/script sources (URLs) — only local directories
- Dry-run mode — not in scope for this iteration
- Pushing modules to a remote registry — only local provisioning API

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| All module upload scenarios work via CLI | 100% | Manual testing with Jahia instance |
| All script execution scenarios work via CLI | 100% | Manual testing with Jahia instance |
| Filter correctly limits files processed | 100% | Unit tests with picomatch patterns |

## Open Questions

- [ ] Should there be a `--recursive` flag for modules/scripts directories, or always recurse?

---

## Users & Context

**Primary User**
- **Who**: Jahia developer or CI/CD pipeline operator
- **Current behavior**: Uses raw `curl` commands in shell scripts to upload modules and run provisioning scripts
- **Trigger**: Needs to deploy module JARs or run provisioning scripts against a running Jahia instance
- **Success state**: Single CLI command handles module uploads, script execution, or manifest submission with file filtering

**Job to Be Done**
When I need to upload modules or run provisioning scripts against Jahia, I want to use a single CLI command with a directory path, so I can avoid writing and maintaining curl-based shell scripts.

**Non-Users**
This is not for end users who interact with Jahia through the UI. It's for developers and DevOps engineers who manage Jahia instances programmatically.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | `--modules <dir>` flag — upload each file as a module via `installOrUpgradeBundle` | Core new feature |
| Must | `--scripts <dir>` flag — execute each file as a provisioning script via `executeScript` | Core new feature |
| Must | `--filter <glob>` flag — glob filter on directory-based flags | Essential for CI/CD (e.g., `*-SNAPSHOT.jar`) |
| Must | `--manifest` becomes optional — mutual exclusivity with modules/scripts | Required for new modes to work standalone |
| Must | Alphabetical ordering of files within directories | Predictable, reproducible execution order |
| Must | Stop on first failure (but empty directory is not a failure) | User-confirmed error handling behavior |
| Must | Per-file result output (success/failure for each file individually) | User-confirmed output style |
| Should | `--filter` applies to `--assets` in manifest mode too | Consistent filtering across all directory-based flags |
| Won't | Parallel uploads | Complexity, not needed for v1 |
| Won't | Remote sources for modules/scripts (URLs) | Only local directories for now |

### MVP Scope

1. Add `--modules` flag (path to a directory of module files)
2. Add `--scripts` flag (path to a directory of script files)
3. Add `--filter` flag (glob pattern, default `*`, using picomatch)
4. Make `--manifest` optional — enforce mutual exclusivity between the three modes
5. Files processed alphabetically, one at a time, stopping on first failure
6. Empty directory (or no matching files after filter) logs a message and exits 0

### API Payloads

**Modules upload** (per file):
```
POST {url}/modules/api/provisioning
Form fields:
  script: [{"installOrUpgradeBundle":"<filename>", "forceUpdate":true}]
  file: @<filepath>
Auth: Basic root:<password>
```

**Scripts execution** (per file):
```
POST {url}/modules/api/provisioning
Form fields:
  script: [{"executeScript":"<filename>"}]
  file: @<filepath>
Auth: Basic root:<password>
```

### User Flow

```
# Upload all modules from a folder
jahia-cli jahia provision --modules ./modules/

# Upload only SNAPSHOT jars
jahia-cli jahia provision --modules ./modules/ --filter "*-SNAPSHOT.jar"

# Run all provisioning scripts from a folder
jahia-cli jahia provision --scripts ./scripts/

# Run only groovy scripts
jahia-cli jahia provision --scripts ./scripts/ --filter "*.groovy"

# Existing manifest flow (unchanged)
jahia-cli jahia provision --manifest ./setup.yaml --assets ./artifacts

# Existing manifest flow with filter on assets
jahia-cli jahia provision --manifest ./setup.yaml --assets ./artifacts --filter "*.jar"
```

### Mutual Exclusivity Rules

| Flag | Compatible with | Incompatible with |
|------|----------------|-------------------|
| `--manifest` | `--assets`, `--file`, `--filter` | `--modules`, `--scripts` |
| `--modules` | `--filter` | `--manifest`, `--assets`, `--file`, `--scripts` |
| `--scripts` | `--filter` | `--manifest`, `--assets`, `--file`, `--modules` |
| `--filter` | All directory-based modes | — |
| `--assets` | `--manifest`, `--filter` | `--modules`, `--scripts` |
| `--file` | `--manifest` | `--modules`, `--scripts` |

---

## Technical Approach

**Feasibility**: HIGH

**Architecture Notes**
- The provisioning API endpoint is the same for all three modes (`/modules/api/provisioning`) — only the `script` form field payload differs
- The existing `submitProvisioning` function handles `FormData` construction and HTTP POST — new functions for modules and scripts can follow the same pattern with different `script` field content
- `picomatch` is a zero-dependency glob matcher suitable for the `--filter` flag
- File listing and sorting can reuse `resolveAssetPaths` with an added filter step
- Each new mode submits files one-at-a-time sequentially (no batching)

**File Structure Plan**
```
src/lib/provisioning/
  submit-provisioning.ts   # existing — manifest mode
  submit-module.ts         # NEW — single module upload (installOrUpgradeBundle)
  submit-script.ts         # NEW — single script execution (executeScript)
  filter-files.ts          # NEW — glob filtering with picomatch
  types.ts                 # UPDATED — add SubmitModuleResult, SubmitScriptResult interfaces
src/commands/jahia/
  provision.ts             # UPDATED — add flags, mode detection, batch loop
```

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| picomatch adds a dependency | L | Small, well-maintained package; or use built-in `minimatch` from Node 22+ |
| Script form field format incorrect | L | Verified from user-provided curl examples |
| File ordering differs across OS | M | Explicit `sort()` after `readdir` |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Core provisioning functions | Create `submit-module.ts`, `submit-script.ts`, `filter-files.ts` with unit tests | pending | - | - | - |
| 2 | Command integration | Update `provision.ts` with new flags, mode detection, mutual exclusivity, batch loop | pending | - | 1 | - |
| 3 | Tests and documentation | Integration tests, update examples, README | pending | - | 2 | - |

### Phase Details

**Phase 1: Core provisioning functions**
- **Goal**: Pure functions for module upload, script execution, and file filtering
- **Scope**:
  - `submit-module.ts` — POST with `installOrUpgradeBundle` payload, returns result
  - `submit-script.ts` — POST with `executeScript` payload, returns result
  - `filter-files.ts` — apply glob pattern to file list using picomatch
  - Update `types.ts` with new interfaces
  - Unit tests for all new functions
- **Success signal**: All unit tests pass, functions are importable

**Phase 2: Command integration**
- **Goal**: Wire new flags into the provision command with mutual exclusivity
- **Scope**:
  - Add `--modules`, `--scripts`, `--filter` flags to `provision.ts`
  - Make `--manifest` optional
  - Add mode detection logic (which flags are present)
  - Add validation for mutual exclusivity
  - Add batch loop with per-file output and stop-on-failure
  - Support `--json` output for all modes
- **Success signal**: CLI accepts all new flag combinations, rejects invalid ones

**Phase 3: Tests and documentation**
- **Goal**: Integration tests and updated documentation
- **Scope**:
  - Integration tests via `bin/dev.js` for help output, flag validation
  - Update command description and examples
  - Verify `--json` output format for all modes
- **Success signal**: All tests pass, lint clean, build clean

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Glob library | picomatch | minimatch, micromatch, regex | Lightweight, widely used, no dependencies |
| Error handling | Stop on first failure | Continue all | User preference — simpler mental model |
| Empty dir behavior | Log + exit 0 | Error out | User confirmed: not a failure condition |
| Upload order | Alphabetical | Filesystem order | Reproducible across OS and runs |
| Filter scope | All directory flags | Only modules/scripts | Consistent behavior, user confirmed |
| Mode exclusivity | Exactly one of manifest/modules/scripts | Allow combos | Simpler, clearer semantics |

---

## Research Summary

**Technical Context**
- The Jahia provisioning API uses a single endpoint (`/modules/api/provisioning`) for all operations
- The `script` form field contains a JSON array with the operation descriptor
- Module uploads use `{"installOrUpgradeBundle":"<filename>", "forceUpdate":true}`
- Script execution uses `{"executeScript":"<filename>"}`
- The `file` form field carries the binary file payload
- Authentication is HTTP Basic (same as existing manifest mode)
- The existing `submitProvisioning` function in `submit-provisioning.ts` demonstrates the exact FormData + fetch pattern to replicate

---

*Generated: 2026-05-14T17:28:00Z*
*Status: DRAFT - needs validation*

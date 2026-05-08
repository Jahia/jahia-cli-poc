# tests:init — Config-Driven Scaffolding Sync

## Problem Statement

Developers bootstrapping Cypress test projects against Jahia need a reliable way to pull test scaffolding files from a central repository (`jahia-cypress`) while maintaining the ability to own/override specific files locally. Currently the `tests init` command exists but lacks config-file-driven behavior, `.gitignore` management, proper logging, and the concept of "remote files that stay managed vs. local files that are owned by the developer."

## Evidence

- The current `tests init` implementation exists but does not read from config `tests.scaffolding.*` fields
- No `.gitignore` management exists — newly synced files are immediately trackable by git, polluting commits
- No logging of individual file sync decisions (copied vs. skipped)
- The `ScaffoldingConfig` type already exists in `src/lib/config/types.ts` with `repository`, `path`, `version`
- The `cloneScaffolding` and `syncMissingFiles` libraries already handle the core git+copy logic

## Proposed Solution

Rewrite `tests init` as a **config-driven scaffolding synchronizer** that:
1. Accepts an optional `--config` flag (defaults to `jahia-cli.config.yml` in cwd; generates blank if missing)
2. Reads `tests.scaffolding.{repository, path, version}` from config
3. Resolves `"latest"` version to highest semver tag via `git ls-remote`
4. Clones the remote repository at the resolved version into a temp directory
5. Recursively walks the remote `scaffolding/` path, syncing files to local destination
6. Skips files matching an exclusion list (remote `.gitignore`, etc.)
7. For each file copied (not already present locally), appends it to the local `.gitignore`
8. Logs every decision: file imported, file skipped (exists), file ignored (pattern), `.gitignore` updated
9. Cleans up temp directory

The `.gitignore` auto-update mechanism ensures that **remotely-sourced files are not committed by default**. If a developer removes a file from `.gitignore`, it signals "I now own this file" and future syncs will skip it (it exists locally).

## Key Hypothesis

We believe a config-driven scaffolding sync with automatic `.gitignore` management will eliminate manual test setup for Jahia developers.
We'll know we're right when developers can run `jahia-cli tests init` and immediately have a working Cypress codebase without manually copying files or editing `.gitignore`.

## What We're NOT Building

- File content diffing/merging — if a file exists locally, it's never overwritten
- Remote file deletion tracking — we don't remove local files that disappear from remote
- Interactive prompts — the command is fully non-interactive (CI-friendly)
- Watch mode — this is a one-shot sync, not a continuous watcher

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Zero manual steps after `tests init` | Working Cypress project | Run command, verify `npx cypress open` works |
| All remote-sourced files gitignored | 100% | Check `.gitignore` contains all copied files |
| Clear audit trail | Every file logged | Verify stdout shows each decision |

## Open Questions

- [ ] Should the exclusion list be configurable beyond the hardcoded `.gitignore` skip?
- [ ] Should `tests init` support a `--force` flag to re-sync even if files exist?
- [ ] What happens if the remote repository has no tags (edge case for `"latest"`)?

---

## Users & Context

**Primary User**
- **Who**: Jahia developer or QA engineer bootstrapping a test project
- **Current behavior**: Manually clones jahia-cypress, copies scaffolding files, edits `.gitignore`
- **Trigger**: Starting a new module's test suite or refreshing scaffolding after upstream changes
- **Success state**: `jahia-cli tests init` produces a ready-to-run Cypress project

**Job to Be Done**
When starting or refreshing a Cypress test project, I want to pull the latest scaffolding from jahia-cypress, so I can focus on writing tests instead of project setup.

**Non-Users**
- Developers who don't use Jahia — irrelevant
- Developers who maintain jahia-cypress itself — they push, not pull

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Read `tests.scaffolding.*` from config file | Config-driven is the core requirement |
| Must | Generate blank config if none exists (via `config init`) | Zero-friction first run |
| Must | Resolve `"latest"` to highest semver tag | Users shouldn't need to know exact versions |
| Must | Recursive sync with skip-if-exists semantics | Core sync behavior |
| Must | Skip remote `.gitignore` (exclusion list) | Don't overwrite local ignore rules |
| Must | Auto-update local `.gitignore` with copied files | Prevent accidental commits of scaffolding |
| Must | Detailed per-file logging | Auditability and debugging |
| Should | `--config` flag to specify alternate config path | Flexibility |
| Should | `--path` flag to override destination directory | Override config default |
| Could | Configurable exclusion patterns beyond `.gitignore` | Future extensibility |
| Won't | File content merging/diffing | Too complex for v1 |
| Won't | `--force` overwrite mode | Risky, defer to v2 |

### MVP Scope

1. Config loading (with blank generation fallback)
2. Version resolution (`"latest"` → highest tag)
3. Recursive file sync with exclusion list
4. `.gitignore` auto-management
5. Per-file logging to stdout
6. `--json` output mode for AI agents

### User Flow

```
User runs: jahia-cli tests init [--config path]
  ↓
Config file found? 
  NO → Generate blank via buildBlankConfig → write jahia-cli.config.yml
  YES → Load and parse
  ↓
Read tests.scaffolding.{repository, path, version}
  ↓
version === "latest"? → git ls-remote --tags → resolve highest semver
  ↓
git clone --depth 1 --branch <version> <repository> → temp dir
  ↓
Walk remote <path>/ recursively:
  - Skip files matching exclusion list (.gitignore)
  - For each file:
    - Exists locally? → LOG "SKIP: <path> (already exists)" 
    - Not exists? → COPY + LOG "SYNC: <path> (imported from remote)"
                  → APPEND to local .gitignore
  ↓
LOG summary: "Synced X files, skipped Y, ignored Z"
LOG: ".gitignore updated with X new entries"
  ↓
Clean up temp directory
```

---

## Technical Approach

**Feasibility**: HIGH

**Architecture Notes**
- Leverages existing `cloneScaffolding` (git clone + tag resolution) — needs minor refactor to accept config values
- Leverages existing `syncMissingFiles` — needs extension for exclusion list + `.gitignore` management + logging
- New module: `src/lib/tests/gitignore-manager.ts` — reads/writes `.gitignore`, appends entries in a managed section
- New module: `src/lib/tests/exclusion-list.ts` — defines files/patterns to skip from remote
- Config loading already exists in `src/lib/config/parser.ts` (`loadConfigFile`)

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Git not available on PATH | Low | Already required for environment commands; fail with clear error |
| Remote repo has no tags | Low | Throw descriptive error suggesting explicit version |
| `.gitignore` format conflicts | Low | Use a clearly marked section with begin/end markers |
| Large remote repos slow to clone | Medium | `--depth 1` already used; `--filter=blob:none` could help |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Exclusion list + gitignore manager | New utility modules for skip patterns and `.gitignore` section management | pending | - | - | - |
| 2 | Refactor clone-scaffolding | Accept config-driven params (repository, path, version) instead of hardcoded defaults | pending | with 1 | - | - |
| 3 | Refactor sync-missing-files | Add exclusion filtering, per-file logging callback, return gitignore entries | pending | - | 1 | - |
| 4 | Rewrite tests:init command | Config-driven orchestration, blank config fallback, wire all modules together | pending | - | 1, 2, 3 | - |
| 5 | Tests + documentation | Unit tests for all new modules, integration test for full flow, update README | pending | - | 4 | - |

### Phase Details

**Phase 1: Exclusion list + gitignore manager**
- **Goal**: Provide reusable utilities for managing which files to skip and how to update `.gitignore`
- **Scope**: 
  - `src/lib/tests/exclusion-list.ts` — hardcoded list of remote files to never sync (`.gitignore`, etc.)
  - `src/lib/tests/gitignore-manager.ts` — reads local `.gitignore`, appends entries in a `# jahia-cli managed` section, preserves existing content
- **Success signal**: Unit tests pass for both modules

**Phase 2: Refactor clone-scaffolding**
- **Goal**: Make `cloneScaffolding` accept `ScaffoldingConfig` parameters from config
- **Scope**: 
  - Accept `repository` URL from config (not just hardcoded default)
  - Accept `path` (subdirectory within repo) from config
  - Keep `resolveLatestTag` working with configurable repository URL
- **Success signal**: Existing tests still pass; new tests cover config-driven params

**Phase 3: Refactor sync-missing-files**
- **Goal**: Add exclusion filtering and logging to the sync walk
- **Scope**:
  - Accept exclusion patterns parameter
  - Accept a logging callback (`(action: string, path: string) => void`)
  - Return list of files that were copied (for `.gitignore` update)
  - Add `'ignored'` as a third action type alongside `'copied'` and `'kept'`
- **Success signal**: Tests verify exclusion filtering and logging

**Phase 4: Rewrite tests:init command**
- **Goal**: Full config-driven orchestration
- **Scope**:
  - `--config` flag (optional, defaults to `jahia-cli.config.yml`)
  - If config missing → generate blank via `buildBlankConfig` + `initializeConfigFile`
  - Load config → extract `tests.scaffolding.*`
  - Call `cloneScaffolding` with config values
  - Call `syncMissingFiles` with exclusion list + logger
  - Call gitignore manager to append copied files
  - Log full audit trail
- **Success signal**: End-to-end integration test passes

**Phase 5: Tests + documentation**
- **Goal**: Comprehensive test coverage and user documentation
- **Scope**:
  - Unit tests for exclusion-list, gitignore-manager
  - Updated unit tests for refactored clone-scaffolding and sync-missing-files
  - Integration test for `tests init` command
  - Update README with `tests init` documentation
- **Success signal**: `npm test` passes, coverage threshold met

### Parallelism Notes

Phases 1 and 2 can run in parallel since they modify independent modules. Phase 3 depends on Phase 1 (needs the exclusion list type). Phase 4 depends on all prior phases. Phase 5 runs after 4.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| `.gitignore` section markers | Use `# --- jahia-cli:managed-start ---` / `# --- jahia-cli:managed-end ---` markers | Append without markers | Markers allow clean re-sync without duplicates |
| Skip-if-exists behavior | Never overwrite existing files | Overwrite with backup, interactive prompt | Simplest mental model; removal from `.gitignore` signals ownership |
| Sync destination | Current working directory (configurable via `--path`) | Always `tests/` subdirectory | Flexibility for different project structures |
| Exclusion list | Hardcoded in code (`.gitignore` only for now) | Config-driven exclusion patterns | YAGNI — can add config later if needed |
| Logging | stdout per-file messages | Silent with `--verbose` flag | User explicitly asked for good logging by default |

---

## Research Summary

**Market Context**
- Similar to `degit` (Rich Harris) — scaffolding from git repos without full clone history
- Similar to `create-*` CLI tools that scaffold from templates
- Unique aspect: the `.gitignore` management for "remote-managed vs locally-owned" files is novel

**Technical Context**
- Existing `cloneScaffolding` already does `git clone --depth 1` + tag resolution via `git ls-remote --tags --refs --sort=-v:refname`
- Existing `syncMissingFiles` already walks directories recursively and copies missing files
- `ScaffoldingConfig` type already defined with `repository`, `path`, `version` fields
- Config loading (`loadConfigFile`) and blank generation (`buildBlankConfig`) already work
- The project uses arrow functions, no loops (map/filter/reduce), strict TypeScript, ESM

---

*Generated: 2026-05-07*
*Status: DRAFT - ready for implementation*

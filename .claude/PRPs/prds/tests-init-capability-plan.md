# Capability Plan: tests:init — Config-Driven Scaffolding Sync

## CAPABILITY

A Jahia module developer runs `jahia-cli tests init` (with or without an existing config file) and receives a fully bootstrapped local Cypress test directory whose scaffolding files are sourced from a configurable remote Git repository. Files pulled from the remote are automatically added to the local `.gitignore` inside a managed section, so they are never accidentally committed. If the developer later modifies and un-ignores a file, the sync treats it as locally owned and never overwrites it again. The command is fully non-interactive and produces detailed per-file audit logs.

## CONSTRAINTS

### Fixed Rules (invariants that must hold)

1. **Never overwrite**: If a file already exists at the destination path, it is never overwritten — regardless of whether it came from a previous sync or was locally created.
2. **Config is the source of truth**: `tests.scaffolding.repository`, `tests.scaffolding.path`, and `tests.scaffolding.version` drive all sync behavior. No hardcoded repo URLs inside the command itself (defaults live in `src/lib/config/defaults.ts` only).
3. **"latest" resolves deterministically**: When `version === "latest"`, the command resolves the highest semver tag via `git ls-remote --tags --refs --sort=-v:refname`. If no tags exist, it fails with a clear error — never falls back to `HEAD` or `main`.
4. **Managed `.gitignore` section is idempotent**: Re-running `tests init` must not create duplicate entries. The section between `# --- jahia-cli:managed-start ---` and `# --- jahia-cli:managed-end ---` is replaced entirely on each run.
5. **Exclusion list is authoritative**: Files matching the exclusion list (`.gitignore` from remote, and any future patterns) are never synced — they are logged as `IGNORED` and silently skipped from `.gitignore` updates.
6. **Temp directory cleanup is guaranteed**: The cloned temp directory is removed in a `finally` block — even on error.
7. **Config fallback is atomic**: If no config file exists, a blank one is generated AND THEN loaded. The command never proceeds with partial/in-memory-only config.

### Scope Boundaries

- This capability owns: config loading → version resolution → git clone → file walk → copy → `.gitignore` update → logging
- This capability does NOT own: config file schema evolution, environment provisioning, test execution, Cypress configuration

### Trust Boundaries

- The remote Git repository is treated as untrusted content: only file paths and content are synced; executable permissions are NOT preserved; no post-clone hooks are executed.
- The exclusion list prevents syncing files that could alter local git behavior (`.gitignore`, `.gitattributes`).

### Data Ownership

| Data | Owner | Notes |
|------|-------|-------|
| `jahia-cli.config.yml` | Developer | CLI only reads; writes only on blank generation |
| Local `.gitignore` (managed section) | CLI | CLI owns the section between markers; developer owns everything else |
| Local test files (copied from remote) | CLI initially, then Developer if un-ignored | Ownership transfers on `.gitignore` removal |
| Remote repository content | Remote team | Read-only shallow clone, immediately discarded |

### Lifecycle Transitions

```
[No config] → config init → [Config exists, no tests dir]
[Config exists] → tests init → [Tests dir with scaffolding + .gitignore updated]
[Tests dir exists] → tests init again → [Only new remote files added, existing untouched]
[Developer un-ignores file] → tests init → [File skipped (exists), not re-added to .gitignore]
```

### Failure and Recovery

| Failure | Behavior |
|---------|----------|
| Git not on PATH | Fail immediately with: "git is required but not found on PATH" |
| Remote repo unreachable | Fail with network error from `git clone` — temp dir cleaned |
| No tags found (version=latest) | Fail with: "No tags found for {repo}. Specify an explicit version." |
| Scaffolding path not found in clone | Fail with: "Path '{path}' not found in {repo}@{version}" |
| Config file invalid YAML | Fail with parser validation error (existing behavior) |
| Disk full during copy | Partial sync — `.gitignore` only updated for files actually written |

## IMPLEMENTATION CONTRACT

### Actors

| Actor | Role |
|-------|------|
| Developer | Invokes `jahia-cli tests init`, owns local repo |
| CI pipeline | May invoke non-interactively with `--json` |
| Remote repository (jahia-cypress) | Provides scaffolding source files |

### Surfaces

| Surface | Type | Notes |
|---------|------|-------|
| `jahia-cli tests init` | CLI command | Primary entry point |
| `jahia-cli.config.yml` | YAML file | Config input (and output on first run) |
| Local `.gitignore` | Text file | Modified by managed section |
| stdout | Log stream | Per-file audit trail |
| stdout (JSON mode) | Structured output | Machine-readable result |

### States and Transitions

```
IDLE
  → LOADING_CONFIG (read or generate config file)
  → CONFIG_LOADED (scaffolding params extracted)
  → RESOLVING_VERSION (if version === "latest", query remote tags)
  → VERSION_RESOLVED (concrete tag/branch determined)
  → CLONING (git clone --depth 1 into temp dir)
  → CLONED (repo checked out, scaffolding path verified)
  → SYNCING (recursive walk + copy + logging)
  → SYNCED (all files processed)
  → UPDATING_GITIGNORE (rewrite managed section)
  → COMPLETE (temp dir cleaned, summary logged)
```

Error at any state → FAILED (temp dir cleaned in finally, error logged)

### Interfaces

**Input: CLI flags/args**
```
--config <path>    Config file path (default: jahia-cli.config.yml)
--path <path>      Override destination directory (default: cwd)
--json             Structured JSON output
```

**Input: Config file (`tests.scaffolding`)**
```yaml
tests:
  scaffolding:
    repository: https://github.com/Jahia/jahia-cypress  # Git URL
    path: scaffolding/                                    # Subdirectory in repo
    version: latest                                       # Tag, branch, or "latest"
```

**Output: stdout (human mode)**
```
Loading config from jahia-cli.config.yml...
Resolving latest tag for https://github.com/Jahia/jahia-cypress...
Resolved version: v3.2.1
Cloning https://github.com/Jahia/jahia-cypress@v3.2.1...
Syncing scaffolding/ → ./tests/

  SYNC:    cypress.config.ts (imported from remote)
  SYNC:    cypress/support/e2e.ts (imported from remote)
  SKIP:    cypress/support/commands.ts (already exists locally)
  IGNORED: .gitignore (excluded by policy)
  SYNC:    package.json (imported from remote)

Summary: 3 synced, 1 skipped, 1 ignored
.gitignore updated: 3 entries added to managed section
✓ Test scaffolding initialized (v3.2.1)
```

**Output: stdout (JSON mode)**
```json
{
  "success": true,
  "version": "v3.2.1",
  "repository": "https://github.com/Jahia/jahia-cypress",
  "destination": "./tests",
  "synced": ["cypress.config.ts", "cypress/support/e2e.ts", "package.json"],
  "skipped": ["cypress/support/commands.ts"],
  "ignored": [".gitignore"],
  "gitignoreUpdated": true,
  "gitignoreEntriesAdded": 3
}
```

### Data Model Implications

**New types needed:**

```typescript
// Action type extended
type SyncAction = 'copied' | 'kept' | 'ignored';

// Logging callback
type SyncLogger = (action: SyncAction, relativePath: string, reason: string) => void;

// Gitignore managed section
interface GitignoreManagedSection {
  readonly startMarker: string;  // # --- jahia-cli:managed-start ---
  readonly endMarker: string;    // # --- jahia-cli:managed-end ---
  readonly entries: readonly string[];
}
```

**Existing types used as-is:**
- `ScaffoldingConfig` (repository, path, version)
- `JahiaCliConfig` (top-level config)
- `ScaffoldingCloneResult` (clone output)

### Security / Policy Constraints

- No shell expansion in git commands — use `execFile` (not `exec`)
- Remote file content is copied byte-for-byte; no interpretation or execution
- The exclusion list prevents syncing dotfiles that could alter git behavior
- No credentials stored — relies on ambient git credential configuration

### Observability / Operator Requirements

- **Every file decision logged**: SYNC, SKIP, IGNORED with path and reason
- **Summary line**: total counts for each category
- **`.gitignore` change logged**: how many entries added/unchanged
- **Version resolution logged**: what "latest" resolved to
- **JSON mode**: full structured output for CI/automation consumption
- **Exit code**: 0 on success, 1 on any failure

## NON-GOALS

- **File updating/merging**: This capability only adds missing files. Content drift detection is a separate concern.
- **Remote file removal tracking**: If a file disappears from the remote scaffolding, local copies remain untouched.
- **Cypress execution**: This command sets up files; it does not run tests.
- **Config schema migration**: If the config format changes, that's owned by the config system, not tests init.
- **Multi-repo sync**: One repository, one path, one version per invocation.

## OPEN QUESTIONS

1. **Exclusion list extensibility**: Currently hardcoded to skip `.gitignore`. Should this be a config array (`tests.scaffolding.exclude: [".gitignore", ".gitattributes"]`)? **Decision for now**: Hardcode; add config later if needed.
2. **`.gitignore` path relativity**: Should entries in the managed section be relative to the destination directory or the repo root? **Decision**: Relative to destination (where files are synced).
3. **Re-run with different version**: If the user changes `version` in config and re-runs, should previously-synced files be removed? **Decision**: No. Only additive. Old files remain.

## HANDOFF

**Status**: Ready for direct implementation.

The PRD phases map cleanly to implementation units. Recommended execution lane:

→ **`tdd-workflow`** — Write tests first for each module (exclusion-list, gitignore-manager, refactored sync), then implement.

Execution order:
1. `src/lib/tests/exclusion-list.ts` — pure function, trivial to TDD
2. `src/lib/tests/gitignore-manager.ts` — file I/O with clear contract, TDD-friendly
3. Refactor `src/lib/tests/sync-missing-files.ts` — add exclusion + logger params
4. Refactor `src/lib/tests/clone-scaffolding.ts` — accept ScaffoldingConfig
5. Rewrite `src/commands/tests/init.ts` — orchestration wiring
6. Integration test via `bin/dev.js tests init`

All modules are pure-function or thin-I/O wrappers — high testability, no mocking frameworks needed beyond `vi.mock` for `node:fs/promises` and `node:child_process`.

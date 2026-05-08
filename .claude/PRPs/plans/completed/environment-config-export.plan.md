# Implementation Plan: Environment Config Export & Replay

## Summary

Add `environment export` command and `--export-config` flag on `environment create` to enable round-trip environment configuration: create → export → delete → recreate from config.

## Patterns to Mirror

- Command structure: `src/commands/environment/create.ts` (flags, state loading, output)
- Pure function extraction: all logic above the class
- Config serialization: `src/lib/config/config-to-yaml.ts`
- State reading: `src/lib/state/get-active-environment.ts`
- Test patterns: `test/commands/environment/create.test.ts`

## Files to Change

### New Files
1. `src/commands/environment/export.ts` — Export command
2. `src/lib/config/export-config.ts` — Pure function: state → exportable config
3. `test/commands/environment/export.test.ts` — Unit + integration tests
4. `test/lib/config/export-config.test.ts` — Unit tests for export logic

### Modified Files
5. `src/commands/environment/create.ts` — Add `--export-config` flag
6. `test/commands/environment/create.test.ts` — Test new flag

## Step-by-Step Tasks

### Task 1: Create export logic pure function
**File**: `src/lib/config/export-config.ts`
**MIRROR**: `src/lib/config/config-to-yaml.ts`

Create a pure function that takes `PersistedEnvironment` and returns a `JahiaCliConfig` suitable for export:
- Strip auto-generated name (replace with undefined so serializer omits it, or generate no name)
- Keep provider explicit
- Keep components with their overrides
- Return as `JahiaCliConfig` (wrapping in `environment:` key)

### Task 2: Create `environment export` command
**File**: `src/commands/environment/export.ts`
**MIRROR**: `src/commands/environment/create.ts`

Flags:
- `--output` / `-o`: Required. Path to write YAML config file.
- `--stdout`: Print to stdout instead of file (mutually exclusive with `--output`)
- `--state`: State file override (shared flag)
- `--json`: Structured JSON output

Logic:
1. Load active environment from state
2. If no active environment, error with helpful message
3. Extract exportable config via pure function
4. Serialize to YAML via `configToYaml()`
5. Write to file or stdout

### Task 3: Add `--export-config` flag to create command
**File**: `src/commands/environment/create.ts`

- Add `exportConfig` flag (string, optional path)
- After successful creation + state save, call the same export pure function
- Write to the specified path
- Log confirmation

### Task 4: Write tests for export logic
**File**: `test/lib/config/export-config.test.ts`

Test cases:
- Strips auto-generated env names
- Preserves explicit env names
- Keeps provider
- Keeps components with overrides
- Keeps components without overrides as plain names
- Excludes transparent components (victorialogs) from export

### Task 5: Write tests for export command
**File**: `test/commands/environment/export.test.ts`

Unit tests:
- Command outputs YAML to specified file path
- Command errors when no active environment
- `--stdout` prints to stdout
- `--json` outputs structured response

Integration tests:
- `bin/dev.js environment export --help` shows usage

### Task 6: Update create command tests
**File**: `test/commands/environment/create.test.ts`

- Add test for `--export-config` flag behavior

## Validation Commands

```bash
npm run build
npm run lint
npm test
```

## Acceptance Criteria

- [ ] `environment export -o ./env.yml` writes valid YAML from active state
- [ ] Exported config does NOT contain container IDs, timestamps, network names
- [ ] Exported config does NOT contain transparent components (victorialogs)
- [ ] `environment create --config ./env.yml` works with exported file
- [ ] `environment create --export-config ./env.yml` saves config at creation time
- [ ] All existing tests still pass
- [ ] New tests cover core logic and edge cases

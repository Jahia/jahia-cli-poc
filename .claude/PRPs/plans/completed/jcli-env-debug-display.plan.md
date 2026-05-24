# Plan: JCLI Environment Variables Debug Display

## Summary

Create a debug module (`src/lib/debug/`) with pure utility functions that collect, mask, and format `JCLI_*` environment variables. Add a shared `--debug` flag (backed by `JCLI_DEBUG` env var) to all commands and the workflow runner, displaying the debug section at execution start when active.

## User Story

As a developer or CI operator debugging a jahia-cli run,
I want to see all `JCLI_*` environment variables at execution start,
So that I can quickly identify configuration issues without manual shell inspection.

## Problem → Solution

Manual `env | grep JCLI_` after failures → Automatic, inline, masked display at command/workflow start when `--debug` is active.

## Metadata

- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/jcli-env-debug-display.prd.md`
- **PRD Phase**: Phase 1 (Core utility functions) + Phase 2 (Flag definition) + Phase 3 (Command integration) + Phase 4 (Workflow integration)
- **Estimated Files**: ~25 (7 new lib files + 1 barrel + 8 test files + ~16 command modifications + 1 workflow modification)

---

## UX Design

### Before

```
$ jahia-cli environment create --config ./config.yml
  ... command output only, no visibility into JCLI_* env vars ...
```

### After

```
$ JCLI_DEBUG=true jahia-cli environment create --config ./config.yml

  ── Debug: JCLI Environment ──
  JCLI_DEBUG              = true
  JCLI_SECRET_DB_PASS     = se***ss
  JCLI_SOME_SETTING       = my-value

  (3 variables detected)

  ... normal command output ...
```

When no variables:
```
$ jahia-cli environment create --config ./config.yml --debug

  ── Debug: JCLI Environment ──
  No JCLI_* environment variables detected.

  ... normal command output ...
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Command start | Immediate execution | Debug section printed first (if --debug) | No delay, just log output |
| Workflow start | Steps execute immediately | Debug section before first step (if --debug) | Only at top-level, not nested |
| JSON output | No debug field | `"debug"` object included (if --debug) | Machine-parseable |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `src/lib/state/state-flag.ts` | all | Pattern for shared OCLIF flag definition |
| P0 | `src/lib/provisioning/detect-provision-mode.ts` | all | Example of pure function style + return types |
| P0 | `test/lib/config/resolve-env-vars.test.ts` | all | Test pattern with process.env mocking |
| P1 | `src/lib/output/formatter.ts` | all | Barrel re-export pattern |
| P1 | `src/commands/hello.ts` | all | Simplest command — shows flag + run() pattern |
| P1 | `src/commands/workflow/run.ts` | 113-218 | Workflow run() method — integration point |
| P2 | `src/lib/config/resolve-env-vars.ts` | all | Similar domain (env vars), coding style reference |

---

## Patterns to Mirror

### SHARED_FLAG_DEFINITION
```typescript
// SOURCE: src/lib/state/state-flag.ts:1-13
import { Flags } from '@oclif/core';

export const stateFlag = Flags.string({
  description: 'Path to the state JSON file. ...',
  env: 'JAHIA_CLI_STATE',
});
```

### PURE_FUNCTION_STYLE
```typescript
// SOURCE: src/lib/provisioning/detect-provision-mode.ts:10-35
export const detectProvisionMode = (flags: {
  readonly manifest: string | undefined;
  readonly modules: string | undefined;
  readonly scripts: string | undefined;
}): ProvisionMode => {
  // ... pure logic, no side effects
};
```

### BARREL_REEXPORT
```typescript
// SOURCE: src/lib/output/formatter.ts:1-13
export { formatCreateResultHuman } from './format-create-result-human.js';
export { formatCreateResultJson } from './format-create-result-json.js';
// ...
```

### TEST_ENV_MOCK_PATTERN
```typescript
// SOURCE: test/lib/config/resolve-env-vars.test.ts:1-14
import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { resolveEnvVars } from '../../../src/lib/config/resolve-env-vars.js';

describe('resolveEnvVars', () => {
  const originalEnv = process.env;
  beforeEach(() => { process.env = { ...originalEnv }; });
  afterEach(() => { process.env = originalEnv; });
  // ... tests that modify process.env safely
});
```

### COMMAND_RUN_PATTERN
```typescript
// SOURCE: src/commands/hello.ts:33-38
public async run(): Promise<void> {
  const { args, flags } = await this.parse(Hello);
  const message = formatGreeting(args.name, flags.uppercase);
  this.log(message);
}
```

### COMMAND_FLAGS_WITH_JSON
```typescript
// SOURCE: src/commands/environment/create.ts:26-42
static override flags = {
  state: stateFlag,
  config: Flags.string({ char: 'c', description: '...', env: 'JAHIA_CLI_CONFIG' }),
  force: Flags.boolean({ char: 'f', description: '...', default: false }),
  json: Flags.boolean({ description: 'Output result as structured JSON', default: false }),
};
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/lib/debug/collect-jcli-vars.ts` | CREATE | Pure function to filter JCLI_* from process.env |
| `src/lib/debug/mask-secret-value.ts` | CREATE | Pure function to mask JCLI_SECRET_* values |
| `src/lib/debug/format-debug-vars-human.ts` | CREATE | Formats vars as indented key=value lines |
| `src/lib/debug/format-debug-section.ts` | CREATE | Wraps formatted vars with header/footer |
| `src/lib/debug/build-debug-json.ts` | CREATE | Builds structured object for JSON output |
| `src/lib/debug/debug-flag.ts` | CREATE | Shared --debug OCLIF flag definition |
| `src/lib/debug/types.ts` | CREATE | Interface for collected env var entries |
| `src/lib/debug/index.ts` | CREATE | Barrel re-exports |
| `test/lib/debug/collect-jcli-vars.test.ts` | CREATE | Unit tests |
| `test/lib/debug/mask-secret-value.test.ts` | CREATE | Unit tests |
| `test/lib/debug/format-debug-vars-human.test.ts` | CREATE | Unit tests |
| `test/lib/debug/format-debug-section.test.ts` | CREATE | Unit tests |
| `test/lib/debug/build-debug-json.test.ts` | CREATE | Unit tests |
| `src/commands/hello.ts` | UPDATE | Add --debug flag + debug section |
| `src/commands/init.ts` | UPDATE | Add --debug flag + debug section |
| `src/commands/environment/create.ts` | UPDATE | Add --debug flag + debug section |
| `src/commands/environment/delete.ts` | UPDATE | Add --debug flag + debug section |
| `src/commands/environment/list.ts` | UPDATE | Add --debug flag + debug section |
| `src/commands/environment/stop.ts` | UPDATE | Add --debug flag + debug section |
| `src/commands/environment/start.ts` | UPDATE | Add --debug flag + debug section |
| `src/commands/environment/logs.ts` | UPDATE | Add --debug flag + debug section |
| `src/commands/environment/export.ts` | UPDATE | Add --debug flag + debug section |
| `src/commands/environment/doctor.ts` | UPDATE | Add --debug flag + debug section |
| `src/commands/workflow/run.ts` | UPDATE | Add --debug flag + debug section before execution |
| `src/commands/workflow/init.ts` | UPDATE | Add --debug flag + debug section |
| `src/commands/tests/build.ts` | UPDATE | Add --debug flag + debug section |
| `src/commands/tests/run.ts` | UPDATE | Add --debug flag + debug section |
| `src/commands/tests/artifacts.ts` | UPDATE | Add --debug flag + debug section |
| `src/commands/tests/init.ts` | UPDATE | Add --debug flag + debug section |
| `src/commands/jahia/alive.ts` | UPDATE | Add --debug flag + debug section |
| `src/commands/jahia/provision.ts` | UPDATE | Add --debug flag + debug section |
| `src/commands/config/init.ts` | UPDATE | Add --debug flag + debug section |

## NOT Building

- File-based logging
- Non-JCLI_ variable display
- Verbose/trace-level debugging
- Automatic misconfiguration detection
- Base class or hook system refactoring

---

## Step-by-Step Tasks

### Task 1: Create types.ts

- **ACTION**: Create `src/lib/debug/types.ts`
- **IMPLEMENT**: Interface for a collected env var entry (key, value, isSecret)
- **MIRROR**: PURE_FUNCTION_STYLE — readonly properties, interface keyword
- **IMPORTS**: None
- **GOTCHA**: Use `interface` not `type` per project convention
- **VALIDATE**: `npm run build` compiles without error

```typescript
/**
 * A single collected JCLI environment variable entry.
 */
export interface JcliEnvEntry {
  readonly key: string;
  readonly value: string;
  readonly isSecret: boolean;
}
```

### Task 2: Create collect-jcli-vars.ts

- **ACTION**: Create `src/lib/debug/collect-jcli-vars.ts`
- **IMPLEMENT**: Pure arrow function that takes a `Record<string, string | undefined>` (process.env shape), filters keys starting with `JCLI_`, sorts alphabetically, and returns `readonly JcliEnvEntry[]`
- **MIRROR**: PURE_FUNCTION_STYLE
- **IMPORTS**: `import type { JcliEnvEntry } from './types.js';`
- **GOTCHA**: `process.env` values can be `undefined` — filter those out. Must accept the env as a parameter (pure, testable).
- **VALIDATE**: Unit test with mock env object

```typescript
export const collectJcliVars = (
  env: Readonly<Record<string, string | undefined>>,
): readonly JcliEnvEntry[] =>
  Object.entries(env)
    .filter((entry): entry is [string, string] =>
      entry[0].startsWith('JCLI_') && entry[1] !== undefined,
    )
    .map(([key, value]) => ({
      key,
      value,
      isSecret: key.startsWith('JCLI_SECRET_'),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
```

### Task 3: Create mask-secret-value.ts

- **ACTION**: Create `src/lib/debug/mask-secret-value.ts`
- **IMPLEMENT**: Pure arrow function that masks a string: if length ≤ 4, return `****`; otherwise first 2 chars + `***` + last 2 chars
- **MIRROR**: PURE_FUNCTION_STYLE
- **IMPORTS**: None
- **GOTCHA**: Empty string should return `****` (treat as short value)
- **VALIDATE**: Unit test with various lengths

```typescript
export const maskSecretValue = (value: string): string =>
  value.length <= 4
    ? '****'
    : `${value.slice(0, 2)}***${value.slice(-2)}`;
```

### Task 4: Create format-debug-vars-human.ts

- **ACTION**: Create `src/lib/debug/format-debug-vars-human.ts`
- **IMPLEMENT**: Pure arrow function that takes `readonly JcliEnvEntry[]` and returns formatted lines. Pads keys to align `=` signs. Masks secret values.
- **MIRROR**: PURE_FUNCTION_STYLE
- **IMPORTS**: `import type { JcliEnvEntry } from './types.js';` and `import { maskSecretValue } from './mask-secret-value.js';`
- **GOTCHA**: When entries is empty, return "No JCLI_* environment variables detected." line
- **VALIDATE**: Unit test with mixed secret/non-secret entries

```typescript
export const formatDebugVarsHuman = (entries: readonly JcliEnvEntry[]): string => {
  if (entries.length === 0) {
    return '  No JCLI_* environment variables detected.';
  }

  const maxKeyLength = Math.max(...entries.map((e) => e.key.length));

  const lines = entries.map((entry) => {
    const paddedKey = entry.key.padEnd(maxKeyLength);
    const displayValue = entry.isSecret ? maskSecretValue(entry.value) : entry.value;
    return `  ${paddedKey} = ${displayValue}`;
  });

  return [...lines, '', `  (${String(entries.length)} variable${entries.length === 1 ? '' : 's'} detected)`].join('\n');
};
```

### Task 5: Create format-debug-section.ts

- **ACTION**: Create `src/lib/debug/format-debug-section.ts`
- **IMPLEMENT**: Pure arrow function that wraps formatted content with header
- **MIRROR**: PURE_FUNCTION_STYLE
- **IMPORTS**: None
- **GOTCHA**: Include blank line before and after for visual separation
- **VALIDATE**: Unit test verifying header + content structure

```typescript
export const formatDebugSection = (formattedVars: string): string =>
  ['', '  ── Debug: JCLI Environment ──', formattedVars, ''].join('\n');
```

### Task 6: Create build-debug-json.ts

- **ACTION**: Create `src/lib/debug/build-debug-json.ts`
- **IMPLEMENT**: Pure arrow function that builds a JSON-serializable object from entries (masking secrets)
- **MIRROR**: PURE_FUNCTION_STYLE
- **IMPORTS**: `import type { JcliEnvEntry } from './types.js';` and `import { maskSecretValue } from './mask-secret-value.js';`
- **GOTCHA**: Return type must be a plain object, not a class instance
- **VALIDATE**: Unit test asserting structure matches expected shape

```typescript
export interface DebugJsonOutput {
  readonly variables: readonly { readonly key: string; readonly value: string; readonly masked: boolean }[];
  readonly count: number;
}

export const buildDebugJson = (entries: readonly JcliEnvEntry[]): DebugJsonOutput => ({
  variables: entries.map((entry) => ({
    key: entry.key,
    value: entry.isSecret ? maskSecretValue(entry.value) : entry.value,
    masked: entry.isSecret,
  })),
  count: entries.length,
});
```

### Task 7: Create debug-flag.ts

- **ACTION**: Create `src/lib/debug/debug-flag.ts`
- **IMPLEMENT**: Shared OCLIF boolean flag with `env: 'JCLI_DEBUG'`
- **MIRROR**: SHARED_FLAG_DEFINITION
- **IMPORTS**: `import { Flags } from '@oclif/core';`
- **GOTCHA**: Must be a `Flags.boolean` (not string) since it's a toggle
- **VALIDATE**: Import in a command file and verify `npm run build`

```typescript
import { Flags } from '@oclif/core';

export const debugFlag = Flags.boolean({
  description:
    'Display JCLI_* environment variables at start for debugging. ' +
    'Can also be enabled via JCLI_DEBUG=true environment variable.',
  env: 'JCLI_DEBUG',
  default: false,
});
```

### Task 8: Create index.ts barrel

- **ACTION**: Create `src/lib/debug/index.ts`
- **IMPLEMENT**: Re-export all public functions and types
- **MIRROR**: BARREL_REEXPORT
- **IMPORTS**: N/A
- **GOTCHA**: Use `.js` extensions in all re-export paths
- **VALIDATE**: `npm run build`

```typescript
export { collectJcliVars } from './collect-jcli-vars.js';
export { maskSecretValue } from './mask-secret-value.js';
export { formatDebugVarsHuman } from './format-debug-vars-human.js';
export { formatDebugSection } from './format-debug-section.js';
export { buildDebugJson } from './build-debug-json.js';
export type { DebugJsonOutput } from './build-debug-json.js';
export { debugFlag } from './debug-flag.js';
export type { JcliEnvEntry } from './types.js';
```

### Task 9: Create unit tests for all pure functions

- **ACTION**: Create test files under `test/lib/debug/`
- **IMPLEMENT**: Tests for each function covering happy path + edge cases
- **MIRROR**: TEST_ENV_MOCK_PATTERN
- **IMPORTS**: Vitest helpers + source functions
- **GOTCHA**: Use `beforeEach`/`afterEach` to restore process.env when testing collectJcliVars with real env. For other functions, just pass data directly (pure).
- **VALIDATE**: `npm test`

Test cases to cover:

**collect-jcli-vars.test.ts:**
- Empty env → empty array
- No JCLI_ vars → empty array
- Mixed vars (JCLI_ and non-JCLI_) → only JCLI_ returned
- Sorting is alphabetical
- JCLI_SECRET_ prefix detected correctly
- Undefined values filtered out

**mask-secret-value.test.ts:**
- Empty string → `****`
- 1-4 char strings → `****`
- 5+ char strings → first 2 + `***` + last 2
- Exact 5 chars → `ab***de`
- Long strings → only first 2 and last 2 visible

**format-debug-vars-human.test.ts:**
- Empty entries → "No JCLI_* environment variables detected."
- Single entry → formatted line + count
- Multiple entries → aligned keys + count
- Secret entries → masked values
- Singular "variable" vs plural "variables"

**format-debug-section.test.ts:**
- Wraps content with header
- Includes blank line before and after

**build-debug-json.test.ts:**
- Empty entries → { variables: [], count: 0 }
- Entries with secrets → masked in output
- Non-secrets → plain values
- Count matches length

### Task 10: Integrate --debug flag into all commands

- **ACTION**: Update all command files to import `debugFlag` and the debug utility functions, adding the flag to `static override flags` and calling the debug display at the start of `run()`
- **IMPLEMENT**: For each command, add at the top of `run()`:
  ```typescript
  if (flags.debug) {
    const entries = collectJcliVars(process.env);
    if (flags.json) {
      // Will be included in JSON output later
    } else {
      this.log(formatDebugSection(formatDebugVarsHuman(entries)));
    }
  }
  ```
- **MIRROR**: COMMAND_RUN_PATTERN, COMMAND_FLAGS_WITH_JSON
- **IMPORTS**: `import { collectJcliVars, formatDebugVarsHuman, formatDebugSection, buildDebugJson, debugFlag } from '../lib/debug/index.js';` (adjust relative path per command depth)
- **GOTCHA**: Commands without `--json` flag just use human output. For commands with `--json`, include debug data in the JSON output object.
- **VALIDATE**: `npm run build && npm run lint`

### Task 11: Integrate debug into workflow run command

- **ACTION**: Update `src/commands/workflow/run.ts` to display debug section before workflow execution (not inside the executor, to avoid duplication in nested workflows)
- **IMPLEMENT**: After parsing flags, before workflow execution, call debug display. For JSON mode, include debug in the final JSON output.
- **MIRROR**: COMMAND_RUN_PATTERN
- **IMPORTS**: Debug module imports
- **GOTCHA**: Only display at the `workflow run` command level, NOT inside `executeWorkflow` function — nested workflows would duplicate the output
- **VALIDATE**: `npm run build && npm test`

### Task 12: Run full verification

- **ACTION**: Run complete quality gate
- **IMPLEMENT**: Execute validation commands
- **MIRROR**: N/A
- **IMPORTS**: N/A
- **GOTCHA**: Ensure no lint warnings (max-warnings=0)
- **VALIDATE**: All commands below pass

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| collectJcliVars — empty env | `{}` | `[]` | Yes |
| collectJcliVars — no JCLI_ | `{ HOME: '/x' }` | `[]` | Yes |
| collectJcliVars — mixed | `{ JCLI_A: 'x', OTHER: 'y' }` | `[{ key: 'JCLI_A', ... }]` | No |
| collectJcliVars — sort | `{ JCLI_B: 'b', JCLI_A: 'a' }` | A before B | No |
| collectJcliVars — secret detect | `{ JCLI_SECRET_X: 's' }` | `isSecret: true` | No |
| maskSecretValue — empty | `''` | `'****'` | Yes |
| maskSecretValue — short | `'ab'` | `'****'` | Yes |
| maskSecretValue — exactly 4 | `'abcd'` | `'****'` | Yes (boundary) |
| maskSecretValue — 5 chars | `'abcde'` | `'ab***de'` | No |
| maskSecretValue — long | `'mysecretpassword'` | `'my***rd'` | No |
| formatDebugVarsHuman — empty | `[]` | "No JCLI_*..." | Yes |
| formatDebugVarsHuman — entries | 2 entries | Aligned, masked | No |
| formatDebugSection — wraps | content string | Header + content | No |
| buildDebugJson — empty | `[]` | `{ variables: [], count: 0 }` | Yes |
| buildDebugJson — with secret | secret entry | masked value | No |

### Edge Cases Checklist

- [x] Empty environment (no JCLI_* vars) → "none detected"
- [x] All vars are secrets → all masked
- [x] Very short secret values (1-4 chars) → `****`
- [x] Undefined values in process.env → filtered out
- [x] Single variable → singular "variable" not "variables"
- [x] Very long key names → padding still works
- [x] JCLI_DEBUG itself is included in the output (it is a JCLI_ var)

---

## Validation Commands

### Static Analysis
```bash
npm run build
```
EXPECT: Zero type errors, manifest generated

### Lint
```bash
npm run lint
```
EXPECT: Zero errors, zero warnings

### Unit Tests
```bash
npm test
```
EXPECT: All tests pass including new debug module tests

### Coverage
```bash
npm run test:coverage
```
EXPECT: Coverage at or above 40% threshold

### Manual Validation
```bash
JCLI_DEBUG=true JCLI_SOME_VAR=hello JCLI_SECRET_TOKEN=mysecretvalue ./bin/dev.js hello
```
EXPECT: Debug section displayed with JCLI_DEBUG, JCLI_SECRET_TOKEN masked, JCLI_SOME_VAR shown

---

## Acceptance Criteria

- [ ] All pure functions created in `src/lib/debug/` (one per file)
- [ ] All functions use arrow syntax with explicit return types
- [ ] `--debug` flag available on every command
- [ ] `JCLI_DEBUG` env var activates debug without flag
- [ ] Secrets masked (first 2 + *** + last 2; **** for ≤4 chars)
- [ ] Variables sorted alphabetically
- [ ] "None detected" shown when no JCLI_ vars exist
- [ ] JSON output includes debug object when --debug + --json
- [ ] Workflow run shows debug before execution
- [ ] No duplicate output in nested workflows
- [ ] All validation commands pass

## Completion Checklist

- [ ] Code follows discovered patterns (arrow functions, one-per-file, readonly)
- [ ] Error handling not needed (pure display, no failures possible)
- [ ] No loops — uses map/filter/sort
- [ ] Tests follow test patterns (describe/test, env mocking)
- [ ] No hardcoded values
- [ ] No `any` types
- [ ] No `let` declarations
- [ ] All imports use `.js` extension
- [ ] All type-only imports use `import type`

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Adding flag to all commands is tedious | LOW | LOW | Repetitive but mechanical — each change is 3 lines |
| Env var value `'true'`/`'1'` handling for JCLI_DEBUG | LOW | MEDIUM | OCLIF `Flags.boolean` with `env` handles string→bool conversion |
| Breaking existing tests | LOW | MEDIUM | Flag defaults to false, no behavior change without --debug |

## Notes

- The `JCLI_DEBUG` variable itself will appear in the debug output (since it starts with `JCLI_`). This is intentional — it confirms the feature is active.
- The workflow executor (`src/lib/workflow/executor.ts`) is NOT modified. Debug display happens at the command level only, preventing duplicate output during nested workflow calls via `executeNestedWorkflow`.
- Commands that don't have a `--json` flag simply use human-formatted output when --debug is active.

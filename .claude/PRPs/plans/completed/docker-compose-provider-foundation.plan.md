# Plan: Docker Compose Provider Foundation + Config Extension

## Summary
Create the docker-compose provider implementing the full `Provider` interface using `docker compose` CLI commands, extend the type system and provider registry to support it, and extend the state/config types with `composePath` and `services` fields. This is Phases 1+2 from the PRD (parallel, co-dependent).

## User Story
As a Jahia developer, I want to manage my test environment lifecycle via Docker Compose, so that I can leverage compose's native orchestration without the CLI needing to manage individual containers.

## Problem → Solution
Currently only native Docker and a placeholder JahiaCloud provider exist → Add a fully functional `docker-compose` provider that delegates lifecycle ops to `docker compose` CLI commands.

## Metadata
- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/docker-compose-provider.prd.md`
- **PRD Phase**: Phase 1 (Provider foundation) + Phase 2 (Config & types extension)
- **Estimated Files**: 14 new + 4 modified

---

## UX Design

N/A — internal change. This phase builds the provider infrastructure; user-facing changes come in later phases (init flow, command integration).

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 (critical) | `src/lib/providers/types.ts` | all | Provider interface contract |
| P0 (critical) | `src/lib/providers/index.ts` | all | Provider registry pattern |
| P0 (critical) | `src/lib/providers/jahiacloudv1/index.ts` | all | Minimal provider template |
| P1 (important) | `src/lib/providers/docker/index.ts` | all | Full provider implementation pattern |
| P1 (important) | `src/lib/config/types.ts` | all | Config types to extend |
| P1 (important) | `src/lib/state/types.ts` | all | State types to extend |
| P2 (reference) | `src/lib/providers/docker/network.ts` | all | Single-function-per-file pattern with execFile |
| P2 (reference) | `src/lib/providers/docker/stop-container.ts` | all | Minimal CLI wrapper pattern |
| P2 (reference) | `test/lib/providers/registry.test.ts` | all | Registry test pattern |
| P2 (reference) | `src/lib/config/validate-environment-config.ts` | all | Validation pattern |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Docker Compose CLI | https://docs.docker.com/compose/reference/ | `docker compose -f <file> -p <project> up/stop/start/down/ps/logs` |
| `docker compose ps --format json` | Docker docs | Returns JSON array with Name, Service, State, Health, Publishers |
| `docker compose down -v` | Docker docs | Removes containers, networks, AND named volumes |

---

## Patterns to Mirror

### NAMING_CONVENTION
```typescript
// SOURCE: src/lib/providers/docker/stop-container.ts:9
export const stopContainer = async (name: string): Promise<void> => {
  await execFileAsync('docker', ['stop', name]);
};
```
Arrow function, single responsibility, explicit return type, `execFileAsync` via promisify.

### FILE_STRUCTURE
```typescript
// SOURCE: src/lib/providers/docker/network.ts:1-4
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
```
Node imports first, then local imports. `execFileAsync` declared at module level.

### PROVIDER_OBJECT
```typescript
// SOURCE: src/lib/providers/jahiacloudv1/index.ts:12-20
export const jahiaCloudV1Provider: Provider = {
  name: 'jahiacloudv1',
  createEnvironment: () => Promise.reject(notImplementedError),
  // ...
};
```
Provider is a const object literal typed as `Provider`.

### REGISTRY_PATTERN
```typescript
// SOURCE: src/lib/providers/index.ts:6-10
export type ProviderName = 'docker' | 'jahiacloudv1';

const PROVIDER_REGISTRY: Readonly<Record<ProviderName, Provider>> = {
  docker: dockerProvider,
  jahiacloudv1: jahiaCloudV1Provider,
};
```
Union type for names, `Readonly<Record<...>>` for registry.

### ERROR_HANDLING
```typescript
// SOURCE: src/lib/providers/docker/index.ts:57-64
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
  return {
    success: false,
    environment: { name: envName, provider: 'docker', network: netName, components: [] },
    errors: [`Failed to create network: ${msg}`],
  };
}
```
Catch unknown, extract message, return structured error result.

### TEST_STRUCTURE
```typescript
// SOURCE: test/lib/providers/registry.test.ts:1-6
import { describe, test, expect } from 'vitest';
import { getProvider, listProviderNames } from '../../../src/lib/providers/index.js';

describe('provider registry', () => {
  test('listProviderNames returns all registered providers', () => {
    const names = listProviderNames();
    expect(names).toContain('docker');
```
Vitest, `describe`/`test`, import from source with `.js` extension.

### STATE_TYPE_PATTERN
```typescript
// SOURCE: src/lib/state/types.ts:35-43
export interface PersistedEnvironment {
  readonly name: string;
  readonly provider: string;
  readonly network: string;
  readonly components: readonly PersistedComponent[];
  readonly config: EnvironmentConfig;
  readonly createdAt: string;
  readonly stoppedAt?: string | undefined;
}
```
All `readonly`, optional fields use `?: T | undefined`.

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/lib/providers/docker-compose/types.ts` | CREATE | Provider-specific types (ComposeServiceStatus, ComposeProject) |
| `src/lib/providers/docker-compose/compose-up.ts` | CREATE | Run `docker compose up -d` |
| `src/lib/providers/docker-compose/compose-stop.ts` | CREATE | Run `docker compose stop` |
| `src/lib/providers/docker-compose/compose-start.ts` | CREATE | Run `docker compose start` |
| `src/lib/providers/docker-compose/compose-down.ts` | CREATE | Run `docker compose down -v` |
| `src/lib/providers/docker-compose/compose-ps.ts` | CREATE | Run `docker compose ps --format json` |
| `src/lib/providers/docker-compose/compose-logs.ts` | CREATE | Run `docker compose logs <service>` |
| `src/lib/providers/docker-compose/build-compose-args.ts` | CREATE | Build common args array (-f, -p) |
| `src/lib/providers/docker-compose/parse-ps-output.ts` | CREATE | Parse JSON output from `docker compose ps` |
| `src/lib/providers/docker-compose/index.ts` | CREATE | Provider object wiring all functions |
| `src/lib/providers/index.ts` | UPDATE | Add docker-compose to registry |
| `src/lib/config/types.ts` | UPDATE | Add composePath & services to EnvironmentConfig |
| `src/lib/config/validate-environment-config.ts` | UPDATE | Handle docker-compose config validation (no components required) |
| `src/lib/state/types.ts` | UPDATE | Add composePath to PersistedEnvironment |
| `test/lib/providers/docker-compose/build-compose-args.test.ts` | CREATE | Unit tests for arg builder |
| `test/lib/providers/docker-compose/parse-ps-output.test.ts` | CREATE | Unit tests for ps output parser |
| `test/lib/providers/registry.test.ts` | UPDATE | Add docker-compose to registry tests |

## NOT Building

- Init flow / prompts (Phase 4)
- Service metadata parsing / x-metadata (Phase 3)
- Compose file writer / include directives (Phase 5)
- Command integration changes (Phase 6)
- Anything using the component registry — this provider is compose-native

---

## Step-by-Step Tasks

### Task 1: Create docker-compose types
- **ACTION**: Create `src/lib/providers/docker-compose/types.ts`
- **IMPLEMENT**: Define interfaces for compose-specific data:
  - `ComposeServiceStatus` — parsed output from `docker compose ps --format json` (name, service, state, health, publishers)
  - `ComposeProject` — project context (composePath, projectName)
- **MIRROR**: STATE_TYPE_PATTERN — all `readonly` properties, optional with `| undefined`
- **IMPORTS**: None (pure type definitions)
- **GOTCHA**: `exactOptionalPropertyTypes` requires `?: T | undefined` not just `?: T`
- **VALIDATE**: `npm run build` compiles without errors

### Task 2: Create build-compose-args utility
- **ACTION**: Create `src/lib/providers/docker-compose/build-compose-args.ts`
- **IMPLEMENT**: Pure function `buildComposeArgs` that takes `{ composePath: string; projectName: string }` and returns the common args array `['-f', composePath, '-p', projectName]`
- **MIRROR**: NAMING_CONVENTION — arrow function, explicit return type
- **IMPORTS**: None (pure function)
- **GOTCHA**: Paths may contain spaces — handled by execFile's array args (no shell interpolation)
- **VALIDATE**: Unit test passes

### Task 3: Create compose-up
- **ACTION**: Create `src/lib/providers/docker-compose/compose-up.ts`
- **IMPLEMENT**: `composeUp` arrow function taking `{ composePath, projectName, onProgress? }`. Runs `docker compose -f <path> -p <project> up -d --wait`. Returns success/error result.
- **MIRROR**: FILE_STRUCTURE (execFileAsync), ERROR_HANDLING (catch, extract msg)
- **IMPORTS**: `node:child_process`, `node:util`, `./build-compose-args.js`
- **GOTCHA**: `--wait` flag waits for services to be healthy; may not be available on older compose versions. Use `up -d` without `--wait` as base, add `--wait` as optional param.
- **VALIDATE**: `npm run build` compiles

### Task 4: Create compose-stop
- **ACTION**: Create `src/lib/providers/docker-compose/compose-stop.ts`
- **IMPLEMENT**: `composeStop` arrow function. Runs `docker compose -f <path> -p <project> stop`. Returns list of stopped services.
- **MIRROR**: FILE_STRUCTURE, NAMING_CONVENTION
- **IMPORTS**: `node:child_process`, `node:util`, `./build-compose-args.js`
- **GOTCHA**: `docker compose stop` exits 0 even if some services weren't running
- **VALIDATE**: `npm run build` compiles

### Task 5: Create compose-start
- **ACTION**: Create `src/lib/providers/docker-compose/compose-start.ts`
- **IMPLEMENT**: `composeStart` arrow function. Runs `docker compose -f <path> -p <project> start`. Returns list of started services.
- **MIRROR**: FILE_STRUCTURE, NAMING_CONVENTION
- **IMPORTS**: `node:child_process`, `node:util`, `./build-compose-args.js`
- **GOTCHA**: `docker compose start` only starts existing stopped containers
- **VALIDATE**: `npm run build` compiles

### Task 6: Create compose-down
- **ACTION**: Create `src/lib/providers/docker-compose/compose-down.ts`
- **IMPLEMENT**: `composeDown` arrow function. Runs `docker compose -f <path> -p <project> down -v`. Returns success/error with details about what was removed.
- **MIRROR**: FILE_STRUCTURE, ERROR_HANDLING
- **IMPORTS**: `node:child_process`, `node:util`, `./build-compose-args.js`
- **GOTCHA**: `-v` removes named volumes; `--remove-orphans` cleans orphan containers. Include both flags.
- **VALIDATE**: `npm run build` compiles

### Task 7: Create compose-ps
- **ACTION**: Create `src/lib/providers/docker-compose/compose-ps.ts`
- **IMPLEMENT**: `composePs` arrow function. Runs `docker compose -f <path> -p <project> ps -a --format json`. Returns raw stdout string for parsing.
- **MIRROR**: FILE_STRUCTURE
- **IMPORTS**: `node:child_process`, `node:util`, `./build-compose-args.js`
- **GOTCHA**: `--format json` outputs one JSON object per line (NDJSON), not a JSON array. Some versions output a JSON array. Handle both.
- **VALIDATE**: `npm run build` compiles

### Task 8: Create parse-ps-output
- **ACTION**: Create `src/lib/providers/docker-compose/parse-ps-output.ts`
- **IMPLEMENT**: Pure function `parsePsOutput` taking raw stdout string, returns `readonly ComposeServiceStatus[]`. Handle both NDJSON (one object per line) and JSON array formats. Map to `ComponentStatus[]` for the Provider interface.
- **MIRROR**: NAMING_CONVENTION (pure arrow function)
- **IMPORTS**: `./types.js`, `../types.js` (for ComponentStatus mapping)
- **GOTCHA**: Empty output (no containers) should return empty array, not throw. Handle `State` field values: "running", "exited", "created", "restarting".
- **VALIDATE**: Unit test with sample JSON passes

### Task 9: Create compose-logs
- **ACTION**: Create `src/lib/providers/docker-compose/compose-logs.ts`
- **IMPLEMENT**: `composeLogs` arrow function. Runs `docker compose -f <path> -p <project> logs <service> --tail <n> --no-color`. Returns log string.
- **MIRROR**: FILE_STRUCTURE (like get-container-logs.ts)
- **IMPORTS**: `node:child_process`, `node:util`, `./build-compose-args.js`
- **GOTCHA**: Service name in compose ≠ container name. The user passes the service name (from compose file). `--no-color` strips ANSI codes for clean output.
- **VALIDATE**: `npm run build` compiles

### Task 10: Create provider index (wire everything)
- **ACTION**: Create `src/lib/providers/docker-compose/index.ts`
- **IMPLEMENT**: Export `dockerComposeProvider: Provider` object. Each method:
  - `createEnvironment`: calls `composeUp`, then `composePs` + `parsePsOutput` to build the result. Uses `composePath` from a closure/parameter strategy (reads from a config resolution — for now, throw if no compose path can be determined; full wiring comes in Phase 6).
  - `stopEnvironment`: calls `composeStop`, then builds StopResult
  - `startEnvironment`: calls `composeStart`, then builds StartResult
  - `destroyEnvironment`: calls `composeDown`, builds DestroyResult
  - `getEnvironmentStatus`: calls `composePs` + `parsePsOutput`, builds EnvironmentState
  - `checkHealth`: calls `getEnvironmentStatus`, maps health statuses
- **MIRROR**: PROVIDER_OBJECT pattern
- **IMPORTS**: All compose-* modules, provider types
- **GOTCHA**: The Provider interface takes `components: readonly ResolvedComponent[]` for `createEnvironment` but the docker-compose provider ignores this parameter — it gets compose path from state/config instead. For now, accept the param but don't use it. The provider needs `composePath` and `projectName` — these will be retrieved from persisted state in Phase 6. For this phase, define a helper `getComposeContext` that reads from state.
- **VALIDATE**: `npm run build` compiles; provider satisfies interface

### Task 11: Register provider
- **ACTION**: Update `src/lib/providers/index.ts`
- **IMPLEMENT**: Import `dockerComposeProvider`, add `'docker-compose'` to `ProviderName` union, add entry in `PROVIDER_REGISTRY`
- **MIRROR**: REGISTRY_PATTERN
- **IMPORTS**: `import { dockerComposeProvider } from './docker-compose/index.js';`
- **GOTCHA**: The hyphenated name `'docker-compose'` is valid as a string literal union member
- **VALIDATE**: `getProvider('docker-compose')` returns the provider

### Task 12: Extend EnvironmentConfig types
- **ACTION**: Update `src/lib/config/types.ts`
- **IMPLEMENT**: Add to `EnvironmentConfig`:
  ```typescript
  readonly composePath?: string | undefined;
  readonly services?: readonly string[] | undefined;
  ```
  `composePath` — path to master docker-compose.yml. `services` — selected service file names (without path prefix).
- **MIRROR**: STATE_TYPE_PATTERN (optional with `| undefined`)
- **IMPORTS**: None
- **GOTCHA**: Existing code accesses `config.components` which must remain valid for docker provider. The docker-compose provider will have empty `components: []` and use `composePath`/`services` instead.
- **VALIDATE**: `npm run build` compiles; existing tests still pass

### Task 13: Extend PersistedEnvironment types
- **ACTION**: Update `src/lib/state/types.ts`
- **IMPLEMENT**: Add to `PersistedEnvironment`:
  ```typescript
  readonly composePath?: string | undefined;
  ```
  This lets subsequent commands find the compose file without re-reading the config.
- **MIRROR**: STATE_TYPE_PATTERN
- **IMPORTS**: None
- **GOTCHA**: Existing state files won't have this field — that's fine since it's optional
- **VALIDATE**: `npm run build` compiles; existing tests pass

### Task 14: Update environment config validation
- **ACTION**: Update `src/lib/config/validate-environment-config.ts`
- **IMPLEMENT**: When `provider === 'docker-compose'`, don't require `components` array. Instead validate that `composePath` is a string. Extract composePath and services from raw config.
- **MIRROR**: Existing validation pattern in same file
- **IMPORTS**: None additional
- **GOTCHA**: Must not break existing docker/jahiacloudv1 validation path. Use early return for docker-compose case.
- **VALIDATE**: `npm run build` compiles; existing tests pass

### Task 15: Write unit tests for build-compose-args
- **ACTION**: Create `test/lib/providers/docker-compose/build-compose-args.test.ts`
- **IMPLEMENT**: Test that `buildComposeArgs` returns correct `-f` and `-p` args for various inputs including paths with spaces.
- **MIRROR**: TEST_STRUCTURE
- **IMPORTS**: vitest, `buildComposeArgs` from source
- **GOTCHA**: Use `.js` extension in import path
- **VALIDATE**: `npm test` passes

### Task 16: Write unit tests for parse-ps-output
- **ACTION**: Create `test/lib/providers/docker-compose/parse-ps-output.test.ts`
- **IMPLEMENT**: Test with:
  - NDJSON format (one object per line)
  - JSON array format
  - Empty output
  - Services in various states (running, exited, created)
  - Missing health field
- **MIRROR**: TEST_STRUCTURE
- **IMPORTS**: vitest, `parsePsOutput` from source
- **GOTCHA**: Use realistic sample output from `docker compose ps --format json`
- **VALIDATE**: `npm test` passes

### Task 17: Update registry test
- **ACTION**: Update `test/lib/providers/registry.test.ts`
- **IMPLEMENT**: Add assertions for `'docker-compose'` in `listProviderNames` and `getProvider('docker-compose')` returns valid provider
- **MIRROR**: Existing tests in same file
- **IMPORTS**: None additional
- **GOTCHA**: None
- **VALIDATE**: `npm test` passes

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| buildComposeArgs basic | `{composePath: './dc.yml', projectName: 'my-env'}` | `['-f', './dc.yml', '-p', 'my-env']` | No |
| buildComposeArgs spaces in path | `{composePath: '/path with spaces/dc.yml', ...}` | Array with space-containing path | Yes |
| parsePsOutput NDJSON | Multi-line JSON objects | Array of ComposeServiceStatus | No |
| parsePsOutput JSON array | `[{...}, {...}]` | Array of ComposeServiceStatus | No |
| parsePsOutput empty | `""` | `[]` | Yes |
| parsePsOutput exited service | State: "exited" | status: 'stopped' | No |
| parsePsOutput no health | Missing Health field | health: undefined | Yes |
| registry includes docker-compose | `listProviderNames()` | Contains 'docker-compose' | No |
| getProvider docker-compose | `getProvider('docker-compose')` | Valid provider object | No |

### Edge Cases Checklist
- [x] Empty `docker compose ps` output (no containers)
- [x] Path with spaces in composePath
- [x] NDJSON vs JSON array format for ps output
- [x] Missing/null health in ps output
- [x] docker-compose provider ignores components param gracefully
- [x] State file without composePath (backward compat)
- [x] Config validation: docker-compose without components is valid
- [x] Config validation: docker without composePath still works as before

---

## Validation Commands

### Static Analysis
```bash
npm run build
```
EXPECT: Zero TypeScript compilation errors

### Lint
```bash
npm run lint
```
EXPECT: Zero errors, zero warnings

### Unit Tests
```bash
npm test
```
EXPECT: All tests pass including new docker-compose tests

### Coverage
```bash
npm run test:coverage
```
EXPECT: Coverage ≥ 40% threshold maintained

### Manual Validation
- [ ] `getProvider('docker-compose')` returns provider with all 6 methods
- [ ] `getProvider('docker')` still works unchanged
- [ ] Config with `provider: docker-compose` and `composePath` validates correctly
- [ ] Config with `provider: docker` and `components` still validates correctly
- [ ] Existing tests all still pass (no regressions)

---

## Acceptance Criteria
- [ ] All 17 tasks completed
- [ ] All validation commands pass
- [ ] Tests written and passing for build-compose-args, parse-ps-output, registry
- [ ] No type errors
- [ ] No lint errors
- [ ] Provider interface fully satisfied (all 6 methods implemented)
- [ ] Zero coupling to docker provider or component registry

## Completion Checklist
- [ ] Code follows discovered patterns (arrow functions, one per file, execFileAsync)
- [ ] Error handling matches codebase style (catch → extract msg → return structured result)
- [ ] No `any` types
- [ ] No `let` declarations
- [ ] No loop statements
- [ ] All standalone functions use arrow syntax
- [ ] One function per file in `src/lib/providers/docker-compose/`
- [ ] All imports use `.js` extension
- [ ] All type-only imports use `import type`
- [ ] Optional properties use `?: T | undefined`
- [ ] All properties are `readonly`

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `docker compose ps --format json` output format varies | Low | Medium | Parse both NDJSON and array formats |
| Provider needs compose path at runtime but interface doesn't pass it | Medium | Low | Use state file lookup helper; full wiring in Phase 6 |
| Extending EnvironmentConfig breaks existing validation | Low | High | Guard new logic behind `provider === 'docker-compose'` check |

## Notes
- The docker-compose provider is intentionally self-contained. It does NOT import from `src/lib/components/` at all.
- The `createEnvironment` method receives `components` (required by interface) but the docker-compose implementation ignores this — it reads `composePath` from persisted state. Full integration happens in Phase 6.
- The `EnvironmentConfig.components` field remains mandatory for the docker provider but is optional/empty for docker-compose. The validation layer handles this split.
- For the `--project-name` flag, use the environment name (e.g., `env-a1b2c3d4`) to ensure isolation between multiple environments.

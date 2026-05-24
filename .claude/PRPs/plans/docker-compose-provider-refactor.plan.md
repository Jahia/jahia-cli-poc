# Plan: Docker Compose Provider — Full Refactor (Phases 1–8)

## Summary

Replace the native Docker provider with a docker-compose-based provider. This involves: fetching environment scaffolding from a remote repository, discovering services via `config.yml` + `x-metadata`, prompting users for service selection, assembling a master `docker-compose.yml` with `include` directives, implementing a thin provider that delegates lifecycle to `docker compose` commands, refactoring the init flow, removing old native docker code, and updating state/config types.

## User Story

As a Jahia module developer or QA engineer,
I want to manage my test environment lifecycle via docker-compose,
So that I can use standard tooling alongside jahia-cli without environment-specific logic locked inside the CLI.

## Problem → Solution

20+ files of custom Docker orchestration logic → Thin wrapper delegating to `docker compose` with service definitions living in external scaffolding.

## Metadata

- **Complexity**: XL
- **Source PRD**: `.claude/PRPs/prds/docker-compose-provider-refactor.prd.md`
- **PRD Phase**: All phases (1–8) — unified plan
- **Estimated Files**: ~30 files created/modified, ~25 files deleted

---

## UX Design

### Before

```
jahia-cli init
  → Config file name?
  → Directory?
  → Environment name?
  → Jahia Docker image?
  → Add SMTP server?
  → Tests scaffolding repo?
  → Scaffolding path?
  → Version?
  → [writes config YAML]

jahia-cli environment create
  → [native docker: create network, pull images, run containers one by one]
```

### After

```
jahia-cli init
  → Config file name?
  → Directory?
  → Tests scaffolding repo?          (fetches scaffolding first)
  → Scaffolding path?
  → Version?
  → [clones scaffolding]
  → Provider? [docker / jahiacloudv1]
  → [reads config.yml from scaffolding/environment/services/]
  → [Per group, ordered by config:]
      "Jahia Core" → auto-included (always_included)
      "Database" → [select one or skip]
      "Cluster Nodes" → [select zero or more]
      "Search Engine" → [select zero or more]
      ...
  → [assembles docker-compose.yml with include directives]
  → [writes config YAML with composePath]

jahia-cli environment create
  → docker compose -f <composePath> up -d
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Init order | env config → scaffolding | scaffolding → provider → services | Scaffolding must be available before service prompting |
| Service selection | Hardcoded jahia + optional SMTP | Dynamic from config.yml groups | Driven by scaffolding metadata |
| Environment create | Native docker commands (20 files) | Single `docker compose up -d` | Massive simplification |
| Environment stop | Stop each container individually | `docker compose stop` | One command |
| Environment start | Start each container individually | `docker compose start` | One command |
| Environment delete | Remove containers + network + volumes | `docker compose down -v` | One command |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `src/lib/tests/clone-scaffolding.ts` | all | Pattern to reuse for environment scaffolding clone |
| P0 | `src/lib/providers/types.ts` | all | Provider interface to simplify |
| P0 | `src/lib/providers/index.ts` | all | Provider registry pattern |
| P0 | `src/commands/init.ts` | all | Init flow to refactor |
| P0 | `src/commands/environment/create.ts` | all | Create command to simplify |
| P1 | `src/lib/config/types.ts` | all | Config types to extend |
| P1 | `src/lib/state/types.ts` | all | State types to adapt |
| P1 | `src/lib/config/defaults.ts` | all | Default constants |
| P1 | `test/lib/tests/clone-scaffolding.test.ts` | all | Test pattern for mocking execFile |
| P2 | `src/commands/tests/init.ts` | all | Similar command pattern (clone + process scaffolding) |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Docker Compose `include` | https://docs.docker.com/compose/how-tos/multiple-compose-files/include/ | Requires v2.20+, `include:` is top-level, paths relative to compose file |
| Docker Compose CLI | https://docs.docker.com/compose/reference/ | `up -d`, `stop`, `start`, `down -v`, `ps --format json` |
| x-metadata extensions | Docker Compose spec | Top-level `x-` keys are ignored by compose, free for tooling |

---

## Patterns to Mirror

### NAMING_CONVENTION
```typescript
// SOURCE: src/lib/tests/clone-scaffolding.ts:14-26
export const buildCloneArgs = (params: {
  readonly version: string;
  readonly repositoryUrl: string;
  readonly checkoutDir: string;
}): readonly string[] => [...]
```
Arrow functions, explicit return types, readonly params, kebab-case file names.

### ERROR_HANDLING
```typescript
// SOURCE: src/lib/tests/clone-scaffolding.ts:76-80
await access(scaffoldingDir).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(
    `Scaffolding directory not found at "${scaffoldingDir}" after cloning ${repositoryUrl}@${version}: ${message}`,
  );
});
```
Catch unknown, check instanceof Error, re-throw with context.

### EXEC_FILE_PATTERN
```typescript
// SOURCE: src/lib/tests/clone-scaffolding.ts:1-12
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
```

### TEST_MOCK_PATTERN
```typescript
// SOURCE: test/lib/tests/clone-scaffolding.test.ts:6-16
const { mockExecFileAsync } = vi.hoisted(() => ({ mockExecFileAsync: vi.fn() }));
vi.mock('node:child_process', () => {
  const execFile = vi.fn();
  Object.defineProperty(execFile, Symbol.for('nodejs.util.promisify.custom'), {
    value: mockExecFileAsync,
    configurable: true,
    writable: true,
  });
  return { execFile };
});
```

### TYPE_DEFINITIONS
```typescript
// SOURCE: src/lib/state/types.ts:35-51
export interface PersistedEnvironment {
  readonly name: string;
  readonly provider: string;
  readonly network: string;
  readonly components: readonly PersistedComponent[];
  readonly config: EnvironmentConfig;
  readonly createdAt: string;
}
```
All readonly, optional with `| undefined`, interface not type.

### PROVIDER_INTERFACE
```typescript
// SOURCE: src/lib/providers/types.ts:88-100
export interface Provider {
  readonly name: string;
  readonly createEnvironment: (...) => Promise<CreateResult>;
  readonly stopEnvironment: (envName: string) => Promise<StopResult>;
  readonly startEnvironment: (envName: string) => Promise<StartResult>;
  readonly destroyEnvironment: (envName: string) => Promise<DestroyResult>;
  readonly getEnvironmentStatus: (envName: string) => Promise<EnvironmentState>;
  readonly checkHealth: (envName: string) => Promise<HealthCheckResult>;
}
```

### COMMAND_STRUCTURE
```typescript
// SOURCE: src/commands/tests/init.ts:124-157
export default class TestsInit extends Command {
  static override description = '...';
  static override examples = [...];
  static override flags = { config: Flags.string(...), json: Flags.boolean(...) };
  public async run(): Promise<void> { /* thin orchestration */ }
}
```

---

## Files to Change

### New files to CREATE

| File | Purpose |
|---|---|
| `src/lib/environment/types.ts` | Types for environment scaffolding (config.yml schema, x-metadata, service selection) |
| `src/lib/environment/clone-environment-scaffolding.ts` | Clone the environment services from scaffolding repo |
| `src/lib/environment/parse-services-config.ts` | Parse `config.yml` (groups, selection rules, ordering) |
| `src/lib/environment/parse-service-metadata.ts` | Parse `x-metadata` from individual service YAML files |
| `src/lib/environment/discover-services.ts` | Discover all services in a directory, return with metadata |
| `src/lib/environment/prompt-service-selection.ts` | Prompt user for service selection per group |
| `src/lib/environment/assemble-compose-file.ts` | Generate docker-compose.yml with include directives |
| `src/lib/environment/validate-selection.ts` | Validate dependencies (requires) are satisfied |
| `src/lib/environment/index.ts` | Barrel re-exports |
| `src/lib/providers/docker-compose/index.ts` | Docker Compose provider implementation |
| `src/lib/providers/docker-compose/run-compose.ts` | Helper to shell out to `docker compose` |
| `src/lib/providers/docker-compose/parse-compose-ps.ts` | Parse `docker compose ps --format json` |
| `test/lib/environment/clone-environment-scaffolding.test.ts` | Tests for cloning |
| `test/lib/environment/parse-services-config.test.ts` | Tests for config parsing |
| `test/lib/environment/parse-service-metadata.test.ts` | Tests for x-metadata parsing |
| `test/lib/environment/discover-services.test.ts` | Tests for service discovery |
| `test/lib/environment/prompt-service-selection.test.ts` | Tests for selection logic |
| `test/lib/environment/assemble-compose-file.test.ts` | Tests for compose assembly |
| `test/lib/environment/validate-selection.test.ts` | Tests for dependency validation |
| `test/lib/providers/docker-compose/run-compose.test.ts` | Tests for compose CLI wrapper |
| `test/lib/providers/docker-compose/parse-compose-ps.test.ts` | Tests for ps parsing |

### Existing files to UPDATE

| File | Action | Justification |
|---|---|---|
| `src/lib/providers/types.ts` | UPDATE | Simplify Provider interface — createEnvironment takes composePath instead of components |
| `src/lib/providers/index.ts` | UPDATE | Replace docker import with docker-compose, update registry |
| `src/lib/config/types.ts` | UPDATE | Add `composePath` field to EnvironmentConfig, add environment scaffolding config |
| `src/lib/config/defaults.ts` | UPDATE | Add default environment scaffolding path constant |
| `src/lib/state/types.ts` | UPDATE | Simplify PersistedEnvironment (no components array, add composePath) |
| `src/commands/init.ts` | UPDATE | Refactor flow: scaffolding → provider → services → compose assembly |
| `src/commands/environment/create.ts` | UPDATE | Simplify to call docker compose up |
| `src/commands/environment/stop.ts` | UPDATE | Simplify to call docker compose stop |
| `src/commands/environment/start.ts` | UPDATE | Simplify to call docker compose start |
| `src/commands/environment/delete.ts` | UPDATE | Simplify to call docker compose down -v |

### Files to DELETE

| Directory/File | Reason |
|---|---|
| `src/lib/providers/docker/` (entire directory) | Replaced by docker-compose provider |
| `src/lib/components/` (entire directory) | Service definitions now live in scaffolding |
| All tests referencing old docker provider and components | Dead code |

## NOT Building

- Custom service logic in jahia-cli (all in scaffolding)
- `.env` file generation (user provides or scaffolding templates it)
- Re-assembly of compose file after init
- Multi-environment support
- VictoriaLogs integration (removed or becomes a scaffolding service)
- Health check logic (compose native healthchecks)

---

## Step-by-Step Tasks

### Task 1: Define environment types

- **ACTION**: Create `src/lib/environment/types.ts` with interfaces for config.yml schema, x-metadata, and service selection
- **IMPLEMENT**:
  ```typescript
  export interface ServiceGroupConfig {
    readonly label: string;
    readonly description: string;
    readonly selection: 'always_included' | 'at_most_one' | 'zero_or_more';
    readonly order: number;
  }

  export interface ServicesConfig {
    readonly groups: Readonly<Record<string, ServiceGroupConfig>>;
  }

  export interface ServiceDependency {
    readonly service?: string | undefined;
    readonly group?: string | undefined;
  }

  export interface ServiceMetadata {
    readonly name: string;
    readonly description: string;
    readonly group: string;
    readonly requires: readonly ServiceDependency[];
    readonly notes?: string | undefined;
  }

  export interface DiscoveredService {
    readonly filename: string;
    readonly metadata: ServiceMetadata;
  }

  export interface ServiceSelection {
    readonly filename: string;
    readonly metadata: ServiceMetadata;
  }

  export interface EnvironmentScaffoldingConfig {
    readonly repository: string;
    readonly path: string;
    readonly version: string;
  }
  ```
- **MIRROR**: TYPE_DEFINITIONS pattern — all readonly, interface not type
- **IMPORTS**: None (pure type file)
- **GOTCHA**: `exactOptionalPropertyTypes` requires `| undefined` on optional fields
- **VALIDATE**: `npm run build` compiles with no errors

### Task 2: Clone environment scaffolding

- **ACTION**: Create `src/lib/environment/clone-environment-scaffolding.ts`
- **IMPLEMENT**: Reuse the pattern from `clone-scaffolding.ts` but target the `environment/` subdirectory within scaffolding. Return path to the `environment/` directory containing `docker-compose.yml` and `services/`.
  ```typescript
  export const cloneEnvironmentScaffolding = async (params: {
    readonly version?: string | undefined;
    readonly workDir: string;
    readonly repositoryUrl?: string | undefined;
    readonly scaffoldingPath?: string | undefined;
  }): Promise<EnvironmentScaffoldingResult> => { ... }
  ```
- **MIRROR**: EXEC_FILE_PATTERN, ERROR_HANDLING
- **IMPORTS**: `execFile` from `node:child_process`, `access`, `mkdir` from `node:fs/promises`, `join` from `node:path`, `promisify` from `node:util`
- **GOTCHA**: The environment directory is at `scaffolding/environment/` inside the cloned repo — different from the tests scaffolding at `scaffolding/`
- **VALIDATE**: Unit test with mocked execFile confirms correct paths

### Task 3: Parse services config.yml

- **ACTION**: Create `src/lib/environment/parse-services-config.ts`
- **IMPLEMENT**: Read and parse `services/config.yml`, validate structure, return typed `ServicesConfig`
  ```typescript
  export const parseServicesConfig = (yamlContent: string): ServicesConfig => { ... }
  ```
- **MIRROR**: Pattern from `parse-scaffolding-config.ts` — validate each field, throw descriptive errors
- **IMPORTS**: `yaml` from `js-yaml` (already a dependency)
- **GOTCHA**: Validate that `selection` is one of the three allowed values
- **VALIDATE**: Unit tests with valid/invalid YAML inputs

### Task 4: Parse service x-metadata

- **ACTION**: Create `src/lib/environment/parse-service-metadata.ts`
- **IMPLEMENT**: Extract `x-metadata` from a service YAML file content
  ```typescript
  export const parseServiceMetadata = (yamlContent: string, filename: string): ServiceMetadata => { ... }
  ```
- **MIRROR**: ERROR_HANDLING pattern — throw with context including filename
- **IMPORTS**: `yaml` from `js-yaml`
- **GOTCHA**: `x-metadata` is a top-level key; `requires` may be empty array or missing
- **VALIDATE**: Unit test with real jahia.yml content from scaffolding

### Task 5: Discover services

- **ACTION**: Create `src/lib/environment/discover-services.ts`
- **IMPLEMENT**: Read all `.yml` files in a services directory (excluding `config.yml`), parse their x-metadata, return as `DiscoveredService[]` grouped by config groups
  ```typescript
  export const discoverServices = async (servicesDir: string): Promise<readonly DiscoveredService[]> => { ... }
  ```
- **MIRROR**: NAMING_CONVENTION — arrow function, explicit return type
- **IMPORTS**: `readdir`, `readFile` from `node:fs/promises`, `join` from `node:path`
- **GOTCHA**: Filter out `config.yml` from the list; handle files without valid x-metadata gracefully
- **VALIDATE**: Unit test with a temp directory containing sample service files

### Task 6: Prompt for service selection

- **ACTION**: Create `src/lib/environment/prompt-service-selection.ts`
- **IMPLEMENT**: For each group (ordered by `order`), present appropriate prompt based on `selection` rule:
  - `always_included` → auto-select, log info
  - `at_most_one` → `select` prompt with "None" option
  - `zero_or_more` → `checkbox` prompt
  ```typescript
  export const promptServiceSelection = async (params: {
    readonly groups: ServicesConfig;
    readonly services: readonly DiscoveredService[];
    readonly onInfo?: (message: string) => void | undefined;
  }): Promise<readonly ServiceSelection[]> => { ... }
  ```
- **MIRROR**: Prompt patterns from `src/commands/init.ts` using `@inquirer/prompts`
- **IMPORTS**: `select`, `checkbox` from `@inquirer/prompts`
- **GOTCHA**: Sort groups by `order` field; only show services belonging to each group
- **VALIDATE**: Manual testing (prompts are hard to unit test); unit test the grouping/sorting logic separately

### Task 7: Validate service selection dependencies

- **ACTION**: Create `src/lib/environment/validate-selection.ts`
- **IMPLEMENT**: Check that all `requires` constraints are satisfied by the selection
  ```typescript
  export const validateSelection = (
    selection: readonly ServiceSelection[],
    allServices: readonly DiscoveredService[],
  ): readonly string[] => { ... } // returns error messages, empty = valid
  ```
- **MIRROR**: Pure function, returns data (errors array) instead of throwing
- **IMPORTS**: None (pure logic)
- **GOTCHA**: `requires` can reference either a specific `service` or a `group` — check both
- **VALIDATE**: Unit tests with valid selections, missing deps, group deps

### Task 8: Assemble compose file

- **ACTION**: Create `src/lib/environment/assemble-compose-file.ts`
- **IMPLEMENT**: Generate the master docker-compose.yml from the base template + selected services as include directives
  ```typescript
  export const assembleComposeFile = (params: {
    readonly baseComposePath: string;
    readonly selectedServices: readonly ServiceSelection[];
    readonly servicesDir: string;
  }): string => { ... }
  ```
  Output format:
  ```yaml
  include:
    - path: ./services/jahia.yml
    - path: ./services/postgres-18.yml

  networks:
    stack:
  ```
- **MIRROR**: NAMING_CONVENTION — pure function, returns string content
- **IMPORTS**: None (string assembly)
- **GOTCHA**: Paths in `include` must be relative to the docker-compose.yml location; use `./services/<filename>`
- **VALIDATE**: Unit test verifies correct YAML output for given selections

### Task 9: Create docker-compose CLI wrapper

- **ACTION**: Create `src/lib/providers/docker-compose/run-compose.ts`
- **IMPLEMENT**: Shell out to `docker compose` with proper args
  ```typescript
  export const runCompose = async (params: {
    readonly composePath: string;
    readonly args: readonly string[];
    readonly cwd?: string | undefined;
  }): Promise<{ readonly stdout: string; readonly stderr: string }> => { ... }
  ```
- **MIRROR**: EXEC_FILE_PATTERN
- **IMPORTS**: `execFile` from `node:child_process`, `promisify` from `node:util`, `dirname` from `node:path`
- **GOTCHA**: Use `-f` flag to specify compose file path; `cwd` should default to compose file's directory
- **VALIDATE**: Unit test with mocked execFile

### Task 10: Parse compose ps output

- **ACTION**: Create `src/lib/providers/docker-compose/parse-compose-ps.ts`
- **IMPLEMENT**: Parse JSON output from `docker compose ps --format json`
  ```typescript
  export const parseComposePsOutput = (stdout: string): readonly ComponentStatus[] => { ... }
  ```
- **MIRROR**: Pure function, explicit return type
- **IMPORTS**: Types from `../types.js`
- **GOTCHA**: `--format json` outputs one JSON object per line (NDJSON), not a JSON array
- **VALIDATE**: Unit test with sample `docker compose ps` JSON output

### Task 11: Implement docker-compose provider

- **ACTION**: Create `src/lib/providers/docker-compose/index.ts`
- **IMPLEMENT**: Provider that delegates to docker compose commands
  ```typescript
  export const dockerComposeProvider: Provider = {
    name: 'docker',
    createEnvironment: async (envName, composePath, onProgress?) => {
      await runCompose({ composePath, args: ['up', '-d'] });
      // ... parse status, return CreateResult
    },
    stopEnvironment: async (envName, composePath) => {
      await runCompose({ composePath, args: ['stop'] });
    },
    startEnvironment: async (envName, composePath) => {
      await runCompose({ composePath, args: ['start'] });
    },
    destroyEnvironment: async (envName, composePath) => {
      await runCompose({ composePath, args: ['down', '-v'] });
    },
    getEnvironmentStatus: async (envName, composePath) => {
      const { stdout } = await runCompose({ composePath, args: ['ps', '--format', 'json'] });
      return parseComposePsOutput(stdout);
    },
    checkHealth: async (envName, composePath) => { ... },
  };
  ```
- **MIRROR**: PROVIDER_INTERFACE pattern
- **IMPORTS**: `runCompose`, `parseComposePsOutput`, types
- **GOTCHA**: Provider interface will need updating — current signature passes `ResolvedComponent[]` for create, but new provider needs `composePath` instead. Update interface in Task 12.
- **VALIDATE**: Integration test against a real compose file (or mocked)

### Task 12: Simplify Provider interface

- **ACTION**: Update `src/lib/providers/types.ts`
- **IMPLEMENT**: Change `createEnvironment` to accept `composePath` instead of components. Simplify other methods to accept composePath.
  ```typescript
  export interface Provider {
    readonly name: string;
    readonly createEnvironment: (
      envName: string,
      composePath: string,
      onProgress?: (message: string) => void,
    ) => Promise<CreateResult>;
    readonly stopEnvironment: (envName: string, composePath: string) => Promise<StopResult>;
    readonly startEnvironment: (envName: string, composePath: string) => Promise<StartResult>;
    readonly destroyEnvironment: (envName: string, composePath: string) => Promise<DestroyResult>;
    readonly getEnvironmentStatus: (envName: string, composePath: string) => Promise<EnvironmentState>;
    readonly checkHealth: (envName: string, composePath: string) => Promise<HealthCheckResult>;
  }
  ```
- **MIRROR**: TYPE_DEFINITIONS
- **IMPORTS**: Keep existing result types
- **GOTCHA**: This is a breaking change to the interface — all callers must be updated
- **VALIDATE**: `npm run build` after updating all callers

### Task 13: Update config types

- **ACTION**: Update `src/lib/config/types.ts`
- **IMPLEMENT**: Add `composePath` to EnvironmentConfig, add `EnvironmentScaffoldingConfig` for scaffolding reference
  ```typescript
  export interface EnvironmentConfig {
    readonly name: string;
    readonly provider: string;
    readonly composePath?: string | undefined;
    readonly scaffolding?: EnvironmentScaffoldingConfig | undefined;
  }
  // Remove: readonly components: readonly ConfigComponent[];
  ```
- **MIRROR**: TYPE_DEFINITIONS
- **GOTCHA**: Removing `components` is a breaking change — ensure all references are updated
- **VALIDATE**: `npm run build`

### Task 14: Update state types

- **ACTION**: Update `src/lib/state/types.ts`
- **IMPLEMENT**: Simplify PersistedEnvironment — remove components array, add composePath
  ```typescript
  export interface PersistedEnvironment {
    readonly name: string;
    readonly provider: string;
    readonly composePath: string;
    readonly config: EnvironmentConfig;
    readonly createdAt: string;
    readonly stoppedAt?: string | undefined;
  }
  ```
- **MIRROR**: TYPE_DEFINITIONS
- **GOTCHA**: Remove `PersistedComponent`, `ComponentEndpoints` — no longer needed
- **VALIDATE**: `npm run build`

### Task 15: Update provider registry

- **ACTION**: Update `src/lib/providers/index.ts`
- **IMPLEMENT**: Replace docker import with docker-compose
  ```typescript
  import { dockerComposeProvider } from './docker-compose/index.js';
  const PROVIDER_REGISTRY = { docker: dockerComposeProvider, jahiacloudv1: jahiaCloudV1Provider };
  ```
- **MIRROR**: Existing registry pattern
- **VALIDATE**: `npm run build`

### Task 16: Refactor init command

- **ACTION**: Rewrite `src/commands/init.ts` with new flow
- **IMPLEMENT**: 
  1. Prompt for config path (as today)
  2. Prompt for scaffolding config (repo, path, version)
  3. Clone scaffolding to temp dir
  4. Prompt for provider choice
  5. If docker: read config.yml, discover services, prompt selections, validate deps, assemble compose file, write it
  6. Assemble and write config YAML with composePath
- **MIRROR**: COMMAND_STRUCTURE from tests/init.ts
- **IMPORTS**: All new environment functions
- **GOTCHA**: Temp dir cleanup in finally block; compose file path relative to project
- **VALIDATE**: Manual test of full init flow

### Task 17: Simplify environment create command

- **ACTION**: Rewrite `src/commands/environment/create.ts`
- **IMPLEMENT**: Load config → get composePath → call provider.createEnvironment(name, composePath) → save state
- **MIRROR**: COMMAND_STRUCTURE
- **GOTCHA**: Remove all component resolution logic; composePath from config
- **VALIDATE**: `npm run build && npm test`

### Task 18: Simplify environment stop/start/delete commands

- **ACTION**: Update `src/commands/environment/stop.ts`, `start.ts`, `delete.ts`
- **IMPLEMENT**: Load state → get composePath → call provider method → update state
- **MIRROR**: Existing command patterns but much simpler
- **VALIDATE**: `npm run build && npm test`

### Task 19: Remove native docker provider

- **ACTION**: Delete `src/lib/providers/docker/` directory entirely
- **IMPLEMENT**: `rm -rf src/lib/providers/docker/`
- **GOTCHA**: Ensure no remaining imports reference this directory
- **VALIDATE**: `npm run build`

### Task 20: Remove old components library

- **ACTION**: Delete `src/lib/components/` directory (or reduce to what's still needed)
- **IMPLEMENT**: Check if any remaining code references components; remove if fully unused
- **GOTCHA**: `src/commands/environment/create.ts` currently imports from components — must be updated first (Task 17)
- **VALIDATE**: `npm run build && npm test`

### Task 21: Create barrel export and cleanup

- **ACTION**: Create `src/lib/environment/index.ts` barrel file
- **IMPLEMENT**: Re-export all public functions from the environment module
- **VALIDATE**: `npm run build`

### Task 22: Write tests for new modules

- **ACTION**: Create test files for all new `src/lib/environment/` and `src/lib/providers/docker-compose/` modules
- **IMPLEMENT**: Follow TEST_MOCK_PATTERN for execFile mocking; pure function tests for parsers/assemblers
- **MIRROR**: TEST_MOCK_PATTERN, test structure from `test/lib/tests/clone-scaffolding.test.ts`
- **VALIDATE**: `npm test` — all pass

### Task 23: Remove dead tests

- **ACTION**: Delete test files for removed modules (docker provider, components)
- **IMPLEMENT**: Find and remove all test files that reference deleted source
- **VALIDATE**: `npm test` — no broken imports

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| parseServicesConfig | Valid config.yml YAML | ServicesConfig with typed groups | No |
| parseServicesConfig | Invalid selection value | Throws descriptive error | Yes |
| parseServiceMetadata | jahia.yml content | ServiceMetadata with group="core" | No |
| parseServiceMetadata | File without x-metadata | Throws with filename in message | Yes |
| discoverServices | Dir with 3 .yml + config.yml | 3 DiscoveredService items (config excluded) | No |
| assembleComposeFile | 2 selected services | YAML with 2 include paths + networks | No |
| assembleComposeFile | 0 selected (empty) | Just networks block | Yes |
| validateSelection | Service requires group "database", selection has postgres | Empty errors | No |
| validateSelection | Service requires group "database", no db selected | Error about missing dep | Yes |
| runCompose | composePath + args | Calls execFile with correct args | No |
| parseComposePsOutput | NDJSON from docker compose ps | ComponentStatus array | No |
| parseComposePsOutput | Empty stdout | Empty array | Yes |

### Edge Cases Checklist

- [ ] Empty services directory (only config.yml)
- [ ] config.yml with no groups
- [ ] Service file with malformed YAML
- [ ] Service file missing x-metadata
- [ ] Circular dependencies in requires
- [ ] Docker compose not installed / wrong version
- [ ] Scaffolding repo unreachable
- [ ] Compose file path with spaces
- [ ] All groups are always_included (no prompts needed)

---

## Validation Commands

### Static Analysis
```bash
npm run build
```
EXPECT: Zero errors

### Linting
```bash
npm run lint
```
EXPECT: Zero errors, zero warnings

### Unit Tests
```bash
npm test
```
EXPECT: All tests pass

### Coverage
```bash
npm run test:coverage
```
EXPECT: Meets 40% threshold

### Manual Validation
- [ ] `jahia-cli init` completes with docker provider selection
- [ ] Generated docker-compose.yml is valid (`docker compose config`)
- [ ] `jahia-cli environment create` starts all services
- [ ] `docker compose ps` shows running containers
- [ ] `jahia-cli environment stop` stops containers
- [ ] `jahia-cli environment start` restarts them
- [ ] `jahia-cli environment delete` removes everything
- [ ] `docker compose up -d` works directly on generated file

---

## Acceptance Criteria

- [ ] All tasks completed
- [ ] All validation commands pass
- [ ] Tests written and passing for all new modules
- [ ] No type errors
- [ ] No lint errors
- [ ] Old native docker provider completely removed
- [ ] Old components library removed (or minimal remnant)
- [ ] Init flow follows new order: scaffolding → provider → services → assembly
- [ ] Environment lifecycle works via docker compose
- [ ] Users can use `docker compose` directly on generated file

## Completion Checklist

- [ ] Code follows discovered patterns (arrow functions, readonly, explicit types)
- [ ] Error handling matches codebase style (catch unknown, re-throw with context)
- [ ] One function per file in `src/lib/environment/`
- [ ] All imports use `.js` extension
- [ ] All type-only imports use `import type`
- [ ] No `any` types
- [ ] No `let` declarations
- [ ] No loop statements
- [ ] Tests follow test patterns (describe/test, vi.hoisted mock)
- [ ] No hardcoded values (use constants/config)

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Breaking changes to Provider interface affect JahiaCloudV1 | Medium | High | Update jahiacloudv1 provider signature in parallel |
| Removing components breaks things still referenced elsewhere | Medium | Medium | grep for all imports before deleting |
| Docker Compose version incompatibility | Low | Medium | Document minimum version, add doctor check later |
| Large scope leads to partial completion | Medium | Medium | Phases are ordered so partial completion is still usable |

## Notes

- The `jahiacloudv1` provider will need its interface updated to match the new Provider signature. It's currently a placeholder, so this should be straightforward.
- Consider keeping the state file version at `1` but changing its shape — existing state files won't be compatible, which is acceptable for this dev/test tool.
- The `EnvironmentConfig.components` field removal means the config YAML schema changes. Old config files will need migration or will just fail with a clear error.
- The scaffolding environment path defaults to `scaffolding/environment/` within the cloned repo but is configurable.

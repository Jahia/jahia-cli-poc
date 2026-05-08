# Plan: Environment Core Refactor — Jahia + VictoriaLogs

## Summary

Refactor the component system to make Jahia the core component running with embedded Derby (no external database dependencies), and transparently deploy VictoriaLogs alongside every environment to aggregate all container logs into an HTTP-queryable API optimized for AI agents. Introduce a category-based component type system that supports future extensions (databases, search, applications, utilities, custom containers).

## User Story

As a Jahia developer, I want to run `jahia-cli environment create` and get a working Jahia with queryable logs, so that I can start developing immediately without configuring infrastructure.

## Problem → Solution

**Current state**: Flat component registry where Jahia depends on pgsql+elasticsearch, interactive mode is a raw checkbox list, no log aggregation.

**Desired state**: Jahia starts standalone with Derby, VictoriaLogs auto-deployed for centralized logging, extensible category system ready for future components.

## Metadata

- **Complexity**: Large
- **Source PRD**: `.claude/PRPs/prds/environment-creation-refactor.prd.md`
- **PRD Phase**: Phase 1 — Core Refactor
- **Estimated Files**: ~18 files (8 modify, 10 create/replace)

---

## UX Design

### Before

```
$ jahia-cli environment create
? Select components to include in your environment:
  ☐ jahia — Jahia DXM processing server
  ☐ jahia-browsing — Jahia DXM browsing-only node
  ☐ pgsql — PostgreSQL database server
  ☐ elasticsearch — Elasticsearch search engine
```

### After

```
$ jahia-cli environment create

  ? Jahia version: (8.2.1.0) █

  ✓ Environment: env-a1b2c3d4
  ✓ VictoriaLogs started (log aggregation)
  ✓ Jahia 8.2.1.0 started (Derby database)

  Environment created successfully!

  Jahia:      http://localhost:8080
  Logs API:   http://localhost:9428

  Query logs: curl 'http://localhost:9428/select/logsql/query?query=*&limit=100'
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Component selection | Multi-checkbox of all components | Ask Jahia version only | VictoriaLogs auto-added |
| Dependencies | Jahia requires pgsql+elasticsearch | Jahia has no deps (Derby) | Simplified |
| Log viewing | `logs --component jahia` tails docker | `logs --component jahia` OR query VictoriaLogs API | Both paths work |
| Output after create | Generic component table | Endpoints + log query example | AI-friendly |

---

## Mandatory Reading

Files that MUST be read before implementing:

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `src/lib/components/types.ts` | all | Type system to refactor |
| P0 | `src/lib/components/index.ts` | all | Registry pattern to update |
| P0 | `src/lib/components/jahia.ts` | all | Core component to modify |
| P0 | `src/lib/providers/docker/container.ts` | 19-74 | buildRunArgs — must add log-driver |
| P0 | `src/lib/providers/docker/index.ts` | all | createEnvironment — must add VictoriaLogs |
| P1 | `src/commands/environment/create.ts` | all | Command to refactor interactive mode |
| P1 | `src/lib/config/types.ts` | all | Config types to extend |
| P1 | `src/lib/state/types.ts` | all | State types for VictoriaLogs endpoint |
| P2 | `test/lib/components/registry.test.ts` | all | Test pattern to follow |
| P2 | `test/lib/providers/docker.test.ts` | all | Docker test pattern |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| VictoriaLogs Docker | https://docs.victoriametrics.com/victorialogs/ | Single container, port 9428, syslog input on 514 |
| VictoriaLogs query API | https://docs.victoriametrics.com/victorialogs/querying/ | `GET /select/logsql/query?query=<LogsQL>&limit=N` |
| Docker syslog driver | https://docs.docker.com/config/containers/logging/syslog/ | `--log-driver=syslog --log-opt syslog-address=tcp://host:514` |
| Docker log-opt tag | https://docs.docker.com/config/containers/logging/log_tags/ | `--log-opt tag={{.Name}}` for container identification |

---

## Patterns to Mirror

Code patterns discovered in the codebase. Follow these exactly.

### NAMING_CONVENTION

```typescript
// SOURCE: src/lib/components/jahia.ts:1-2
import type { ComponentDefinition } from './types.js';

export const jahia: ComponentDefinition = {
```

```typescript
// SOURCE: src/lib/providers/docker/volume.ts:9
export const volumeName = (envName: string, volumeBaseName: string): string =>
  `jahia-cli-${envName}-${volumeBaseName}`;
```

### ERROR_HANDLING

```typescript
// SOURCE: src/lib/providers/docker/index.ts:100-132
try {
  await createComponentVolumes(envName, component);
  const containerId = await runContainer({...});
  return { status: {...}, };
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  return { status: {...}, error: `Failed to start ${component.definition.name}: ${msg}` };
}
```

### COMPONENT_DEFINITION

```typescript
// SOURCE: src/lib/components/elasticsearch.ts:1-25
import type { ComponentDefinition } from './types.js';

export const elasticsearch: ComponentDefinition = {
  name: 'elasticsearch',
  description: 'Elasticsearch search engine for Jahia content indexing',
  image: 'docker.elastic.co/elasticsearch/elasticsearch',
  defaultTag: '7.17.24',
  ports: [{ container: 9200, host: 9200 }],
  env: {...},
  volumes: [...],
  healthcheck: {...},
  dependsOn: [],
  networkAliases: ['elasticsearch', 'es'],
};
```

### TEST_STRUCTURE

```typescript
// SOURCE: test/lib/components/registry.test.ts:1-10
import { describe, expect, test } from 'vitest';

import { getComponent, listComponentNames, listComponents, resolveComponent }
  from '../../../src/lib/components/index.js';

describe('Component Registry', () => {
  test('listComponentNames returns all registered names', () => {
    const names = listComponentNames();
    expect(names).toContain('jahia');
  });
});
```

### DOCKER_RUN_ARGS

```typescript
// SOURCE: src/lib/providers/docker/container.ts:31-73
const args: string[] = ['run', '-d', '--name', containerName(params.envName, params.componentName)];
args.push('--network', params.networkName);
params.networkAliases.forEach((alias) => { args.push('--network-alias', alias); });
params.ports.forEach((port) => {
  const proto = port.protocol ?? 'tcp';
  args.push('-p', `${String(port.host)}:${String(port.container)}/${proto}`);
});
Object.entries(params.env).forEach(([key, value]) => { args.push('-e', `${key}=${value}`); });
```

### PROVIDER_CREATE_FLOW

```typescript
// SOURCE: src/lib/providers/docker/index.ts:182-223
createEnvironment: async (envName, components): Promise<CreateResult> => {
  const netName = networkName(envName);
  try { await createNetwork(envName); } catch (error) { return failure; }
  const ordered = sortByDependencies(components);
  const results = await ordered.reduce(async (chain, component) => {
    const result = await runSingleComponent(envName, netName, component);
    return {...};
  }, Promise.resolve({...}));
  return { success: results.errors.length === 0, environment: {...}, errors: [...] };
};
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/lib/components/types.ts` | UPDATE | Add `category`, `providerSupport`, `isTransparent`, `multiInstance` fields |
| `src/lib/components/jahia.ts` | UPDATE | Remove pgsql/elasticsearch deps, use Derby defaults |
| `src/lib/components/victorialogs.ts` | CREATE | New transparent infrastructure component |
| `src/lib/components/index.ts` | UPDATE | Update registry with new components, add category helpers |
| `src/lib/components/pgsql.ts` | DELETE | Remove from active registry (keep file for Phase 3) |
| `src/lib/components/elasticsearch.ts` | DELETE | Remove from active registry (keep file for Phase 4) |
| `src/lib/components/jahia-browsing.ts` | DELETE | Remove from active registry (keep file for Phase 4) |
| `src/lib/providers/docker/container.ts` | UPDATE | Add `logDriver` params to `buildRunArgs` |
| `src/lib/providers/docker/index.ts` | UPDATE | Auto-inject VictoriaLogs, configure log forwarding |
| `src/commands/environment/create.ts` | UPDATE | Refactor interactive mode, auto-add transparent components |
| `src/lib/output/formatter.ts` | UPDATE | Add VictoriaLogs endpoint to output |
| `test/lib/components/registry.test.ts` | UPDATE | Reflect new registry contents |
| `test/lib/providers/docker.test.ts` | UPDATE | Test log-driver args |
| `test/commands/environment/create.test.ts` | UPDATE | Test new interactive flow |
| `test/lib/components/victorialogs.test.ts` | CREATE | Unit tests for VictoriaLogs component |

## NOT Building

- JahiaCloudV1 provider implementation (placeholder stays as-is)
- Database components (pgsql, mariadb) — Phase 3
- Elasticsearch, jCustomer, browsing nodes — Phase 4
- Custom container support from config — Phase 5
- Utility containers (openldap, mailpit, cypress) — Phase 6
- Log retention/rotation configuration
- Web UI for log viewing

---

## Step-by-Step Tasks

### Task 1: Extend ComponentDefinition types

- **ACTION**: Add new fields to `ComponentDefinition` interface in `src/lib/components/types.ts`
- **IMPLEMENT**:
  ```typescript
  export type ComponentCategory =
    | 'core'
    | 'infrastructure'
    | 'database'
    | 'search'
    | 'application'
    | 'utility'
    | 'custom';

  export interface ComponentDefinition {
    readonly name: string;
    readonly description: string;
    readonly image: string;
    readonly defaultTag: string;
    readonly ports: readonly PortMapping[];
    readonly env: Readonly<Record<string, string>>;
    readonly volumes: readonly VolumeMount[];
    readonly healthcheck?: HealthcheckConfig | undefined;
    readonly dependsOn: readonly string[];
    readonly networkAliases: readonly string[];
    // New fields:
    readonly category: ComponentCategory;
    readonly isTransparent: boolean;  // Auto-deployed, not user-selectable
    readonly multiInstance: boolean;  // Can have multiple instances (e.g., jcustomer-1, jcustomer-2)
    readonly providerSupport: readonly ('docker' | 'jahiacloudv1')[];
  }
  ```
- **MIRROR**: NAMING_CONVENTION — interfaces use `readonly`, `| undefined` for optional
- **IMPORTS**: None additional needed
- **GOTCHA**: `exactOptionalPropertyTypes` is enabled — optional fields need `| undefined`
- **VALIDATE**: `npm run build` passes with no type errors

### Task 2: Create VictoriaLogs component definition

- **ACTION**: Create `src/lib/components/victorialogs.ts`
- **IMPLEMENT**:
  ```typescript
  import type { ComponentDefinition } from './types.js';

  export const victorialogs: ComponentDefinition = {
    name: 'victorialogs',
    description: 'VictoriaLogs log aggregation for AI-friendly log consumption',
    image: 'victoriametrics/victoria-logs',
    defaultTag: 'v1.15.0-victorialogs',
    ports: [
      { container: 9428, host: 9428 },   // HTTP query API
      { container: 514, host: 5140 },     // Syslog input (mapped to non-privileged port)
    ],
    env: {},
    volumes: [
      { name: 'victorialogs-data', containerPath: '/vlogs' },
    ],
    healthcheck: {
      command: ['CMD-SHELL', 'wget -qO- http://localhost:9428/health || exit 1'],
      intervalSeconds: 5,
      timeoutSeconds: 3,
      retries: 3,
      startPeriodSeconds: 5,
    },
    dependsOn: [],
    networkAliases: ['victorialogs', 'logs'],
    category: 'infrastructure',
    isTransparent: true,
    multiInstance: false,
    providerSupport: ['docker'],
  };
  ```
- **MIRROR**: COMPONENT_DEFINITION pattern
- **IMPORTS**: `import type { ComponentDefinition } from './types.js';`
- **GOTCHA**: VictoriaLogs syslog listens on port 514 inside container — map to 5140 on host to avoid privilege issues. The `--syslogListenAddr.tcp` flag will be passed via Docker CMD override or env.
- **VALIDATE**: Import and type-check passes

### Task 3: Update Jahia component for Derby default

- **ACTION**: Modify `src/lib/components/jahia.ts` to remove external DB/ES dependencies
- **IMPLEMENT**:
  ```typescript
  import type { ComponentDefinition } from './types.js';

  export const jahia: ComponentDefinition = {
    name: 'jahia',
    description: 'Jahia DXM (Digital Experience Manager) processing server',
    image: 'jahia/jahia-ee',
    defaultTag: '8.2.1.0',
    ports: [
      { container: 8080, host: 8080 },
      { container: 8101, host: 8101 },
    ],
    env: {
      SUPER_USER_PASSWORD: 'root1234',
      MAX_RAM_PERCENTAGE: '80',
      PROCESSING_SERVER: 'true',
      EXECUTE_PROVISIONING_SCRIPT:
        'https://raw.githubusercontent.com/Jahia/jahia-cli/main/provisioning/default.yaml',
    },
    volumes: [
      { name: 'jahia-data', containerPath: '/var/jahia/repository' },
    ],
    healthcheck: {
      command: [
        'CMD-SHELL',
        'curl -f http://localhost:8080/modules/healthcheck || exit 1',
      ],
      intervalSeconds: 30,
      timeoutSeconds: 10,
      retries: 10,
      startPeriodSeconds: 120,
    },
    dependsOn: [],
    networkAliases: ['jahia'],
    category: 'core',
    isTransparent: false,
    multiInstance: false,
    providerSupport: ['docker', 'jahiacloudv1'],
  };
  ```
- **MIRROR**: COMPONENT_DEFINITION
- **IMPORTS**: Same as before
- **GOTCHA**: Remove `JAHIA_DATABASE_URL`, `JAHIA_DATABASE_USER`, `JAHIA_DATABASE_PASSWORD`, `JAHIA_ELASTICSEARCH_ADDRESSES` — Jahia uses Derby by default when these are absent.
- **VALIDATE**: No references to pgsql or elasticsearch in the component

### Task 4: Remove old components, update registry

- **ACTION**: Delete `pgsql.ts`, `elasticsearch.ts`, `jahia-browsing.ts` from `src/lib/components/`. Update `index.ts` to register only `jahia` and `victorialogs`, plus add category-filtering helpers.
- **IMPLEMENT**:
  ```typescript
  import type { ComponentCategory, ComponentDefinition, ComponentOverrides, ResolvedComponent } from './types.js';
  import { jahia } from './jahia.js';
  import { victorialogs } from './victorialogs.js';

  export const COMPONENT_REGISTRY: Readonly<Record<string, ComponentDefinition>> = {
    jahia,
    victorialogs,
  };

  export const listComponentNames = (): readonly string[] => Object.keys(COMPONENT_REGISTRY);

  export const listComponents = (): readonly ComponentDefinition[] =>
    Object.values(COMPONENT_REGISTRY);

  export const listUserSelectableComponents = (): readonly ComponentDefinition[] =>
    Object.values(COMPONENT_REGISTRY).filter((c) => !c.isTransparent);

  export const listTransparentComponents = (): readonly ComponentDefinition[] =>
    Object.values(COMPONENT_REGISTRY).filter((c) => c.isTransparent);

  export const listComponentsByCategory = (category: ComponentCategory): readonly ComponentDefinition[] =>
    Object.values(COMPONENT_REGISTRY).filter((c) => c.category === category);

  export const getComponent = (name: string): ComponentDefinition | undefined =>
    COMPONENT_REGISTRY[name];

  export const resolveComponent = (
    definition: ComponentDefinition,
    overrides: ComponentOverrides = {},
  ): ResolvedComponent => ({
    definition,
    overrides,
    effectiveTag: overrides.tag ?? definition.defaultTag,
    effectiveEnv: { ...definition.env, ...overrides.env },
    effectivePorts: overrides.ports ?? definition.ports,
  });

  export type { ComponentCategory, ComponentDefinition, ComponentOverrides, ResolvedComponent } from './types.js';
  ```
- **MIRROR**: NAMING_CONVENTION — arrow functions, `readonly` returns
- **IMPORTS**: Add `victorialogs`, remove old imports
- **GOTCHA**: Removing the old files will break existing tests — must update tests in same task set
- **VALIDATE**: `npm run build` — no missing import errors

### Task 5: Add log-driver support to Docker container builder

- **ACTION**: Extend `buildRunArgs` in `src/lib/providers/docker/container.ts` to accept optional log driver configuration
- **IMPLEMENT**: Add a `logConfig` optional parameter to `buildRunArgs`:
  ```typescript
  export interface LogDriverConfig {
    readonly driver: string;
    readonly options: Readonly<Record<string, string>>;
  }

  // Add to buildRunArgs params:
  readonly logConfig?: LogDriverConfig | undefined;

  // Add to buildRunArgs body after healthcheck section:
  if (params.logConfig) {
    args.push('--log-driver', params.logConfig.driver);
    Object.entries(params.logConfig.options).forEach(([key, value]) => {
      args.push('--log-opt', `${key}=${value}`);
    });
  }
  ```
- **MIRROR**: DOCKER_RUN_ARGS — same `forEach` + `push` pattern
- **IMPORTS**: None additional
- **GOTCHA**: The `LogDriverConfig` interface should go in `container.ts` since it's Docker-specific, not in the general component types.
- **VALIDATE**: Existing tests still pass (logConfig is optional)

### Task 6: Update Docker provider to inject VictoriaLogs and configure log forwarding

- **ACTION**: Modify `src/lib/providers/docker/index.ts` to:
  1. Always start VictoriaLogs first (as transparent infrastructure)
  2. Configure all other containers to use syslog driver pointing to VictoriaLogs
- **IMPLEMENT**:
  - Add a helper `getTransparentInfrastructure` that resolves VictoriaLogs
  - In `createEnvironment`: start VictoriaLogs first (no log driver — it uses default json-file), then start user components with `--log-driver=syslog --log-opt syslog-address=tcp://victorialogs:514 --log-opt tag={{.Name}}`
  - VictoriaLogs itself uses Docker's default json-file driver (can't log to itself)
  - Pass the `logConfig` to `runContainer` for non-VictoriaLogs containers
  - Also update `runContainer` to accept and forward `logConfig`
- **MIRROR**: PROVIDER_CREATE_FLOW
- **IMPORTS**: `import { listTransparentComponents, resolveComponent } from '../../components/index.js';`
- **GOTCHA**: VictoriaLogs must be healthy before other containers start (they need to connect to its syslog port). Use `--log-opt syslog-address=tcp://victorialogs:514` — this uses the Docker network alias, not host port. The syslog driver on the other containers will forward logs via the internal Docker network.
- **VALIDATE**: `buildRunArgs` includes log-driver flags for non-VictoriaLogs containers

### Task 7: Refactor interactive mode in environment create command

- **ACTION**: Update `src/commands/environment/create.ts` to:
  1. In interactive mode: ask only Jahia version (with default), auto-add transparent components
  2. Auto-inject transparent components regardless of mode (interactive, flags, config file)
- **IMPLEMENT**:
  - Replace `promptForComponents` with `promptForJahiaVersion` that asks version only
  - Add `injectTransparentComponents` helper that adds VictoriaLogs to any config
  - Update `resolveConfig` method to always call `injectTransparentComponents`
  - Update output to show VictoriaLogs endpoint
- **MIRROR**: Interactive prompts use `@inquirer/prompts` (already imported)
- **IMPORTS**: `import { input } from '@inquirer/prompts';` (replace `checkbox`)
- **GOTCHA**: Config file mode should also get VictoriaLogs injected — transparent components are added at the provider level, not config level. Better to handle injection in the Docker provider's `createEnvironment` rather than in the command.
- **VALIDATE**: `--help` output still works, interactive mode prompts correctly

### Task 8: Update output formatter for VictoriaLogs endpoint

- **ACTION**: Update `src/lib/output/formatter.ts` to include VictoriaLogs endpoint in create output
- **IMPLEMENT**: Add endpoint info to both human and JSON formatters:
  ```typescript
  // In formatCreateResultHuman, after network/provider lines:
  lines.push(`  Logs API: http://localhost:9428`);
  lines.push('');
  lines.push(`  Query logs: curl 'http://localhost:9428/select/logsql/query?query=*&limit=100'`);

  // In JSON output, add:
  logsEndpoint: 'http://localhost:9428',
  logsQuery: 'http://localhost:9428/select/logsql/query?query=*&limit=100',
  ```
- **MIRROR**: Existing formatter patterns (lines array, JSON.stringify)
- **IMPORTS**: None additional
- **GOTCHA**: The port 9428 comes from VictoriaLogs component definition — could extract from resolved components for accuracy, but hardcoding is fine for Phase 1.
- **VALIDATE**: Output includes Logs API line

### Task 9: Update tests for new registry

- **ACTION**: Rewrite `test/lib/components/registry.test.ts` to test new registry (jahia + victorialogs only), add `test/lib/components/victorialogs.test.ts`
- **IMPLEMENT**:
  - Registry test: check `listComponentNames` returns `['jahia', 'victorialogs']`
  - Check `listUserSelectableComponents` returns only jahia
  - Check `listTransparentComponents` returns only victorialogs
  - Check `listComponentsByCategory('core')` returns jahia
  - Verify jahia has no `dependsOn`
  - VictoriaLogs test: verify definition fields, category, isTransparent
- **MIRROR**: TEST_STRUCTURE
- **IMPORTS**: vitest `describe`, `expect`, `test`
- **GOTCHA**: Don't reference removed components (pgsql, elasticsearch, jahia-browsing)
- **VALIDATE**: `npm test` passes

### Task 10: Update Docker provider tests for log-driver

- **ACTION**: Update `test/lib/providers/docker.test.ts` to test `buildRunArgs` with `logConfig`
- **IMPLEMENT**:
  ```typescript
  test('buildRunArgs includes log-driver when logConfig provided', () => {
    const args = buildRunArgs({
      ...baseParams,
      logConfig: {
        driver: 'syslog',
        options: { 'syslog-address': 'tcp://victorialogs:514', 'tag': '{{.Name}}' },
      },
    });
    expect(args).toContain('--log-driver');
    expect(args).toContain('syslog');
    expect(args).toContain('--log-opt');
    expect(args).toContain('syslog-address=tcp://victorialogs:514');
    expect(args).toContain('tag={{.Name}}');
  });
  ```
- **MIRROR**: TEST_STRUCTURE, existing `buildRunArgs` tests
- **IMPORTS**: Same as existing test file
- **GOTCHA**: Ensure `baseParams` matches new interface (with optional logConfig)
- **VALIDATE**: `npm test` passes

### Task 11: Update environment create command tests

- **ACTION**: Update `test/commands/environment/create.test.ts` to reflect new interactive mode
- **IMPLEMENT**:
  - Update `buildConfigFromFlags` test to work with new component set
  - Integration test for `--help` should reflect new description/flags
  - Remove references to `--component pgsql` or `--component elasticsearch`
- **MIRROR**: TEST_STRUCTURE
- **IMPORTS**: Same
- **GOTCHA**: Integration tests run CLI subprocess — no mocking needed, just assert output
- **VALIDATE**: `npm test` passes

### Task 12: Build, lint, and full test pass

- **ACTION**: Run full quality pipeline
- **IMPLEMENT**: Execute `npm run build && npm run lint && npm test`
- **MIRROR**: N/A
- **IMPORTS**: N/A
- **GOTCHA**: Build regenerates OCLIF manifest — must pass for command discovery to work. Lint has zero-warning policy. Tests may have other files referencing removed components.
- **VALIDATE**: All three commands exit 0

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `listComponentNames` returns jahia + victorialogs | - | `['jahia', 'victorialogs']` | No |
| `listUserSelectableComponents` excludes transparent | - | Only jahia returned | No |
| `listTransparentComponents` returns infra | - | Only victorialogs returned | No |
| `listComponentsByCategory('core')` | 'core' | `[jahia]` | No |
| `getComponent('victorialogs')` returns definition | 'victorialogs' | VictoriaLogs def | No |
| `resolveComponent(jahia)` no deps | jahia def | `dependsOn: []` | No |
| `buildRunArgs` with logConfig | params + logConfig | args contain `--log-driver syslog` | No |
| `buildRunArgs` without logConfig | params only | No log-driver in args | No |
| `buildConfigFromFlags` with jahia only | `['jahia']` | Valid config | No |
| VictoriaLogs has correct ports | - | 9428, 514 | No |
| VictoriaLogs is transparent | - | `isTransparent: true` | No |

### Edge Cases Checklist

- [ ] Empty component list in config file (error)
- [ ] Unknown component name in flags (error with available list)
- [ ] VictoriaLogs port 9428 already in use (Docker error propagated)
- [ ] No Docker daemon running (error propagated from createNetwork)
- [ ] `--json` mode includes logsEndpoint field

---

## Validation Commands

### Static Analysis

```bash
npm run build
```
EXPECT: Zero TypeScript errors, OCLIF manifest regenerated

### Lint

```bash
npm run lint
```
EXPECT: Zero errors, zero warnings

### Unit Tests

```bash
npm test
```
EXPECT: All tests pass

### Full Coverage

```bash
npm run test:coverage
```
EXPECT: Coverage ≥ 40% threshold maintained

### Manual Validation

- [ ] `npx tsx bin/dev.js environment create --help` shows updated help
- [ ] Help does not reference pgsql, elasticsearch, jahia-browsing
- [ ] Build produces clean `oclif.manifest.json` with updated commands

---

## Acceptance Criteria

- [ ] `jahia` component uses Derby (no DB env vars, no dependsOn)
- [ ] `victorialogs` component defined with syslog + HTTP API ports
- [ ] Component registry contains only `jahia` and `victorialogs`
- [ ] `listUserSelectableComponents()` returns only non-transparent components
- [ ] `listTransparentComponents()` returns VictoriaLogs
- [ ] `buildRunArgs` supports optional log-driver configuration
- [ ] Docker provider injects VictoriaLogs transparently during create
- [ ] Non-VictoriaLogs containers use syslog driver pointing to VictoriaLogs
- [ ] Interactive mode asks Jahia version only (not component selection)
- [ ] Output shows VictoriaLogs endpoint (human + JSON modes)
- [ ] All tests pass
- [ ] Lint passes with zero warnings
- [ ] Build succeeds

## Completion Checklist

- [ ] Code follows arrow function convention (no standalone function declarations)
- [ ] Error handling uses `err instanceof Error ? err.message : String(err)` pattern
- [ ] All new interfaces use `readonly` properties
- [ ] `import type` used for type-only imports
- [ ] `.js` extensions in all imports
- [ ] No `let`, no loops — use `const`, `map`, `filter`, `reduce`
- [ ] No `any` types
- [ ] Tests use `describe` / `test` (not `it`)
- [ ] Guard against `undefined` with early-return (not `!` assertions)

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Syslog driver connection timing | Medium | Medium | Start VictoriaLogs first, wait for health before starting Jahia |
| Docker syslog driver not available | Low | High | It's built into Docker Engine; no extra install needed |
| Removing components breaks other test files | Medium | Low | Search all test files for references to removed components |
| VictoriaLogs image tag changes | Low | Low | Pin to specific tag in component definition |

## Notes

- VictoriaLogs uses `--syslogListenAddr.tcp=:514` flag to enable syslog TCP listener. This should be passed as a container command/entrypoint arg. The official Docker image supports this via command-line flags.
- The syslog driver on user containers will use the Docker network DNS name `victorialogs` to reach the syslog port — no host port needed for this internal traffic.
- VictoriaLogs HTTP API on port 9428 is exposed to the host for AI agents to query logs directly via `curl`.
- Container names are embedded in syslog tags via `--log-opt tag={{.Name}}` for easy filtering in LogsQL queries like `_stream:{container="jahia-cli-env-abc-jahia"}`.

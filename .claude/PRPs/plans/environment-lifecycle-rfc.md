# RFC: Environment Lifecycle Management

**Source PRD**: `.claude/PRPs/prds/environment-lifecycle-management.prd.md`
**Status**: READY FOR EXECUTION
**Risk Level**: Tier 2 — multi-file behavior changes, moderate integration risk

---

## Dependency Graph

```
        ┌──────────┐
        │  UNIT-0   │  Merge PR #3 (foundation)
        └─────┬─────┘
              │
        ┌─────▼─────┐
        │  UNIT-1   │  State persistence layer
        └─────┬─────┘
              │
        ┌─────▼─────┐
        │  UNIT-2   │  Provider interface extension
        └─────┬─────┘
              │
        ┌─────┴─────┐
        │           │
  ┌─────▼─────┐ ┌──▼──────┐
  │  UNIT-3   │ │ UNIT-4  │  Lifecycle cmds ║ Logs & List
  └─────┬─────┘ └──┬──────┘
        │           │
        └─────┬─────┘
              │
        ┌─────▼─────┐
        │  UNIT-5   │  Single-environment guard
        └─────┬─────┘
              │
        ┌─────▼─────┐
        │  UNIT-6   │  Integration wiring + create updates
        └─────┬─────┘
              │
        ┌─────▼─────┐
        │  UNIT-7   │  Documentation & output polish
        └──────────┘
```

---

## Work Units

### UNIT-0: Merge Foundation PR

| Field | Value |
|-------|-------|
| id | `UNIT-0` |
| depends_on | `[]` |
| scope | Merge PR #3 (`feat/environment-foundation`) into `main` |
| risk_level | Tier 1 |
| rollback_plan | Revert merge commit |

**Acceptance Tests**:
- [ ] PR #3 merged to `main`
- [ ] `npm run build && npm run lint && npm test` passes on `main`
- [ ] `environment create` and `environment doctor` commands available

---

### UNIT-1: State Persistence Layer

| Field | Value |
|-------|-------|
| id | `UNIT-1` |
| depends_on | `[UNIT-0]` |
| scope | New `src/lib/state/` module with types, read/write/delete, and Docker reconciliation |
| risk_level | Tier 2 |
| rollback_plan | Delete `src/lib/state/` directory and revert Provider/command changes |

**Files to create**:

| File | Purpose |
|------|---------|
| `src/lib/state/types.ts` | `PersistedEnvironment`, `PersistedComponent`, `StateFile` interfaces |
| `src/lib/state/store.ts` | `loadState`, `saveState`, `deleteState`, `getActiveEnvironment`, `stateFilePath` pure functions |
| `src/lib/state/reconcile.ts` | `reconcileWithDocker` — cross-checks state file against live `docker inspect` |
| `test/lib/state/store.test.ts` | Unit tests for state read/write/delete (use temp dirs) |
| `test/lib/state/reconcile.test.ts` | Unit tests for reconciliation logic (mock docker output) |

**Key interfaces**:

```typescript
interface PersistedComponent {
  readonly name: string;
  readonly image: string;
  readonly tag: string;
  readonly containerId: string;
}

interface PersistedEnvironment {
  readonly name: string;
  readonly provider: string;
  readonly network: string;
  readonly components: readonly PersistedComponent[];
  readonly config: EnvironmentConfig;  // original config for restart
  readonly createdAt: string;
  readonly stoppedAt?: string | undefined;
}

interface StateFile {
  readonly version: 1;
  readonly environment?: PersistedEnvironment | undefined;
}
```

**Design decisions**:
- State file at `<stateDir>/state.json` (default `~/.jahia-cli/`)
- Configurable via `JAHIA_CLI_STATE_DIR` env var or `--state-dir` global flag
- Single environment stored (not an array) — enforces v1 constraint
- `config` field stored so `start` can re-derive resolved components
- `reconcileWithDocker` returns state with updated statuses, marks containers as `stale` if missing

**Acceptance Tests**:
- [ ] `saveState` creates file at correct path
- [ ] `loadState` returns `undefined` when no file exists
- [ ] `deleteState` removes file
- [ ] `getActiveEnvironment` returns environment or `undefined`
- [ ] State directory auto-created if missing
- [ ] `JAHIA_CLI_STATE_DIR` env var overrides default path
- [ ] `npm run build && npm run lint && npm test` passes

---

### UNIT-2: Provider Interface Extension

| Field | Value |
|-------|-------|
| id | `UNIT-2` |
| depends_on | `[UNIT-1]` |
| scope | Add `destroyEnvironment`, `startEnvironment`, `stopEnvironment` to Provider interface + Docker implementation |
| risk_level | Tier 2 |
| rollback_plan | Revert Provider type changes and Docker provider additions |

**Files to modify**:

| File | Changes |
|------|---------|
| `src/lib/providers/types.ts` | Add 3 new methods to `Provider` interface + `DestroyResult`, `StartResult`, `StopResult` types |
| `src/lib/providers/docker/index.ts` | Implement `destroyEnvironment` (rm containers, rm network, rm volumes), `stopEnvironment` (docker stop), `startEnvironment` (docker start) |
| `src/lib/providers/docker/container.ts` | Add `stopContainer`, `startContainer` functions |
| `src/lib/providers/jahiacloudv1/index.ts` | Add placeholder methods (reject with Error) |
| `test/lib/providers/docker.test.ts` | Tests for `stopContainer`, `startContainer`, new `buildRunArgs` edge cases |

**New Provider methods**:

```typescript
readonly destroyEnvironment: (envName: string) => Promise<DestroyResult>;
readonly stopEnvironment: (envName: string) => Promise<StopResult>;
readonly startEnvironment: (envName: string) => Promise<StartResult>;
```

**Docker implementation notes**:
- `stopEnvironment`: `docker stop` each container (reverse dependency order)
- `startEnvironment`: `docker start` each container (dependency order)
- `destroyEnvironment`: `docker rm -f` containers → `docker network rm` → `docker volume rm`

**Acceptance Tests**:
- [ ] `stopContainer` calls `docker stop <name>`
- [ ] `startContainer` calls `docker start <name>`
- [ ] `destroyEnvironment` removes containers, network, and volumes
- [ ] `stopEnvironment` stops in reverse dependency order
- [ ] `startEnvironment` starts in dependency order
- [ ] JahiaCloudV1 placeholder methods reject gracefully
- [ ] `npm run build && npm run lint && npm test` passes

---

### UNIT-3: Lifecycle Commands (start, stop, delete)

| Field | Value |
|-------|-------|
| id | `UNIT-3` |
| depends_on | `[UNIT-2]` |
| scope | Three new commands: `environment start`, `environment stop`, `environment delete` |
| risk_level | Tier 2 |
| rollback_plan | Delete command files, revert manifest |

**Files to create**:

| File | Purpose |
|------|---------|
| `src/commands/environment/start.ts` | Start a stopped environment — reads state, calls provider.startEnvironment, updates state |
| `src/commands/environment/stop.ts` | Stop a running environment — reads state, calls provider.stopEnvironment, updates state |
| `src/commands/environment/delete.ts` | Destroy environment — calls provider.destroyEnvironment, deletes state |
| `test/commands/environment/start.test.ts` | Unit tests for helper functions + integration test |
| `test/commands/environment/stop.test.ts` | Unit tests + integration test |
| `test/commands/environment/delete.test.ts` | Unit tests + integration test |

**Files to modify**:

| File | Changes |
|------|---------|
| `src/commands/environment/create.ts` | After successful create, persist state via `saveState` |
| `src/lib/output/formatter.ts` | Add formatters for start/stop/delete results |

**Command patterns** (all follow same structure):
1. Parse flags (`--name` optional if single-env guard, `--json`, `--provider`)
2. Load state → validate environment exists
3. Call provider method
4. Update/delete state
5. Format and output result

**Acceptance Tests**:
- [ ] `environment stop` stops running environment and updates state
- [ ] `environment start` restarts stopped environment and updates state
- [ ] `environment delete` destroys everything and removes state file
- [ ] All commands fail gracefully when no environment exists
- [ ] All commands support `--json` flag
- [ ] `environment create` now persists state after success
- [ ] `npm run build && npm run lint && npm test` passes

---

### UNIT-4: Logs & List Commands

| Field | Value |
|-------|-------|
| id | `UNIT-4` |
| depends_on | `[UNIT-2]` |
| scope | Two new commands: `environment logs`, `environment list` |
| risk_level | Tier 1 |
| rollback_plan | Delete command files |

**Files to create**:

| File | Purpose |
|------|---------|
| `src/commands/environment/logs.ts` | View container logs — wraps `docker logs`, supports `--follow`, `--tail`, `--component` filter |
| `src/commands/environment/list.ts` | Show all components and their live status — reads state + reconciles with Docker |
| `src/lib/providers/docker/logs.ts` | `getContainerLogs`, `streamContainerLogs` functions |
| `test/commands/environment/logs.test.ts` | Unit + integration tests |
| `test/commands/environment/list.test.ts` | Unit + integration tests |
| `test/lib/providers/docker/logs.test.ts` | Tests for log helper functions |

**Files to modify**:

| File | Changes |
|------|---------|
| `src/lib/output/formatter.ts` | Add `formatListHuman`, `formatListJson`, `formatLogsJson` formatters |

**`environment logs` flags**:
- `--component` / `-C`: filter to specific component (required if multiple)
- `--follow` / `-f`: stream logs (like `docker logs -f`)
- `--tail` / `-t`: number of lines (default: 100)
- `--json`: wrap output in JSON structure

**`environment list` output**:
```
Environment: my-env (running)
Provider: docker
Network: jahia-cli-my-env

  Component          Status      Health      Container ID
  ──────────────────────────────────────────────────────────
  pgsql              running     healthy     a1b2c3d4e5f6
  jahia              running     starting    f6e5d4c3b2a1
  jahia-browsing     running     starting    1a2b3c4d5e6f
```

**Acceptance Tests**:
- [ ] `environment logs` shows container output
- [ ] `--component` flag filters to specific container
- [ ] `--tail` limits output lines
- [ ] `--json` wraps logs in structured format
- [ ] `environment list` shows all components with live status
- [ ] `environment list` handles no-environment case gracefully
- [ ] `npm run build && npm run lint && npm test` passes

---

### UNIT-5: Single-Environment Guard

| Field | Value |
|-------|-------|
| id | `UNIT-5` |
| depends_on | `[UNIT-3]` |
| scope | Prevent multiple environments from being created simultaneously |
| risk_level | Tier 1 |
| rollback_plan | Remove guard check from `create` command |

**Files to modify**:

| File | Changes |
|------|---------|
| `src/commands/environment/create.ts` | Check `getActiveEnvironment()` before creating; error with actionable message if exists |
| `src/lib/state/store.ts` | Add `hasActiveEnvironment` convenience function |
| `test/commands/environment/create.test.ts` | Test guard behavior |

**Guard behavior**:
```
$ jahia-cli environment create --component jahia
✗ An environment "my-env" is already active.

  To stop it:   jahia-cli environment stop
  To delete it: jahia-cli environment delete

  Use --force to override this check.
```

- `--force` flag bypasses guard (deletes existing env first)
- JSON output includes `{ "error": "environment_exists", "existing": "my-env" }`

**Acceptance Tests**:
- [ ] Second `create` fails with descriptive error
- [ ] `--force` deletes existing and creates new
- [ ] `--json` output includes structured error
- [ ] After `delete`, `create` succeeds again
- [ ] `npm run build && npm run lint && npm test` passes

---

### UNIT-6: Integration Wiring

| Field | Value |
|-------|-------|
| id | `UNIT-6` |
| depends_on | `[UNIT-3, UNIT-4, UNIT-5]` |
| scope | Wire state into `doctor` command, ensure all commands share consistent state dir config |
| risk_level | Tier 1 |
| rollback_plan | Revert doctor changes |

**Files to modify**:

| File | Changes |
|------|---------|
| `src/commands/environment/doctor.ts` | Read env name from state if `--name` not provided |
| `src/commands/environment/create.ts` | Ensure `--state-dir` flag propagated |

**Acceptance Tests**:
- [ ] `environment doctor` works without `--name` when state file exists
- [ ] Full lifecycle integration test: create → list → logs → stop → start → doctor → delete
- [ ] `npm run build && npm run lint && npm test` passes

---

### UNIT-7: Documentation & Output Polish

| Field | Value |
|-------|-------|
| id | `UNIT-7` |
| depends_on | `[UNIT-6]` |
| scope | README, Agents.md, command help text, consistent `--json` across all commands |
| risk_level | Tier 1 |
| rollback_plan | Revert doc changes |

**Files to modify**:

| File | Changes |
|------|---------|
| `README.md` | Full command reference for all environment subcommands |
| `Agents.md` | Add "Environment Lifecycle Manager" harness |
| `CLAUDE.md` | Update architecture section with state layer |
| `.github/copilot-instructions.md` | Add lifecycle commands to architecture docs |

**Acceptance Tests**:
- [ ] All documented commands run successfully
- [ ] `--help` on every command is clear and complete
- [ ] `--json` output is parseable on every command
- [ ] Agents.md harness workflow is executable
- [ ] `npm run build && npm run lint && npm test` passes

---

## Execution Summary

| Unit | Tier | Parallel | Est. Files | Key Risk |
|------|------|----------|-----------|----------|
| UNIT-0 | 1 | - | 0 (merge) | PR feedback |
| UNIT-1 | 2 | - | 5 new | Cross-platform paths |
| UNIT-2 | 2 | - | 5 modified | Breaking Provider interface |
| UNIT-3 | 2 | with UNIT-4 | 8 new + 2 mod | State consistency |
| UNIT-4 | 1 | with UNIT-3 | 6 new + 1 mod | Log streaming cross-platform |
| UNIT-5 | 1 | - | 3 modified | Force flag UX |
| UNIT-6 | 1 | - | 2 modified | Integration gaps |
| UNIT-7 | 1 | - | 4 modified | Staleness |

**Total**: ~29 files touched, 7 PRs (one per unit after UNIT-0)

---

## Merge Queue Rules

1. Never merge a unit with failing tests from a dependency unit
2. Rebase each unit branch on latest `main` before merge
3. Re-run `npm run build && npm run lint && npm test` after each merge
4. Units 3 and 4 may be developed in parallel but merged sequentially (3 first)

---

## Recovery Protocol

If a unit stalls:
1. Evict from active queue
2. Snapshot findings and blockers
3. Narrow scope (e.g., split `logs` follow mode to separate unit)
4. Retry with updated constraints

---

*Generated: 2026-05-02T11:57:00Z*

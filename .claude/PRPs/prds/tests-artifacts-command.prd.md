# Tests Artifacts Collection Command

## Problem Statement

CI/CD pipelines and developers debugging test failures need a reliable, repeatable way to collect logs and diagnostic files from Jahia environment containers after test execution. Today this is done with ad-hoc shell scripts that query VictoriaLogs and manually `docker cp` files — fragile, inconsistent, and hard to maintain across repositories.

## Evidence

- Existing shell script pattern uses `curl` against VictoriaLogs API and `find`/`docker cp` for file extraction
- Every Jahia test repository reimplements artifact collection differently
- CI/CD pipelines need deterministic output structure for artifact uploading (GitHub Actions, Jenkins)

## Proposed Solution

A `tests artifacts` command that collects all container logs from VictoriaLogs (with `docker logs` fallback) and copies container-specific diagnostic files via `docker cp`, producing a structured output folder ready for CI upload.

## Key Hypothesis

We believe a single `tests artifacts` command will replace fragile shell-script artifact collection for CI/CD pipelines and developers.
We'll know we're right when test repositories can replace their custom artifact scripts with one `jahia-cli tests artifacts` call.

## What We're NOT Building

- Log analysis or parsing — this is collection only
- Real-time log streaming (use `environment logs` for that)
- Artifact upload to external services (GitHub Actions, S3) — that's the CI pipeline's job
- Log rotation or retention management

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Artifact completeness | One log file per container + all declared artifact paths | Manual verification |
| Replaces shell scripts | Drop-in replacement for existing artifact collection | Test repo migration |
| Works on stopped containers | `docker cp` and `docker logs` fallback work on stopped containers | Integration test |

## Open Questions

- [ ] Should VictoriaLogs query use a time range (e.g., since environment creation) or always fetch all logs?
- [ ] Maximum log size handling — should there be a size cap per container?

---

## Users & Context

**Primary User**
- **Who**: CI/CD pipeline (GitHub Actions, Jenkins) running Jahia integration tests
- **Current behavior**: Custom shell scripts that `curl` VictoriaLogs and `docker cp` files
- **Trigger**: Test suite completes (pass or fail), artifacts need to be collected before environment teardown
- **Success state**: `./results/` folder contains all logs and diagnostic files, ready for CI artifact upload

**Secondary User**
- **Who**: Developer debugging a failing test locally
- **Trigger**: Test failure that needs log inspection
- **Success state**: All logs and error files collected in one place without manual container inspection

**Job to Be Done**
When a test suite finishes, I want to collect all container logs and diagnostic files in one command, so I can upload them as CI artifacts or inspect them locally without hunting through containers.

**Non-Users**
Production operations teams — this is for dev/test environments only.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Query VictoriaLogs for per-container logs, write one `.log` file each | Core artifact — every container's logs must be captured |
| Must | Fall back to `docker logs` when VictoriaLogs is unavailable | Containers may outlive VictoriaLogs infrastructure |
| Must | `docker cp` artifact paths from containers (defined in component + config) | Diagnostic files like Jahia error logs are essential for debugging |
| Must | Configurable output directory (`--output`, default `./results/`) | CI pipelines need control over artifact location |
| Must | Create output directory and per-container subfolders automatically | No manual folder setup |
| Must | Work on both running and stopped containers | Artifacts may be collected after environment stop |
| Must | Add `artifacts` field to `ComponentDefinition` for default artifact paths | Each component type knows its important diagnostic files |
| Should | Support `--json` flag for structured output summary | Consistent with all other CLI commands |
| Should | Config override for artifact paths per component | Users may need additional files beyond defaults |
| Could | Progress output showing collection status per container | Nice UX for long-running collection |
| Won't | Log filtering/querying — always collects all logs | Simplicity; filtering is a separate concern |

### MVP Scope

1. Query VictoriaLogs API for each non-infrastructure container → write `{container-name}.log`
2. Fall back to `docker logs` if VictoriaLogs is unreachable
3. Copy artifact paths from containers via `docker cp` → per-container subfolder
4. `artifacts` field on `ComponentDefinition` with Jahia defaults: `['/var/log/jahia/jahia-error']`
5. `--output` flag (default `./results/`), auto-create directory
6. Human-readable progress output + `--json` summary

### Output Folder Structure

```
results/
├── jahia.log                      # VictoriaLogs or docker logs output
├── smtp-server.log                # VictoriaLogs or docker logs output
├── jahia/                         # Artifact subfolder (only if artifacts exist)
│   └── jahia-error/               # Copied from /var/log/jahia/jahia-error
│       ├── error.log
│       └── ...
└── ...
```

### User Flow

```
# Typical CI usage (after tests, before environment delete)
jahia-cli tests artifacts --output ./test-results

# With config-based artifact overrides
jahia-cli tests artifacts -c jahia-cli.config.yml --output ./test-results

# Minimal (uses defaults)
jahia-cli tests artifacts
```

---

## Technical Approach

**Feasibility**: HIGH

**Architecture Notes**
- VictoriaLogs query: `GET http://localhost:{port}/select/logsql/query?query=*&limit=10000` filtered by syslog tag (`jahia-cli-{envName}-{containerName}`)
- The syslog tag format is `jahia-cli-${envName}-{{.Name}}` (set in `buildLogConfig`)
- `docker cp {containerId}:{path} {localPath}` via `execFile('docker', ['cp', ...])`
- `docker logs {containerId}` as fallback via `execFile('docker', ['logs', ...])`
- State provides `containerId` per component via `getActiveEnvironment()`
- New `artifacts` field on `ComponentDefinition`: `readonly artifacts?: readonly string[] | undefined`
- Config overrides for artifacts: new `artifacts` field on `ComponentOverrides`
- `ResolvedComponent` gets `effectiveArtifacts` (merged definition + overrides)

**Key Files to Modify**
- `src/lib/components/types.ts` — add `artifacts` to `ComponentDefinition` and `ComponentOverrides`
- `src/lib/components/index.ts` — merge `effectiveArtifacts` in `resolveComponent`
- `src/lib/components/jahia.ts` — add default artifacts `['/var/log/jahia/jahia-error']`
- New: `src/commands/tests/artifacts.ts` — the command
- New: `src/lib/artifacts/` — library functions (query-vlogs, docker-cp, collect-artifacts)

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| VictoriaLogs API returns huge log volume | Medium | Use reasonable default limit; document behavior |
| `docker cp` fails on missing paths | Medium | Catch errors per-path, warn and continue |
| Container removed before collection | Low | Warn and skip; state reconciliation detects missing containers |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Component artifacts | Add `artifacts` field to types, Jahia defaults, resolve logic | pending | - | - | - |
| 2 | Artifact collection library | Pure functions: query VictoriaLogs, docker cp, docker logs fallback | pending | - | 1 | - |
| 3 | Command implementation | `tests artifacts` command wiring library to OCLIF | pending | - | 2 | - |
| 4 | Tests and docs | Unit tests, integration tests, README update | pending | - | 3 | - |

### Phase Details

**Phase 1: Component artifacts**
- **Goal**: Extend the component type system to support artifact path declarations
- **Scope**: Add `artifacts?: readonly string[]` to `ComponentDefinition` and `ComponentOverrides`, add `effectiveArtifacts` to `ResolvedComponent`, set Jahia defaults to `['/var/log/jahia/jahia-error']`
- **Success signal**: Build passes, existing tests still green

**Phase 2: Artifact collection library**
- **Goal**: Pure, testable functions for all collection operations
- **Scope**:
  - `query-vlogs.ts` — fetch logs from VictoriaLogs API per container (by syslog tag)
  - `collect-container-logs.ts` — orchestrates VictoriaLogs query with `docker logs` fallback
  - `copy-container-artifacts.ts` — `docker cp` each artifact path from a container
  - `collect-all-artifacts.ts` — top-level orchestrator: logs + files for all containers
- **Success signal**: Unit tests pass for each function with mocked Docker/HTTP calls

**Phase 3: Command implementation**
- **Goal**: Working `tests artifacts` command
- **Scope**: OCLIF command with `--output` and `--json` flags, `--state` override, human-readable progress, JSON summary output
- **Success signal**: `jahia-cli tests artifacts --output ./results` produces expected folder structure

**Phase 4: Tests and docs**
- **Goal**: Comprehensive test coverage and user documentation
- **Scope**: Unit tests for pure functions, integration test via `bin/dev.js`, README section, config file documentation for artifact overrides
- **Success signal**: All tests pass, docs are accurate

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Command name | `tests artifacts` | `tests collect`, `tests export` | "artifacts" is the established CI/CD term |
| Log source | VictoriaLogs first, `docker logs` fallback | VictoriaLogs only, `docker logs` only | Resilient; works even after infra teardown |
| Artifact paths | In ComponentDefinition + config overrides | Config only, hardcoded only | Sensible defaults with user flexibility |
| Output structure | Flat logs + per-container artifact subfolders | All in subfolders, single flat folder | Clean separation; logs at root, files nested |
| Container state | Works on running and stopped | Running only | `docker cp` and `docker logs` work on stopped containers |

---

## Research Summary

**Technical Context**
- VictoriaLogs syslog tag: `jahia-cli-${envName}-{{.Name}}` — container name is embedded, enabling per-container log queries
- VictoriaLogs LogsQL query API: `GET /select/logsql/query?query={query}&limit={limit}`
- `docker cp` works on both running and stopped containers
- `docker logs` works on stopped containers (if using json-file driver or similar; syslog driver may not retain logs locally — this is exactly why VictoriaLogs is primary)
- State system provides all needed data: environment name, container IDs, component names, config

---

*Generated: 2026-05-13T18:26*
*Status: DRAFT - ready for implementation*

# Structured Artifact Export

## Problem Statement

Developers and CI pipelines running `tests artifacts` get a messy output folder with duplicate files, confusing nested paths (e.g., `results/jahia/jahia/`), and empty log files for some containers (cypress, victorialogs). This makes post-test debugging unreliable and forces manual cleanup of artifact directories.

## Evidence

- The `effectiveArtifacts` merge in `src/lib/components/index.ts:107` concatenates definition + override arrays without deduplication
- `copyContainerArtifacts` uses `basename(source)` for destination, creating double-nested paths like `results/jahia/jahia/` for `/var/log/jahia`
- The cypress container started by `tests:run` doesn't use the syslog log driver, so VictoriaLogs has no logs for it; but the VictoriaLogs query may succeed with empty results before the `docker logs` fallback fires
- The `artifacts` type is `readonly string[]` with no way to control output destination

## Proposed Solution

Change the `artifacts` field in `ComponentDefinition` from `string[]` to an array of `{ source, destination }` objects. Each object maps a container path to a relative path in the output folder. Update the copy logic to use the explicit destination, deduplicate entries, and fix container log collection to ensure all containers produce non-empty logs.

## Key Hypothesis

We believe explicit source/destination artifact mapping will eliminate duplicate content and produce a clean, predictable output structure for developers and CI pipelines.
We'll know we're right when `tests artifacts` produces a flat output folder with no duplicates and non-empty log files for every container.

## What We're NOT Building

- S3/remote artifact upload — out of scope, separate concern
- Artifact compression/archiving — consumers can zip the output folder themselves
- Backward compatibility shim — this is a clean breaking change to the `ComponentDefinition` interface

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Zero duplicate files in output | 0 duplicates | Manual inspection of `tests artifacts` output |
| All container logs non-empty | 100% of containers | Check file sizes after collection |
| Developer can control output structure | Cypress results at `./`, Jahia logs at `./jahia/` | Config-driven destination mapping |

## Open Questions

- [ ] Should the YAML config allow overriding artifact destinations per-component, or is the component definition sufficient?
- [ ] Should logs also be placed at configurable destinations, or always at the output root as `<component>.log`?

---

## Users & Context

**Primary User**
- **Who**: Developers running Jahia test suites locally or CI pipelines collecting test results
- **Current behavior**: Run `tests artifacts`, get a messy folder with duplicates and empty logs, manually reorganize
- **Trigger**: After test execution, need to collect results for debugging or CI reporting
- **Success state**: A clean output folder with test results where expected and all logs populated

**Job to Be Done**
When running tests, I want to collect artifacts with a clean, predictable structure, so I can debug failures quickly and integrate with CI reporting tools.

**Non-Users**
End users of Jahia — this is purely a developer/CI tooling concern.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Change `artifacts: string[]` → `artifacts: { source, destination }[]` | Enables destination control |
| Must | Update all component definitions with explicit destinations | Required by new interface |
| Must | Fix copy logic to use destination path instead of `basename(source)` | Eliminates double-nesting |
| Must | Deduplicate artifact entries before copying | Prevents duplicate files |
| Must | Fix empty logs for cypress container | Cypress logs are critical for debugging |
| Must | Fix empty logs for victorialogs container | Infrastructure logs needed for troubleshooting |
| Must | Allow YAML config to override artifact destinations | Different projects need different output structures |

### MVP Scope

All of the above — this is a single cohesive change to the artifact data model and collection logic.

### User Flow

```
1. Developer defines artifacts in component (or overrides in YAML config):
   artifacts: [{ source: '/var/log/jahia', destination: 'jahia/' }]

2. Developer runs: jahia-cli tests artifacts --output ./results

3. CLI resolves effective artifacts (definition + overrides, deduplicated)

4. For each component:
   a. Collect logs (VictoriaLogs → docker logs fallback, properly)
   b. Copy artifacts using destination paths

5. Output:
   ./results/
     ├── jahia.log
     ├── cypress.log
     ├── victorialogs.log
     ├── jahia/              ← from jahia component: /var/log/jahia → ./jahia/
     │   ├── error.log
     │   └── access.log
     ├── videos/             ← from cypress: /home/jahians/results → ./
     ├── screenshots/
     └── reports/
```

---

## Technical Approach

**Feasibility**: HIGH

**Architecture Notes**

- New `ArtifactMapping` interface in `src/lib/components/types.ts`:
  ```typescript
  interface ArtifactMapping {
    readonly source: string;      // container path
    readonly destination: string;  // relative path in output folder
  }
  ```
- `ComponentDefinition.artifacts` changes from `readonly string[]` to `readonly ArtifactMapping[]`
- `ComponentOverrides.artifacts` changes similarly
- `effectiveArtifacts` merge in `resolveComponent` deduplicates by `source` (overrides win)
- `copyContainerArtifacts` uses `destination` to build the output path instead of `basename(source)`
- `destination: './'` means copy contents directly into the component's output area
- Log collection fix: for containers without syslog config (cypress), skip VictoriaLogs query and go straight to `docker logs`

**Key files to modify:**

| File | Change |
|------|--------|
| `src/lib/components/types.ts` | New `ArtifactMapping` interface, update `ComponentDefinition` and `ComponentOverrides` |
| `src/lib/components/index.ts` | Deduplication logic in `resolveComponent` |
| `src/lib/components/jahia.ts` | `artifacts: [{ source: '/var/log/jahia', destination: 'jahia/' }]` |
| `src/lib/components/cypress.ts` | `artifacts: [{ source: '/home/jahians/results', destination: './' }]` |
| `src/lib/artifacts/copy-container-artifacts.ts` | Use `destination` for output path construction |
| `src/lib/artifacts/collect-all.ts` | Pass structured artifacts, handle dedup |
| `src/lib/artifacts/fetch-container-logs.ts` | Fix log collection for non-syslog containers |
| `src/lib/artifacts/query-vlogs.ts` | Verify syslog tag format matches actual container names |
| `src/lib/config/types.ts` | Update config types for artifact overrides |
| `src/lib/config/parser.ts` | Parse artifact objects from YAML config |
| Tests for all modified files | Unit tests for new logic |

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Breaking change to ComponentDefinition | Certain | Acceptable — young project, no external consumers |
| `docker cp` behavior differs for files vs directories | Low | Existing try-directory-then-file logic is sound |
| VictoriaLogs tag mismatch for some containers | Medium | Validate tag format: `jahia-cli-{env}-jahia-cli-{env}-{component}` is double-nested, verify this matches actual Docker container names |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Data model | New `ArtifactMapping` interface, update types and component definitions | complete | - | - | - |
| 2 | Copy logic | Update `copyContainerArtifacts` to use destination paths, add deduplication | complete | - | 1 | - |
| 3 | Log fix | Fix empty logs for cypress and victorialogs containers | complete | with 2 | 1 | - |
| 4 | Config support | YAML config parsing for artifact destination overrides | complete | - | 1 | - |
| 5 | Tests & validation | Unit tests for all changes, end-to-end validation | complete | - | 2, 3, 4 | - |

### Phase Details

**Phase 1: Data model**
- **Goal**: Establish the new `ArtifactMapping` type and update all interfaces and component definitions
- **Scope**: `types.ts`, `index.ts` (dedup in merge), `jahia.ts`, `cypress.ts`, `victorialogs.ts`, `smtp-server.ts`
- **Success signal**: `npm run build` compiles cleanly with new types

**Phase 2: Copy logic**
- **Goal**: Output files land at the configured destination path instead of `basename(source)` nesting
- **Scope**: `copy-container-artifacts.ts`, `collect-all.ts`
- **Success signal**: `tests artifacts` output matches expected structure (no double-nesting, no duplicates)

**Phase 3: Log fix**
- **Goal**: All containers produce non-empty log files
- **Scope**: `fetch-container-logs.ts`, `query-vlogs.ts` — fix VictoriaLogs query for non-syslog containers
- **Success signal**: `cypress.log` and `victorialogs.log` contain actual content

**Phase 4: Config support**
- **Goal**: YAML config can override artifact destinations per-component
- **Scope**: `config/types.ts`, `config/parser.ts`, artifact override merging
- **Success signal**: `artifacts: [{ source: '/custom/path', destination: 'custom/' }]` in YAML works

**Phase 5: Tests & validation**
- **Goal**: All new logic is covered by unit tests
- **Scope**: Test files for all modified modules
- **Success signal**: `npm test` passes, `npm run test:coverage` meets threshold

### Parallelism Notes

Phases 2 and 3 can run in parallel since they modify different files (copy logic vs log fetching). Phase 4 (config) depends only on Phase 1 (types) and can be developed alongside Phases 2-3.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Artifact type | `{ source, destination }` object | Tuple `[source, dest]`, keep strings with convention | Object is self-documenting, easy to extend later |
| Destination semantics | Relative to output dir | Relative to component subdir | Flat structure is simpler — `./` means output root |
| Deduplication | By `source` path, overrides win | No dedup, last-write-wins | Prevents identical `docker cp` calls |
| Breaking change | Yes, clean break | Backward compat union type | Project is young, no external consumers |
| Log fix approach | Skip VictoriaLogs for non-syslog containers | Always try both | Avoids false-positive empty results from VictoriaLogs |

---

## Research Summary

**Technical Context**

Key findings from codebase exploration:

- `effectiveArtifacts` merge at `src/lib/components/index.ts:107` has no deduplication
- `copyContainerArtifacts` at `src/lib/artifacts/copy-container-artifacts.ts:31` uses `basename()` causing double nesting
- Syslog tag in `src/lib/providers/docker/index.ts:69` is `jahia-cli-{env}-{{.Name}}` where `{{.Name}}` = `jahia-cli-{env}-{component}`, producing a double-prefixed tag
- VictoriaLogs query at `src/lib/artifacts/query-vlogs.ts:20` mirrors this double prefix — tags match, but containers without syslog driver (cypress, victorialogs itself) return empty results
- The cypress container in `tests/run.ts` is started without `logConfig`, using Docker's default json-file driver

---

*Generated: 2026-05-17T15:55:32Z*
*Status: DRAFT - needs validation*

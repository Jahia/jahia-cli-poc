# State-Driven Dual-Mode URL Resolution

## Problem Statement

When jahia-cli commands (`jahia alive`, `jahia provision`, workflows, tests) need to communicate with containers, users must manually provide `--url` flags because the state system always resolves to `http://localhost:PORT`. This breaks inside Docker containers (e.g., test runners) where the correct address is `http://CONTAINER-NAME:PORT` via the Docker network. The manual overhead compounds as workflows and CI automation grow.

## Evidence

- `getJahiaConnectionDefaults()` in `src/lib/state/get-jahia-connection-defaults.ts` hardcodes `http://localhost:${port}` — ignoring the `aliases` already stored in `ComponentEndpoints`
- The `tests run` command mounts the state file into the test container and sets `JAHIA_CLI_STATE`, yet commands inside the container still resolve to `localhost` URLs
- The state file already stores `endpoints.aliases` and `endpoints.ports` per component — the data exists, it's just not used for URL resolution
- Cypress component definition (`src/lib/components/cypress.ts`) documents: "Environment variables use in-network Docker aliases (e.g. `http://jahia:8080`)" — confirming the dual-mode need

## Proposed Solution

Extend the state URL resolution layer to be **context-aware**: automatically detect whether the CLI is running on the host or inside a Docker container, and construct the correct URL using the data already persisted in the state file. For Docker provider environments, use `localhost:hostPort` on the host and `alias:containerPort` inside Docker. For JahiaCloudV1 provider environments, use the same remote URL regardless of context. All commands log the URL source (CLI flag vs state file) and access mode (host vs docker-network) for easy debugging.

## Key Hypothesis

We believe **automatic host/docker-network URL resolution from the state file** will **eliminate manual --url flag usage for standard operations** for **developers and CI pipelines running jahia-cli**.
We'll know we're right when **`jahia alive` (with no flags) succeeds both from the host and from inside a test container on the same Docker network**.

## What We're NOT Building

- **Remote cluster support** — JahiaCloudV1 provider will store a remote URL, but implementing the cloud provider itself is out of scope
- **Multi-environment state** — the state file holds one environment; no changes to that model
- **Service discovery** — no DNS, no consul; purely file-based resolution from persisted state
- **Automatic URL for non-state scenarios** — if there's no state file, behavior falls back to current defaults

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Zero --url flags needed for default operations | 100% of standard host + in-container flows | Manual test: `jahia alive` works from host and test container |
| URL source logged in every command | All commands using Jahia connection | Code review: every URL resolution logs source |
| Backward compatibility | Zero breaking changes | `npm test` — all existing tests pass |
| Test coverage | ≥40% threshold maintained | `npm run test:coverage` |

## Open Questions

- [ ] Should the env var for forcing network mode be `JAHIA_CLI_NETWORK_MODE` or something else?
- [ ] When running inside Docker with no state file, should detection still log that it detected Docker mode?
- [ ] Future: should the state file store a pre-computed `urls` field per component, or always derive at resolution time?

---

## Users & Context

**Primary User**
- **Who**: Developers running jahia-cli locally, and CI pipelines running jahia-cli from inside Docker containers (e.g., Cypress test runner)
- **Current behavior**: Must pass `--url http://jahia:8080` when running from inside a container; forget it and the command fails silently against `localhost`
- **Trigger**: Any command that communicates with Jahia (alive, provision, workflow steps) after `environment create`
- **Success state**: Command resolves the correct URL automatically — no `--url` needed

**Job to Be Done**
When running jahia-cli commands after creating an environment, I want to communicate with containers without specifying URLs, so I can focus on testing and development rather than network plumbing.

**Non-Users**
Users connecting to fully remote Jahia instances not managed by jahia-cli state — they will always use `--url` explicitly. (Note: JahiaCloudV1 managed instances will be handled by the provider storing the remote URL in state.)

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | **Docker detection** — detect if CLI runs inside Docker (/.dockerenv + env var override) | Core to dual-mode resolution |
| Must | **Generalized URL resolution** — resolve any component's URL from state (not just Jahia) | All components with ports need addressable URLs |
| Must | **Dual-mode URLs** — host mode uses `localhost:hostPort`, docker mode uses `alias:containerPort` | The fundamental feature |
| Must | **URL source logging** — every command logs whether URL came from CLI flag or state file, and which mode | Required for debugging |
| Must | **Backward compatibility** — `--url` flag still works, overrides state-derived URL | Users may still target custom hosts |
| Should | **State file enrichment** — ensure all components have populated `endpoints` at creation time | Data completeness |
| Should | **Provider-aware resolution** — Docker provider uses dual-mode, JahiaCloudV1 uses single remote URL | Future-proofing for cloud provider |
| Could | **Connection defaults for all components** — extend beyond Jahia to pgsql, elasticsearch, etc. | Useful for future commands that interact with infra components |
| Won't | **JahiaCloudV1 provider implementation** — only the URL resolution interface, not the cloud API | Separate feature |

### MVP Scope

1. `detect-docker-context.ts` — detects host vs docker-network context
2. Refactor `get-jahia-connection-defaults.ts` → generalized `resolve-component-url.ts` that works for any component
3. Update `alive` and `provision` commands to use new resolution with source logging
4. Tests covering both host and docker detection paths

### User Flow

```
Developer runs: jahia-cli jahia alive

1. CLI loads state file → finds active environment
2. CLI detects execution context (host or docker)
3. CLI resolves Jahia URL from state:
   - Host: http://localhost:8080 (from endpoints.ports[0].host)
   - Docker: http://jahia:8080 (from endpoints.aliases[0]:endpoints.ports[0].container)
4. CLI logs: "URL: http://localhost:8080 (source: state file, mode: host)"
5. CLI polls SAM healthcheck at resolved URL
6. CLI reports result
```

---

## Technical Approach

**Feasibility**: HIGH

The state file already stores all required data (`endpoints.aliases`, `endpoints.ports`). The change is primarily in the resolution logic — no new data collection or infrastructure needed.

**Architecture Notes**
- New file `src/lib/state/detect-docker-context.ts` — pure function, checks `/.dockerenv` + `JAHIA_CLI_NETWORK_MODE` env var
- New file `src/lib/state/resolve-component-url.ts` — replaces `get-jahia-connection-defaults.ts` with a generalized version
- New interface `ResolvedConnection` with `url`, `source` (flag | state), `mode` (host | docker-network | direct)
- Each command that resolves URLs will log the `ResolvedConnection` metadata
- `getJahiaConnectionDefaults` will be refactored to call the new generalized resolver (or deprecated in favor of it)

**Key Files to Modify**
- `src/lib/state/types.ts` — add `ResolvedConnection` interface
- `src/lib/state/get-jahia-connection-defaults.ts` → refactor or replace
- `src/lib/state/index.ts` — export new functions
- `src/commands/jahia/alive.ts` — use new resolver + log source
- `src/commands/jahia/provision.ts` — use new resolver + log source
- All other commands that use `getJahiaConnectionDefaults` or `getActiveEnvironment` for connection info

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Docker detection false positive (e.g., dev machine has `/.dockerenv`) | Low | Env var override `JAHIA_CLI_NETWORK_MODE=host` to force host mode |
| Breaking existing `--url` flag behavior | Low | URL flag always takes priority — tested explicitly |
| State files from older versions missing `endpoints` | Medium | Graceful fallback: missing endpoints → use current localhost default |
| Container port != host port mapping edge cases | Low | Use the correct port from the mapping based on detected context |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Docker context detection | Create `detect-docker-context.ts` with tests | pending | - | - | - |
| 2 | Generalized URL resolver | Create `resolve-component-url.ts` replacing hardcoded localhost logic | pending | with 1 | - | - |
| 3 | Connection types & interfaces | Define `ResolvedConnection`, `UrlSource`, `NetworkMode` types | pending | with 1 | - | - |
| 4 | Command integration | Update alive, provision, and other commands to use new resolver with logging | pending | - | 1, 2, 3 | - |
| 5 | Test coverage & validation | Unit tests for all new functions + integration tests for dual-mode | pending | - | 4 | - |
| 6 | Documentation update | Update CLAUDE.md and README with new state URL resolution behavior | pending | - | 5 | - |

### Phase Details

**Phase 1: Docker Context Detection**
- **Goal**: Reliably detect whether jahia-cli runs on host or inside Docker
- **Scope**: `src/lib/state/detect-docker-context.ts` — pure function returning `'host' | 'docker-network'`
- **Success signal**: Tests pass for both contexts with env var override

**Phase 2: Generalized URL Resolver**
- **Goal**: Replace hardcoded `localhost` URL construction with state-aware, context-aware resolution
- **Scope**: `src/lib/state/resolve-component-url.ts` — takes component name, state, context → returns URL + metadata
- **Success signal**: Resolves correct URL for host mode, docker mode, and missing-state fallback

**Phase 3: Connection Types & Interfaces**
- **Goal**: Define clean type contracts for the new resolution system
- **Scope**: Add types to `src/lib/state/types.ts` — `ResolvedConnection`, `UrlSource`, `NetworkMode`
- **Success signal**: All new code compiles with strict TypeScript

**Phase 4: Command Integration**
- **Goal**: All commands use the new resolver and log URL source/mode
- **Scope**: Update `alive.ts`, `provision.ts`, and any future commands. Deprecate or refactor `getJahiaConnectionDefaults`
- **Success signal**: All commands log URL source; `--url` override still works

**Phase 5: Test Coverage & Validation**
- **Goal**: Comprehensive tests for all new code paths
- **Scope**: Unit tests for detection, resolution, and integration tests for commands
- **Success signal**: `npm run test:coverage` meets threshold; all tests pass

**Phase 6: Documentation Update**
- **Goal**: Keep docs in sync with new behavior
- **Scope**: CLAUDE.md architecture section, README command docs
- **Success signal**: Documented behavior matches actual behavior

### Parallelism Notes

Phases 1, 2, and 3 can run in parallel — they are independent modules (detection, resolution logic, types). Phase 4 depends on all three. Phases 5 and 6 are sequential after integration.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Docker detection method | /.dockerenv + env var override | cgroup parsing, hostname check, /proc/1/cgroup | /.dockerenv is the most reliable cross-platform signal; env var provides escape hatch |
| URL resolution scope | All components with ports | Jahia-only | Future commands will need to address pgsql, elasticsearch, etc. Generalize now |
| State file schema change | None (endpoints already optional) | Add version 2, add pre-computed URLs | Endpoints field already exists; derive URLs at resolution time for flexibility |
| Provider-aware resolution | Docker = dual-mode, Cloud = single URL | Same logic for all providers | Docker has host/container duality; cloud URLs are the same everywhere |
| Logging format | "URL: <url> (source: <source>, mode: <mode>)" | Separate log lines, structured only | Single line is scannable; structured JSON mode already exists |

---

## Research Summary

**Market Context**
- Docker CLI tools commonly detect container context via `/.dockerenv` or cgroup inspection
- Docker Compose uses service names for inter-container networking — same pattern as this feature
- Testcontainers (Java/Node) solve similar host-vs-container URL duality with explicit "host" vs "network" aliases

**Technical Context**
- State file (`~/.jahia-cli/state.json`) already stores `ComponentEndpoints` with `aliases` and `ports` per component
- `getJahiaConnectionDefaults` is the only URL resolution function — needs generalization
- The Docker provider already populates `endpoints` at container creation time (`src/lib/providers/docker/index.ts:205`)
- Test container (`tests run`) already mounts the state file and sets `JAHIA_CLI_STATE` — the new resolution will work inside automatically
- JahiaCloudV1 provider (placeholder) will store a remote URL — dual-mode is Docker-specific

---

*Generated: 2026-05-15T18:00:05+02:00*
*Status: DRAFT — needs validation*

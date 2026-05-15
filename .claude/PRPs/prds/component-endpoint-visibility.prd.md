# Component Endpoint Visibility

## Problem Statement

Developers and CI/CD pipelines using jahia-cli don't know how to reach the containers they've created. The container names are auto-generated (e.g., `jahia-cli-env-83b8f755-jahia`) and change across codebases, making it hard to figure out the correct URL to access a service from inside the Docker network (another container) or from the host machine. While network aliases already exist (e.g., `jahia`), they're invisible — not shown in any output or persisted in the state file.

## Evidence

- Container names include a hash of the environment name, making them unpredictable
- Network aliases are set at `docker run` time but never surfaced to the user
- The state file (`PersistedComponent`) stores only `name`, `image`, `tag`, `containerId` — no endpoint information
- `environment list` shows container names but not how to reach them
- Users across multiple codebases have to independently figure out addressing patterns

## Proposed Solution

Persist endpoint information (network alias + ports for in-network access, localhost + mapped ports for host access) in the state file at environment creation time, and surface it clearly in `environment list` output. Allow optional alias overrides via component config for multi-instance or custom naming scenarios.

## Key Hypothesis

We believe surfacing endpoint information in the state file and CLI output will eliminate the need for users to manually discover container addresses. We'll know we're right when a user can run `environment list` and immediately know how to reach any service from both inside and outside the Docker network.

## What We're NOT Building

- Automatic env var injection into test containers based on endpoints — the existing `envInjections` mechanism handles this already
- Protocol-aware endpoints (http://, smtp://) — endpoints are shown as `host:port`, users determine the protocol
- Backward compatibility for existing environments — only new environments get endpoint data
- Cloud provider endpoint resolution (JahiaCloudV1) — deferred, but the data model is generic enough to support it

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Endpoint data in state | 100% of components | State file includes endpoints for all components after `environment create` |
| Discoverability | Zero manual lookup needed | `environment list` output shows all reachable endpoints |
| Alias stability | Consistent across codebases | Default alias is component name, identical regardless of environment name |

## Open Questions

- [ ] Should `environment doctor` validate that endpoints are actually reachable?
- [ ] When JahiaCloudV1 is implemented, will endpoints be returned by the cloud API or derived from config?

---

## Users & Context

**Primary User**
- **Who**: Developer or CI/CD engineer running Jahia test environments
- **Current behavior**: Creates environment, then manually inspects `docker ps` or reads component source code to figure out container names and ports
- **Trigger**: Needs to configure a test runner, browser, or script to connect to a Jahia instance or supporting service
- **Success state**: Runs `environment list` and immediately sees all addresses needed

**Job to Be Done**
When I've created an environment and need to connect to it, I want to see how each service is reachable, so I can configure my tests or tools without guessing container names.

**Non-Users**
Users of JahiaCloudV1 provider (not yet implemented) — the endpoint model supports them but no provider-specific logic is built.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Persist endpoint data (alias, ports) in state file per component | Core deliverable — makes endpoints discoverable |
| Must | Display endpoints in `environment list` (human + JSON) | Users need to see this without reading the state file manually |
| Must | Default network alias = component name | Stable, predictable, works across codebases |
| Should | Allow alias override via component `overrides.alias` in config | Needed for multi-instance or custom naming |
| Should | Include endpoint data in `environment list --json` output | CI/CD pipelines need programmatic access |
| Could | Show endpoints in `environment create` success output | Immediate feedback at creation time |
| Won't | Auto-inject endpoint env vars into test container | Existing `envInjections` already handles this |
| Won't | Protocol-aware URLs | Users know which protocol to use |

### MVP Scope

1. Extend `PersistedComponent` with endpoint data (network alias, ports, host ports)
2. Populate endpoints at `environment:create` time from component definitions
3. Display endpoints in `environment list` output
4. Support alias override in component config

### User Flow

```
1. User runs: environment create -c config.yml
2. CLI creates containers with network aliases (already works)
3. CLI persists endpoint info in state file (NEW)
4. User runs: environment list
5. Output shows for each component:
     jahia (jahia/jahia-ee:8.2.1.0) — running
       Docker network:  jahia:8080, jahia:8101
       Host:            localhost:8080, localhost:8101
6. User uses these addresses in their test config or scripts
```

---

## Technical Approach

**Feasibility**: HIGH

This is primarily a data persistence and display change. All the underlying data (network aliases, port mappings) already exists at environment creation time in the `ResolvedComponent` objects.

**Architecture Notes**
- Extend `PersistedComponent` interface with an `endpoints` field containing `alias`, `networkPorts`, and `hostPorts`
- At create time, read `networkAliases[0]` (or override) and `effectivePorts` from `ResolvedComponent`
- For Docker provider: host endpoints are always `localhost:{hostPort}`
- For future cloud providers: both internal and external endpoints might be the same URL
- The `endpoints` structure should be generic: `{ alias: string; ports: Array<{ container: number; host: number }> }` — the presentation layer decides how to format internal vs external

**Key Files to Modify**
- `src/lib/state/types.ts` — add endpoint fields to `PersistedComponent`
- `src/lib/providers/docker/index.ts` — populate endpoints when persisting state
- `src/commands/environment/create.ts` — pass endpoint data through to state
- `src/commands/environment/list.ts` — display endpoints in output
- `src/lib/output/formatter.ts` — format endpoint display
- `src/lib/config/types.ts` — add optional `alias` to `ComponentOverrides`
- `src/lib/config/parser.ts` — parse `alias` override

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| State file schema change breaks existing state files | LOW | New fields are optional; old state files just won't have endpoints |
| Port conflicts when host ports are already in use | LOW | Out of scope — this is an existing concern not related to this feature |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | State & types | Extend PersistedComponent with endpoints, add alias to ComponentOverrides, parse alias in config | pending | - | - | - |
| 2 | Create flow | Populate endpoints at environment:create time from resolved components | pending | - | 1 | - |
| 3 | Display | Surface endpoints in environment list (human + JSON) and optionally in create output | pending | - | 2 | - |
| 4 | Tests & docs | Unit tests for all new functions, update config documentation/comments | pending | - | 3 | - |

### Phase Details

**Phase 1: State & Types**
- **Goal**: Define the data model for endpoints
- **Scope**: 
  - Add `ComponentEndpoints` interface to `src/lib/state/types.ts` with `alias`, `ports` (array of `{ container, host }`)
  - Add optional `endpoints` to `PersistedComponent`
  - Add optional `alias` to `ComponentOverrides` in config types
  - Parse `alias` in config parser with validation
- **Success signal**: Types compile, existing tests still pass

**Phase 2: Create Flow**
- **Goal**: Populate endpoint data when creating an environment
- **Scope**:
  - In Docker provider's `createEnvironment`, build endpoint data from `ResolvedComponent` (networkAliases[0] or config alias, effectivePorts)
  - Pass endpoints through to state persistence
  - Apply alias override from config if present
- **Success signal**: After `environment create`, state file contains endpoint data for all components

**Phase 3: Display**
- **Goal**: Make endpoints visible to users
- **Scope**:
  - Update `environment list` human output to show "Docker network: alias:port" and "Host: localhost:hostPort" per component
  - Update `environment list --json` to include endpoints object
  - Optionally show endpoints in `environment create` success message
- **Success signal**: Running `environment list` shows complete endpoint info

**Phase 4: Tests & Docs**
- **Goal**: Ensure quality and discoverability
- **Scope**:
  - Unit tests for endpoint building logic
  - Unit tests for display formatting
  - Update config YAML comments to document `alias` override option
  - Update any relevant documentation
- **Success signal**: All tests pass, `npm run lint` clean, config comments explain alias usage

### Parallelism Notes

Phases are sequential — each builds on the previous. However phases are small enough that they can be implemented in a single session.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Endpoint format | `host:port` (no protocol) | Full URLs with protocol | Users know the protocol; keeps it simple and generic |
| Default alias | Component name (e.g., `jahia`) | Container name or custom default | Stable across codebases, matches existing networkAliases |
| Alias override location | `overrides.alias` in component config | Separate endpoints config section | Minimal config surface, fits existing override pattern |
| State schema migration | Optional field, no migration | Versioned migration | Old state files work fine, just missing endpoint data |
| Env injection into tests | Not included | Auto-inject based on endpoints | Existing `envInjections` already handles this well |

---

## Research Summary

**Technical Context**
- Network aliases already work via `--network-alias` in `docker run` (set in `buildRunArgs`)
- Each component defines `networkAliases` (jahia→`['jahia']`, smtp-server→`['smtp-server']`)
- Port mappings are defined per component (e.g., jahia: 8080→8080, 8101→8101)
- State file currently persists: name, image, tag, containerId — but NOT aliases or ports
- `environment list` reconciles with Docker for live status but doesn't show endpoint info
- The `envInjections` mechanism already handles cross-component env var injection (e.g., smtp-server injects `MAILPIT_URL` into cypress)

---

*Generated: 2026-05-15*
*Status: DRAFT - needs validation*

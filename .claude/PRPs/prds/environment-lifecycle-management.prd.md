# Environment Lifecycle Management

## Problem Statement

Developers, QA engineers, and AI agents working on Jahia need to spin up composable development environments (processing nodes, browsing nodes, databases, search engines) to develop features, write tests, and fix bugs. Today this requires understanding Docker networking, environment variables, inter-service wiring, and maintaining complex docker-compose files — knowledge that is hard for humans to keep current and impossible for AI agents to discover autonomously.

## Evidence

- Existing docker-compose files are difficult to read and maintain due to Jahia's composable nature (endless combinations of components)
- AI agents cannot self-discover how to configure a Jahia environment from docker-compose files alone
- New team members face a steep learning curve to understand the "plumbing" between Jahia components
- The rise of agentic AI development creates an urgent need for programmatic, well-documented environment control with clear feedback loops

## Proposed Solution

Extend `jahia-cli` with full environment lifecycle commands (`start`, `stop`, `delete`, `logs`, `list`) building on the existing foundation (`create`, `doctor`). Add a local state persistence layer so environments can be tracked across CLI invocations. Enforce single-environment-at-a-time to avoid port conflicts in v1. All commands produce structured output (human-readable + `--json`) so both humans and AI agents can operate autonomously.

## Key Hypothesis

We believe providing a CLI that abstracts Jahia environment complexity will help develop against Jahia for humans and AI Agents. We'll know we're right when an AI Agent is able to pick up and fix an issue in full autonomy.

## What We're NOT Building

- **JahiaCloudV1 provider implementation** — stays as placeholder, future work
- **Add/remove components from running environments** — v2 feature
- **Production deployments** — this is strictly for development
- **Kubernetes/cloud orchestration** — Docker-only for now
- **GUI** — CLI-first, designed for terminal and agent consumption

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Full lifecycle completion | A user or agent can create → use → stop → start → delete an environment in one session | Manual + automated integration test |
| AI agent autonomy | An AI agent can manage an environment without human intervention | End-to-end agent test scenario |
| Time to working environment | Under 2 minutes for a standard Jahia + Postgres setup (after image pull) | Timed integration test |
| Zero docker-compose files | No docker-compose.yml needed for standard dev workflows | Usage observation |

## Open Questions

- [ ] Should logs be aggregated into a dedicated container (e.g., VictoriaLogs) for easier AI consumption, or is `docker logs` sufficient for v1?
- [ ] What is the ideal default location for the state file? (`~/.jahia-cli/`, XDG config dir, or project-local?)
- [ ] Should the single-environment guard be global (one env total) or per-project?
- [ ] How should the CLI handle stale state files (environment deleted outside of CLI)?

---

## Users & Context

**Primary Users**

1. **Jahia Module Developer**
   - **Who**: Developer building or extending Jahia modules
   - **Current behavior**: Manually configures docker-compose files, copies env vars from wikis/READMEs
   - **Trigger**: Picks up a JIRA ticket requiring a running Jahia environment
   - **Success state**: Environment running, feature developed, tests passing

2. **QA Engineer**
   - **Who**: Tester creating or extending test suites
   - **Current behavior**: Uses pre-configured docker-compose files, often outdated
   - **Trigger**: Needs a specific Jahia configuration to reproduce or test a scenario
   - **Success state**: Environment matches expected configuration, tests executed

3. **AI Agent**
   - **Who**: Autonomous coding agent (Claude Code, Copilot, etc.)
   - **Current behavior**: Cannot manage Jahia environments — requires human setup
   - **Trigger**: Assigned an issue that requires a running Jahia environment for development or testing
   - **Success state**: Environment created, code changed, tests run, issue resolved — all without human intervention

**Job to Be Done**

When I want to fix a bug, I want to spin up the infrastructure that exposes the issue, so I can reproduce it and start working on a fix.

**Non-Users**

- Production operations teams (this is not a deployment tool)
- Non-technical end users (CLI requires technical awareness)
- Projects unrelated to Jahia

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | `environment start` — start a stopped environment | Core lifecycle operation |
| Must | `environment stop` — stop a running environment without destroying it | Preserve state between work sessions |
| Must | `environment delete` — destroy environment, containers, networks, volumes | Clean up resources |
| Must | `environment logs` — view/stream container logs | Essential for debugging and AI agent feedback |
| Must | `environment list` — show all components and their status | Environment awareness for humans and agents |
| Must | State persistence — local JSON cache of environment state | Enable lifecycle commands across CLI invocations |
| Must | Single-environment guard — prevent multiple environments running simultaneously | Avoid port conflicts in v1 |
| Should | `--json` output on all new commands | AI agent consumption |
| Should | Stale state detection — reconcile state file with actual Docker state | Resilience against out-of-band changes |
| Could | Log aggregation container (VictoriaLogs) | Better AI consumption of logs |
| Won't | Add/remove components from running environment | Deferred to v2 |
| Won't | JahiaCloudV1 provider | Deferred — placeholder remains |
| Won't | Multi-environment support | Deferred to v2 with port conflict resolution |

### MVP Scope

End-to-end lifecycle: `create` → `list` → `logs` → `stop` → `start` → `doctor` → `delete`, with state persistence and single-environment guard, all producing `--json` output.

### User Flow

```
# Human developer flow
jahia-cli environment create --component jahia --component pgsql
jahia-cli environment list
jahia-cli environment logs --component jahia
# ... develop and test ...
jahia-cli environment stop
# ... next day ...
jahia-cli environment start
jahia-cli environment doctor
# ... done ...
jahia-cli environment delete

# AI agent flow (all with --json)
jahia-cli environment create --component jahia --component pgsql --json
jahia-cli environment doctor --json
jahia-cli environment logs --component jahia --json
jahia-cli environment delete --json
```

---

## Technical Approach

**Feasibility**: HIGH

**Architecture Notes**

- Extends existing 3-layer architecture: Component Library → Provider Interface → CLI Commands
- Provider interface gains 3 new methods: `destroyEnvironment`, `startEnvironment`, `stopEnvironment`
- New state persistence layer: `src/lib/state/` with JSON file read/write
- State file location configurable via flag or env var, with sensible default
- Single-environment guard checks state file before `create`
- `logs` command wraps `docker logs` with optional `-f` (follow) support
- `list` command reads state + reconciles with live Docker status
- All commands support `--json` flag for structured output

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| State file out of sync with Docker | Medium | Reconcile state with `docker inspect` on every read; mark stale entries |
| Port conflicts if guard bypassed | Low | Guard is enforced at CLI level; document limitation |
| Docker CLI not available | Low | Existing `create` already requires Docker; fail fast with clear error |
| Cross-platform state file paths | Medium | Use `os.homedir()` + configurable path; test on all 3 OS |

---

## Implementation Phases

<!--
  STATUS: pending | in-progress | complete
  PARALLEL: phases that can run concurrently (e.g., "with 3" or "-")
  DEPENDS: phases that must complete first (e.g., "1, 2" or "-")
  PRP: link to generated plan file once created
-->

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 0 | Foundation merge | Merge PR #3 (environment-foundation) into main | pending | - | - | - |
| 1 | State persistence | Local JSON state file with read/write/reconcile operations | pending | - | 0 | - |
| 2 | Provider interface extension | Add `destroyEnvironment`, `startEnvironment`, `stopEnvironment` to Provider + Docker implementation | pending | - | 1 | - |
| 3 | Lifecycle commands | `environment start`, `environment stop`, `environment delete` commands | pending | - | 2 | - |
| 4 | Logs & list commands | `environment logs` and `environment list` commands | pending | with 3 | 2 | - |
| 5 | Single-environment guard | Prevent multiple environments; update `create` to enforce | pending | - | 1 | - |
| 6 | Output & documentation | `--json` on all commands, README update, Agents.md update | pending | - | 3, 4, 5 | - |

### Phase Details

**Phase 0: Foundation Merge**
- **Goal**: Get PR #3 merged so all new work builds on stable main
- **Scope**: Review, address feedback, merge `feat/environment-foundation`
- **Success signal**: PR #3 merged, main branch has environment commands

**Phase 1: State Persistence**
- **Goal**: Enable tracking environment state across CLI invocations
- **Scope**: `src/lib/state/` module — types, read/write/delete, reconciliation with Docker, configurable state directory
- **Success signal**: State file created on `environment create`, readable by other commands, reconciles with live Docker state

**Phase 2: Provider Interface Extension**
- **Goal**: Add lifecycle methods to Provider interface and Docker implementation
- **Scope**: Extend `Provider` type with `destroyEnvironment`, `startEnvironment`, `stopEnvironment`; implement in Docker provider using `docker stop`, `docker start`, `docker rm`, network/volume cleanup
- **Success signal**: Docker provider can stop, start, and destroy environments programmatically

**Phase 3: Lifecycle Commands**
- **Goal**: Users and agents can manage full environment lifecycle
- **Scope**: `environment start`, `environment stop`, `environment delete` commands with flags and `--json` output
- **Success signal**: Full create → stop → start → delete cycle works end-to-end

**Phase 4: Logs & List Commands**
- **Goal**: Visibility into environment state and container output
- **Scope**: `environment logs` (snapshot + optional follow mode, component filter) and `environment list` (all components with status)
- **Success signal**: Logs readable by humans and parseable by agents; list shows accurate live status

**Phase 5: Single-Environment Guard**
- **Goal**: Prevent port conflicts by enforcing one environment at a time
- **Scope**: Guard in `environment create` that checks state file; clear error message with suggestion to delete existing environment
- **Success signal**: Second `create` fails with actionable error; `delete` clears the guard

**Phase 6: Output & Documentation**
- **Goal**: All commands are agent-friendly and well-documented
- **Scope**: Ensure `--json` on all new commands, update README with full command reference, update Agents.md with lifecycle harness
- **Success signal**: An AI agent can discover and use all commands from docs and `--help` alone

### Parallelism Notes

Phases 3 and 4 can run in parallel since they both depend on Phase 2 but don't share files. All other phases are sequential. Phase 5 (guard) only needs Phase 1 (state) but should be validated after Phase 3 (lifecycle commands exist).

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| State persistence format | Local JSON file | SQLite, Docker labels only | Simplest approach; easy to read/debug; no extra dependencies |
| State file location | Configurable with default | Fixed location, project-local | Flexibility for different setups; default covers 90% of cases |
| Single-environment enforcement | CLI-level guard via state file | Port allocation system, Docker network isolation | Simplest v1 approach; avoids port conflict complexity |
| Log aggregation | Deferred (open question) | VictoriaLogs container, file-based | Need to validate AI agent log consumption patterns first |
| Multi-environment | Deferred to v2 | Build now with port ranges | Unnecessary complexity for v1; single env covers primary use case |
| Native Docker CLI | Keep (from foundation) | Docker API via HTTP, dockerode npm package | No extra dependencies; cross-platform; already proven in foundation |

---

## Research Summary

**Market Context**

- Tools like Tilt, DevSpace, Garden, and Skaffold solve dev environment orchestration but are Kubernetes-focused
- Docker Compose is the closest analog but requires users to understand Docker networking, env vars, and inter-service wiring
- No existing tool provides business-domain-aware component libraries where users request "Jahia + 3 browsing nodes + Postgres" and the tool handles plumbing
- The differentiator is **domain-specific abstraction** — encoding Jahia knowledge into the CLI

**Technical Context**

- Foundation PR (#3) establishes clean 3-layer architecture: Component Library → Provider Abstraction → CLI Commands
- 4 components defined (jahia, jahia-browsing, pgsql, elasticsearch) with dependency ordering
- Docker provider uses native `docker` CLI via `child_process.execFile` — no docker-compose dependency
- Provider interface needs 3 new methods for lifecycle management
- Output formatter already supports dual human/JSON output — pattern can be extended
- 42 existing tests cover components, config, Docker helpers, and commands

---

*Generated: 2026-05-02T11:50:00Z*
*Status: DRAFT - needs validation*

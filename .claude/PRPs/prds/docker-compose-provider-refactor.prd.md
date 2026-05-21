# Docker Compose Provider Refactor

## Problem Statement

Jahia CLI's Docker provider uses 20+ files of custom container orchestration logic (native `docker run`, dependency sorting, network creation, log forwarding). This complexity is hard to maintain, tightly couples environment-specific logic into jahia-cli, and prevents users from managing their environments with standard Docker Compose tooling directly.

## Evidence

- The current `src/lib/providers/docker/` directory contains 20 files implementing what docker-compose does natively
- Environment definitions (services, dependencies, healthchecks) are hardcoded in `src/lib/components/` instead of living in composable, shareable scaffolding files
- Users cannot use `docker compose` directly on their environments — they must always go through jahia-cli
- The jahia-cypress project already maintains a docker-compose service library at `scaffolding/environment/` designed for this exact composition pattern

## Proposed Solution

Replace the native Docker provider with a thin docker-compose wrapper. The environment spec (services, dependencies, healthchecks, ports, volumes) lives entirely in the scaffolding repository as composable YAML fragments. jahia-cli's role becomes: fetch scaffolding → prompt for service selection (driven by `config.yml` + `x-metadata`) → assemble a master `docker-compose.yml` with `include` directives → delegate lifecycle to `docker compose` commands.

## Key Hypothesis

We believe replacing native Docker commands with docker-compose orchestration will simplify jahia-cli maintenance and give developers direct compose-file access for their environments. We'll know we're right when the provider code shrinks by 70%+ and users can interchangeably use `jahia-cli environment start` or `docker compose up` on the same environment.

## What We're NOT Building

- Custom service definitions inside jahia-cli — all service logic lives in scaffolding
- Production deployment tooling — this targets dev/test/CI only
- Hot-reload or re-assembly of compose files after initial `init`
- Multi-environment support (one active environment at a time, as today)
- Health check logic inside jahia-cli — rely on compose's native healthchecks

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Provider code reduction | >70% fewer lines in docker provider | Line count comparison |
| Compose interoperability | Users can run `docker compose up/down` directly | Manual verification |
| Init-to-running time | Same or faster than current native approach | Timed comparison |
| CI pipeline compatibility | All lifecycle commands work in headless mode | CI test run |

## Open Questions

- [ ] Should the `Provider` interface be narrowed (fewer methods) now that compose handles orchestration?
- [ ] How should `.env` file generation work — does jahia-cli generate it or does the scaffolding provide a template?
- [ ] Should `environment status` parse `docker compose ps` output or use `docker compose ls`?
- [ ] How to handle the VictoriaLogs transparent infrastructure — as a service in the scaffolding or removed?

---

## Users & Context

**Primary User**
- **Who**: Jahia module developers and QA engineers setting up local test environments; CI/CD pipelines
- **Current behavior**: Run `jahia-cli environment create` which internally manages individual containers via native Docker CLI
- **Trigger**: Starting a new integration test project or needing a fresh Jahia environment with specific services
- **Success state**: A working multi-service environment managed by a standard docker-compose.yml that can be operated by jahia-cli OR docker compose directly

**Job to Be Done**
When I need a Jahia test environment, I want to select my services and get a working docker-compose setup, so I can start testing immediately and manage the environment with standard tools.

**Non-Users**
Production operations teams — this is explicitly not for production deployments. Users who only use Jahia Cloud (they use the JahiaCloudV1 provider instead).

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Init: fetch scaffolding + prompt services + assemble docker-compose.yml | Core value proposition — config-driven composition |
| Must | Create: `docker compose up -d` on assembled file | Replaces 200+ lines of native container orchestration |
| Must | Stop: `docker compose stop` | Direct delegation |
| Must | Start: `docker compose start` | Direct delegation |
| Must | Destroy: `docker compose down -v` | Direct delegation with volume cleanup |
| Must | Remove old native docker provider | Reduce maintenance burden |
| Should | Status: parse `docker compose ps` output | User visibility into environment state |
| Should | Logs: `docker compose logs` passthrough | Debugging support |
| Could | Doctor: validate compose file + docker version | Helpful diagnostics |
| Won't | Custom service logic in jahia-cli | Explicitly deferred — lives in scaffolding |
| Won't | Re-assembly after init | Compose file is generated once |

### MVP Scope

1. `jahia-cli init` — prompts for scaffolding location, fetches it, prompts for provider (docker), reads `config.yml`, prompts for services per group (respecting selection rules + ordering), assembles `docker-compose.yml` with `include` directives
2. `jahia-cli environment create` — runs `docker compose up -d` on the assembled file
3. `jahia-cli environment stop` — runs `docker compose stop`
4. `jahia-cli environment start` — runs `docker compose start`
5. `jahia-cli environment delete` — runs `docker compose down -v`
6. Remove old native docker provider code

### User Flow

```
jahia-cli init
  → "Configuration file name?" (as today)
  → "Directory?" (as today)
  → Fetches scaffolding from jahia-cypress (as today)
  → "Provider?" → docker selected
  → Stores docker-compose.yml location in config
  → Reads environment/services/config.yml from scaffolding
  → For each group (ordered by config):
      - always_included → auto-select, inform user
      - at_most_one → prompt single selection (or skip)
      - zero_or_more → prompt multi-selection
  → Assembles docker-compose.yml with include directives
  → Done — compose file ready

jahia-cli environment create
  → Reads compose file path from config/state
  → Runs `docker compose -f <path> up -d`
  → Reports status

jahia-cli environment stop/start/delete
  → Delegates to corresponding docker compose command
```

---

## Technical Approach

**Feasibility**: HIGH

**Architecture Notes**
- New provider: `src/lib/providers/docker-compose/` — thin wrapper around `docker compose` CLI
- Reuse existing `clone-scaffolding.ts` pattern for fetching environment scaffolding
- Parse `config.yml` and service `x-metadata` using existing YAML parsing (js-yaml)
- Assemble compose file by writing `include:` directives + `networks: stack:` block
- Store compose file path in jahia-cli state for lifecycle commands
- Provider interface simplified: methods just shell out to `docker compose` with appropriate flags

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Docker Compose v2.20+ not available | Low | Doctor command checks version; clear error message |
| `include` directive behavior differences across versions | Low | Pin minimum version, test on CI |
| Scaffolding repo unavailable during init | Medium | Graceful error, offline fallback instructions |
| Service `x-metadata` parsing complexity | Low | Well-defined schema in scaffolding README |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Scaffolding fetch for environment | Add environment scaffolding clone alongside existing tests scaffolding | in-progress | - | - | `plans/docker-compose-provider-refactor.plan.md` |
| 2 | Service discovery & prompting | Parse config.yml + x-metadata, prompt user for service selection | in-progress | - | 1 | `plans/docker-compose-provider-refactor.plan.md` |
| 3 | Compose file assembly | Generate docker-compose.yml with include directives from selections | in-progress | - | 2 | `plans/docker-compose-provider-refactor.plan.md` |
| 4 | Docker Compose provider | New provider implementing create/stop/start/destroy via `docker compose` CLI | in-progress | with 3 | 1 | `plans/docker-compose-provider-refactor.plan.md` |
| 5 | Init flow refactor | Reorder init: scaffolding → provider → service selection → assembly | in-progress | - | 3, 4 | `plans/docker-compose-provider-refactor.plan.md` |
| 6 | Remove native docker provider | Delete old provider code and component registry | in-progress | - | 5 | `plans/docker-compose-provider-refactor.plan.md` |
| 7 | State & config adaptation | Update state/config types to store compose file path instead of component list | in-progress | with 4 | 1 | `plans/docker-compose-provider-refactor.plan.md` |
| 8 | Lifecycle commands update | Update environment create/stop/start/delete to use new provider | in-progress | - | 4, 7 | `plans/docker-compose-provider-refactor.plan.md` |

### Phase Details

**Phase 1: Scaffolding fetch for environment**
- **Goal**: Fetch the environment service library from the scaffolding repo
- **Scope**: New function to clone/copy `scaffolding/environment/` directory to the project workspace
- **Success signal**: Can programmatically access `config.yml` and `services/*.yml` after fetch

**Phase 2: Service discovery & prompting**
- **Goal**: Read config.yml groups + parse x-metadata from each service file to build prompt flow
- **Scope**: Parse YAML, build ordered group list, discover services per group, enforce selection rules
- **Success signal**: Unit tests verify correct group ordering, service-to-group mapping, and selection rule enforcement

**Phase 3: Compose file assembly**
- **Goal**: Generate a valid docker-compose.yml from user selections
- **Scope**: Write `include:` directives for selected services + `networks: stack:` definition
- **Success signal**: Generated file passes `docker compose config` validation

**Phase 4: Docker Compose provider**
- **Goal**: Implement Provider interface using `docker compose` CLI commands
- **Scope**: `up -d`, `stop`, `start`, `down -v`, `ps --format json` for status
- **Success signal**: All provider methods work against a real compose file

**Phase 5: Init flow refactor**
- **Goal**: Reorder init to: scaffolding first → provider choice → service selection → assembly
- **Scope**: Refactor `src/commands/init.ts` to new flow
- **Success signal**: `jahia-cli init` produces a working config + compose file

**Phase 6: Remove native docker provider**
- **Goal**: Delete old native Docker code to reduce maintenance surface
- **Scope**: Remove `src/lib/providers/docker/`, `src/lib/components/` (service definitions), related tests
- **Success signal**: Build passes, no dead code references

**Phase 7: State & config adaptation**
- **Goal**: Config/state types store compose file path and provider metadata
- **Scope**: Update `EnvironmentConfig`, `StateFile`, `PersistedEnvironment` types
- **Success signal**: State correctly persists compose file location across commands

**Phase 8: Lifecycle commands update**
- **Goal**: All `environment` subcommands use new docker-compose provider
- **Scope**: Update create, stop, start, delete, status commands
- **Success signal**: Full lifecycle works end-to-end

### Parallelism Notes

- Phases 3 and 4 can run in parallel (compose assembly is independent of provider implementation)
- Phase 7 can run in parallel with Phase 4 (type changes don't depend on provider logic)
- Phases 6 and 8 must wait for the new system to be working

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Orchestration engine | Docker Compose via CLI | Docker SDK, Podman, native docker | Standard tooling, minimal custom code, user can interact directly |
| Service definitions location | External scaffolding repo | In jahia-cli, in config file | Decouples env logic from CLI, shareable across projects |
| Compose assembly strategy | `include` directives | Copy service content inline, profiles | Clean separation, each service self-contained, easy to add/remove |
| Old provider | Remove entirely | Keep as fallback | Reduces maintenance, no user need for both |
| Provider interface | Simplify to compose commands | Keep complex interface | Compose handles what the old 20-file provider did |

---

## Research Summary

**Market Context**
- Docker Compose `include` (v2.20+, GA since mid-2023) is the modern approach for modular compose files
- Alternatives like `extends` or multiple `-f` flags are older/less clean
- Tools like Tilt, DevContainers, and Dagger solve similar problems but add dependencies

**Technical Context**
- Current provider: 20 files, ~800 lines of custom orchestration logic
- Scaffolding repo already has the complete service library with config.yml + x-metadata schema
- Existing `clone-scaffolding.ts` provides the git clone pattern to reuse
- `@inquirer/prompts` already in use for interactive selection (select, checkbox, confirm)

---

*Generated: 2026-05-21T21:48:00Z*
*Status: DRAFT - needs validation*

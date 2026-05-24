# Docker Compose Provider for jahia-cli

## Problem Statement

Jahia developers, QA engineers, and CI/CD pipelines need to manage multi-service test environments (Jahia + database + search + testing tools). The current native Docker provider requires jahia-cli to internally manage container orchestration (networking, dependencies, startup order), creating maintenance burden and coupling CLI code to Docker internals. Docker Compose already handles this natively — the CLI should be a thin orchestration layer, not a container runtime.

## Evidence

- The existing Docker provider has 20+ files managing individual containers, networks, volumes, port mapping, health checks, and dependency ordering — all of which Docker Compose handles out of the box
- The `jahia-cypress` scaffolding repository already provides a well-structured service library with `x-metadata` and `config.yml` defining groups, selection rules, and dependencies
- Docker Compose `include` directive (v2.20+) enables modular service composition without CLI-side logic
- Maintenance burden: any new service (e.g., Redis, Kafka) requires code changes in jahia-cli under the Docker provider; with docker-compose, it's just a new YAML file in the scaffolding

## Proposed Solution

Implement a `docker-compose` provider that delegates all container orchestration to Docker Compose. The CLI's responsibility is limited to: (1) reading service metadata from the scaffolding, (2) prompting the user to select services based on `config.yml` groups and selection rules, (3) writing the `include:` directives into the master `docker-compose.yml`, and (4) invoking `docker compose` commands for lifecycle management. All service relationships, dependencies, and configuration live in the scaffolding repository, not in jahia-cli code.

## Key Hypothesis

We believe a docker-compose-based provider with externalized service definitions will eliminate CLI maintenance burden for environment orchestration while giving developers/QA a simpler, more flexible experience. We'll know we're right when the full environment lifecycle (create → start → stop → delete) works from the generated compose file with zero service-specific logic in jahia-cli.

## What We're NOT Building

- Removing the existing Docker provider — explicitly deferred to a follow-up task
- Production deployment capabilities — this is for dev/test/CI only
- Custom inter-service logic inside jahia-cli — all relationships via `config.yml` and `x-metadata` `requires`
- Service health monitoring beyond what `docker compose ps` provides
- Inline editing of service YAML files — users modify scaffolding directly if needed

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Full lifecycle works | 100% of environment commands functional | Manual + CI test: create → list → logs → stop → start → delete |
| Zero service-specific code | 0 hardcoded service names in provider | Code review — provider is generic |
| Init prompt correctness | Respects all selection rules from config.yml | Unit tests for each rule type |
| Scaffolding-driven | Adding a new service requires 0 CLI code changes | Add a service YAML to scaffolding, verify it appears in prompts |

## Open Questions

- [ ] Should `environment logs` use `docker compose logs <service>` or `docker logs <container_name>`? (Recommend: `docker compose logs` for consistency)
- [ ] Should the provider support `.env` file generation/management, or assume users provide their own? (Recommend: assume user provides, document required vars)
- [ ] Should `environment list` parse `docker compose ps` output or use `docker compose ps --format json`? (Recommend: JSON format for reliability)
- [ ] For CI/CD non-interactive use: how are services pre-selected without prompts? (Recommend: the config file stores selected services, `--config` flag skips prompts)

---

## Users & Context

**Primary User**
- **Who**: Jahia developer or QA engineer setting up local test environments; CI/CD pipeline running automated tests
- **Current behavior**: Manually configure Docker containers or use the existing Docker provider which requires CLI code for every new service
- **Trigger**: Starting work on a feature/fix that needs a running Jahia environment with specific services (database, search, LDAP, etc.)
- **Success state**: Running environment with all selected services healthy, accessible at known ports, ready for testing

**Job to Be Done**
When I need a Jahia test environment with specific services, I want to select my services from a menu and have them start together correctly, so I can focus on development/testing instead of Docker configuration.

**Non-Users**
- Production operations teams — this is explicitly for dev/test/CI
- Users without Docker installed — Docker Compose v2.20+ is a hard requirement
- Users who need fine-grained container control — they should use Docker directly

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Docker Compose provider implementing full Provider interface | Core deliverable — all lifecycle commands must work |
| Must | Init flow reading `config.yml` groups and prompting per selection rules | Users need guided service selection |
| Must | `x-metadata` parsing from service YAML files for names, descriptions, dependencies | Required for prompts and dependency resolution |
| Must | Writing `include:` directives to master `docker-compose.yml` | The only file-write responsibility of the CLI |
| Must | Dependency auto-resolution from `requires` in `x-metadata` | If user picks Kibana, Elasticsearch must be auto-included |
| Must | Non-interactive mode via `--config` flag (services pre-defined in config) | CI/CD pipelines can't prompt |
| Should | `environment logs` via `docker compose logs <service>` | Consistent with compose ecosystem |
| Should | Store selected services in `jahia-cli.config.yml` for repeatability | Users shouldn't re-select every time |
| Could | Validation that Docker Compose v2.20+ is installed | Nice guardrail, not blocking |
| Won't | Custom inter-service startup ordering in CLI | Docker Compose `depends_on` handles this |
| Won't | Inline `.env` file generation | Users manage their own env vars |

### MVP Scope

1. New `docker-compose` provider with `createEnvironment`, `stopEnvironment`, `startEnvironment`, `destroyEnvironment`, `getEnvironmentStatus`, `checkHealth`
2. Init flow extended: provider selection → if docker-compose, read scaffolding config.yml + x-metadata → prompt per group → write master docker-compose.yml
3. Config type extended: `EnvironmentConfig` gains optional `composePath` field for docker-compose provider
4. All existing environment commands work transparently with the new provider
5. State file stores provider type + compose path for subsequent operations

### User Flow

```
1. jahia-cli init
   → "Select provider: docker-compose"
   → Scaffolding fetched (jahia-cypress/test-jahia-cli)
   → config.yml parsed → groups sorted by order
   → Group "Jahia Core" (always_included) → auto-selected
   → Group "Database" (at_most_one) → prompt: [postgres-16, postgres-17, postgres-18, mariadb-10, skip]
   → Group "Cluster Nodes" (zero_or_more) → prompt: [jahia-browsing-a, -b, -c]
   → ... remaining groups ...
   → Dependency resolution (e.g., Kibana requires Elasticsearch)
   → Write include: directives to ./environment/docker-compose.yml
   → Write config to jahia-cli.config.yml

2. jahia-cli environment create --config jahia-cli.config.yml
   → Reads composePath from config
   → Runs: docker compose -f <path> up -d
   → Persists state (provider: docker-compose, composePath, services list)

3. jahia-cli environment list
   → Runs: docker compose -f <path> ps --format json
   → Displays service statuses

4. jahia-cli environment logs --component jahia
   → Runs: docker compose -f <path> logs jahia --tail 100

5. jahia-cli environment stop
   → Runs: docker compose -f <path> stop

6. jahia-cli environment start
   → Runs: docker compose -f <path> start

7. jahia-cli environment delete
   → Runs: docker compose -f <path> down -v
```

---

## Technical Approach

**Feasibility**: HIGH

**Architecture Notes**
- New provider at `src/lib/providers/docker-compose/` — completely independent of `src/lib/providers/docker/`
- Provider interface signature takes `components: readonly ResolvedComponent[]` but docker-compose provider ignores it — uses `composePath` from persisted state instead
- Config type `EnvironmentConfig` extended with optional `composePath?: string` and optional `services?: readonly string[]` (selected service file names)
- Init flow gains a provider selection step; when `docker-compose` is chosen, an entirely different prompt path runs (reading `config.yml` + `x-metadata`)
- All `docker compose` invocations use `-f <composePath>` to be explicit about which file
- The `--project-name` flag ensures isolation when multiple environments exist

**Key Design Decisions**
- The docker-compose provider does NOT use the component registry (`src/lib/components/`) at all — it's compose-native
- Service metadata parsing (`x-metadata`, `config.yml`) lives in its own module (`src/lib/providers/docker-compose/`) since it's provider-specific
- State file stores `composePath` so subsequent commands know where to find the compose file
- The provider is self-contained: removing the Docker provider later requires no changes to the docker-compose provider

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Docker Compose version too old on user system | Medium | Check version at init time, warn if < 2.20 |
| `docker compose ps --format json` output varies by version | Low | Parse conservatively, handle missing fields |
| Scaffolding fetch fails (network issues) | Low | Already handled by existing scaffolding fetch logic |
| YAML parsing of `x-metadata` breaks on unusual content | Low | Validate with schema, use existing YAML parser |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Provider foundation | Create docker-compose provider skeleton implementing Provider interface with `docker compose` CLI calls | complete | - | - | `.claude/PRPs/plans/completed/docker-compose-provider-foundation.plan.md` |
| 2 | Config & types extension | Extend EnvironmentConfig, state types, and provider registry to support docker-compose | complete | with 1 | - | `.claude/PRPs/plans/completed/docker-compose-provider-foundation.plan.md` |
| 3 | Service metadata parsing | Parse `config.yml` groups and `x-metadata` from service YAML files, resolve dependencies | complete | - | 1 | - |
| 4 | Init flow integration | Add provider selection to init, implement docker-compose-specific prompt flow using parsed metadata | complete | - | 2, 3 | - |
| 5 | Compose file writer | Write `include:` directives to master docker-compose.yml based on user selections | complete | - | 3 | - |
| 6 | Command integration | Ensure all environment commands (create, start, stop, delete, list, logs) work with docker-compose provider | complete | - | 1, 2, 4, 5 | - |
| 7 | Tests & validation | Unit tests for all pure functions, integration tests for CLI commands with docker-compose provider | in-progress | - | 6 | - |

### Phase Details

**Phase 1: Provider Foundation**
- **Goal**: A working docker-compose provider that can run `docker compose` lifecycle commands
- **Scope**: `src/lib/providers/docker-compose/` with individual function files for each operation (up, stop, start, down, ps, logs), plus the provider object wiring them together
- **Success signal**: `docker compose up -d` / `stop` / `start` / `down -v` / `ps --format json` / `logs` can be invoked programmatically

**Phase 2: Config & Types Extension**
- **Goal**: The type system and provider registry support docker-compose as a first-class provider
- **Scope**: Extend `EnvironmentConfig` with `composePath`/`services`, add `'docker-compose'` to `ProviderName`, register provider, extend state types
- **Success signal**: `getProvider('docker-compose')` returns the new provider; config files with `provider: docker-compose` parse correctly

**Phase 3: Service Metadata Parsing**
- **Goal**: Parse the scaffolding's `config.yml` and `x-metadata` into typed data structures
- **Scope**: Types for groups/metadata/dependencies, YAML parsing functions, dependency resolution algorithm
- **Success signal**: Given a services directory, produce a fully typed structure of groups with their services, selection rules, and resolved dependencies

**Phase 4: Init Flow Integration**
- **Goal**: `jahia-cli init` can guide users through docker-compose service selection
- **Scope**: Provider choice prompt, group-by-group service selection respecting rules (`always_included`, `at_most_one`, `zero_or_more`), dependency auto-resolution with user notification
- **Success signal**: Interactive init produces a valid config with selected services

**Phase 5: Compose File Writer**
- **Goal**: Write the master docker-compose.yml with correct `include:` entries
- **Scope**: Pure function that takes selected service paths and produces the YAML content with include directives + networks section
- **Success signal**: Generated file passes `docker compose config` validation

**Phase 6: Command Integration**
- **Goal**: All `environment` commands work transparently with docker-compose provider
- **Scope**: Ensure `create` uses compose path from config, `start/stop/delete/list/logs` read compose path from state, adapt state persistence for compose-based environments
- **Success signal**: Full lifecycle (create → list → logs → stop → start → delete) works end-to-end

**Phase 7: Tests & Validation**
- **Goal**: Comprehensive test coverage for all new code
- **Scope**: Unit tests for metadata parsing, dependency resolution, compose file writing, provider functions; integration tests for init flow and lifecycle commands
- **Success signal**: All tests pass, coverage threshold maintained

### Parallelism Notes

Phases 1 and 2 can run in parallel — the provider skeleton and the type extensions are independent. All other phases have sequential dependencies due to the layered nature of the implementation.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Provider independence | docker-compose provider shares NO code with docker provider | Shared utilities layer | Future removal of docker provider is easier; compose is fundamentally different |
| Compose file location | Stored as `composePath` in config and state | Hardcoded convention | Flexibility for different project layouts |
| Service metadata source | `x-metadata` in YAML + `config.yml` for groups | Separate metadata JSON file | Standard Docker Compose extension mechanism; single source of truth |
| Lifecycle commands | Use `docker compose` CLI (not Docker SDK) | Docker SDK / API | Simpler, cross-platform, matches existing pattern |
| Dependency resolution | Auto-include required services, notify user | Block and require manual selection | Better UX, fewer errors |
| Project isolation | `--project-name` flag with env name | Docker Compose default naming | Multiple environments can coexist |
| Logs command | `docker compose logs <service>` | `docker logs <container>` | Consistent with compose workflow, handles replicas |
| Init stores services | Selected services saved in `jahia-cli.config.yml` | Only written to docker-compose.yml | Enables non-interactive recreation via --config |

---

## Research Summary

**Market Context**
- Docker Compose `include` (GA in v2.20, June 2023) is the standard mechanism for modular multi-file composition
- Tools like Tilt, DevContainers, and Lando all use Docker Compose as their underlying engine with thin orchestration layers on top
- The pattern of "metadata in extension fields + external tool reads it" is an established Docker Compose ecosystem convention (`x-` prefixed keys)

**Technical Context**
- jahia-cli's `Provider` interface cleanly abstracts lifecycle operations — adding a new provider requires implementing 6 methods
- The existing init flow is modular with pure functions for each prompt section — extending it with a new path is straightforward
- State persistence already stores `provider` name, making dispatch automatic for subsequent commands
- The scaffolding repo has a complete service library ready to use with well-defined metadata schema

---

*Generated: 2026-05-22T22:47:00Z*
*Status: DRAFT - needs validation*

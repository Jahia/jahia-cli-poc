# Environment Creation Refactor — Jahia-First with VictoriaLogs

## Problem Statement

The current environment creation system scatters component complexity prematurely — it defines pgsql, elasticsearch, and jahia-browsing as equal peers to Jahia, requiring users to manually compose dependencies. In reality, Jahia is the **core component** that must always be present, and everything else is an optional extension. Furthermore, there is no centralized logging solution, making it difficult for AI agents to consume container logs programmatically.

## Evidence

- The existing `jahia.ts` component hardcodes `dependsOn: ['pgsql', 'elasticsearch']`, forcing external database usage even though Jahia ships with an embedded Derby database suitable for development.
- The interactive mode presents all components as a flat checkbox list with no guidance, offering no opinionated default path.
- No logging infrastructure exists — `environment logs` tails individual containers without aggregation or query capability.
- AI-assisted development workflows require structured, queryable logs accessible via HTTP API.

## Proposed Solution

Refactor the component system to make **Jahia the mandatory core** that starts with Derby by default. Always transparently deploy a **VictoriaLogs** container alongside any environment to aggregate all container logs and expose them via an HTTP query API optimized for AI agent consumption. Build extensible scaffolding so additional components (databases, search, jCustomer, browsing nodes, utility containers) can be added incrementally without architectural rework.

## Key Hypothesis

We believe that a Jahia-first environment with transparent log aggregation will reduce time-to-first-environment for new developers from minutes of configuration to a single command, while enabling AI agents to query structured logs. We'll know we're right when `jahia-cli environment create` (with no flags) produces a running Jahia with queryable logs in under 60 seconds of user interaction.

## What We're NOT Building

- **JahiaCloudV1 implementation** — placeholder provider interface only, no API calls
- **Database selection in JahiaCloudV1** — not applicable to cloud provider
- **Full Elasticsearch/jCustomer/browsing implementation** — only scaffolding/interfaces for now
- **Log rotation/retention policies** — VictoriaLogs handles this internally
- **Web UI for logs** — API-only, optimized for agents

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Time to first environment (interactive mode) | < 30s user interaction | Manual testing of interactive flow |
| Containers running after create | 2 (Jahia + VictoriaLogs) | `docker ps` count |
| Log query latency | < 500ms | curl to VictoriaLogs API |
| Build passes | Zero errors | `npm run build && npm run lint && npm test` |

## Open Questions

- [ ] Should VictoriaLogs port (9428) be exposed to the host by default, or only on the Docker network?
- [ ] What Jahia image tag should be the default? (currently `8.2.1.0` — confirm latest)
- [ ] Should the interactive mode ask for an environment name or auto-generate one?
- [ ] What log retention period should VictoriaLogs use by default?

---

## Users & Context

**Primary User**
- **Who**: Jahia developer or QA engineer starting a local development/test environment
- **Current behavior**: Manually runs docker-compose or selects multiple components via checkbox without understanding dependencies
- **Trigger**: Needs a working Jahia instance to develop modules, test features, or run automated tests
- **Success state**: Jahia is running, healthy, and logs are queryable

**Secondary User**
- **Who**: AI coding agent (Copilot, Claude Code) orchestrating test environments
- **Current behavior**: Parses unstructured docker logs, no query API
- **Trigger**: Needs to create environments programmatically and query logs for debugging
- **Success state**: `--json` mode creates environment, returns VictoriaLogs endpoint for log queries

**Job to Be Done**
When I need a Jahia environment for development, I want to run a single command that gives me a working Jahia with queryable logs, so I can start developing immediately without configuring infrastructure.

**Non-Users**
- Production operators (this is for dev/test only)
- Users who need Jahia Cloud environments (deferred to JahiaCloudV1 provider later)

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Jahia starts with embedded Derby by default | Simplest path to working environment |
| Must | VictoriaLogs container auto-deployed transparently | AI agent log consumption requirement |
| Must | All container logs forwarded to VictoriaLogs | Centralized queryable logging |
| Must | Interactive mode creates environment without config file | First-run experience |
| Must | Extensible component registry with category system | Support for future database, search, jCustomer, etc. |
| Should | Component scaffolding for pgsql, mariadb, elasticsearch, jCustomer, browsing nodes | Architecture readiness |
| Should | Config file can define custom containers | Extensibility for openldap, mailpit, cypress, etc. |
| Could | VictoriaLogs pre-configured query templates for common Jahia log patterns | Developer convenience |
| Won't | JahiaCloudV1 provider implementation | Deferred — placeholder only |
| Won't | Database selection UI in interactive mode | Phase 2 work |

### MVP Scope (Phase 1)

- `environment create` interactive mode asks minimal questions (or none — just starts Jahia + VictoriaLogs)
- Jahia runs with Derby (no external DB dependency)
- VictoriaLogs container starts automatically, collects logs from all environment containers
- VictoriaLogs HTTP API exposed for log queries (port 9428)
- Docker log driver configured to forward to VictoriaLogs (via syslog or docker log driver)
- Existing commands (stop, start, delete, list, logs, doctor, alive) continue to work
- `--json` output includes VictoriaLogs endpoint information

### User Flow (Interactive Mode)

```
$ jahia-cli environment create

  Creating Jahia environment...
  
  ℹ No configuration file found. Starting interactive setup.
  
  ? Jahia version: (8.2.1.0) ▌
  
  ✓ Environment name: jahia-env-abc123
  ✓ Provider: docker
  ✓ Starting VictoriaLogs (log aggregation)...
  ✓ Starting Jahia 8.2.1.0 (Derby database)...
  
  Environment created successfully!
  
  Jahia:        http://localhost:8080
  Logs API:     http://localhost:9428
  
  Query logs:   curl 'http://localhost:9428/select/logsql/query?query=*'
```

---

## Technical Approach

**Feasibility**: HIGH

**Architecture Notes**

1. **Component Categories** — Replace flat registry with categorized system:
   - `core` — Jahia (always required)
   - `infrastructure` — VictoriaLogs (always deployed, transparent)
   - `database` — pgsql, mariadb (optional extensions, Docker-only)
   - `search` — elasticsearch (optional extension)
   - `application` — jCustomer, jahia-browsing (optional, multi-instance capable)
   - `utility` — openldap, mailpit, cypress (optional)
   - `custom` — user-defined in config file

2. **Log Forwarding Strategy** — Use Docker's `--log-driver=fluentd` or direct `docker logs` piping to VictoriaLogs syslog input. Alternative: VictoriaLogs can scrape Docker API directly via `docker_sd_configs`. Preferred approach: use Docker's native JSON file driver and have VictoriaLogs use the Docker log collection agent (vlogscollector) OR simply pipe logs via Docker's syslog driver to VictoriaLogs syslog listener.

3. **Transparent Infrastructure** — VictoriaLogs is never shown in user-facing component selection; it's always started as infrastructure. The component type system differentiates between user-selectable and automatic components.

4. **Multi-Instance Components** — Some components (jCustomer, jahia-browsing) can have multiple instances. The registry must support instance count and unique naming (e.g., `jcustomer-1`, `jcustomer-2`).

5. **Provider Constraints** — The component definition should declare which providers support it (e.g., database selection is Docker-only). The interactive mode filters choices based on active provider.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Docker log driver config complexity | Medium | Start with simplest approach (syslog driver → VictoriaLogs syslog input) |
| VictoriaLogs container readiness race | Low | Start VictoriaLogs first, wait for health before starting other containers |
| Port conflicts (8080, 9428) | Medium | Document port requirements, support port override in config |
| Large log volume in dev | Low | VictoriaLogs handles well; add retention config later |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Core Refactor | Remove old components, refactor types, implement Jahia+VictoriaLogs | complete | - | - | `.claude/PRPs/reports/environment-core-refactor-report.md` |
| 2 | Interactive Mode | Streamlined interactive flow for first-run experience | pending | - | 1 | - |
| 3 | Database Extensions | Add pgsql & MariaDB as optional components (Docker-only) | pending | with 4 | 2 | - |
| 4 | Search & Applications | Add elasticsearch, jCustomer, browsing node scaffolding | pending | with 3 | 2 | - |
| 5 | Custom Containers | Support user-defined containers in config file | pending | - | 3, 4 | - |
| 6 | Utility Containers | Add openldap, mailpit, cypress definitions | pending | - | 5 | - |

### Phase Details

**Phase 1: Core Refactor**
- **Goal**: Clean slate — Jahia + VictoriaLogs as the minimal working environment
- **Scope**:
  - Remove `pgsql.ts`, `elasticsearch.ts`, `jahia-browsing.ts` from active registry
  - Refactor component types to include `category`, `providerSupport`, `isTransparent`, `multiInstance`
  - Create `victorialogs.ts` component definition
  - Update `jahia.ts` to use Derby by default (remove pgsql/elasticsearch deps)
  - Update Docker provider to handle log forwarding configuration
  - Ensure VictoriaLogs starts before Jahia, configured for AI-friendly log access
  - Update tests
- **Success signal**: `npm run build && npm test` passes; `environment create --component jahia` starts Jahia + VictoriaLogs with logs flowing

**Phase 2: Interactive Mode**
- **Goal**: First-run UX that creates a working environment with minimal questions
- **Scope**:
  - Detect absence of config file → enter interactive mode
  - Ask only essential questions (Jahia version, environment name optional)
  - Auto-select Jahia + VictoriaLogs
  - Display clear success output with endpoints
  - Support `--json` for agent consumption
- **Success signal**: Running `jahia-cli environment create` with no flags produces a working environment

**Phase 3: Database Extensions**
- **Goal**: Allow users to opt into an external database instead of Derby
- **Scope**:
  - Add `pgsql.ts` and `mariadb.ts` component definitions (new versions)
  - Interactive mode asks "Use external database?" → choice of pgsql/mariadb
  - Update Jahia env vars when external DB is selected
  - Mark as Docker-only (not available on JahiaCloudV1)
  - Tests for database component resolution
- **Success signal**: `environment create` can optionally start with pgsql or mariadb

**Phase 4: Search & Applications**
- **Goal**: Scaffolding for elasticsearch, jCustomer, and additional Jahia browsing nodes
- **Scope**:
  - `elasticsearch.ts` component (single or cluster mode)
  - `jcustomer.ts` component (multi-instance capable)
  - `jahia-browsing.ts` component (multi-instance capable)
  - Interactive mode presents these as optional additions
  - Instance count selection for multi-instance components
- **Success signal**: Component definitions exist, types support multi-instance, interactive mode offers them

**Phase 5: Custom Containers**
- **Goal**: Config file can define arbitrary containers not in the registry
- **Scope**:
  - Extend config schema with `custom` container section
  - Parser resolves custom containers with full Docker options
  - Custom containers participate in log forwarding
  - Validation for custom container definitions
- **Success signal**: A config YAML with a custom container definition deploys successfully

**Phase 6: Utility Containers**
- **Goal**: Common utility containers available in registry
- **Scope**:
  - `openldap.ts`, `mailpit.ts`, `cypress.ts` definitions
  - Integration with Jahia (LDAP config, SMTP config, test runner endpoints)
- **Success signal**: Utility containers can be added via config or interactive mode

### Parallelism Notes

Phases 3 and 4 can run in parallel because they add independent component types that don't depend on each other — only on the base architecture from Phase 2.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Default database | Derby (embedded) | PostgreSQL | Minimizes dependencies for quickest start; pgsql available as opt-in |
| Log aggregation | VictoriaLogs | Loki, Elasticsearch, plain files | Lightweight, single binary, LogsQL query language, free, designed for high cardinality |
| Log collection method | Docker syslog driver → VictoriaLogs syslog input | Fluentd, Filebeat, Docker API scraping | Simplest Docker-native approach, no extra agent needed |
| Component visibility | Transparent (auto) vs User-selectable | All visible | VictoriaLogs is infrastructure, not a user choice |
| Multi-instance | Supported in type system from start | Add later | jCustomer and browsing nodes need it; cheaper to design in now |
| Provider constraints | Per-component declaration | Global config | Some components (DB selection) are Docker-only; must be explicit |

---

## Research Summary

**Market Context**
- VictoriaLogs is a lightweight, high-performance log management solution from VictoriaMetrics
- Exposes LogsQL query language via HTTP API at `/select/logsql/query`
- Supports syslog input on port 514 (TCP/UDP) for receiving Docker logs
- Single binary, minimal resource usage — ideal for dev environments
- Docker's `--log-driver=syslog` can forward directly without additional agents

**Technical Context (Existing Codebase)**
- Component registry pattern at `src/lib/components/index.ts` is extensible — add file + register
- Docker provider at `src/lib/providers/docker/index.ts` handles topological sort, network creation, volume management
- State system at `src/lib/state/` persists environment info to JSON — supports single active environment
- Config parser at `src/lib/config/parser.ts` reads YAML and resolves components
- Interactive mode uses `@inquirer/prompts` — already a dependency
- Container naming: `jahia-cli-{envName}-{componentName}` pattern established
- Network naming: `jahia-cli-{envName}` pattern established

---

*Generated: 2026-05-08T17:25:00Z*
*Status: DRAFT — ready for review*

# Simplify Init Command — Optional Services

## Problem Statement

Developers creating new Jahia test projects face unnecessary complexity in the `init` wizard. The current system uses a group-based service selection model (`config.yml` with `always_included`/`at_most_one`/`zero_or_more` rules) that requires understanding service groups, dependencies, and validation rules. This slows down project creation when the goal is simply: start with a working Jahia + Postgres setup, optionally add extras.

## Evidence

- The scaffolding already provides a master `docker-compose.yml` that represents a minimal working setup (Jahia + Postgres)
- The `config.yml` group system was built for flexibility that's never been needed — in practice, the default is always used
- Previous session already removed Derby support and the interactive service selection prompt, confirming the simplification direction

## Proposed Solution

Replace the group-based service selection system with a simple model: the master `docker-compose.yml` from scaffolding IS the default environment. Each service `.yml` file declares `optional: true` in its `x-metadata` if it can be added on top. During init, users see a single alphabetical checkbox of optional services and can pick any they want. The compose file is updated in place by injecting `include:` directives.

## Key Hypothesis

We believe a single checkbox prompt showing optional services alphabetically will let developers create test projects faster and with less confusion than the current group-based system. We'll know we're right when `init` requires fewer steps and no knowledge of service groups.

## What We're NOT Building

- Changes to the scaffolding repository itself — that's external
- Changes to the non-interactive `--config` re-sync beyond removing `config.yml` dependency
- Changes to the provider abstraction or jahiacloudv1
- Production deployment tooling

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Interactive prompts in happy path | ≤ 4 (config path, scaffolding, provider, optional services) | Manual count |
| Dead code removed | 100% of group system code | Files deleted |
| Tests pass | All existing + new tests green | `npm test` |

## Open Questions

- [ ] Should optional services show their `description` from x-metadata in the checkbox?
- [ ] Should the hint about customizing env vars appear before or after the checkbox?

---

## Users & Context

**Primary User**
- **Who**: Jahia developer starting a new test project
- **Current behavior**: Runs `jahia-cli init`, navigates multiple prompts about groups and service types, often just accepts defaults
- **Trigger**: Creating a new test project that needs a local Jahia environment
- **Success state**: Working `docker-compose.yml` with Jahia + Postgres + any selected extras, ready to `docker compose up`

**Job to Be Done**
When I start a new Jahia test project, I want to get a working docker environment with minimal decisions, so I can focus on writing tests rather than configuring infrastructure.

**Non-Users**
- Production deployers (use different tooling)
- Cloud provider users (jahiacloudv1 skips the compose step entirely)

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Sync scaffolding uniformly (no skipDirectories) | Simplifies file handling |
| Must | Master docker-compose.yml from scaffolding is the default (not generated) | Removes assembly complexity |
| Must | Single checkbox prompt showing optional services alphabetically | Simple UX |
| Must | `optional: true` flag in x-metadata determines which services are shown | No config.yml needed |
| Must | Update compose file in place (inject includes between header and networks) | Preserve scaffolding structure |
| Must | Hint about customizing environment variables | User guidance |
| Must | Remove dead code: config.yml parsing, group system, validateSelection, promptServiceSelection | Clean codebase |
| Must | Keep provider selection prompt (Docker vs jahiacloudv1) | Future extensibility |
| Should | Show service description in checkbox choices | Better UX |
| Won't | Change scaffolding repository | Out of scope |

### MVP Scope

1. Add `optional?: boolean` to `ServiceMetadata`
2. In interactive init: after syncing scaffolding, discover services, filter to `optional: true`, present alphabetical checkbox
3. Update docker-compose.yml in place with selected optional services
4. Show hint about env var customization
5. Remove: `parseServicesConfig`, `promptServiceSelection`, `validateSelection`, `SelectionRule`, `ServiceGroupConfig`, `ServicesConfig`, `config.yml` references
6. Non-interactive mode: sync scaffolding only, don't touch compose

### User Flow

```
$ jahia-cli init

  Welcome to Jahia CLI! Let's create your configuration.

  ── Configuration File ──
  Configuration file name: (jahia-cli.config.yml)
  Directory: (.)

  ── Scaffolding ──
  Repository: (https://github.com/Jahia/jahia-cypress)
  Path: (scaffolding/)
  Version: (latest)
  Fetching scaffolding...
  ✓ Synced 12 file(s)

  ── Provider ──
  Environment provider: docker

  ── Optional Services ──
  The default environment includes Jahia and PostgreSQL.
  Select additional services to include (space to select, enter to confirm):

  ◻ Cypress — End-to-end testing framework
  ◻ Elasticsearch — Search and indexing engine
  ◻ Kibana — Elasticsearch dashboard

  Note: You can customize environment variables or modify the
  docker-compose.yml and service files at any time after init.

  ✓ Docker Compose file updated with 1 additional service(s)

  ✓ Configuration created at ./jahia-cli.config.yml
  ✓ Docker Compose file at ./environment/docker-compose.yml
```

---

## Technical Approach

**Feasibility**: HIGH

**Architecture Notes**
- Add `optional?: boolean` field to `ServiceMetadata` interface in `src/lib/environment/types.ts`
- Update `parseServiceMetadata` to read `optional` from `x-metadata`
- Replace service selection logic in `init.ts` interactive path with simple checkbox of optional services sorted alphabetically
- `assembleComposeFile` already supports injecting includes into existing content — reuse as-is
- Non-interactive path simplifies to: sync scaffolding, update .gitignore, done (no compose manipulation)

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Existing tests reference removed code | HIGH | Update/remove tests for deleted modules |
| Scaffolding repo still has config.yml | LOW | CLI ignores it; it's just a file that gets synced |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Add optional flag to metadata | Add `optional` to types and parser | pending | with 2 | - | - |
| 2 | Remove dead code | Delete group system files, update exports | pending | with 1 | - | - |
| 3 | Simplify interactive init | Replace service selection with optional checkbox | pending | - | 1, 2 | - |
| 4 | Simplify non-interactive init | Remove compose manipulation from --config path | pending | with 3 | 2 | - |
| 5 | Update tests | Fix broken tests, add new tests for optional flow | pending | - | 3, 4 | - |

### Phase Details

**Phase 1: Add optional flag to metadata**
- **Goal**: Support `optional: true` in x-metadata
- **Scope**: Update `ServiceMetadata` interface, update `parseServiceMetadata` to read the flag
- **Success signal**: `npm run build` passes

**Phase 2: Remove dead code**
- **Goal**: Clean out the group-based service selection system
- **Scope**: Delete `parse-services-config.ts`, `prompt-service-selection.ts`, `validate-selection.ts`, `SelectionRule` type, `ServiceGroupConfig`, `ServicesConfig`, related tests, update barrel exports
- **Success signal**: `npm run build` passes with no references to deleted code

**Phase 3: Simplify interactive init**
- **Goal**: Single checkbox for optional services
- **Scope**: Rewrite init interactive path: sync all files → discover optional services → checkbox prompt (alphabetical) → update compose in place → show hint about customization
- **Success signal**: `npm run build && npm run lint` pass

**Phase 4: Simplify non-interactive init**
- **Goal**: Non-interactive mode only syncs scaffolding, doesn't manipulate compose
- **Scope**: Remove all compose assembly/update logic from `runNonInteractive`
- **Success signal**: `npm run build` passes

**Phase 5: Update tests**
- **Goal**: All tests pass, dead test files removed, new behavior covered
- **Scope**: Remove tests for deleted modules, update init tests, add tests for optional metadata parsing
- **Success signal**: `npm test` all green, `npm run lint` clean

### Parallelism Notes

Phases 1 and 2 are independent (adding a field vs removing code). Phases 3 and 4 both depend on 1+2 but are independent of each other (different code paths in init). Phase 5 must come last to verify everything works together.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Service selection model | `optional: true` flag per service | Group-based config.yml | Simpler, self-contained, no external config file |
| Compose update strategy | Inject includes in place | Generate from scratch | Preserves scaffolding structure (header, networks) |
| Non-interactive compose handling | Don't touch compose | Re-assemble based on selections | Keep non-interactive simple — it's for CI re-sync only |
| Provider prompt | Keep it | Remove (hardcode docker) | Future extensibility for jahiacloudv1 |

---

## Research Summary

**Market Context**
CLI init wizards (npm init, create-react-app, oclif generate) follow the pattern: minimal questions, sensible defaults, option to customize after. The fewer prompts, the better adoption.

**Technical Context**
The existing codebase has all building blocks needed. The change is primarily deletion (group system) and simplification (single checkbox). `assembleComposeFile` already handles the compose update pattern correctly. `discoverServices` reads all `.yml` files and parses metadata — just needs to expose `optional`.

---

*Generated: 2025-05-25T10:45:00*
*Status: DRAFT - ready for implementation*

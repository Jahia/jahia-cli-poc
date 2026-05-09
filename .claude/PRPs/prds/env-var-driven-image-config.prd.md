# Environment Variable–Driven Docker Image Configuration

## Problem Statement

CI/CD pipeline engineers running Jahia test environments need to spin up the same environment definition with different Docker image versions (e.g., version A then version B) without duplicating YAML configuration files. Today, the `overrides.tag` field only accepts literal strings, and the `image` field (`jahia/jahia-ee`) is buried in the component library — not surfaced in the config file in the standard `registry/repository/image:tag` Docker format. This forces teams to maintain multiple config files or manually edit configs between CI/CD runs.

## Evidence

- The workflow engine already passes environment variables to steps via `process.env` inheritance (executor.ts:159). CI/CD pipelines naturally set env vars like `JAHIA_VERSION=8.3.0.0` before invoking the CLI.
- The current `ComponentOverrides` interface (components/types.ts:72-76) only supports `tag`, `env`, and `ports` — no way to override the image name or registry.
- Docker images follow the `[registry/]repository/image:tag` convention, but the component library splits this across `image` (e.g., `jahia/jahia-ee`) and `defaultTag` (e.g., `8.2.1.0`), making it unclear what the full image reference is.

## Proposed Solution

Add `${VAR_NAME:-default_value}` environment variable substitution syntax to the YAML config parser, and extend `ComponentOverrides` with an `image` field. This lets any component's image or tag reference an environment variable that resolves at parse time from `process.env` — the same source used by workflow `run:` steps.

The syntax follows bash variable expansion conventions (`${VAR}` for required, `${VAR:-fallback}` for optional with default), which is familiar to CI/CD engineers and consistent with how env vars flow through the workflow engine.

## Key Hypothesis

We believe adding `${VAR:-default}` substitution to component image and tag overrides will allow CI/CD pipelines to run matrix test environments from a single config file.
We'll know we're right when a user can `export JAHIA_VERSION=8.3.0.0 && jahia-cli environment create --config env.yml` and get a different Jahia version than the config's default, without editing the file.

## What We're NOT Building

- **Full template engine** — We're not building Jinja/Handlebars-style templating. Only `${VAR}` and `${VAR:-default}` syntax. No conditionals, loops, or nested expressions.
- **Env var substitution in all config fields** — Only in component `image` and `tag` override fields (and container `env` values for consistency). Not in `name`, `provider`, `ports`, workflow steps, etc.
- **Registry authentication** — Private registry auth (docker login) is the user's responsibility.
- **Image validation** — We don't validate that the resolved image exists in any registry.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Single config covers multiple versions | 100% | A CI pipeline can use one config file with different JAHIA_VERSION values |
| Config verbosity for simple cases | Zero extra lines | Components without env var overrides remain a plain string (`- jahia`) |
| Backward compatibility | 100% | All existing config files parse identically |

## Open Questions

- [ ] Should env var substitution also apply to container environment variables (the `env:` map in overrides)? (Recommendation: yes, for consistency)
- [ ] Should we support `${VAR:?error message}` syntax for required vars with custom error messages? (Recommendation: no, keep it simple — `${VAR}` errors with a clear default message)

---

## Users & Context

**Primary User**
- **Who**: CI/CD pipeline engineer configuring Jahia test environments in GitHub Actions, Jenkins, or similar
- **Current behavior**: Duplicates YAML config files for each version matrix entry, or uses `sed`/`yq` to patch configs inline before running `jahia-cli`
- **Trigger**: Setting up a test matrix that runs the same test suite against Jahia 8.2.x and 8.3.x
- **Success state**: One `jahia-cli.config.yml` in the repo, env vars control which versions are deployed

**Job to Be Done**
When setting up a CI/CD test matrix, I want to parameterize Docker image versions via environment variables, so I can test multiple Jahia versions from one config file without file duplication or inline patching.

**Non-Users**
Developers doing local `jahia-cli init` → `environment create` for personal dev. They don't need env vars — literal values are fine. The feature must not add noise to their experience.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | `${VAR:-default}` substitution in `tag` overrides | Core requirement — version parameterization |
| Must | `image` field in `ComponentOverrides` | Allows overriding the full image name (e.g., private registry) |
| Must | Full `image:tag` format displayed in prompts, output, and comments | Users need to see what Docker image will actually be pulled |
| Must | Backward compatibility — existing configs unchanged | Cannot break current users |
| Should | `${VAR:-default}` substitution in `image` overrides | Allows registry/repo parameterization for private registries |
| Should | `${VAR:-default}` substitution in component `env` values | Consistent env var resolution across all override fields |
| Should | Updated YAML comments documenting env var syntax | Self-documenting config files |
| Could | `${VAR}` (no default) with clear error on missing var | Strict mode for CI where forgetting an env var should fail fast |
| Won't | Template engine features (conditionals, loops) | Over-engineering — env var substitution is sufficient |

### MVP Scope

1. Add `image` field to `ComponentOverrides`
2. Implement `${VAR:-default}` and `${VAR}` resolution in the config parser
3. Apply env var resolution to `image`, `tag`, and `env` override fields
4. Update interactive prompts to show full `image:tag` format
5. Update output formatters to display full image references
6. Update YAML comment documentation
7. Tests for all new behavior

### User Flow

**CI/CD usage (critical path)**:
```yaml
environment:
  name: test-env
  components:
    - name: jahia
      overrides:
        image: "${JAHIA_IMAGE:-jahia/jahia-ee}"
        tag: "${JAHIA_VERSION:-8.2.1.0}"
    - smtp-server    # no env var needed — stays concise
```

```bash
# Pipeline run 1
export JAHIA_VERSION=8.3.0.0
jahia-cli environment create --config jahia-cli.config.yml

# Pipeline run 2 — different version, same config
export JAHIA_VERSION=8.2.1.0
jahia-cli environment create --config jahia-cli.config.yml

# Pipeline run 3 — private registry
export JAHIA_IMAGE=my-registry.example.com/jahia/jahia-ee
export JAHIA_VERSION=8.3.0.0-SNAPSHOT
jahia-cli environment create --config jahia-cli.config.yml
```

**Local dev usage (unchanged)**:
```yaml
environment:
  components:
    - jahia           # still works — no overrides needed
    - smtp-server
```

---

## Technical Approach

**Feasibility**: HIGH

The parser already resolves component names and merges overrides. Adding env var resolution is a string transformation step inserted between YAML parsing and config validation.

**Architecture Notes**

- **New utility: `resolveEnvVars(value: string): string`** — Scans a string for `${VAR}` and `${VAR:-default}` patterns, resolves from `process.env`, returns the resolved string. Pure function, easily testable.
- **Applied in the config parser** — After YAML parsing, before validation. The `validateEnvironmentConfig` function processes component overrides through `resolveEnvVars`.
- **`ComponentOverrides.image`** — New optional field. When provided, overrides `ComponentDefinition.image`. Combined with `tag` override (or default), produces the full `image:tag` for `docker run`.
- **`resolveComponent` update** — Computes `effectiveImage` from `overrides.image ?? definition.image`.
- **Interactive prompts** — Show full `image:tag` (e.g., `jahia/jahia-ee:8.2.1.0`) instead of just version.
- **Output formatter** — Display full image reference in the `Version` column or add an `Image` column.

**Consistency with Workflow Engine**:
The workflow executor (executor.ts) passes `process.env` to `run:` steps via `execa`. The `resolveEnvVars` function reads from the same `process.env`. This means:
- `export JAHIA_VERSION=8.3.0.0` in the shell
- Config file uses `${JAHIA_VERSION:-8.2.1.0}`
- Both the environment creation AND workflow `run:` steps see the same value

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Circular env var references | Low | Don't support nested `${}` — single-pass resolution only |
| Breaking existing configs with `$` in values | Low | Only `${...}` syntax triggers resolution; bare `$` is literal |
| Windows env var behavior | Low | `process.env` works identically on all platforms |

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
| 1 | Env var resolver | Create `resolveEnvVars` utility with `${VAR}` and `${VAR:-default}` support | pending | - | - | - |
| 2 | Type & override changes | Add `image` to `ComponentOverrides`, add `effectiveImage` to `ResolvedComponent`, update `resolveComponent` | pending | with 1 | - | - |
| 3 | Parser integration | Wire env var resolution into config parser for `image`, `tag`, and `env` override fields | pending | - | 1, 2 | - |
| 4 | Interactive prompts & output | Update prompts to show `image:tag` format, update output formatters with full image references | pending | - | 2 | - |
| 5 | Docker provider update | Update `runContainer` and related functions to use `effectiveImage` | pending | with 4 | 2 | - |
| 6 | Documentation & comments | Update YAML comments, CLAUDE.md, README with env var syntax documentation | pending | - | 3, 4, 5 | - |
| 7 | Tests | Unit tests for resolver, parser, overrides; integration tests for CLI with env vars | pending | - | 3, 4, 5 | - |

### Phase Details

**Phase 1: Env Var Resolver**
- **Goal**: Create a pure, testable `resolveEnvVars` function
- **Scope**: New file `src/lib/config/resolve-env-vars.ts` with:
  - `resolveEnvVars(value: string): string` — resolves `${VAR}` and `${VAR:-default}`
  - `resolveEnvVarsInRecord(record: Record<string, string>): Record<string, string>` — applies to all values in a record
  - Throws on `${VAR}` when VAR is not set (no default provided)
  - Ignores bare `$` characters and malformed patterns
- **Success signal**: Unit tests pass for all substitution patterns

**Phase 2: Type & Override Changes**
- **Goal**: Extend the type system to support image overrides
- **Scope**:
  - Add `readonly image?: string | undefined` to `ComponentOverrides`
  - Add `readonly effectiveImage: string` to `ResolvedComponent`
  - Update `resolveComponent` to compute `effectiveImage`
- **Success signal**: `npm run build` passes, existing tests still pass

**Phase 3: Parser Integration**
- **Goal**: Env var resolution happens transparently during config parsing
- **Scope**:
  - In `validateEnvironmentConfig`, apply `resolveEnvVars` to component override `image` and `tag` fields
  - Apply `resolveEnvVarsInRecord` to component override `env` fields
  - Ensure resolution happens before component registry lookup
- **Success signal**: A config with `${TEST_VAR:-default}` parses correctly, and setting `TEST_VAR` changes the result

**Phase 4: Interactive Prompts & Output**
- **Goal**: Users see the full Docker image reference everywhere
- **Scope**:
  - `init.ts` prompt: show `jahia/jahia-ee:8.2.1.0` as the default, allow full image input
  - `environment/create.ts` prompt: same approach
  - Output formatter: display `image:tag` in tables (the `Version` column becomes `Image` showing full reference)
  - `config-to-yaml-with-comments.ts`: update ENVIRONMENT_COMMENT with env var syntax examples
- **Success signal**: CLI output shows full image references; YAML comments document `${VAR:-default}` syntax

**Phase 5: Docker Provider Update**
- **Goal**: Docker provider uses the resolved image from overrides
- **Scope**:
  - `runSingleComponent` in docker/index.ts: pass `effectiveImage` instead of `definition.image`
  - `container.ts` `buildRunArgs`: already receives `image` param — just ensure callers pass the resolved one
  - `ComponentStatus.image` shows the effective image, not the definition default
- **Success signal**: `docker run` uses the overridden image when provided

**Phase 6: Documentation & Comments**
- **Goal**: Users understand the env var feature from the config file itself
- **Scope**:
  - Update ENVIRONMENT_COMMENT in `config-to-yaml-with-comments.ts`
  - Update README.md with env var examples
  - Update CLAUDE.md if architecture description needs changes
- **Success signal**: Generated config files include env var syntax examples in comments

**Phase 7: Tests**
- **Goal**: Full test coverage for new functionality
- **Scope**:
  - Unit tests for `resolveEnvVars` (all patterns, edge cases, error cases)
  - Unit tests for updated `resolveComponent` with image override
  - Parser tests with env var substitution
  - Integration test: CLI with env var set produces correct output
- **Success signal**: `npm test` passes, `npm run test:coverage` doesn't regress

### Parallelism Notes

- Phases 1 and 2 are independent (utility function vs type changes) — can run in parallel
- Phase 3 depends on both 1 and 2 (needs the resolver and the new types)
- Phases 4 and 5 depend on 2 (need `effectiveImage`) but are independent of each other — can run in parallel
- Phase 6 depends on 3, 4, 5 (needs final API to document)
- Phase 7 depends on 3, 4, 5 (needs implementation to test)

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Env var syntax | `${VAR:-default}` | `{{VAR}}`, `$VAR`, `%VAR%` | Bash-compatible, familiar to CI/CD engineers, matches workflow env var model |
| Resolution timing | Parse time (config load) | Container creation time | Simpler, debuggable (resolved values visible in state), consistent with "config is fully resolved before execution" |
| Scope of substitution | `image`, `tag`, `env` overrides only | All string fields | Keeps it focused; names/providers shouldn't be dynamic |
| `${VAR}` without default | Error on missing | Silent empty string | Fail-fast is safer for CI — missing vars should break the build |
| Image field in overrides | Optional `image` field | Replace `tag` with full `image:tag` | Backward compatible; `tag` alone still works for simple version changes |

---

## Research Summary

**Market Context**
- Docker Compose supports `${VAR:-default}` syntax natively in YAML files — this is the de facto standard for parameterized container configs
- Kubernetes uses `envsubst` or Helm templates for similar purposes
- GitHub Actions uses `${{ env.VAR }}` but that's specific to their template engine
- The `${VAR:-default}` syntax is the most portable and widely understood

**Technical Context**
- The codebase already has a clean separation between config parsing (parser.ts) and component resolution (components/index.ts)
- The `resolveComponent` function is the natural point to inject `effectiveImage`
- The workflow engine's `process.env` inheritance model means env vars set in the shell are automatically available — no extra plumbing needed
- All component definitions use short image names (`jahia/jahia-ee`, `axllent/mailpit`) without registry prefix — the default Docker Hub registry is implied

---

*Generated: 2026-05-09T20:01:53+02:00*
*Status: DRAFT - needs validation*

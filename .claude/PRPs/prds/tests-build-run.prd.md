# Tests Build & Run Commands

## Problem Statement

Developers and CI/CD pipelines running end-to-end tests against Jahia need to build a custom test Docker image (from a `Dockerfile.local` scaffolded by `tests init`) and then run that image as a container attached to an existing Jahia environment. Today there is no CLI command for either step — teams rely on manual `docker buildx` invocations and ad-hoc container orchestration, making the test flow fragile and inconsistent across local dev and CI.

## Evidence

- The scaffolding system (`tests init`) already syncs `docker/Dockerfile.local` from `jahia-cypress`, but nothing in the CLI consumes it
- CI pipelines (GitHub Actions) need a deterministic, reproducible way to build the test image with the correct `BASE_VERSION` and then run it attached to the Jahia network
- Local developers investigating CI-only failures need to replicate the exact same image build + run flow

## Proposed Solution

Add two new subcommands under `tests`:

1. **`tests build`** — Builds a multi-arch test Docker image from `docker/Dockerfile.local` using `docker buildx`, passing `BASE_VERSION` (derived from `tests.scaffolding.version` in config) as a build arg. The image stays local (no push).

2. **`tests run`** — Starts the built test image as a container attached to an existing environment's Docker network. The container runs tests, streams output in real-time, and the CLI exits with the container's exit code. The container is kept after completion for debugging. A `cypress` component definition is registered in the component registry for configuration and env injection.

Both commands are registered as workflow `uses:` actions for full workflow integration.

## Key Hypothesis

We believe providing `tests build` and `tests run` commands will eliminate manual Docker scripting from CI/CD pipelines and local test workflows.
We'll know we're right when the full test flow (`environment create` → `tests build` → `tests run` → `tests artifacts`) can be expressed as a single jahia-cli workflow.

## What We're NOT Building

- **Remote image push** — The built image stays local; no registry authentication or push logic
- **Test framework integration** — We don't parse Cypress/Jest results; we just forward exit codes
- **Parallel test execution** — One test container per `tests run` invocation
- **Auto-cleanup** — Container is kept after completion for debugging (user runs `environment destroy`)

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Full E2E workflow expressible in YAML | Yes | A single config file can build + run tests via `workflow run` |
| CI pipeline simplification | Replaces manual docker commands | Before/after comparison of CI scripts |
| Exit code propagation | 100% | `tests run` exit code matches container exit code |

## Open Questions

- [ ] Should `tests run` support a `--timeout` flag to kill long-running test containers?
- [ ] Should `tests build` support `--no-cache` to force a clean rebuild?
- [ ] Are there additional env vars beyond the initial set that test containers commonly need?

---

## Users & Context

**Primary User**
- **Who**: Jahia module developer running E2E tests locally or in CI
- **Current behavior**: Manual `docker buildx build` + `docker run` with hand-crafted flags and network attachment
- **Trigger**: After `environment create` sets up Jahia + dependencies, they need to build and run the test image
- **Success state**: Tests execute, output streams to terminal, exit code reflects pass/fail

**Job to Be Done**
When I have a running Jahia environment, I want to build and run my test image against it, so I can validate my changes with the same setup used in CI.

**Non-Users**
- Teams not using the jahia-cypress scaffolding (they have their own test infrastructure)
- Production deployments (this is development/test tooling only)

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | `tests build` builds image from `docker/Dockerfile.local` with `BASE_VERSION` arg | Core requirement |
| Must | Multi-arch build via `docker buildx` (`linux/amd64,linux/arm64`) | Match base image architecture |
| Must | `tests run` starts container on environment network | Container needs to reach Jahia by hostname |
| Must | Real-time stdout/stderr streaming | Developer needs to see test output as it happens |
| Must | Exit code propagation | CI/CD pipeline needs pass/fail signal |
| Must | Auto-inject `JAHIA_URL` from environment state | Service discovery without manual config |
| Must | `cypress` component spec with configurable env vars (`SUPER_USER_PASSWORD`, `JAHIA_URL`, `NEXUS_USERNAME`, `NEXUS_PASSWORD`, `MAILPIT_URL`, `MANIFEST`) | Consistent with other components, env var pattern |
| Must | Additional build args support (`--build-arg KEY=VALUE`) | Custom Dockerfile needs may vary |
| Must | Custom env vars for test container (`--env KEY=VALUE` or via config) | Different test suites need different vars |
| Must | Workflow integration (`uses: tests:build`, `uses: tests:run`) | Composable test pipelines |
| Should | Configurable Dockerfile path (default: `docker/Dockerfile.local`) | Some projects may structure differently |
| Should | Configurable image tag (default: `jahia-tests:VERSION`) | Allow custom naming |
| Could | `--no-cache` flag for clean rebuilds | Debugging build issues |
| Won't | Image push to remote registry | Out of scope — local only |
| Won't | Test result parsing | We forward exit codes, not parse results |

### MVP Scope

1. `tests build` command with `--config`, `--dockerfile`, `--tag`, `--build-arg` flags
2. `tests run` command with `--config`, `--state`, `--env`, `--json` flags
3. `cypress` component definition with env var defaults and `${VAR:-default}` pattern
4. Workflow `uses:` registration for both commands
5. Unit + integration tests

### User Flow

```
# Full flow (manual)
jahia-cli environment create -c config.yml
jahia-cli tests build -c config.yml
jahia-cli tests run -c config.yml
jahia-cli tests artifacts --output ./results

# Full flow (workflow)
jahia-cli workflow run -c config.yml
# workflow steps: environment:create → tests:build → tests:run → tests:artifacts
```

---

## Technical Approach

**Feasibility**: HIGH

The existing component registry, Docker provider, and workflow executor provide all the building blocks. The main new work is:

1. A `docker buildx build` wrapper (new, but straightforward shell-out)
2. A `docker run --attach` equivalent that streams output and captures exit code
3. A new `cypress` component definition following the established pattern

**Architecture Notes**

- `tests build` shells out to `docker buildx build --platform linux/amd64,linux/arm64 --build-arg BASE_VERSION=... -t jahia-tests:VERSION --load docker/`
- `tests run` creates a container via `docker run` attached to the environment network (from state), with `--rm` omitted (keep container), and `stdio: inherit` for real-time streaming
- The `cypress` component follows the same pattern as `jahia.ts` — env vars with `${VAR:-default}` syntax, resolved at runtime
- The test container does NOT use a healthcheck (it runs and exits)
- The test container depends on `jahia` (must be running before tests start)

**Key env vars for the cypress component:**

| Variable | Default | Description |
|----------|---------|-------------|
| `JAHIA_URL` | `http://jahia:8080` | Auto-injected from environment |
| `SUPER_USER_PASSWORD` | `${SUPER_USER_PASSWORD:-root1234}` | Jahia admin password |
| `NEXUS_USERNAME` | `${NEXUS_USERNAME:-}` | Nexus credentials (optional) |
| `NEXUS_PASSWORD` | `${NEXUS_PASSWORD:-}` | Nexus credentials (optional) |
| `MAILPIT_URL` | `http://smtp-server:8025` | Auto-injected when smtp-server is present |
| `MANIFEST` | `${MANIFEST:-}` | Provisioning manifest (optional) |

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `docker buildx` not installed | Low | Check availability and provide clear error message |
| Multi-arch build requires QEMU on x86 hosts | Medium | Document prerequisite; `--load` works for native arch |
| Container exit code lost in streaming mode | Low | Use `docker wait` after `docker logs --follow` to get exit code |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Component & types | Create `cypress` component definition, extend `TestsConfig` with build settings | pending | - | - | - |
| 2 | Build command | Implement `tests build` with `docker buildx`, version resolution, build args | pending | - | 1 | - |
| 3 | Run command | Implement `tests run` with network attachment, streaming, exit code propagation | pending | - | 1 | - |
| 4 | Workflow integration | Register both commands as `uses:` actions, update sample workflows | pending | - | 2, 3 | - |
| 5 | Tests & documentation | Unit + integration tests, README updates | pending | - | 4 | - |

### Phase Details

**Phase 1: Component & types**
- **Goal**: Define the `cypress` component and extend config types
- **Scope**: Create `src/lib/components/cypress.ts`, register in `index.ts`, extend `TestsConfig` with optional build configuration
- **Success signal**: Component appears in registry, types compile cleanly

**Phase 2: Build command**
- **Goal**: `tests build` command that builds a multi-arch test image
- **Scope**: `src/commands/tests/build.ts` with pure functions for version resolution, buildx arg assembly, and image tagging
- **Success signal**: `jahia-cli tests build -c config.yml` produces a local Docker image

**Phase 3: Run command**
- **Goal**: `tests run` command that runs the test container attached to an environment
- **Scope**: `src/commands/tests/run.ts` with pure functions for container creation, output streaming, and exit code capture
- **Success signal**: `jahia-cli tests run -c config.yml` runs tests, streams output, exits with container's code

**Phase 4: Workflow integration**
- **Goal**: Both commands usable as `uses:` steps in workflows
- **Scope**: Ensure `uses: tests:build` and `uses: tests:run` work in workflow definitions, update sample workflows
- **Success signal**: A workflow with `uses: tests:build` followed by `uses: tests:run` executes correctly

**Phase 5: Tests & documentation**
- **Goal**: Full test coverage and documentation
- **Scope**: Unit tests for all pure functions, integration tests for CLI, README command documentation
- **Success signal**: `npm test` passes, `npm run lint` clean, README updated

### Parallelism Notes

Phases 2 and 3 can run in parallel since they share only the types from Phase 1, but are listed sequentially for clarity. Phase 4 depends on both. Phase 5 depends on all.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Build tool | `docker buildx` (required) | `docker build` with fallback | User explicitly chose no fallback; buildx is standard in modern Docker |
| Build arg name | `BASE_VERSION` | `BASE_IMAGE` (full ref) | Dockerfile handles registry/repo; CLI only passes version string |
| Image tag format | `jahia-tests:VERSION` | Static tag, env-derived | Allows multiple versions to coexist locally |
| Container lifecycle | Keep after exit | Auto-remove | Debugging requires inspecting stopped containers |
| Output streaming | `stdio: inherit` on `docker run` | `docker logs --follow` after detached start | Simpler, real-time, no race conditions |
| Component name | `cypress` | `test-runner`, `e2e-runner` | Matches the `jahia-cypress` ecosystem naming |
| Component category | New `test-runner` category | `utility`, `application` | Semantically distinct from infrastructure/app components |

---

## Research Summary

**Market Context**
- Docker buildx is the standard multi-arch build tool, available in Docker Desktop and CI runners
- Test containers that run and exit are a common pattern in CI/CD (similar to GitHub Actions service containers)

**Technical Context**
- The existing component registry (`src/lib/components/`) provides a clean pattern: define component → register → resolve with overrides
- The Docker provider already handles network creation, container naming, and env injection
- The workflow executor supports `uses:` steps that spawn CLI commands — no special integration needed
- `docker run` with `stdio: inherit` provides real-time streaming; `process.exitCode` propagates the container's exit code
- The `envInjections` pattern (used by `smtp-server` → `jahia`) can be reused for `jahia` → `cypress` (inject `JAHIA_URL`)

---

*Generated: 2026-05-14*
*Status: DRAFT - needs validation*

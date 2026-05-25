# Refactor tests:run — Docker Compose Profile Runner

## Problem
Anyone running integration tests with jahia-cli cannot use `tests:run` effectively. The command should simply start all containers within a docker compose profile and stream logs until they stop — making test execution trivial for anyone with a config file.

## Evidence
- Author cannot use `tests:run` in its current form — the implementation doesn't align with the docker compose profile workflow used in practice.

## Users
- **Primary**: Developers and CI pipelines running Jahia integration tests via docker compose profiles.
- **Not for**: Users running tests outside of Docker or without jahia-cli.

## Hypothesis
We believe **refactoring `tests:run` to start a docker compose profile and stream logs** will **make running integration tests trivial** for **anyone with a jahia-cli config file**.
We'll know we're right when **`tests:run` reliably starts test containers, streams logs, and exits with the container exit code**.

## Success Metrics
| Metric | Target | How measured |
|---|---|---|
| Command usability | Works first try with valid config | Manual validation |
| Exit code accuracy | Reflects test container exit code | CI pipeline integration |

## Scope
**MVP** — Start containers in a compose profile (default "tests"), stream logs until all profile containers stop, exit with container exit code.

**Out of scope**
- Test result parsing — not the CLI's job
- Report generation — separate tooling
- Retry logic — handle externally
- Building the test image — that's `tests:build`
- Waiting for Jahia readiness — handled separately
- Container cleanup after completion — handled separately

## Delivery Milestones

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | Refactor tests:run | Command starts compose profile, streams logs, exits with correct code | pending | — |

## Open Questions
- None — no waiting for Jahia health, no cleanup. Those are separate concerns.

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Compose file path misconfiguration | Medium | Command fails to find compose file | Clear error message referencing config field |
| Profile doesn't exist in compose | Medium | Docker compose error | Surface docker's error clearly |

---
*Status: DRAFT — requirements only. Implementation planning pending via /plan.*

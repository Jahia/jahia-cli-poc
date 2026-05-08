# Environment Configuration Export & Replay

## Problem Statement

Developers who create Jahia environments interactively cannot easily reproduce them later or share their setup with colleagues. The interactive mode creates a running environment but the configuration used is only stored in the runtime state file — there's no portable, declarative spec that can be version-controlled, shared, or used for consistent re-creation.

## Evidence

- The state file already stores `config: EnvironmentConfig` alongside runtime data (container IDs, network names)
- `configToYaml()` exists but is only used for scaffolding blank configs
- `loadConfigFile()` + `--config` flag already support reading a YAML config to create an environment
- Missing piece: there's no way to **export** the environment section from a running state back to a config file

## Proposed Solution

Add an `environment export` command that extracts the environment configuration from the current state and writes it to a YAML file. Also add an optional `--export-config` flag on `environment create` so users can save their config at creation time. The exported config contains only what's needed to recreate the environment — no runtime state (container IDs, timestamps, network names).

## Key Hypothesis

We believe that providing a simple export-from-state-to-config workflow will enable developers to create reproducible environments. We'll know we're right when users can: (1) create interactively, (2) export to config, (3) delete the environment, (4) recreate from the exported config — and get an identical setup.

## What We're NOT Building

- State export (container IDs, network names, timestamps) — config only
- Config merging/diffing — simple overwrite semantics
- JahiaCloudV1 provider support — Docker only for now
- Config validation CLI command — the create command already validates on read

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Round-trip fidelity | 100% | Exported config recreates identical environment |
| Command simplicity | 1 command to export | `environment export` with sensible defaults |
| Zero runtime data leaks | 0 | No container IDs, timestamps, or network names in exported config |

## Open Questions

- [x] Should `name` be included in exported config? → No, auto-generated names should be omitted (let re-creation generate new names)
- [x] Should `provider` be included? → Yes, always explicit

---

## Users & Context

**Primary User**
- **Who**: Developer or QA engineer setting up Jahia for local development/testing
- **Current behavior**: Creates environment interactively, then must manually remember/write the config to reproduce later
- **Trigger**: Wants to share setup, commit to repo, or re-use after deletion
- **Success state**: Has a portable YAML file that recreates the exact same environment

**Job to Be Done**
When I've set up a working Jahia environment interactively, I want to export its configuration to a file, so I can recreate it later or share it with my team.

**Non-Users**
CI systems that already have config files checked into repos — they don't need export.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | `environment export` command | Core feature — extract config from state to YAML |
| Must | `--output` flag for export path | Let user choose where to write |
| Must | Strip runtime data from export | Config is creation-spec only |
| Must | `--export-config` flag on `environment create` | Convenience — save at creation time |
| Should | Human-readable YAML output | Use existing `configToYaml()` with string shorthand |
| Should | `--json` support on export | Consistent with all other commands |
| Could | `--stdout` flag to print to terminal | Useful for piping |
| Won't | Config validation command | Create already validates on load |

### MVP Scope

1. `environment export` command that reads state and writes the environment section to a YAML file
2. `--export-config <path>` flag on `environment create` that saves config after successful creation
3. Ensure the round-trip works: create → export → delete → create from config

### User Flow

```
# Flow 1: Export after creation
$ jahia-cli environment create          # interactive, picks version
$ jahia-cli environment export -o ./env.yml
# File written: ./env.yml

# Flow 2: Export at creation time
$ jahia-cli environment create --export-config ./env.yml
# Environment created + config saved to ./env.yml

# Flow 3: Recreate from config
$ jahia-cli environment create --config ./env.yml
# Identical environment recreated
```

---

## Technical Approach

**Feasibility**: HIGH

**Architecture Notes**
- `PersistedEnvironment.config` already contains the full `EnvironmentConfig` — just need to serialize it
- `configToYaml()` already handles serialization with human-readable component shorthand
- New command is a simple state → config → YAML → file pipeline
- `--export-config` flag on create just saves after the state is persisted

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Config drift from state | LOW | Export reads directly from `state.environment.config` |
| Name collision on re-import | LOW | Omit auto-generated names from export; `create` generates fresh names |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Config Export Core | `environment export` command + pure functions + tests | pending | - | - | - |
| 2 | Create Integration | `--export-config` flag on `environment create` | pending | - | 1 | - |

### Phase Details

**Phase 1: Config Export Core**
- **Goal**: Working `environment export` command
- **Scope**: New command file, export logic (pure function), YAML serialization, tests
- **Success signal**: `environment export -o ./test.yml` produces valid YAML that can be used with `--config`

**Phase 2: Create Integration**
- **Goal**: Save config at creation time
- **Scope**: Add `--export-config` flag to create command, call export logic after success
- **Success signal**: `environment create --export-config ./env.yml` creates env AND writes config file

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Auto-gen name handling | Omit from export | Include name | Names like `env-b8b172e6` are meaningless to share |
| Provider in export | Always include | Omit if default | Explicit is better — avoids confusion across machines |
| Output format | Full YAML file with `environment:` key | Just the env section | Full file is what `--config` expects |
| Default output path | Required `--output` flag | Default to `./jahia-cli.yml` | Explicit avoids accidental overwrites |

---

*Generated: 2026-05-08*
*Status: DRAFT — ready for implementation*

# Jahia Provision Command

## Problem Statement

CI/CD pipelines and developers currently rely on fragile bash/curl scripts to provision Jahia instances — posting YAML provisioning scripts to `/modules/api/provisioning` with manual error handling, credential management, and file attachment logic. This approach is error-prone, not portable across platforms, and disconnected from the CLI's environment management system.

## Evidence

- Current provisioning is done via raw `curl` with multipart form data, manual error codes, and shell-specific constructs (`$(find assets -type f | sed -E ... | xargs)`)
- The bash script has no retry logic, no structured output, and cryptic failure messages ("PROVISIONING FAILURE - EXITING SCRIPT")
- Provisioning is a core operation in every Jahia CI/CD pipeline — executed on every test run and deployment
- The CLI already manages the Jahia environment (create, start, stop, alive) but has no way to provision it

## Proposed Solution

A `jahia provision` command that accepts a provisioning manifest (local YAML file or public URL), auto-detects the source type, resolves credentials and connection details from the active environment state, and POSTs the manifest to the Jahia provisioning API with proper error handling, retry logic, and structured output. Optional file attachments can be included alongside the manifest.

## Key Hypothesis

We believe a native CLI provisioning command will replace fragile curl scripts for CI/CD engineers and developers.
We'll know we're right when CI/CD pipelines can replace their bash provisioning blocks with a single `jahia-cli jahia provision` call.

## What We're NOT Building

- Provisioning manifest authoring/validation — the CLI sends whatever YAML it's given, Jahia validates it
- Interactive provisioning builder — v1 is non-interactive, manifest-driven
- Provisioning rollback — out of scope, Jahia server doesn't support it
- Multi-instance parallel provisioning — one instance at a time (target the active environment)

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Feature parity with curl script | 100% | Can provision with manifest + file attachments |
| Cross-platform support | 3 OS | CI matrix passes on Linux, macOS, Windows |
| Structured error output | Yes | `--json` flag produces machine-parseable failure details |

## Open Questions

- [ ] Should the command wait for Jahia to be alive (SAM GREEN) before attempting provisioning, or assume the caller handles that?
- [ ] What is the exact response format from `/modules/api/provisioning` on success vs failure?
- [ ] Should file attachments support glob patterns (e.g., `--file "assets/*.jar"`) or only explicit paths?

---

## Users & Context

**Primary User**
- **Who**: CI/CD pipeline engineer maintaining Jahia test/deploy pipelines; developer setting up local Jahia environments
- **Current behavior**: Writes bash scripts with `curl -X POST` to the provisioning endpoint, manually handles auth, file attachments via `find | sed | xargs`, and checks `$?` for errors
- **Trigger**: After `jahia-cli environment create` + `environment alive`, needs to install modules, configure settings, or load content into the running Jahia instance
- **Success state**: Jahia instance is provisioned with the desired configuration, modules, and content — confirmed by a clear success/failure message

**Job to Be Done**
When I have a running Jahia environment and need to configure it, I want to execute a provisioning manifest against it, so I can have a fully configured Jahia ready for testing or use.

**Non-Users**
- Jahia Cloud managed service users (provisioning is handled by the platform)
- Non-technical content editors (they don't interact with the CLI)

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Accept manifest as local file path or public URL | Core requirement — auto-detect source type |
| Must | POST manifest to `/modules/api/provisioning` as multipart form | API contract with Jahia server |
| Must | Support Basic Auth with configurable credentials | Required for API access |
| Must | Support `--json` structured output | CI/CD and AI agent consumption |
| Must | Support `--file` flag for additional file attachments | Feature parity with current curl approach |
| Must | Resolve Jahia URL from active environment state or `--url` flag | Consistent with `environment alive` pattern |
| Should | Return non-zero exit code on provisioning failure | CI/CD pipeline integration |
| Should | Log provisioning progress (submitting, waiting for response) | User feedback during long operations |
| Could | Support multiple `--file` flags for multiple attachments | Convenience for complex provisioning |
| Won't | Validate manifest YAML structure before sending | Jahia server validates; we're a transport layer |
| Won't | Support authenticated/private URLs | Add later if needed; public URLs cover CI artifacts |

### MVP Scope

1. Command accepts a single positional argument: manifest path or URL
2. Auto-detects URL vs local file (starts with `http://` or `https://` = URL, otherwise file)
3. If URL: downloads content to memory, sends as form data
4. If file: reads from disk, sends as form data
5. POSTs to `{jahia_url}/modules/api/provisioning` with Basic Auth
6. Supports `--file` flag(s) for additional file attachments
7. Outputs success/failure with details in human or JSON format
8. Uses active environment state for defaults (URL, credentials) with flag overrides

### User Flow

```
# Minimal — uses active environment defaults
jahia-cli jahia provision ./provisioning/setup.yaml

# With a public URL
jahia-cli jahia provision https://raw.githubusercontent.com/org/repo/main/provisioning.yaml

# With file attachments and explicit credentials
jahia-cli jahia provision ./setup.yaml --file ./modules/mymodule.jar --file ./content/import.zip \
  --url http://localhost:8080 --username root --password root1234

# CI/CD with JSON output
jahia-cli jahia provision ./setup.yaml --json --state /ci/state.json
```

---

## Technical Approach

**Feasibility**: HIGH

**Architecture Notes**
- Follows the same command pattern as `environment alive`: state flag, url/username/password overrides, json output
- Uses native `fetch` with `FormData` for multipart POST (no new dependencies needed — Node 18+ has native FormData)
- Manifest source detection: simple string prefix check (`http://` or `https://`)
- For URL manifests: `fetch` GET to download, then re-POST as form data
- For local files: `fs.readFile` then attach as form data
- File attachments: each `--file` path is read and added to the form as additional `file` fields
- Pure functions extracted for: `detectManifestSource`, `fetchManifestFromUrl`, `readManifestFromFile`, `submitProvisioningScript`, `buildProvisioningFormData`

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Node.js native FormData doesn't support file uploads identically to curl | M | Test against real Jahia instance; fall back to `undici` FormData if needed |
| Large file attachments may exceed memory | L | Stream files if needed, but v1 can buffer (provisioning files are typically small) |
| Jahia provisioning endpoint response format undocumented | M | Test empirically; handle both text and JSON responses gracefully |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Core provisioning library | Pure functions for manifest detection, fetching, reading, and form submission | pending | - | - | - |
| 2 | Command implementation | OCLIF command with flags, state integration, and output formatting | pending | - | 1 | - |
| 3 | File attachment support | `--file` flag handling with multiple file support | pending | - | 2 | - |
| 4 | Tests | Unit tests for pure functions + integration tests via CLI subprocess | pending | - | 3 | - |
| 5 | Documentation | README command docs, YAML comment examples, workflow integration guide | pending | - | 4 | - |

### Phase Details

**Phase 1: Core provisioning library**
- **Goal**: Create the pure functions that handle all provisioning logic
- **Scope**:
  - `src/lib/provisioning/detect-manifest-source.ts` — returns `'file'` or `'url'` based on input string
  - `src/lib/provisioning/fetch-manifest.ts` — downloads manifest from URL, returns content as Buffer
  - `src/lib/provisioning/read-manifest.ts` — reads manifest from local file path, returns content as Buffer
  - `src/lib/provisioning/submit-provisioning.ts` — builds FormData, POSTs to Jahia endpoint, returns result
  - `src/lib/provisioning/types.ts` — interfaces for ProvisioningResult, ProvisioningOptions
- **Success signal**: All pure functions exported, typed, and independently testable

**Phase 2: Command implementation**
- **Goal**: Wire the library into an OCLIF command at `jahia provision`
- **Scope**:
  - `src/commands/jahia/provision.ts` — OCLIF command with args/flags
  - Positional arg: `manifest` (required) — file path or URL
  - Flags: `--url`, `--username`, `--password`, `--state`, `--json`
  - Resolve defaults from active environment state
  - Human-readable and JSON output formatting
- **Success signal**: `jahia-cli jahia provision ./test.yaml` works end-to-end

**Phase 3: File attachment support**
- **Goal**: Support additional file attachments via `--file` flag
- **Scope**:
  - Add `--file` flag (multiple allowed) to the command
  - Read each file, add to FormData as additional `file` fields
  - Validate files exist before submitting
- **Success signal**: `jahia-cli jahia provision ./test.yaml --file ./module.jar` works

**Phase 4: Tests**
- **Goal**: Comprehensive test coverage for all new code
- **Scope**:
  - Unit tests for `detectManifestSource`, `fetchManifest`, `readManifest`, `submitProvisioning`
  - Integration tests via `bin/dev.js` subprocess
  - Edge cases: missing file, unreachable URL, invalid credentials, server error responses
- **Success signal**: All tests pass, coverage meets threshold

**Phase 5: Documentation**
- **Goal**: Document the new command for users
- **Scope**:
  - README.md command reference
  - Example workflow step using `uses: jahia provision`
  - CLAUDE.md architecture update
- **Success signal**: All documented commands run successfully

### Parallelism Notes

Phases are sequential — each builds on the previous. Phase 1 must complete before Phase 2 can wire it into the command, and Phase 3 extends Phase 2's flag handling.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Manifest source detection | String prefix check (`http://` / `https://`) | URL.parse validation, file existence check first | Simple, unambiguous, matches user mental model |
| HTTP client | Native `fetch` | axios, got, undici | No new dependencies; project already uses native fetch for SAM queries |
| Form data handling | Native `FormData` + `Blob` | `form-data` npm package, manual multipart | Node 18+ supports it natively; matches project's zero-dependency preference |
| Command topic | `jahia provision` | `provision run`, `environment provision` | User requested `jahia` topic; provisioning is a Jahia server operation, not an environment lifecycle operation |
| Credential defaults | Same as `environment alive` (root/root1234) | Read from component env vars in state | Consistent UX across commands; state may not always be available |

---

## Research Summary

**Market Context**
- Jahia's provisioning API accepts multipart form POST with a `script` field (YAML) and optional `file` fields
- Current usage in CI/CD is via bash `curl` — brittle, platform-specific, no structured error handling
- No existing CLI tools wrap Jahia provisioning — this is net-new

**Technical Context**
- The codebase already has the pattern for Jahia API interaction (SAM queries via `fetch` with Basic Auth)
- State system provides environment name, component details, but not direct Jahia URL — URL must be derived from port mappings or provided explicitly
- Workflow executor already supports `uses:` steps that invoke jahia-cli subcommands — `jahia provision` will integrate naturally as a workflow step
- Native `fetch` + `FormData` available in Node 18+ (project targets Node 20+)

---

*Generated: 2026-05-09T20:43:00Z*
*Status: DRAFT - needs validation*

# Remove Service Selection from Init Command

## Problem Statement

The init command's service selection feature (optional services checkbox) adds complexity without clear value. Users creating test environments want to get started quickly with the default scaffolding and can manually customize the `environment/` folder afterward. The extra prompt step slows onboarding and the underlying code (discover-services, assemble-compose-file, parse-service-metadata) adds maintenance burden.

## Evidence

- User feedback: "the implementation is too complex" — direct request to remove
- The scaffolding already provides a working docker-compose.yml with sensible defaults
- Users who need customization can edit files directly in `environment/`

## Proposed Solution

Remove all service selection logic from the init command. After provider selection, skip straight to the summary and "start environment?" prompt. The summary tells users how to customize via the `environment/` folder.

## Key Hypothesis

We believe removing service selection will make init faster and simpler for new users.
We'll know we're right when users can go from `init` to running environment in fewer steps.

## What We're NOT Building

- Service discovery UI — removed entirely
- Compose file assembly/modification during init — removed
- Any replacement for service selection — users edit files manually

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Init prompt count | 5 (config file, dir, repo, path, version, provider) | Count prompts |
| Dead code removed | ~200 lines of library code + tests | Line count |

## Open Questions

- [x] Delete library code? → Yes
- [x] Remove checkbox import? → No (keep for potential future use)
- [x] Summary wording? → "To customize your environment, edit the files in the environment/ folder."

---

## Users & Context

**Primary User**
- **Who**: Developer starting a new Jahia test project
- **Current behavior**: Runs `init`, gets confused by service selection, just wants defaults
- **Trigger**: Starting a new project or test environment
- **Success state**: Config created, environment running, customization possible later

**Job to Be Done**
When starting a new Jahia project, I want to quickly scaffold a working environment, so I can begin development without understanding Docker internals.

**Non-Users**
Power users who need complex multi-service setups — they can edit files directly.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Remove promptOptionalServices method | Core simplification |
| Must | Remove assembleComposeFile call from init | No compose modification |
| Must | Delete discover-services, assemble-compose-file, parse-service-metadata | Dead code |
| Must | Delete related types (ServiceMetadata, etc.) | Dead code |
| Must | Update summary to mention environment/ customization | User guidance |
| Must | Delete tests for removed modules | Clean test suite |
| Won't | Remove checkbox from imports | May be useful later |

### MVP Scope

Single commit: remove service selection code, update summary message, delete dead library code and tests.

### User Flow (after change)

```
Config file name → Directory → Scaffolding repo → Path → Version → Provider
→ Summary (mentions environment/ customization)
→ "Start environment?" (Y/n)
→ Done
```

---

## Technical Approach

**Feasibility**: HIGH — pure deletion and minor message update.

**Architecture Notes**
- Remove `promptOptionalServices` private method from Init class
- Remove lines 371-395 (Step 4: Optional services) from `run()`
- Remove imports: `discoverServices`, `assembleComposeFile`
- Delete files: `src/lib/environment/discover-services.ts`, `src/lib/environment/assemble-compose-file.ts`, `src/lib/environment/parse-service-metadata.ts`
- Delete types: `ServiceMetadata`, `DiscoveredService`, `ServiceSelection`, `ServiceDependency` from `types.ts`
- Update `src/lib/environment/index.ts` barrel to remove deleted exports
- Update `buildInitSuccessMessage` to include customization note
- Delete test files: `test/lib/environment/assemble-compose-file.test.ts`, `test/lib/environment/parse-service-metadata.test.ts`

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Other commands use deleted modules | LOW | grep for imports before deleting |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Remove all | Single phase — delete dead code, update init, update tests | pending | - | - | - |

### Phase Details

**Phase 1: Remove service selection**
- **Goal**: Simplify init to skip service selection entirely
- **Scope**:
  1. Remove `promptOptionalServices` method and Step 4 block from init.ts
  2. Remove imports for `discoverServices`, `assembleComposeFile`
  3. Update `buildInitSuccessMessage` to include environment/ customization note
  4. Delete `src/lib/environment/discover-services.ts`
  5. Delete `src/lib/environment/assemble-compose-file.ts`
  6. Delete `src/lib/environment/parse-service-metadata.ts`
  7. Remove `ServiceMetadata`, `DiscoveredService`, `ServiceSelection`, `ServiceDependency` from types.ts
  8. Update `src/lib/environment/index.ts` barrel exports
  9. Delete `test/lib/environment/assemble-compose-file.test.ts`
  10. Delete `test/lib/environment/parse-service-metadata.test.ts`
  11. Delete `test/lib/environment/collect-file-paths.test.ts` if `collect-file-paths.ts` is only used by discover-services
  12. Verify no other commands import deleted modules
  13. Run build + lint + test
- **Success signal**: `npm run build && npm run lint && npm test` all pass

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Remove vs hide service selection | Remove entirely | Feature flag, hide behind --advanced | User wants simplicity, dead code is bad |
| Keep checkbox import | Yes | Remove it | May be useful for future features |
| Summary wording | "To customize your environment, edit the files in the environment/ folder." | More detailed instructions | Keep it simple |

---

*Generated: 2026-05-25*
*Status: DRAFT - ready for implementation*

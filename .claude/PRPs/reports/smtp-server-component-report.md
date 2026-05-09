# Implementation Report: Add Optional SMTP Server (Mailpit) Component

## Summary
Added an optional SMTP server component using `axllent/mailpit:v1.27` to the Jahia CLI environment system. When selected (interactively or via config), it automatically injects `SMTP_SERVER_URL=smtp://smtp-server:1025` into the Jahia container via a new `envInjections` mechanism. Dependencies are an implementation detail hidden from the user.

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Add `envInjections` to ComponentDefinition type | ✅ Complete | Optional field in types.ts |
| 2 | Create smtp-server.ts component | ✅ Complete | Was already created |
| 3 | Register smtp-server in component index | ✅ Complete | Added import + registry entry |
| 4 | Add `applyEnvInjections` function | ✅ Complete | Pure function in components/index.ts |
| 5 | Wire injections into Docker provider | ✅ Complete | Applied before user component startup |
| 6 | Update interactive mode with SMTP prompt | ✅ Complete | Asks after Jahia version question |
| 7 | Update config comments | ✅ Complete | Mentions smtp-server in environment section |
| 8 | Update tests | ✅ Complete | 8 new tests added |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (tsc) | ✅ Pass | Zero errors |
| Lint (eslint) | ✅ Pass | Zero warnings |
| Unit Tests (vitest) | ✅ Pass | 276 tests, all passing |
| Build | ✅ Pass | Manifest regenerated |

## Files Changed

| File | Action | Description |
|---|---|---|
| `src/lib/components/types.ts` | UPDATED | Added optional `envInjections` field to `ComponentDefinition` |
| `src/lib/components/smtp-server.ts` | EXISTED | Mailpit component definition (already created) |
| `src/lib/components/index.ts` | UPDATED | Registered smtp-server, added `applyEnvInjections` function |
| `src/lib/providers/docker/index.ts` | UPDATED | Apply env injections before starting user components |
| `src/commands/environment/create.ts` | UPDATED | Added `promptForOptionalComponents`, updated interactive flow |
| `src/lib/config/config-to-yaml-with-comments.ts` | UPDATED | Updated environment comment to mention smtp-server |
| `test/lib/components/registry.test.ts` | UPDATED | Updated counts, added 8 new tests |

## Tests Written

| Test | Coverage |
|---|---|
| smtp-server is utility category and user-selectable | Component metadata |
| smtp-server exposes SMTP and web UI ports | Port configuration |
| smtp-server declares envInjections for jahia | Injection declaration |
| listComponentsByCategory returns smtp-server for utility | Category filter |
| applyEnvInjections injects SMTP_SERVER_URL when smtp-server present | Cross-component injection |
| applyEnvInjections does not inject when smtp-server absent | No false positives |
| applyEnvInjections preserves existing env vars | No data loss |
| applyEnvInjections does not modify smtp-server component itself | Injection direction |

## Deviations from Plan
None — implemented as planned.

## Next Steps
- [ ] Code review via `/code-review`
- [ ] Create PR via `/prp-pr`

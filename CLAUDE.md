# CLAUDE.md — Project Instructions for AI Agents

## Project Overview

`@jahia/jahia-cli` is a cross-platform CLI application built on **OCLIF v4** (ESM) with **TypeScript strict mode**. It helps accelerate developing and testing Jahia in the Agentic era.

## Build & Quality Commands

```bash
npm run build          # TypeScript compilation + OCLIF manifest
npm run lint           # ESLint (strict TypeScript + functional rules)
npm run lint:fix       # Auto-fix lint errors
npm run format         # Prettier formatting
npm test               # Vitest (unit + integration tests)
npm run test:watch     # Vitest in watch mode
npm run test:coverage  # Vitest with v8 coverage
```

## Architecture

- **Framework**: OCLIF v4 with `@oclif/core` (ESM, `"type": "module"`)
- **Language**: TypeScript 5.7+ with strict mode
- **Test runner**: Vitest 3
- **Linter**: ESLint 9 flat config + typescript-eslint strict + eslint-plugin-functional
- **Formatter**: Prettier (single quotes, trailing commas, 100 char width)
- **CI**: GitHub Actions — 3 OS × 2 Node versions matrix
- **Release**: GitHub Releases → npm publish with provenance

## Code Conventions

### Functional Programming Style
- Use **arrow functions** for all standalone logic
- **One function per .ts file** — each exported function gets its own file for clarity and testability
- Extract business logic into **pure functions** outside command classes
- Prefer `const` over `let` — ESLint warns on `let`
- Avoid loops — use `map`, `filter`, `reduce` instead (ESLint warns on loops)
- Avoid mutation where practical

### OCLIF Commands
- Commands **must** extend `Command` class (framework requirement)
- Keep `run()` method minimal — delegate to pure helper functions
- Export helper functions for direct unit testing
- Use `Args` and `Flags` from `@oclif/core` for command inputs

### TypeScript
- Strict mode is enabled with extra checks (`noUncheckedIndexedAccess`, `noImplicitOverride`, etc.)
- Use `type` imports: `import type { Foo } from './bar.js'`
- All function return types should be explicit (ESLint warns)
- Use `.js` extensions in imports (ESM requirement)

### Testing
- Unit tests: test pure functions directly (fast, no process overhead)
- Integration tests: run CLI via `bin/dev.js` subprocess with `execFile`
- Test files mirror `src/` structure under `test/`
- Use `describe` / `test` (not `it`) from vitest

### File Organization
```
src/commands/          # CLI commands (one file per command)
src/lib/components/    # Component library definitions
src/lib/config/        # YAML config parser and defaults
src/lib/output/        # Dual human/JSON output formatters
src/lib/providers/     # Provider abstraction (docker, jahiacloudv1)
src/lib/state/         # Local JSON state persistence
src/index.ts        # Re-exports from @oclif/core
test/commands/      # Mirror of src/commands/ with .test.ts suffix
bin/run.js          # Production entry point
bin/dev.js          # Development entry point (tsx)
```

## Adding a New Command

1. Create `src/commands/<name>.ts` extending `Command`
2. Extract logic into exported pure arrow functions
3. Create `test/commands/<name>.test.ts` with unit + integration tests
4. Run `npm run build` to regenerate the OCLIF manifest
5. Run `npm run lint && npm test` to validate

## CI/CD

- **CI** runs on every push/PR to `main`: lint → build → test (6 matrix jobs)
- **Release** triggers on GitHub Release publish: lint → test → build → npm publish
- Version is derived from the release tag (e.g., `v1.2.3` → `1.2.3`)

## Important Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts, OCLIF config |
| `tsconfig.json` | TypeScript compilation config (strict) |
| `tsconfig.eslint.json` | Extended config for linting all files |
| `eslint.config.ts` | ESLint v9 flat config |
| `vitest.config.ts` | Test runner config |
| `.github/workflows/ci.yml` | CI workflow |
| `.github/workflows/release.yml` | Release workflow |

## Cross-Platform Compatibility (Windows / macOS / Linux)

This CLI **must** work on all three platforms. CI enforces this with a 3-OS matrix.

### Rules for All Code and Tests
- **Never hardcode path separators** — always use `path.join()` or `path.resolve()`
- **Never assume Unix shell commands** — use Node.js APIs (`fs`, `child_process`) instead of shell builtins
- **Use `os.homedir()`** for home directory (not `$HOME` or `~`)
- **Use `os.tmpdir()`** for temp paths in tests
- **Line endings**: write files with explicit content; don't rely on `\n` in assertions against file output
- **Process spawning**: use `execFile` (not `exec`) to avoid shell interpretation differences
- **Docker CLI**: available on all platforms — safe to shell out to `docker` directly
- **Test assertions on paths**: always construct expected paths with `path.join()`, never string literals like `'/foo/bar'`

### Common Pitfalls
| Problem | Fix |
|---------|-----|
| `path.join` uses `\` on Windows | Never compare against hardcoded `/` paths |
| `$HOME` undefined on Windows | Use `os.homedir()` |
| Shell glob expansion differs | Let Node handle globs, not the shell |
| `chmod` not available on Windows | Guard with platform check or skip |

# Agents.md — AI Agent Harnesses for jahia-cli

This document defines the specialized AI agent harnesses for the `@jahia/jahia-cli` project.
Each harness is a reusable agent configuration that can be invoked to perform specific tasks
with full project context. They allow incremental improvement based on feedback.

## How Harnesses Work

Each harness below defines:
- **Purpose**: What the agent does
- **Trigger**: When to invoke it
- **Context**: What files/knowledge the agent needs
- **Workflow**: Step-by-step instructions for the agent
- **Quality Gates**: Verification criteria before considering work done

Harnesses are invoked via the `task` tool with `agent_type` or by referencing the
workflow instructions below when working with any AI coding assistant.

---

## 1. Command Scaffolder

**Purpose**: Generate a new OCLIF command with proper structure, tests, and documentation.

**Trigger**: When adding a new CLI command or topic.

**Workflow**:
1. Read `CLAUDE.md` for project conventions
2. Create `src/commands/<name>.ts`:
   - Import `Args`, `Command`, `Flags` from `@oclif/core`
   - Extract all business logic into exported pure arrow functions above the class
   - Keep `run()` method minimal — parse args/flags, call pure functions, log output
   - Add `description`, `examples`, `args`, and `flags` static overrides
3. Create `test/commands/<name>.test.ts`:
   - Unit tests for each exported pure function
   - Integration tests via `execFile` on `bin/dev.js`
   - Cover: default behavior, all flags, edge cases, error cases
4. Update `README.md` Commands section with the new command
5. Run `npm run build && npm run lint && npm test`
6. Verify all tests pass before completing

**Quality Gates**:
- [ ] Pure functions are exported and unit-tested independently
- [ ] Integration tests verify CLI output
- [ ] `npm run lint` passes with zero errors
- [ ] `npm test` passes all tests
- [ ] README updated with new command documentation

---

## 2. Code Quality Guardian

**Purpose**: Enforce functional programming style, TypeScript strictness, and project conventions.

**Trigger**: After any code change — invoke proactively on every PR or commit.

**Workflow**:
1. Run `npm run lint` and fix any errors
2. Run `npm run format` to ensure consistent formatting
3. Review changed files for:
   - **Arrow functions**: All standalone functions should be arrow functions
   - **Pure functions**: Logic should be extracted from command classes
   - **Const over let**: No `let` unless mutation is genuinely required
   - **No loops**: Use `map`/`filter`/`reduce` instead
   - **Type imports**: Use `import type` for type-only imports
   - **Explicit return types**: All functions should have explicit return types
   - **No `any`**: TypeScript strict mode — use proper types
4. Run `npm test` to verify no regressions
5. Run `npm run build` to verify compilation

**Quality Gates**:
- [ ] `npm run lint` — zero errors
- [ ] `npm run format` — no changes needed
- [ ] `npm test` — all tests pass
- [ ] `npm run build` — compiles cleanly
- [ ] No `any` types in changed code
- [ ] All functions use arrow syntax (except OCLIF command classes)

---

## 3. Test Coverage Expander

**Purpose**: Identify gaps in test coverage and add missing tests.

**Trigger**: When adding features, fixing bugs, or when coverage drops.

**Workflow**:
1. Run `npm run test:coverage` to identify uncovered lines
2. For each uncovered function or branch:
   - Add unit tests for the pure function
   - Add integration tests for CLI behavior
3. Cover edge cases:
   - Missing/invalid arguments
   - Flag combinations
   - Error scenarios (bad input, missing resources)
4. Ensure tests are fast (unit tests < 100ms each)
5. Run full test suite to verify no regressions

**Quality Gates**:
- [ ] `npm run test:coverage` shows improvement
- [ ] New tests cover edge cases and error paths
- [ ] All tests pass
- [ ] No test takes more than 5 seconds

---

## 4. CI/CD Pipeline Maintainer

**Purpose**: Keep GitHub Actions workflows up to date, efficient, and reliable.

**Trigger**: When changing Node.js versions, dependencies, or build steps.

**Workflow**:
1. Review `.github/workflows/ci.yml`:
   - Matrix covers supported Node.js versions (currently 20, 22)
   - All 3 OS platforms tested (ubuntu, macos, windows)
   - Steps are in correct order: install → lint → build → test
   - Caching is configured (npm cache)
2. Review `.github/workflows/release.yml`:
   - Triggered only on `release: published`
   - Version extracted from tag correctly
   - npm publish uses `--provenance --access public`
   - `NPM_TOKEN` secret is referenced
3. Verify workflows are valid YAML
4. Check for security best practices:
   - Minimal permissions (`contents: read`)
   - Pinned action versions (`@v4`)
   - No secrets in logs

**Quality Gates**:
- [ ] Workflows are valid YAML
- [ ] CI matrix covers all target platforms and Node versions
- [ ] Release workflow publishes correctly
- [ ] No secrets exposed in workflow logs

---

## 5. Documentation Keeper

**Purpose**: Keep README, CLAUDE.md, and Agents.md in sync with code changes.

**Trigger**: After adding commands, changing conventions, or modifying CI/CD.

**Workflow**:
1. Verify `README.md`:
   - Installation instructions are current
   - All commands are documented with args and flags
   - Development setup instructions work
   - Contributing guidelines match actual conventions
2. Verify `CLAUDE.md`:
   - Build commands are correct
   - Architecture description matches reality
   - Code conventions reflect current ESLint rules
   - "Adding a New Command" guide is accurate
3. Verify `Agents.md` (this file):
   - Harness workflows match current project structure
   - Quality gates are achievable
4. Run any documented commands to verify they work

**Quality Gates**:
- [ ] All documented commands run successfully
- [ ] No stale references to removed features
- [ ] New features are documented

---

## 6. Dependency Updater

**Purpose**: Keep dependencies up to date while maintaining stability.

**Trigger**: Periodically or when security advisories are published.

**Workflow**:
1. Run `npm outdated` to identify stale dependencies
2. Update dependencies incrementally (one major version at a time)
3. After each update:
   - `npm install`
   - `npm run build` — verify compilation
   - `npm run lint` — verify lint rules still apply
   - `npm test` — verify all tests pass
4. Pay special attention to:
   - `@oclif/core` — major updates may change APIs
   - `typescript-eslint` — rule changes may require config updates
   - `vitest` — test API changes
5. Update `engines.node` in package.json if minimum Node version changes
6. Update CI matrix Node versions if needed

**Quality Gates**:
- [ ] `npm audit` shows no high/critical vulnerabilities
- [ ] All tests pass after updates
- [ ] Build compiles cleanly
- [ ] Lint passes

---

## 7. TypeScript OCLIF Best Practices Enforcer

**Purpose**: Ensure all code changes follow functional TypeScript best practices for OCLIF CLI development. This harness is **always active** — it applies to every modification or creation, not just when explicitly invoked.

**Trigger**: Every code change, whether creating new files, modifying existing ones, or reviewing PRs. This harness does NOT require refactoring existing code that wasn't touched, but any file you modify must leave in compliance.

**Principles**:

### File & Folder Structure
- **One exported function per `.ts` file** in library code (`src/lib/`). The file name should match the function name in kebab-case (e.g., `build-sample-workflow.ts` exports `buildSampleWorkflow`).
- **Command files** (`src/commands/`) are the one exception — they contain the OCLIF `Command` class plus extracted pure helper functions above it.
- **Group related files in topic directories** (e.g., `src/lib/workflow/`, `src/lib/artifacts/`). Each directory should have an `index.ts` barrel file re-exporting public API.
- **Types go in a dedicated `types.ts`** within each directory. Use `interface` (not `type`) for object shapes.
- **Test files mirror source structure** under `test/` with `.test.ts` suffix.

### Functional Programming
- **Arrow functions only** — the `function` keyword is forbidden except for OCLIF command class methods (`run()`, lifecycle hooks).
- **`const` only** — `let` is banned by ESLint. Use `.map()`, `.filter()`, `.reduce()`, or restructure into pure helper functions.
- **No loops** — `for`, `while`, `for...of` are banned. Use array methods or recursion.
- **Pure functions** — extract all business logic from command `run()` into exported pure functions above the class. The `run()` method should only parse flags, call pure functions, and log output.
- **Immutable data** — interfaces use `readonly` properties. Use `Readonly<>` and `readonly` arrays.
- **No mutation** — avoid `.push()`, `.splice()`, property reassignment. Build new objects/arrays instead.

### TypeScript Strictness
- **No `any`** — the compiler and ESLint both reject it. Use proper types, generics, or `unknown` with type guards.
- **Explicit return types** on all exported functions.
- **`import type`** for type-only imports — enforced by `consistent-type-imports`.
- **`.js` extensions** in all import paths — ESM requirement even for `.ts` source files.
- **`interface` over `type`** for object shapes — enforced by `consistent-type-definitions`.
- **Optional properties include `| undefined`** — required by `exactOptionalPropertyTypes` (e.g., `readonly foo?: string | undefined`).

### Testing
- **Every new function gets tests**. Minimum one test per function, covering the happy path.
- **Cover edge cases**: invalid input, empty arrays, undefined optionals, error paths.
- **Unit tests** import pure functions directly — no process overhead.
- **Integration tests** spawn `bin/dev.js` via `execFile` and assert on stdout/stderr.
- **Use `describe` / `test`** (not `it`) from vitest.
- **Cross-platform**: use `path.join()`, `path.basename()`, `os.tmpdir()` — never hardcode path separators.

### Code Coverage
- Maintain or improve the **40% threshold** (target: 80%).
- Run `npm run test:coverage` before committing to verify.
- Prioritize testing pure functions (highest ROI) over mocked integration tests.

**Workflow** (applied to every change):
1. Before writing code, read `CLAUDE.md` for current conventions
2. For new files: one function per file, kebab-case name, arrow function, explicit return type
3. For modified files: ensure touched code follows all principles above
4. Write or update tests for every new/changed function
5. Run validation chain: `npm run build && npm run lint && npm test`
6. Verify no `any`, no `let`, no loops, no `function` keyword in changed code

**Quality Gates** (must ALL pass before considering work done):
- [ ] `npm run build` — zero errors
- [ ] `npm run lint` — zero errors, zero warnings
- [ ] `npm test` — all tests pass
- [ ] `npm run test:coverage` — meets threshold
- [ ] Every new function has at least one test
- [ ] No `any` types in changed code
- [ ] No `let` declarations in changed code
- [ ] No loop statements in changed code
- [ ] All standalone functions use arrow syntax
- [ ] One function per file in `src/lib/` directories
- [ ] All imports use `.js` extension
- [ ] All type-only imports use `import type`

---

## Invoking Harnesses

When working with an AI assistant on this project, reference the harness by name:

```
"Run the Command Scaffolder harness to add a new 'config' command"
"Run the Code Quality Guardian on my latest changes"
"Run the Test Coverage Expander for the new auth module"
```

The agent should read this file, follow the specified workflow, and verify all quality gates before completing.

**Note**: Harness #7 (TypeScript OCLIF Best Practices Enforcer) is **always active** and does not need to be explicitly invoked. It applies to every code change in every session.

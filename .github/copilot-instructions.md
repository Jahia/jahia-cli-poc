# Copilot Instructions for jahia-cli

## Commands

```bash
npm run build          # TypeScript compilation + OCLIF manifest generation
npm run lint           # ESLint (strict TypeScript + functional rules)
npm run lint:fix       # Auto-fix lint errors
npm run format         # Prettier formatting
npm test               # Vitest — all tests
npx vitest run test/lib/components/registry.test.ts  # Run a single test file
npm run test:coverage  # Coverage report (v8)
```

Always run `npm run build` after changing source files — it regenerates the OCLIF command manifest.

## Architecture

OCLIF v4 CLI (ESM, `"type": "module"`) with TypeScript strict mode and a functional programming style enforced by ESLint.

### Command layer (`src/commands/`)

Commands extend OCLIF's `Command` class but keep `run()` thin — all logic lives in exported pure arrow functions above the class. This makes business logic directly unit-testable without spawning a subprocess. Topic separator is a space (`environment create`, not `environment:create`).

### Environment system (`src/lib/`)

The CLI manages Jahia environments through three layers:

- **Component library** (`src/lib/components/`) — Predefined container definitions (jahia, pgsql, elasticsearch, etc.). Each component is a TypeScript object with image, ports, env vars, volumes, healthcheck, and dependency declarations. Users pick components by name; all Docker details are abstracted. Add a component by creating a file and registering it in `index.ts`.

- **Provider abstraction** (`src/lib/providers/`) — `Provider` interface with `createEnvironment`, `getEnvironmentStatus`, `checkHealth`. The Docker provider uses native `docker` CLI commands (not docker-compose). A `jahiacloudv1` placeholder exists for future cloud API support.

- **Config system** (`src/lib/config/`) — YAML config files define environments declaratively. The parser validates, resolves component names from the registry, and merges user overrides with defaults.

### Output formatting (`src/lib/output/`)

All commands support `--json` for structured output (AI agent consumption) alongside human-readable formatted output with status icons.

## Key Conventions

- **All standalone functions must be arrow functions** — only OCLIF command classes use `class` syntax.
- **Use `interface` not `type`** for object shapes — ESLint enforces `consistent-type-definitions`.
- **Use `import type`** for type-only imports — enforced by `consistent-type-imports`.
- **Optional properties must include `| undefined`** — TypeScript `exactOptionalPropertyTypes` is enabled (e.g., `readonly foo?: string | undefined`).
- **Use `.js` extensions in all imports** — ESM requirement, even when the source file is `.ts`.
- **No `let`, no loops** — ESLint warns on both. Use `const`, `map`, `filter`, `reduce`.
- **No `any`** — TypeScript strict + `strictTypeChecked` ESLint preset.
- **Immutable data** — interfaces use `readonly` properties and `Readonly<>` utility types.

## Testing Pattern

Tests mirror `src/` under `test/`. Each test file has two sections:

1. **Unit tests** — import and test the exported pure functions directly.
2. **Integration tests** — spawn `bin/dev.js` via `execFile` and assert on stdout.

Use `describe` / `test` (not `it`). Guard against `undefined` with early-return checks instead of non-null assertions (`!`).

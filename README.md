# @jahia/jahia-cli

A CLI to accelerate developing and testing Jahia in the Agentic era.

[![CI](https://github.com/Jahia/jahia-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/Jahia/jahia-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@jahia/jahia-cli)](https://www.npmjs.com/package/@jahia/jahia-cli)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

## Installation

### Via npm (recommended)

```bash
npm install -g @jahia/jahia-cli
```

### Via npx (no installation)

```bash
npx @jahia/jahia-cli hello
```

## Usage

```bash
# Display help
jahia --help

# Run the hello command
jahia hello

# Greet someone by name
jahia hello YourName

# Uppercase greeting
jahia hello --uppercase
```

## Commands

### `jahia hello [NAME]`

Say hello from Jahia CLI.

**Arguments:**
- `NAME` — Name to greet (default: `world`)

**Flags:**
- `-u, --uppercase` — Transform the greeting to uppercase

## Development

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10

### Setup

```bash
git clone https://github.com/Jahia/jahia-cli.git
cd jahia-cli
npm install
```

### Run in development

```bash
./bin/dev.js hello
```

### Build

```bash
npm run build
```

### Test

```bash
npm test                # Run tests once
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage
```

### Lint & Format

```bash
npm run lint        # Check for linting errors
npm run lint:fix    # Auto-fix linting errors
npm run format      # Format code with Prettier
```

## Project Structure

```
src/
└── commands/       # CLI commands (one file per command)
    └── hello.ts    # Hello world command
test/
└── commands/       # Test files mirror src structure
    └── hello.test.ts
bin/
├── dev.js          # Dev entry point (uses tsx)
└── run.js          # Production entry point
```

## Contributing

1. Create a feature branch from `main`
2. Make your changes following the functional programming style
3. Ensure all tests pass: `npm test`
4. Ensure linting passes: `npm run lint`
5. Submit a pull request

### Coding Conventions

- **Functional programming**: Use arrow functions, prefer `const`, avoid mutations
- **TypeScript strict mode**: All types must be explicit, no `any`
- **Command classes**: OCLIF requires classes for commands, but extract logic into pure functions

## Releasing

Releases are managed via GitHub Releases:

1. Create a new release on GitHub with a semver tag (e.g., `v1.0.0`)
2. The release workflow automatically publishes to npm

> **Note:** The repository requires an `NPM_TOKEN` secret for npm publishing.

## License

[Apache License 2.0](LICENSE)
A CLI to accelerate developing and testing Jahia in the Agentic era

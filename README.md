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
npx @jahia/jahia-cli environment create --component jahia --component pgsql
```

### Via Docker

```bash
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock ghcr.io/jahia/jahia-cli environment list
```

## Quick Start

```bash
# Create a Jahia environment with PostgreSQL
jahia-cli environment create --component jahia --component pgsql

# Check environment health
jahia-cli environment doctor

# View logs from a component
jahia-cli environment logs --component jahia

# List all components and their status
jahia-cli environment list

# Stop the environment (preserves containers)
jahia-cli environment stop

# Restart the environment
jahia-cli environment start

# Destroy everything
jahia-cli environment delete
```

## Commands

### `config init`

Generate an initialized Jahia CLI configuration file.

```bash
# Derive config from active state
jahia-cli config init

# Generate a blank scaffold
jahia-cli config init --blank

# Use custom state file and output path
jahia-cli config init --state ~/.jahia-cli/state.json --output ./my-config.yml

# Overwrite existing file
jahia-cli config init --force
```

**Flags:**
- `--state` - Path to state JSON file used for state-derived config
- `-o, --output` - Output YAML file path (default: `jahia-cli.config.yml`)
- `--blank` - Generate a blank scaffold instead of deriving from state
- `-f, --force` - Overwrite output file if it already exists
- `--json` - Structured JSON output

### `tests init`

Initialize local test scaffolding from `Jahia/jahia-cypress`.

This command clones `jahia-cypress` at the specified version (branch/tag), or the latest tag
when version is omitted, reads `scaffolding/`, and recursively copies only missing files into
your local tests folder. Existing local files are kept as-is.

If `<tests-folder>/config.yml` does not exist, it is initialized and seeded with:

```yaml
tests:
  jahia-cypress: <resolved-version>
```

```bash
# Initialize from latest jahia-cypress tag
jahia-cli tests init

# Initialize tests folder from a working branch
jahia-cli tests init test-jahia-cli

# Use a release tag and a custom destination
jahia-cli tests init v1.2.3 ./tests

# Use custom destination without specifying version
jahia-cli tests init --path ./tests

# JSON output for CI/AI
jahia-cli tests init main tests --json
```

**Arguments:**
- `[version]` - Branch or tag to fetch from `Jahia/jahia-cypress` (default: latest tag)
- `[path]` - Local tests folder path (default: `tests`)

**Flags:**
- `-p, --path` - Local tests folder path (overrides positional path)
- `--json` - Structured JSON output

### `environment create`

Create a new Jahia environment from predefined components.

```bash
# Interactive mode (prompts for component selection)
jahia-cli environment create

# Specify components directly
jahia-cli environment create --component jahia --component pgsql --component elasticsearch

# Use a YAML config file
jahia-cli environment create --config ./my-environment.yml

# Named environment with JSON output (for AI agents)
jahia-cli environment create --name my-env --component jahia --component pgsql --json

# Force-replace an existing environment
jahia-cli environment create --component jahia --force
```

**Flags:**
- `-C, --component` — Component to include (repeatable)
- `-c, --config` — Path to a YAML configuration file
- `-n, --name` — Environment name (auto-generated if omitted)
- `-p, --provider` — Provider to use (default: `docker`)
- `-f, --force` — Delete existing environment before creating
- `--json` — Structured JSON output

### `environment stop`

Stop a running environment without destroying it.

```bash
jahia-cli environment stop
jahia-cli environment stop --json
```

### `environment start`

Restart a previously stopped environment.

```bash
jahia-cli environment start
jahia-cli environment start --json
```

### `environment delete`

Destroy an environment completely (containers, networks, volumes).

```bash
jahia-cli environment delete
jahia-cli environment delete --json
```

### `environment doctor`

Check health status of the active environment.

```bash
jahia-cli environment doctor
jahia-cli environment doctor --name my-env --json
```

### `environment logs`

View logs from a specific component.

```bash
jahia-cli environment logs --component jahia
jahia-cli environment logs --component pgsql --tail 50
jahia-cli environment logs --component jahia --json
```

**Flags:**
- `-C, --component` — Component to show logs for (required)
- `-t, --tail` — Number of lines from the end (default: 100)
- `--json` — Structured JSON output

### `environment list`

Show all components and their live status.

```bash
jahia-cli environment list
jahia-cli environment list --json
```

## Available Components

| Component | Description |
|-----------|-------------|
| `jahia` | Jahia DXM processing node |
| `jahia-browsing` | Jahia browsing (read-only) node |
| `pgsql` | PostgreSQL database |
| `elasticsearch` | Elasticsearch search engine |

## YAML Configuration

Create a `environment.yml` file to define complex environments:

```yaml
name: my-jahia-env
provider: docker
components:
  - jahia
  - pgsql
  - name: elasticsearch
    overrides:
      tag: "8.11.0"
tests:
  jahia-cypress: "v1.2.3"
```

### `jahia provision`

Execute a Jahia provisioning script (YAML manifest) against a running Jahia instance. The manifest can be a local file or a public URL — the CLI detects the source automatically.

```bash
# Provision from a local file
jahia-cli jahia provision --manifest ./provisioning.yaml

# Provision from a URL
jahia-cli jahia provision --manifest https://raw.githubusercontent.com/org/repo/main/provisioning.yaml

# Custom target URL and credentials
jahia-cli jahia provision --manifest ./setup.yaml --url http://jahia.example.com:8080 --username root --password secret

# Attach additional files referenced by the manifest
jahia-cli jahia provision --manifest ./setup.yaml -f ./settings.properties -f ./license.xml

# Use state to target the active environment
jahia-cli jahia provision --manifest ./setup.yaml --state

# JSON output for CI/AI
jahia-cli jahia provision --manifest ./setup.yaml --json
```

**Flags:**
- `-m, --manifest` (required) - Path to a local YAML file or a public URL

**Flags:**
- `--url` - Jahia base URL (default: `http://localhost:8080`)
- `-u, --username` - Jahia admin username (default: `root`)
- `-P, --password` - Jahia admin password (default: `root1234`)
- `-f, --file` - Additional files to attach (repeatable)
- `-a, --assets` - Directory whose files are attached recursively
- `--state` - Optional state file path to target the active environment
- `--json` - Structured JSON output

## AI Agent Usage

All commands support `--json` for structured output. AI agents should:

1. Use `--json` on every command for parseable responses
2. Check `success` field in JSON output
3. Use `environment doctor --json` to verify health before running tests
4. Use `environment logs --component <name> --json` for debugging

## Development

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10
- Docker (for environment commands)

### Setup

```bash
git clone https://github.com/Jahia/jahia-cli.git
cd jahia-cli
npm install
```

### Run in development

```bash
./bin/dev.js environment create --component jahia --component pgsql
```

### Build & Test

```bash
npm run build          # TypeScript compilation + OCLIF manifest
npm run lint           # ESLint check
npm test              # Run all tests
npm run test:coverage  # Tests with coverage
npm run format         # Prettier formatting
```

## Architecture

```
src/
├── commands/
│   ├── config/          # Configuration commands (init)
│   ├── environment/     # Environment lifecycle commands
│   └── tests/           # Test bootstrap commands (init)
├── lib/
│   ├── components/      # Component library (jahia, pgsql, elasticsearch, etc.)
│   ├── config/          # YAML config parser and defaults
│   ├── tests/           # Test scaffolding bootstrap helpers
│   ├── output/          # Dual human/JSON output formatters
│   ├── providers/       # Provider abstraction (docker, jahiacloudv1 placeholder)
│   │   └── docker/      # Native Docker CLI integration
│   └── state/           # Local JSON state persistence
test/                    # Mirror of src/ with .test.ts files
```

## Contributing

1. Create a feature branch from `main`
2. Follow functional programming style (arrow functions, `const`, no mutations)
3. One function per `.ts` file
4. Ensure `npm run lint && npm test` passes
5. Submit a pull request

## Releasing

Releases are managed via GitHub Releases:

1. Create a new release with a semver tag (e.g., `v1.0.0`)
2. The release workflow automatically publishes to npm and builds a multi-arch Docker image

## License

[Apache License 2.0](LICENSE)

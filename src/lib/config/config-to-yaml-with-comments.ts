import type { JahiaCliConfig } from './types.js';
import { configToYaml } from './config-to-yaml.js';

/**
 * Section-level comment headers for the config file.
 * Provides lightweight documentation embedded directly in the generated YAML.
 */
const SCAFFOLDING_COMMENT = `# ── Scaffolding ──────────────────────────────────────────────────────────
# Source repository for the project scaffolding (tests + environment).
# - repository: Git URL of the scaffolding source
# - path: subdirectory within the repo containing scaffolding files
# - version: Git ref to checkout ("latest" resolves to newest tag)
#
# The scaffolding contains:
#   ./              — test framework files (synced by "tests init")
#   ./environment/  — docker-compose services and config (used by "init")`;

const ENVIRONMENT_COMMENT = `# ── Environment ──────────────────────────────────────────────────────────
# Defines the Jahia environment to create via Docker Compose.
# - name: unique identifier for the environment (auto-generated if omitted)
# - provider: "docker" (default) or "jahiacloudv1" (future)
# - composePath: path to the assembled docker-compose.yml file`;

const TESTS_COMMENT = `# ── Tests ────────────────────────────────────────────────────────────────
# Configures test container build and run settings.
# - container.dockerfile: path to the Dockerfile
# - container.image: image name for the built test image
# - container.tag: image tag (defaults to scaffolding version)`;

const WORKFLOWS_FILE_COMMENT = `# ── Workflows File ───────────────────────────────────────────────────────
# Path to a separate YAML file containing shared (global) workflow definitions.
# Resolved relative to this config file's directory.
# Workflows in this file are merged with local workflows below.
# Local workflows take precedence on name collisions.
# Supports \${VAR:-default} env var substitution.
#
# Example:
#   workflowsFile: jahia-cli.workflows.global.yml
#
# Can also be specified via CLI: --workflows-file <path>
# (CLI flag is resolved relative to CWD and takes precedence over this key)`;

const WORKFLOW_COMMENT = `# ── Workflows ────────────────────────────────────────────────────────────
# Named workflows executed by "jahia-cli workflow run --name <name>".
# Each workflow has a unique name (the map key), an optional "default: true"
# flag, and a "steps" array.
#
# One workflow may be marked as "default: true" — it runs when --name is omitted.
#
# Each step is either a shell command (run:) or a jahia-cli command (uses:).
# - name: human-readable label (optional)
# - run: shell command executed via execa
# - uses: jahia-cli command name (e.g. "environment:create")
# - with: flags passed to the command (e.g. { timeout: "300" })
# - working_dir: override the working directory for this step
#
# Workflows can call other workflows via:
#   uses: workflow:run
#   with:
#     name: <other-workflow-name>
#
# Circular calls are detected and rejected.
# Steps run in order; the workflow stops on the first failure.`;

/**
 * Takes the plain YAML output from configToYaml and inserts section-level
 * comment headers above each top-level section (environment, tests, workflow).
 */
export const insertSectionComments = (yamlContent: string): string => {
  const commentMap: Readonly<Record<string, string>> = {
    'scaffolding:': SCAFFOLDING_COMMENT,
    'workflowsFile:': WORKFLOWS_FILE_COMMENT,
    'environment:': ENVIRONMENT_COMMENT,
    'tests:': TESTS_COMMENT,
    'workflows:': WORKFLOW_COMMENT,
  };

  const lines = yamlContent.split('\n');
  const result: string[] = [];

  lines.forEach((line) => {
    const matchedKey = Object.keys(commentMap).find(
      (key) => line.startsWith(key),
    );

    if (matchedKey !== undefined) {
      if (result.length > 0) {
        result.push('');
      }

      result.push(commentMap[matchedKey] ?? '');
    }

    result.push(line);
  });

  return result.join('\n');
};

/**
 * Serializes JahiaCliConfig to YAML with section-level documentation comments.
 */
export const configToYamlWithComments = (config: JahiaCliConfig): string =>
  insertSectionComments(configToYaml(config));

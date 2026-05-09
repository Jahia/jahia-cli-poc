import type { JahiaCliConfig } from './types.js';
import { configToYaml } from './config-to-yaml.js';

/**
 * Section-level comment headers for the config file.
 * Provides lightweight documentation embedded directly in the generated YAML.
 */
const ENVIRONMENT_COMMENT = `# ── Environment ──────────────────────────────────────────────────────────
# Defines the Jahia environment to create via Docker.
# - name: unique identifier for the environment (auto-generated if omitted)
# - provider: "docker" (default) or "jahiacloudv1" (future)
# - components: list of services to start (e.g. jahia, pgsql, elasticsearch)
#   Each component can be a plain string or an object with overrides:
#     - jahia                          # uses default tag
#     - { name: jahia, overrides: { tag: "8.3.0.0" } }  # custom version`;

const TESTS_COMMENT = `# ── Tests ────────────────────────────────────────────────────────────────
# Configures test scaffolding pulled from a remote Git repository.
# - scaffolding.repository: Git URL of the test scaffolding source
# - scaffolding.path: subdirectory within the repo containing scaffolding files
# - scaffolding.version: Git ref to checkout ("latest" resolves to newest tag)`;

const WORKFLOW_COMMENT = `# ── Workflow ─────────────────────────────────────────────────────────────
# Sequential steps executed by "jahia-cli workflow run".
# Each step is either a shell command (run:) or a jahia-cli command (uses:).
# - name: human-readable label (optional)
# - run: shell command executed via execa
# - uses: jahia-cli command name (e.g. "environment:create")
# - with: flags passed to the command (e.g. { timeout: "300" })
# - working_dir: override the working directory for this step
# Steps run in order; the workflow stops on the first failure.`;

/**
 * Takes the plain YAML output from configToYaml and inserts section-level
 * comment headers above each top-level section (environment, tests, workflow).
 */
export const insertSectionComments = (yamlContent: string): string => {
  const commentMap: Readonly<Record<string, string>> = {
    'environment:': ENVIRONMENT_COMMENT,
    'tests:': TESTS_COMMENT,
    'workflow:': WORKFLOW_COMMENT,
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

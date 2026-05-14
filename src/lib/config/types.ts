import type { ComponentOverrides } from '../components/types.js';

/**
 * A component entry in a YAML config file.
 */
export interface ConfigComponent {
  readonly name: string;
  readonly overrides?: ComponentOverrides | undefined;
}

/**
 * Scaffolding source configuration for test initialization.
 */
export interface ScaffoldingConfig {
  readonly repository: string;
  readonly path: string;
  readonly version: string;
}

/**
 * Test framework configuration metadata.
 */
export interface TestsConfig {
  readonly 'jahia-cypress'?: string | undefined;
  readonly scaffolding?: ScaffoldingConfig | undefined;
  /**
   * Test container build and run configuration.
   *
   * All fields are optional — sensible defaults are used when omitted.
   * This keeps config files minimal while allowing full control when needed.
   *
   * Available options:
   *   dockerfile  — Path to the Dockerfile (default: "docker/Dockerfile.local")
   *   image       — Image name for the built test image (default: "jahia-tests")
   *                 Supports ${VAR:-default} env var substitution.
   *   tag         — Image tag (default: scaffolding version from tests.scaffolding.version)
   *                 Supports ${VAR:-default} env var substitution.
   *   platform    — Target platform for buildx (e.g. "linux/amd64").
   *                 Defaults to current platform when omitted.
   *   buildArgs   — Extra Docker build args as key-value pairs.
   *                 Values support ${VAR:-default} env var substitution.
   *
   * Example in YAML:
   *   tests:
   *     container:
   *       image: "${TEST_IMAGE:-jahia-tests}"
   *       tag: "${TEST_TAG:-latest}"
   *       platform: linux/amd64
   *       buildArgs:
   *         CYPRESS_VERSION: "13.0.0"
   */
  readonly container?: TestContainerConfig | undefined;
}

/**
 * Configuration for the test container image build and execution.
 * All fields are optional — defaults from the cypress component and
 * build-image module are used when omitted.
 */
export interface TestContainerConfig {
  readonly dockerfile?: string | undefined;
  readonly image?: string | undefined;
  readonly tag?: string | undefined;
  readonly platform?: string | undefined;
  readonly buildArgs?: Readonly<Record<string, string>> | undefined;
}

/**
 * The environment section of the configuration file.
 */
export interface EnvironmentConfig {
  readonly name: string;
  readonly provider: string;
  readonly components: readonly ConfigComponent[];
}

/**
 * A single step in a workflow.
 * Either `run` (shell command) or `uses` (jahia-cli command) must be provided.
 */
export interface WorkflowStep {
  readonly name?: string | undefined;
  readonly run?: string | undefined;
  readonly uses?: string | undefined;
  readonly with?: Readonly<Record<string, string>> | undefined;
  readonly working_dir?: string | undefined;
}

/**
 * A single named workflow in the configuration file.
 * May be marked as the default workflow to run when --name is omitted.
 */
export interface WorkflowConfig {
  readonly default?: boolean | undefined;
  readonly steps: readonly WorkflowStep[];
}

/**
 * A map of named workflows keyed by workflow name.
 */
export type WorkflowsMap = Readonly<Record<string, WorkflowConfig>>;

/**
 * The top-level Jahia CLI configuration file structure.
 * Contains `environment`, `tests`, and `workflows` as distinct top-level sections.
 */
export interface JahiaCliConfig {
  readonly environment?: EnvironmentConfig | undefined;
  readonly tests?: TestsConfig | undefined;
  readonly workflows?: WorkflowsMap | undefined;
}

/**
 * Raw YAML structure before validation (loose types for parsing).
 */
export interface RawConfig {
  readonly environment?: unknown;
  readonly tests?: unknown;
  readonly workflows?: unknown;
  readonly workflow?: unknown;
}

/**
 * Raw environment section before validation.
 */
export interface RawEnvironmentConfig {
  readonly name?: unknown;
  readonly provider?: unknown;
  readonly components?: unknown;
}

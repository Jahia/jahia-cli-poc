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

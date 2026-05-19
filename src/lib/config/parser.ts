/**
 * Configuration parser — re-exports individual parse/validate functions.
 *
 * Each function lives in its own file following the one-function-per-file convention.
 * This barrel module preserves backward-compatible import paths.
 */
export { parseScaffoldingConfig } from './parse-scaffolding-config.js';
export { parseTestContainerConfig } from './parse-test-container-config.js';
export { parseTestsConfig } from './parse-tests-config.js';
export { resolveComponentOverrides } from './resolve-component-overrides.js';
export { validateEnvironmentConfig } from './validate-environment-config.js';
export { validateWorkflowStep } from './validate-workflow-step.js';
export { parseSingleWorkflow } from './parse-single-workflow.js';
export { parseWorkflowsConfig } from './parse-workflows-config.js';
export { validateConfig } from './validate-config.js';
export { loadConfigFile } from './load-config-file.js';
export { resolveConfigComponents } from './resolve-config-components.js';

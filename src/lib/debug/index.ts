/**
 * Debug module — displays environment variables matching a configurable prefix for debugging.
 *
 * Each function lives in its own file following the one-function-per-file convention.
 * This barrel module provides backward-compatible import paths.
 */
export { collectJcliVars } from './collect-jcli-vars.js';
export { maskSecretValue } from './mask-secret-value.js';
export { truncateLongValue } from './truncate-long-value.js';
export { formatDebugVarsHuman } from './format-debug-vars-human.js';
export { formatDebugSection } from './format-debug-section.js';
export { buildDebugJson } from './build-debug-json.js';
export type { DebugJsonOutput } from './build-debug-json.js';
export { debugFlag } from './debug-flag.js';
export type { JcliEnvEntry } from './types.js';

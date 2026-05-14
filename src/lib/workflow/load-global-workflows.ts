import { readFile } from 'node:fs/promises';

import yaml from 'js-yaml';

import { parseWorkflowsConfig } from '../config/parser.js';
import type { WorkflowsMap } from '../config/types.js';

/**
 * Result of attempting to load a global workflows file.
 * Provides structured outcome so the caller can decide how to present it.
 */
export interface GlobalWorkflowsLoadResult {
  readonly found: boolean;
  readonly path: string;
  readonly workflows: WorkflowsMap | undefined;
  readonly error?: string | undefined;
}

/**
 * Loads and parses a global workflows YAML file.
 *
 * The file must contain a top-level `workflows:` key with the same structure
 * as the `workflows` section in the main config file.
 *
 * Returns a structured result (never throws for missing files):
 * - found=true, workflows=map → file loaded successfully
 * - found=false → file does not exist (caller decides severity)
 * - found=true, workflows=undefined, error=msg → file exists but is invalid
 */
export const loadGlobalWorkflows = async (
  filePath: string,
): Promise<GlobalWorkflowsLoadResult> => {
  const content = await readFile(filePath, 'utf-8').catch((error: unknown) => {
    const isNotFound =
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT';
    if (isNotFound) {
      return undefined;
    }

    throw error;
  });

  if (content === undefined) {
    return { found: false, path: filePath, workflows: undefined };
  }

  const raw: unknown = yaml.load(content);

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {
      found: true,
      path: filePath,
      workflows: undefined,
      error: 'Global workflows file must contain a YAML object with a "workflows:" key.',
    };
  }

  const record = raw as Record<string, unknown>;

  if (record['workflows'] === undefined) {
    return {
      found: true,
      path: filePath,
      workflows: undefined,
      error: 'Global workflows file must contain a "workflows:" key.',
    };
  }

  const workflows = parseWorkflowsConfig(record['workflows']);

  return { found: true, path: filePath, workflows };
};

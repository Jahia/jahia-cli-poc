import { readFile } from 'node:fs/promises';

import yaml from 'js-yaml';

import { validateConfig } from './validate-config.js';
import type { JahiaCliConfig, RawConfig } from './types.js';

/**
 * Loads and parses a YAML config file from disk.
 */
export const loadConfigFile = async (filePath: string): Promise<JahiaCliConfig> => {
  const content = await readFile(filePath, 'utf-8');
  const raw = yaml.load(content) as RawConfig;
  return validateConfig(raw);
};

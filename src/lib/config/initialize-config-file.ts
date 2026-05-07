import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { configToYaml } from './config-to-yaml.js';
import type { JahiaCliConfig } from './types.js';

export interface InitializeConfigFileParams {
  readonly outputFile: string;
  readonly config: JahiaCliConfig;
  readonly force: boolean;
}

export interface InitializeConfigFileResult {
  readonly written: boolean;
  readonly outputFile: string;
}

export const initializeConfigFile = async (
  params: InitializeConfigFileParams,
): Promise<InitializeConfigFileResult> => {
  const outputExists = await access(params.outputFile)
    .then(() => true)
    .catch(() => false);

  if (outputExists && !params.force) {
    return { written: false, outputFile: params.outputFile };
  }

  const yamlContent = configToYaml(params.config);
  await mkdir(dirname(params.outputFile), { recursive: true });
  await writeFile(params.outputFile, yamlContent, 'utf-8');

  return { written: true, outputFile: params.outputFile };
};

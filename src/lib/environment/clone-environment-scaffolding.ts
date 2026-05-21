import { execFile } from 'node:child_process';
import { access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import type { EnvironmentScaffoldingResult } from './types.js';
import {
  buildCloneArgs,
  DEFAULT_CYPRESS_REPOSITORY,
  resolveLatestTag,
} from '../tests/clone-scaffolding.js';

const execFileAsync = promisify(execFile);
const DEFAULT_CHECKOUT_DIRNAME = 'jahia-cypress';

/**
 * Clones the environment scaffolding from the remote repository.
 * Returns paths to the environment directory and services subdirectory.
 */
export const cloneEnvironmentScaffolding = async (params: {
  readonly version?: string | undefined;
  readonly workDir: string;
  readonly repositoryUrl?: string | undefined;
  readonly scaffoldingPath?: string | undefined;
}): Promise<EnvironmentScaffoldingResult> => {
  const repositoryUrl = params.repositoryUrl ?? DEFAULT_CYPRESS_REPOSITORY;
  const version = params.version ?? (await resolveLatestTag(repositoryUrl));
  const checkoutDir = join(params.workDir, DEFAULT_CHECKOUT_DIRNAME);
  const subPath = params.scaffoldingPath ?? 'scaffolding/environment';
  const environmentDir = join(checkoutDir, subPath);
  const servicesDir = join(environmentDir, 'services');

  await mkdir(params.workDir, { recursive: true });
  await execFileAsync('git', [...buildCloneArgs({ version, repositoryUrl, checkoutDir })], {
    cwd: params.workDir,
  });

  await access(environmentDir).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Environment scaffolding not found at "${environmentDir}" after cloning ${repositoryUrl}@${version}: ${message}`,
    );
  });

  await access(servicesDir).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Services directory not found at "${servicesDir}" after cloning ${repositoryUrl}@${version}: ${message}`,
    );
  });

  return {
    version,
    repositoryUrl,
    checkoutDir,
    environmentDir,
    servicesDir,
  };
};

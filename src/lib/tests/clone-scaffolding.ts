import { execFile } from 'node:child_process';
import { access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import type { ScaffoldingCloneResult } from './types.js';

export const DEFAULT_CYPRESS_REPOSITORY = 'https://github.com/Jahia/jahia-cypress.git';

const DEFAULT_CHECKOUT_DIRNAME = 'jahia-cypress';
const TAG_PREFIX = 'refs/tags/';
const execFileAsync = promisify(execFile);

export const buildCloneArgs = (params: {
  readonly version: string;
  readonly repositoryUrl: string;
  readonly checkoutDir: string;
}): readonly string[] => [
  'clone',
  '--depth',
  '1',
  '--branch',
  params.version,
  params.repositoryUrl,
  params.checkoutDir,
];

export const parseLatestTagFromLsRemote = (stdout: string, repositoryUrl: string): string => {
  const firstLine = stdout
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    throw new Error(`No tags found for ${repositoryUrl}.`);
  }

  const ref = firstLine.split(/\s+/)[1];
  if (!ref?.startsWith(TAG_PREFIX)) {
    throw new Error(`Unable to resolve latest tag from git output for ${repositoryUrl}.`);
  }

  return ref.slice(TAG_PREFIX.length);
};

export const resolveLatestTag = async (repositoryUrl?: string): Promise<string> => {
  const url = repositoryUrl ?? DEFAULT_CYPRESS_REPOSITORY;
  const { stdout } = await execFileAsync('git', [
    'ls-remote',
    '--tags',
    '--refs',
    '--sort=-v:refname',
    url,
  ]);

  return parseLatestTagFromLsRemote(stdout, url);
};

export const cloneScaffolding = async (params: {
  readonly version?: string | undefined;
  readonly workDir: string;
  readonly repositoryUrl?: string | undefined;
}): Promise<ScaffoldingCloneResult> => {
  const repositoryUrl = params.repositoryUrl ?? DEFAULT_CYPRESS_REPOSITORY;
  const version = params.version ?? (await resolveLatestTag(repositoryUrl));
  const checkoutDir = join(params.workDir, DEFAULT_CHECKOUT_DIRNAME);
  const scaffoldingDir = join(checkoutDir, 'scaffolding');

  await mkdir(params.workDir, { recursive: true });
  await execFileAsync('git', [...buildCloneArgs({ version, repositoryUrl, checkoutDir })], {
    cwd: params.workDir,
  });

  await access(scaffoldingDir).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Scaffolding directory not found at "${scaffoldingDir}" after cloning ${repositoryUrl}@${version}: ${message}`,
    );
  });

  return {
    version,
    repositoryUrl,
    checkoutDir,
    scaffoldingDir,
  };
};

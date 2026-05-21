import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import type { PersistedEnvironment } from '../state/types.js';

import type { CollectionResult, ComponentCollectionResult } from './types.js';

const execFileAsync = promisify(execFile);

/**
 * Collects logs for a single service using docker compose logs.
 */
const collectLogsForService = async (params: {
  readonly composePath: string;
  readonly serviceName: string;
  readonly outputDir: string;
}): Promise<{
  readonly logFile: string | undefined;
  readonly logSource: 'docker' | undefined;
  readonly logError: string | undefined;
}> => {
  const logFileName = `${params.serviceName}.log`;
  const logFilePath = join(params.outputDir, logFileName);

  try {
    const { stdout } = await execFileAsync('docker', [
      'compose',
      '-f',
      params.composePath,
      'logs',
      '--no-color',
      params.serviceName,
    ]);
    await writeFile(logFilePath, stdout, 'utf-8');
    return { logFile: logFileName, logSource: 'docker', logError: undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { logFile: undefined, logSource: undefined, logError: message };
  }
};

/**
 * Lists services from the docker-compose file.
 */
const listComposeServices = async (composePath: string): Promise<readonly string[]> => {
  try {
    const { stdout } = await execFileAsync('docker', [
      'compose',
      '-f',
      composePath,
      'config',
      '--services',
    ]);
    return stdout.trim().split('\n').filter((s) => s.length > 0);
  } catch {
    return [];
  }
};

/**
 * Collects all artifacts (logs) for every service in a docker-compose environment.
 * Errors are isolated per-service — one failure does not block the others.
 */
export const collectAllArtifacts = async (params: {
  readonly env: PersistedEnvironment;
  readonly outputDir: string;
  readonly onProgress?: ((message: string) => void) | undefined;
}): Promise<CollectionResult> => {
  const { env, outputDir, onProgress } = params;

  await mkdir(outputDir, { recursive: true });

  const services = await listComposeServices(env.composePath);

  const componentResults = await services.reduce(
    async (chainPromise, serviceName) => {
      const chain = await chainPromise;

      onProgress?.(`Collecting logs for ${serviceName}...`);
      const logResult = await collectLogsForService({
        composePath: env.composePath,
        serviceName,
        outputDir,
      });

      return [...chain, {
        componentName: serviceName,
        containerId: serviceName,
        logFile: logResult.logFile,
        logSource: logResult.logSource,
        logError: logResult.logError,
        artifacts: [],
      } satisfies ComponentCollectionResult];
    },
    Promise.resolve([] as readonly ComponentCollectionResult[]),
  );

  return {
    envName: env.name,
    outputDir,
    components: componentResults,
  };
};

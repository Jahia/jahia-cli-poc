import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { getComponent, resolveComponent } from '../components/index.js';
import type { ResolvedComponent } from '../components/types.js';
import { resolveConfigComponents } from '../config/parser.js';
import type { PersistedEnvironment } from '../state/types.js';

import { copyContainerArtifacts } from './copy-container-artifacts.js';
import { fetchContainerLogs } from './fetch-container-logs.js';
import type { ArtifactCopyResult, CollectionResult, ComponentCollectionResult } from './types.js';

/**
 * Resolves the VictoriaLogs base URL from a persisted environment.
 * Returns undefined if VictoriaLogs is not present or its port can't be determined.
 */
export const resolveVlogsUrl = (env: PersistedEnvironment): string | undefined => {
  const vlComponent = env.components.find((c) => c.name === 'victorialogs');
  if (vlComponent === undefined) {
    return undefined;
  }
  // VictoriaLogs HTTP API listens on port 9428
  const resolved = env.config.components.find((c) => c.name === 'victorialogs');
  const portOverride = resolved?.overrides?.ports?.find((p) => p.container === 9428);
  const hostPort = portOverride?.host ?? 9428;
  return `http://localhost:${String(hostPort)}`;
};

/**
 * Collects logs for a single container, returning log metadata.
 */
const collectLogsForComponent = async (params: {
  readonly containerId: string;
  readonly componentName: string;
  readonly envName: string;
  readonly vlogsBaseUrl: string | undefined;
  readonly outputDir: string;
}): Promise<{
  readonly logFile: string | undefined;
  readonly logSource: 'victorialogs' | 'docker' | undefined;
  readonly logError: string | undefined;
}> => {
  const logFileName = `${params.componentName}.log`;
  const logFilePath = join(params.outputDir, logFileName);

  try {
    const logResult = await fetchContainerLogs({
      containerId: params.containerId,
      componentName: params.componentName,
      envName: params.envName,
      vlogsBaseUrl: params.vlogsBaseUrl,
    });
    await writeFile(logFilePath, logResult.content, 'utf-8');
    return { logFile: logFileName, logSource: logResult.source, logError: undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { logFile: undefined, logSource: undefined, logError: message };
  }
};

/**
 * Collects all artifacts (logs + file copies) for every component in an environment.
 * Errors are isolated per-component — one failure does not block the others.
 */
export const collectAllArtifacts = async (params: {
  readonly env: PersistedEnvironment;
  readonly outputDir: string;
  readonly onProgress?: ((message: string) => void) | undefined;
}): Promise<CollectionResult> => {
  const { env, outputDir, onProgress } = params;

  if (env.provider !== 'docker') {
    throw new Error(`Artifact collection is only supported for Docker environments (got "${env.provider}").`);
  }

  await mkdir(outputDir, { recursive: true });

  const vlogsUrl = resolveVlogsUrl(env);

  // Re-resolve components from config to get effectiveArtifacts
  const resolvedComponents = resolveConfigComponents(env.config);

  // Map persisted components by name for container ID lookup
  const containerIdByName = new Map(env.components.map((c) => [c.name, c.containerId]));

  // Build the list of targets: config-resolved components + any persisted components
  // not in config (e.g. cypress test container added by tests:run)
  const resolvedNames = new Set(resolvedComponents.map((r) => r.definition.name));
  const extraComponents = env.components
    .filter((c) => !resolvedNames.has(c.name))
    .map((c) => {
      const def = getComponent(c.name);
      return def !== undefined ? resolveComponent(def) : undefined;
    })
    .filter((c): c is ResolvedComponent => c !== undefined);

  const allTargets = [...resolvedComponents, ...extraComponents];

  const componentResults = await allTargets.reduce(
    async (chainPromise, resolved) => {
      const chain = await chainPromise;
      const componentName = resolved.definition.name;
      const containerId = containerIdByName.get(componentName);

      if (containerId === undefined) {
        return [...chain, {
          componentName,
          containerId: 'unknown',
          logFile: undefined,
          logSource: undefined,
          logError: `No container ID found in state for "${componentName}"`,
          artifacts: [],
        } satisfies ComponentCollectionResult];
      }

      // Collect logs
      onProgress?.(`Collecting logs for ${componentName}...`);
      const logResult = await collectLogsForComponent({
        containerId,
        componentName,
        envName: env.name,
        vlogsBaseUrl: vlogsUrl,
        outputDir,
      });

      // Copy artifacts
      const artifactResults: readonly ArtifactCopyResult[] = resolved.effectiveArtifacts.length > 0
        ? await ((): Promise<readonly ArtifactCopyResult[]> => {
          onProgress?.(`Copying artifacts for ${componentName}...`);
          return copyContainerArtifacts({
            containerId,
            artifactMappings: resolved.effectiveArtifacts,
            outputDir,
          });
        })()
        : [];

      return [...chain, {
        componentName,
        containerId,
        logFile: logResult.logFile,
        logSource: logResult.logSource,
        logError: logResult.logError,
        artifacts: artifactResults,
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

import type { ResolvedComponent } from '../../components/types.js';
import type { ComponentStatus } from '../types.js';
import type { LogDriverConfig } from './container.js';
import { runContainer } from './container.js';
import { createVolume } from './volume.js';
import { pullImage } from './pull-image.js';

/**
 * Creates all volumes needed by a component.
 */
const createComponentVolumes = async (
  envName: string,
  component: ResolvedComponent,
): Promise<void> => {
  await component.definition.volumes.reduce(
    (chain, vol) => chain.then(() => createVolume(envName, vol.name)).then(() => undefined),
    Promise.resolve(),
  );
};

/**
 * Starts a single component via docker run, returning its status.
 */
export const runSingleComponent = async (
  envName: string,
  netName: string,
  component: ResolvedComponent,
  logConfig?: LogDriverConfig,
  onProgress?: (message: string) => void,
): Promise<{ status: ComponentStatus; error?: string | undefined }> => {
  try {
    const imageRef = `${component.effectiveImage}:${component.effectiveTag}`;
    onProgress?.(`Pulling ${component.definition.name} (${imageRef})...`);
    await pullImage(component.effectiveImage, component.effectiveTag);
    onProgress?.(`Starting ${component.definition.name}...`);
    await createComponentVolumes(envName, component);
    const containerId = await runContainer({
      envName,
      componentName: component.definition.name,
      image: component.effectiveImage,
      tag: component.effectiveTag,
      networkName: netName,
      ports: component.effectivePorts,
      env: component.effectiveEnv,
      volumes: component.definition.volumes,
      networkAliases: component.effectiveNetworkAliases,
      healthcheck: component.definition.healthcheck,
      logConfig,
      containerArgs: component.definition.args,
    });
    const portMap = Object.fromEntries(
      component.effectivePorts.map((p) => [String(p.container), p.host]),
    );
    return {
      status: {
        name: component.definition.name,
        status: 'running',
        containerId: containerId.slice(0, 12),
        health: component.definition.healthcheck ? 'starting' : 'none',
        ports: Object.keys(portMap).length > 0 ? portMap : undefined,
        image: component.effectiveImage,
        tag: component.effectiveTag,
        category: component.definition.category,
        endpoints: {
          aliases: component.effectiveNetworkAliases,
          ports: component.effectivePorts,
        },
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: {
        name: component.definition.name,
        status: 'stopped',
        image: component.effectiveImage,
        tag: component.effectiveTag,
        category: component.definition.category,
      },
      error: `Failed to start ${component.definition.name}: ${msg}`,
    };
  }
};

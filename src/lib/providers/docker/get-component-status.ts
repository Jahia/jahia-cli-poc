import { getComponent } from '../../components/index.js';
import type { ComponentStatus } from '../types.js';
import { containerName, inspectContainer } from './container.js';

/**
 * Gets the status of a single component container.
 */
export const getComponentStatus = async (
  envName: string,
  componentName: string,
): Promise<ComponentStatus> => {
  const name = containerName(envName, componentName);
  const info = await inspectContainer(name);
  const def = getComponent(componentName);

  if (!info) {
    return {
      name: componentName,
      status: 'not_found',
      image: def?.image,
      tag: def?.defaultTag,
      category: def?.category,
    };
  }

  const health =
    info.health === 'none' ||
    info.health === 'healthy' ||
    info.health === 'unhealthy' ||
    info.health === 'starting'
      ? info.health
      : undefined;

  return {
    name: componentName,
    status: info.running ? 'running' : 'stopped',
    containerId: info.id.slice(0, 12),
    health,
    image: def?.image,
    tag: def?.defaultTag,
    category: def?.category,
  };
};

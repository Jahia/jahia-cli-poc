import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { PersistedComponent, PersistedEnvironment } from './types.js';

const execFileAsync = promisify(execFile);

/**
 * Checks whether a container is still running in Docker.
 * Returns 'running', 'stopped', or 'missing'.
 */
const checkContainerStatus = async (
  containerId: string,
): Promise<'running' | 'stopped' | 'missing'> => {
  try {
    const { stdout } = await execFileAsync('docker', [
      'inspect',
      '--format',
      '{{.State.Running}}',
      containerId,
    ]);
    return stdout.trim() === 'true' ? 'running' : 'stopped';
  } catch {
    return 'missing';
  }
};

/**
 * Reconciled component with live Docker status.
 */
export interface ReconciledComponent extends PersistedComponent {
  readonly liveStatus: 'running' | 'stopped' | 'missing';
}

/**
 * Reconciled environment with live Docker status on each component.
 */
export interface ReconciledEnvironment extends Omit<PersistedEnvironment, 'components'> {
  readonly components: readonly ReconciledComponent[];
}

/**
 * Reconciles the persisted environment state with live Docker container status.
 * Checks each container and annotates with its actual status.
 */
export const reconcileWithDocker = async (
  environment: PersistedEnvironment,
): Promise<ReconciledEnvironment> => {
  const reconciledComponents = await Promise.all(
    environment.components.map(async (comp): Promise<ReconciledComponent> => {
      const liveStatus = await checkContainerStatus(comp.containerId);
      return { ...comp, liveStatus };
    }),
  );

  return {
    ...environment,
    components: reconciledComponents,
  };
};

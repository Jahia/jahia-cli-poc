/**
 * Detected provisioning mode based on provided flags.
 */
export type ProvisionMode = 'manifest' | 'modules' | 'scripts';

/**
 * Detects the provisioning mode from provided flags.
 * Exactly one of manifest, modules, or scripts must be provided.
 */
export const detectProvisionMode = (flags: {
  readonly manifest: string | undefined;
  readonly modules: string | undefined;
  readonly scripts: string | undefined;
}): ProvisionMode => {
  const modes: readonly ProvisionMode[] = [
    ...(flags.manifest !== undefined ? (['manifest'] as const) : []),
    ...(flags.modules !== undefined ? (['modules'] as const) : []),
    ...(flags.scripts !== undefined ? (['scripts'] as const) : []),
  ];

  if (modes.length === 0) {
    throw new Error('One of --manifest, --modules, or --scripts is required.');
  }

  if (modes.length > 1) {
    throw new Error('Only one of --manifest, --modules, or --scripts can be specified at a time.');
  }

  const mode = modes[0];
  if (mode === undefined) {
    throw new Error('One of --manifest, --modules, or --scripts is required.');
  }

  return mode;
};

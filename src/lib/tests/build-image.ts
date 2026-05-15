import { resolveEnvVars } from '../config/resolve-env-vars.js';

/**
 * Default Dockerfile path relative to the working directory.
 */
export const DEFAULT_DOCKERFILE = 'docker/Dockerfile.local';

/**
 * Default image name prefix for built test images.
 */
export const DEFAULT_IMAGE_NAME = 'jahia-tests';

/**
 * Resolves the image tag for the test image build.
 * Uses the scaffolding version from config, with env var substitution.
 */
export const resolveImageTag = (
  imageName: string,
  version: string,
): string => `${imageName}:${version}`;

/**
 * Parses a repeatable `KEY=VALUE` flag into a record.
 * Applies `${VAR:-default}` env var resolution to values for consistency
 * with the config system.
 */
export const parseKeyValueArgs = (
  args: readonly string[],
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    args.map((arg) => {
      const eqIndex = arg.indexOf('=');
      if (eqIndex === -1) {
        throw new Error(
          `Invalid KEY=VALUE argument: "${arg}". Expected format: KEY=VALUE`,
        );
      }
      return [arg.slice(0, eqIndex), resolveEnvVars(arg.slice(eqIndex + 1))];
    }),
  );

/**
 * Builds the argument list for `docker buildx build`.
 *
 * Pure function — all inputs explicit, no side effects.
 */
export const buildBuildxArgs = (params: {
  readonly dockerfile: string;
  readonly tag: string;
  readonly baseVersion: string;
  readonly context?: string | undefined;
  readonly platform?: string | undefined;
  readonly noCache?: boolean | undefined;
  readonly extraBuildArgs?: Readonly<Record<string, string>> | undefined;
}): readonly string[] => {
  const args: string[] = [
    'buildx', 'build',
    '-f', params.dockerfile,
    '-t', params.tag,
    '--build-arg', `BASE_VERSION=${params.baseVersion}`,
  ];

  if (params.extraBuildArgs !== undefined) {
    Object.entries(params.extraBuildArgs).forEach(([key, value]) => {
      args.push('--build-arg', `${key}=${value}`);
    });
  }

  if (params.platform !== undefined) {
    args.push('--platform', params.platform);
  }

  if (params.noCache === true) {
    args.push('--no-cache');
  }

  // --load makes the image available in the local Docker daemon
  args.push('--load');

  // Build context defaults to CWD (.), can be overridden via config or flag
  args.push(params.context ?? '.');

  return args;
};

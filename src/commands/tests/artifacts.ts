import { resolve } from 'node:path';

import { Command, Flags } from '@oclif/core';

import { collectAllArtifacts } from '../../lib/artifacts/collect-all.js';
import type { CollectionResult, ComponentCollectionResult } from '../../lib/artifacts/types.js';
import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateFlag } from '../../lib/state/state-flag.js';

const DEFAULT_OUTPUT_DIR = './results/';

/**
 * Formats a single component's collection result as human-readable text.
 */
export const formatComponentResult = (c: ComponentCollectionResult): string => {
  const lines: string[] = [];
  const logStatus = c.logFile !== undefined
    ? `✓ ${c.logFile} (${c.logSource ?? 'unknown'})`
    : `✗ logs failed${c.logError !== undefined ? `: ${c.logError}` : ''}`;
  lines.push(`  ${c.componentName}: ${logStatus}`);

  c.artifacts.forEach((a) => {
    const status = a.success ? '✓' : '✗';
    const suffix = a.success ? '' : ` — ${a.error ?? 'unknown error'}`;
    lines.push(`    ${status} ${a.path}${suffix}`);
  });

  return lines.join('\n');
};

/**
 * Formats the full collection result as human-readable output.
 */
export const formatCollectionHuman = (result: CollectionResult): string => {
  const lines: string[] = [
    `✓ Artifacts collected for environment "${result.envName}"`,
    `  Output: ${result.outputDir}`,
    '',
  ];

  result.components.forEach((c) => {
    lines.push(formatComponentResult(c));
  });

  return lines.join('\n');
};

/**
 * Builds JSON output for the collection result.
 */
export const buildCollectionJson = (result: CollectionResult): string =>
  JSON.stringify(
    {
      success: true,
      envName: result.envName,
      outputDir: result.outputDir,
      components: result.components.map((c) => ({
        name: c.componentName,
        containerId: c.containerId,
        logFile: c.logFile ?? null,
        logSource: c.logSource ?? null,
        logError: c.logError ?? null,
        artifacts: c.artifacts.map((a) => ({
          path: a.path,
          success: a.success,
          error: a.error ?? null,
        })),
      })),
    },
    null,
    2,
  );

export default class TestsArtifacts extends Command {
  static override description =
    'Collect test artifacts (container logs and diagnostic files) from the active environment. ' +
    'Fetches logs from VictoriaLogs (with docker logs fallback) and copies container artifact paths ' +
    'defined in component definitions or config overrides.';

  static override examples = [
    '<%= config.bin %> tests artifacts',
    '<%= config.bin %> tests artifacts --output ./ci-results/',
    '<%= config.bin %> tests artifacts --state /ci/workspace/state.json --json',
  ];

  static override flags = {
    state: stateFlag,
    output: Flags.string({
      char: 'o',
      description: `Output directory for collected artifacts (default: ${DEFAULT_OUTPUT_DIR})`,
    }),
    json: Flags.boolean({
      description: 'Output result as structured JSON (for AI agents and scripting)',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(TestsArtifacts);
    const statePath = stateFilePath(flags.state);
    const outputDir = resolve(flags.output ?? DEFAULT_OUTPUT_DIR);

    try {
      const env = await getActiveEnvironment(statePath);
      if (env === undefined) {
        throw new Error('No active environment found. Create one with "environment create" first.');
      }

      const result = await collectAllArtifacts({
        env,
        outputDir,
        onProgress: flags.json ? undefined : (msg: string): void => {
          this.log(msg);
        },
      });

      if (flags.json) {
        this.log(buildCollectionJson(result));
      } else {
        this.log(formatCollectionHuman(result));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (flags.json) {
        this.log(JSON.stringify({ success: false, error: message }, null, 2));
      } else {
        this.error(message);
      }
    }
  }
}

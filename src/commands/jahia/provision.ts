import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

import { Command, Flags } from '@oclif/core';

import { detectManifestSource } from '../../lib/provisioning/detect-manifest-source.js';
import { fetchManifest } from '../../lib/provisioning/fetch-manifest.js';
import { readManifest } from '../../lib/provisioning/read-manifest.js';
import { resolveAssetPaths } from '../../lib/provisioning/resolve-asset-paths.js';
import { submitProvisioning } from '../../lib/provisioning/submit-provisioning.js';
import type { ProvisioningAttachment } from '../../lib/provisioning/types.js';
import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { getJahiaConnectionDefaults } from '../../lib/state/get-jahia-connection-defaults.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateFlag } from '../../lib/state/state-flag.js';

/**
 * Reads file attachments from disk and returns them as ProvisioningAttachment objects.
 */
export const loadAttachments = async (
  filePaths: readonly string[],
): Promise<readonly ProvisioningAttachment[]> => {
  const results = await Promise.all(
    filePaths.map(async (filePath) => {
      const content = await readFile(filePath);
      return { filename: basename(filePath), content };
    }),
  );
  return results;
};

/**
 * Formats a provisioning result for human-readable output.
 */
export const formatProvisioningResultHuman = (result: {
  readonly success: boolean;
  readonly statusCode: number;
  readonly message: string;
  readonly responseBody: unknown;
  readonly manifest: string;
  readonly durationMs: number;
}): string => {
  const icon = result.success ? '✓' : '✗';
  const status = result.success ? 'Provisioning succeeded' : 'Provisioning failed';
  const lines = [
    `${icon} ${status}`,
    `  Manifest:  ${result.manifest}`,
    `  Status:    HTTP ${String(result.statusCode)}`,
    `  Duration:  ${String(result.durationMs)}ms`,
  ];

  if (result.responseBody !== undefined) {
    lines.push('');
    lines.push(JSON.stringify(result.responseBody, null, 2));
  } else if (!result.success && result.message) {
    lines.push(`  Error:     ${result.message}`);
  }

  return lines.join('\n');
};

export default class JahiaProvision extends Command {
  static override description =
    'Execute a provisioning script against a running Jahia instance. ' +
    'The manifest can be a local YAML file or a public URL (auto-detected). ' +
    'Optional file attachments can be included via --file flags or --assets directory.';

  static override examples = [
    '<%= config.bin %> jahia provision --manifest ./provisioning/setup.yaml',
    '<%= config.bin %> jahia provision --manifest https://raw.githubusercontent.com/org/repo/main/provisioning.yaml',
    '<%= config.bin %> jahia provision --manifest ./setup.yaml --file ./modules/mymodule.jar',
    '<%= config.bin %> jahia provision --manifest ./setup.yaml --assets ./artifacts',
    '<%= config.bin %> jahia provision --manifest ./setup.yaml --file ./mod1.jar --file ./mod2.jar --json',
    '<%= config.bin %> jahia provision --manifest ./setup.yaml --url http://localhost:8080 --username root --password secret',
  ];

  static override flags = {
    state: stateFlag,
    manifest: Flags.string({
      char: 'm',
      description: 'Path to a local YAML file or a public URL of the provisioning manifest',
      required: true,
    }),
    url: Flags.string({
      description: 'Jahia base URL (default: from state, or http://localhost:8080)',
    }),
    username: Flags.string({
      char: 'u',
      description: 'Jahia admin username (default: from state, or root)',
    }),
    password: Flags.string({
      char: 'P',
      description: 'Jahia admin password (default: from state, or root1234)',
    }),
    file: Flags.string({
      char: 'f',
      description: 'File attachment to include (can be specified multiple times)',
      multiple: true,
    }),
    assets: Flags.string({
      char: 'a',
      description: 'Directory whose files are attached to the provisioning request (recursive)',
    }),
    json: Flags.boolean({
      description: 'Output result as structured JSON (for AI agents and scripting)',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(JahiaProvision);
    const stateOverride = flags.state;
    const statePath = stateFilePath(stateOverride);

    const env = await getActiveEnvironment(stateOverride);
    const envName = env?.name ?? 'unknown';
    const defaults = getJahiaConnectionDefaults(env);
    const url = flags.url ?? defaults.url;
    const username = flags.username ?? defaults.username;
    const password = flags.password ?? defaults.password;
    const manifest = flags.manifest;

    const source = detectManifestSource(manifest);

    if (!flags.json) {
      this.log(`Provisioning Jahia environment "${envName}"...`);
      this.log(`  Manifest: ${manifest} (${source})`);
      this.log(`  URL:      ${url}`);
      this.log(`  State:    ${statePath}`);
      if (flags.file && flags.file.length > 0) {
        this.log(`  Files:    ${flags.file.join(', ')}`);
      }
      if (flags.assets) {
        this.log(`  Assets:   ${flags.assets}`);
      }
      this.log('');
    }

    try {
      // Load manifest
      if (!flags.json) {
        this.log(source === 'url' ? 'Downloading manifest...' : 'Reading manifest...');
      }

      const { content: manifestContent, filename: manifestFilename } =
        source === 'url'
          ? await fetchManifest(manifest)
          : await readManifest(manifest);

      // Load file attachments from --file flags and --assets directory
      const filePaths = flags.file ?? [];
      const assetPaths = flags.assets ? await resolveAssetPaths(flags.assets) : [];
      const allPaths = [...filePaths, ...assetPaths];
      const attachments = await loadAttachments(allPaths);

      if (!flags.json && attachments.length > 0) {
        this.log(`Attaching ${String(attachments.length)} file(s)...`);
      }

      if (!flags.json) {
        this.log('Submitting provisioning script...');
      }

      const result = await submitProvisioning({
        url,
        username,
        password,
        manifestContent,
        manifestFilename,
        attachments,
      });

      if (flags.json) {
        this.log(
          JSON.stringify(
            { ...result, environment: envName, stateFile: statePath, source },
            null,
            2,
          ),
        );
      } else {
        this.log('');
        this.log(formatProvisioningResultHuman(result));
      }

      if (!result.success) {
        this.exit(1);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (flags.json) {
        this.log(
          JSON.stringify(
            { success: false, environment: envName, stateFile: statePath, error: message },
            null,
            2,
          ),
        );
      } else {
        this.log('');
        this.log(`✗ ${message}`);
      }
      this.exit(1);
    }
  }
}

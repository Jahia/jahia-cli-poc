import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

import { Args, Command, Flags } from '@oclif/core';

import { detectManifestSource } from '../../lib/provisioning/detect-manifest-source.js';
import { fetchManifest } from '../../lib/provisioning/fetch-manifest.js';
import { readManifest } from '../../lib/provisioning/read-manifest.js';
import { submitProvisioning } from '../../lib/provisioning/submit-provisioning.js';
import type { ProvisioningAttachment } from '../../lib/provisioning/types.js';
import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateFlag } from '../../lib/state/state-flag.js';

const DEFAULT_URL = 'http://localhost:8080';
const DEFAULT_USERNAME = 'root';
const DEFAULT_PASSWORD = 'root1234';

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
 * Formats a single provisioning operation entry for display.
 */
const formatOperation = (entry: Record<string, unknown>, indent: string): readonly string[] => {
  const lines: string[] = [];
  const type = Object.keys(entry).find((k) => k !== 'status' && k !== 'error') ?? 'unknown';
  const value = entry[type];
  const statusIcon = entry['status'] === 'success' ? '✓' : entry['status'] === 'skipped' ? '–' : '✗';
  const statusText = typeof entry['status'] === 'string' ? entry['status'] : '';

  if (typeof value === 'string') {
    lines.push(`${indent}${statusIcon} ${type}: ${value} [${statusText}]`);
  } else if (Array.isArray(value)) {
    lines.push(`${indent}${statusIcon} ${type}: [${statusText}]`);
    value.forEach((item) => {
      lines.push(`${indent}    - ${String(item)}`);
    });
  } else {
    lines.push(`${indent}${statusIcon} ${type} [${statusText}]`);
  }

  if (entry['error']) {
    const errorVal = entry['error'];
    const errorStr = typeof errorVal === 'string' ? errorVal : JSON.stringify(errorVal);
    lines.push(`${indent}    Error: ${errorStr}`);
  }

  return lines;
};

/**
 * Formats the JSON response body from the provisioning API into
 * a human-readable summary. Handles arrays of operation results
 * and falls back to indented JSON for unknown structures.
 */
const formatResponseBody = (body: unknown): string => {
  if (Array.isArray(body)) {
    const lines = ['  Response:'];
    body.forEach((entry: unknown) => {
      if (typeof entry === 'object' && entry !== null) {
        formatOperation(entry as Record<string, unknown>, '    ').forEach((line) => {
          lines.push(line);
        });
      } else {
        lines.push(`    ${String(entry)}`);
      }
    });
    return lines.join('\n');
  }

  if (typeof body === 'object' && body !== null) {
    return `  Response:\n${JSON.stringify(body, null, 2)
      .split('\n')
      .map((line) => `    ${line}`)
      .join('\n')}`;
  }

  return `  Response: ${String(body)}`;
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
    lines.push(formatResponseBody(result.responseBody));
  } else if (!result.success && result.message) {
    lines.push(`  Error:     ${result.message}`);
  }

  return lines.join('\n');
};

export default class JahiaProvision extends Command {
  static override description =
    'Execute a provisioning script against a running Jahia instance. ' +
    'The manifest can be a local YAML file or a public URL (auto-detected). ' +
    'Optional file attachments (modules, content packages) can be included via --file flags.';

  static override examples = [
    '<%= config.bin %> jahia provision ./provisioning/setup.yaml',
    '<%= config.bin %> jahia provision https://raw.githubusercontent.com/org/repo/main/provisioning.yaml',
    '<%= config.bin %> jahia provision ./setup.yaml --file ./modules/mymodule.jar',
    '<%= config.bin %> jahia provision ./setup.yaml --file ./mod1.jar --file ./mod2.jar --json',
    '<%= config.bin %> jahia provision ./setup.yaml --url http://localhost:8080 --username root --password secret',
  ];

  static override args = {
    manifest: Args.string({
      description: 'Path to a local YAML file or a public URL of the provisioning manifest',
      required: true,
    }),
  };

  static override flags = {
    state: stateFlag,
    url: Flags.string({
      description: `Jahia base URL (default: ${DEFAULT_URL})`,
    }),
    username: Flags.string({
      char: 'u',
      description: 'Jahia admin username',
      default: DEFAULT_USERNAME,
    }),
    password: Flags.string({
      char: 'P',
      description: 'Jahia admin password',
      default: DEFAULT_PASSWORD,
    }),
    file: Flags.string({
      char: 'f',
      description: 'File attachment to include (can be specified multiple times)',
      multiple: true,
    }),
    json: Flags.boolean({
      description: 'Output result as structured JSON (for AI agents and scripting)',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(JahiaProvision);
    const stateOverride = flags.state;
    const statePath = stateFilePath(stateOverride);

    const env = await getActiveEnvironment(stateOverride);
    const envName = env?.name ?? 'unknown';
    const url = flags.url ?? DEFAULT_URL;

    const source = detectManifestSource(args.manifest);

    if (!flags.json) {
      this.log(`Provisioning Jahia environment "${envName}"...`);
      this.log(`  Manifest: ${args.manifest} (${source})`);
      this.log(`  URL:      ${url}`);
      this.log(`  State:    ${statePath}`);
      if (flags.file && flags.file.length > 0) {
        this.log(`  Files:    ${flags.file.join(', ')}`);
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
          ? await fetchManifest(args.manifest)
          : await readManifest(args.manifest);

      // Load file attachments
      const attachments = flags.file ? await loadAttachments(flags.file) : [];

      if (!flags.json) {
        this.log('Submitting provisioning script...');
      }

      const result = await submitProvisioning({
        url,
        username: flags.username,
        password: flags.password,
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

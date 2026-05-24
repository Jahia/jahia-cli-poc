import { Command, Flags } from '@oclif/core';

import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { resolveJahiaConnection } from '../../lib/state/get-jahia-connection-defaults.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateFlag } from '../../lib/state/state-flag.js';
import { waitForSam } from '../../lib/sam/wait-for-sam.js';
import type { SamPollEvent } from '../../lib/sam/types.js';
import {
  collectJcliVars,
  debugFlag,
  formatDebugSection,
  formatDebugVarsHuman,
} from '../../lib/debug/index.js';

const DEFAULT_INTERVAL = 2;
const DEFAULT_TIMEOUT = 300;
const DEFAULT_COUNT = 5;
const DEFAULT_SEVERITY = 'MEDIUM';

/**
 * Formats a human-readable label describing where the URL came from.
 */
export const formatUrlSourceLabel = (source: string, networkMode: string): string =>
  source === 'flag'
    ? 'source: --url flag'
    : source === 'state'
      ? `source: state file, mode: ${networkMode}`
      : `source: default, mode: ${networkMode}`;

export default class JahiaAlive extends Command {
  static override description =
    'Wait until the Jahia environment is fully alive and responding GREEN. ' +
    'Polls the Server Availability Manager (SAM) healthcheck endpoint and requires ' +
    'N consecutive GREEN responses before declaring the environment ready.';

  static override examples = [
    '<%= config.bin %> jahia alive',
    '<%= config.bin %> jahia alive --count 10 --timeout 600',
    '<%= config.bin %> jahia alive --url http://localhost:8080 --json',
    '<%= config.bin %> jahia alive --state /ci/workspace/state.json',
  ];

  static override flags = {
    state: stateFlag,
    url: Flags.string({
      description: 'Jahia base URL (default: from state, or http://localhost:8080)',
    }),
    username: Flags.string({
      char: 'u',
      description: 'Jahia username for SAM authentication (default: from state, or root)',
    }),
    password: Flags.string({
      char: 'P',
      description: 'Jahia password for SAM authentication (default: from state, or root1234)',
    }),
    severity: Flags.string({
      char: 's',
      description: 'SAM probe severity to evaluate (LOW, MEDIUM, HIGH, CRITICAL)',
      default: DEFAULT_SEVERITY,
    }),
    interval: Flags.integer({
      char: 'i',
      description: 'Seconds between health checks',
      default: DEFAULT_INTERVAL,
    }),
    timeout: Flags.integer({
      char: 't',
      description: 'Maximum seconds to wait before failing',
      default: DEFAULT_TIMEOUT,
    }),
    count: Flags.integer({
      char: 'c',
      description: 'Number of consecutive GREEN responses required',
      default: DEFAULT_COUNT,
    }),
    json: Flags.boolean({
      description: 'Output result as structured JSON (for AI agents and scripting)',
      default: false,
    }),
    debug: debugFlag,
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(JahiaAlive);
    if (flags.debug) {
      const debugEntries = collectJcliVars(process.env);
      this.log(formatDebugSection(formatDebugVarsHuman(debugEntries)));
    }
    const stateOverride = flags.state;

    // Always load state for credential resolution — even with --url, password may come from config
    const env = await getActiveEnvironment(stateOverride);
    const connection = await resolveJahiaConnection(env, flags.url);

    const url = connection.url;
    const username = flags.username ?? connection.username;
    const password = flags.password ?? connection.password;
    const envName = flags.url !== undefined ? (env?.name ?? 'direct') : (env?.name ?? 'unknown');
    const urlSourceLabel = formatUrlSourceLabel(
      connection.resolvedUrl.source,
      connection.resolvedUrl.networkMode,
    );

    if (!flags.json) {
      if (flags.url !== undefined) {
        this.log(
          `Waiting for Jahia at "${url}" to become alive (direct URL mode — state file not used)...`,
        );
      } else {
        const statePath = stateFilePath(stateOverride);
        this.log(`Waiting for Jahia environment "${envName}" to become alive...`);
        this.log(`  State:    ${statePath}`);
      }

      this.log(`  URL:      ${url} (${urlSourceLabel})`);
      this.log(
        `  Requires: ${String(flags.count)} consecutive GREEN at ${String(flags.interval)}s interval`,
      );
      this.log(`  Timeout:  ${String(flags.timeout)}s`);
      this.log('');
    }

    const onPoll = (event: SamPollEvent): void => {
      if (flags.json) return;
      const icon = event.health === 'GREEN' ? '●' : '○';
      const progress =
        event.health === 'GREEN'
          ? ` (${String(event.consecutiveGreen)}/${String(flags.count)})`
          : '';
      const detail = event.message ? ` — ${event.message}` : '';
      this.log(
        `  ${icon} [${String(event.elapsedSeconds).padStart(4)}s] ${event.health}${progress}${detail}`,
      );
    };

    try {
      const result = await waitForSam({
        url,
        username,
        password,
        severity: flags.severity,
        intervalSeconds: flags.interval,
        timeoutSeconds: flags.timeout,
        consecutiveCount: flags.count,
        onPoll,
      });

      if (flags.json) {
        const jsonBase =
          flags.url !== undefined
            ? {
                ...result,
                url,
                mode: 'direct' as const,
                urlSource: connection.resolvedUrl.source,
                networkMode: connection.resolvedUrl.networkMode,
              }
            : {
                ...result,
                environment: envName,
                stateFile: stateFilePath(stateOverride),
                urlSource: connection.resolvedUrl.source,
                networkMode: connection.resolvedUrl.networkMode,
              };
        this.log(JSON.stringify(jsonBase, null, 2));
      } else {
        this.log('');
        const label = flags.url !== undefined ? `Jahia at "${url}"` : `Environment "${envName}"`;
        this.log(`✓ ${label} is alive and responding GREEN`);
        this.log(
          `  Confirmed in ${String(result.elapsedSeconds)}s with ${String(result.consecutiveGreen)} consecutive checks`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (flags.json) {
        const jsonBase =
          flags.url !== undefined
            ? {
                success: false,
                url,
                mode: 'direct' as const,
                error: 'timeout',
                message,
                urlSource: connection.resolvedUrl.source,
                networkMode: connection.resolvedUrl.networkMode,
              }
            : {
                success: false,
                environment: envName,
                stateFile: stateFilePath(stateOverride),
                error: 'timeout',
                message,
                urlSource: connection.resolvedUrl.source,
                networkMode: connection.resolvedUrl.networkMode,
              };
        this.log(JSON.stringify(jsonBase, null, 2));
      } else {
        this.log('');
        this.log(`✗ ${message}`);
      }
      this.exit(1);
    }
  }
}

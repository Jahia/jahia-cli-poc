import { Command, Flags } from '@oclif/core';

import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { getJahiaConnectionDefaults } from '../../lib/state/get-jahia-connection-defaults.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateFlag } from '../../lib/state/state-flag.js';
import { waitForSam } from '../../lib/sam/wait-for-sam.js';
import type { SamPollEvent } from '../../lib/sam/types.js';

const DEFAULT_INTERVAL = 2;
const DEFAULT_TIMEOUT = 300;
const DEFAULT_COUNT = 5;
const DEFAULT_SEVERITY = 'MEDIUM';

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
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(JahiaAlive);
    const stateOverride = flags.state;
    const statePath = stateFilePath(stateOverride);

    const env = await getActiveEnvironment(stateOverride);
    const envName = env?.name ?? 'unknown';
    const defaults = getJahiaConnectionDefaults(env);
    const url = flags.url ?? defaults.url;
    const username = flags.username ?? defaults.username;
    const password = flags.password ?? defaults.password;

    if (!flags.json) {
      this.log(`Waiting for Jahia environment "${envName}" to become alive...`);
      this.log(`  URL:      ${url}`);
      this.log(`  Requires: ${String(flags.count)} consecutive GREEN at ${String(flags.interval)}s interval`);
      this.log(`  Timeout:  ${String(flags.timeout)}s`);
      this.log(`  State:    ${statePath}`);
      this.log('');
    }

    const onPoll = (event: SamPollEvent): void => {
      if (flags.json) return;
      const icon = event.health === 'GREEN' ? '●' : '○';
      const progress =
        event.health === 'GREEN' ? ` (${String(event.consecutiveGreen)}/${String(flags.count)})` : '';
      const detail = event.message ? ` — ${event.message}` : '';
      this.log(`  ${icon} [${String(event.elapsedSeconds).padStart(4)}s] ${event.health}${progress}${detail}`);
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
        this.log(JSON.stringify({ ...result, environment: envName, stateFile: statePath }, null, 2));
      } else {
        this.log('');
        this.log(`✓ Environment "${envName}" is alive and responding GREEN`);
        this.log(
          `  Confirmed in ${String(result.elapsedSeconds)}s with ${String(result.consecutiveGreen)} consecutive checks`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (flags.json) {
        this.log(
          JSON.stringify({ success: false, environment: envName, stateFile: statePath, error: 'timeout', message }, null, 2),
        );
      } else {
        this.log('');
        this.log(`✗ ${message}`);
      }
      this.exit(1);
    }
  }
}

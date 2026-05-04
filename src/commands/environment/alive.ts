import { Command, Flags } from '@oclif/core';

import { getActiveEnvironment } from '../../lib/state/get-active-environment.js';
import { stateFilePath } from '../../lib/state/state-file-path.js';
import { stateFlag } from '../../lib/state/state-flag.js';
import { waitForSam } from '../../lib/sam/wait-for-sam.js';
import type { SamPollEvent } from '../../lib/sam/types.js';

const DEFAULT_URL = 'http://localhost:8080';
const DEFAULT_USERNAME = 'root';
const DEFAULT_PASSWORD = 'root1234';
const DEFAULT_INTERVAL = 2;
const DEFAULT_TIMEOUT = 300;
const DEFAULT_COUNT = 5;
const DEFAULT_SEVERITY = 'MEDIUM';

export default class EnvironmentAlive extends Command {
  static override description =
    'Wait until the Jahia environment is fully alive and responding GREEN. ' +
    'Polls the Server Availability Manager (SAM) healthcheck endpoint and requires ' +
    'N consecutive GREEN responses before declaring the environment ready.';

  static override examples = [
    '<%= config.bin %> environment alive',
    '<%= config.bin %> environment alive --count 10 --timeout 600',
    '<%= config.bin %> environment alive --url http://localhost:8080 --json',
    '<%= config.bin %> environment alive --state /ci/workspace/state.json',
  ];

  static override flags = {
    state: stateFlag,
    url: Flags.string({
      description: `Jahia base URL (default: ${DEFAULT_URL})`,
    }),
    username: Flags.string({
      char: 'u',
      description: 'Jahia username for SAM authentication',
      default: DEFAULT_USERNAME,
    }),
    password: Flags.string({
      char: 'P',
      description: 'Jahia password for SAM authentication',
      default: DEFAULT_PASSWORD,
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
    const { flags } = await this.parse(EnvironmentAlive);
    const stateOverride = flags.state;
    const statePath = stateFilePath(stateOverride);

    const env = await getActiveEnvironment(stateOverride);
    const envName = env?.name ?? 'unknown';
    const url = flags.url ?? DEFAULT_URL;

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
        username: flags.username,
        password: flags.password,
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

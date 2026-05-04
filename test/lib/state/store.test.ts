import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';

import { loadState } from '../../../src/lib/state/load-state.js';
import { saveState } from '../../../src/lib/state/save-state.js';
import { deleteState } from '../../../src/lib/state/delete-state.js';
import { getActiveEnvironment } from '../../../src/lib/state/get-active-environment.js';
import { hasActiveEnvironment } from '../../../src/lib/state/has-active-environment.js';
import { stateFilePath } from '../../../src/lib/state/state-file-path.js';
import type { StateFile } from '../../../src/lib/state/types.js';

describe('state persistence', () => {
  const tempDirRef: { current: string } = { current: '' };

  beforeEach(async () => {
    tempDirRef.current = await mkdtemp(join(tmpdir(), 'jahia-cli-test-'));
  });

  afterEach(async () => {
    await rm(tempDirRef.current, { recursive: true, force: true });
  });

  test('stateFilePath returns explicit file path unchanged', () => {
    const result = stateFilePath('/some/dir/state.json');
    expect(result).toBe('/some/dir/state.json');
  });

  test('stateFilePath uses JAHIA_CLI_STATE env var', () => {
    const previous = process.env['JAHIA_CLI_STATE'];
    process.env['JAHIA_CLI_STATE'] = '/tmp/custom/state.json';
    const result = stateFilePath();
    expect(result).toBe('/tmp/custom/state.json');
    if (previous === undefined) {
      delete process.env['JAHIA_CLI_STATE'];
    } else {
      process.env['JAHIA_CLI_STATE'] = previous;
    }
  });

  test('stateFilePath supports legacy JAHIA_CLI_STATE_DIR env var', () => {
    const previousState = process.env['JAHIA_CLI_STATE'];
    const previousDir = process.env['JAHIA_CLI_STATE_DIR'];
    delete process.env['JAHIA_CLI_STATE'];
    process.env['JAHIA_CLI_STATE_DIR'] = '/legacy/dir';

    const result = stateFilePath();
    expect(result).toBe(join('/legacy/dir', 'state.json'));

    if (previousState === undefined) {
      delete process.env['JAHIA_CLI_STATE'];
    } else {
      process.env['JAHIA_CLI_STATE'] = previousState;
    }
    if (previousDir === undefined) {
      delete process.env['JAHIA_CLI_STATE_DIR'];
    } else {
      process.env['JAHIA_CLI_STATE_DIR'] = previousDir;
    }
  });

  test('loadState returns undefined when no file exists', async () => {
    const result = await loadState(join(tempDirRef.current, 'state.json'));
    expect(result).toBeUndefined();
  });

  test('saveState creates file and loadState reads it back', async () => {
    const state: StateFile = {
      version: 1,
      environment: {
        name: 'test-env',
        provider: 'docker',
        network: 'jahia-cli-test-env',
        components: [
          { name: 'jahia', image: 'jahia/jahia-ee', tag: '8.2', containerId: 'abc123def456' },
        ],
        config: { name: 'test-env', provider: 'docker', components: [{ name: 'jahia' }] },
        createdAt: '2026-05-02T10:00:00Z',
      },
    };

    await saveState(state, join(tempDirRef.current, 'state.json'));

    const loaded = await loadState(join(tempDirRef.current, 'state.json'));
    expect(loaded).toEqual(state);
  });

  test('saveState creates parent directory if missing', async () => {
    const nestedStatePath = join(tempDirRef.current, 'nested', 'deep', 'state.json');
    const state: StateFile = { version: 1 };

    await saveState(state, nestedStatePath);

    const content = await readFile(nestedStatePath, 'utf-8');
    expect(JSON.parse(content)).toEqual(state);
  });

  test('deleteState removes the state file', async () => {
    const state: StateFile = { version: 1 };
    await saveState(state, join(tempDirRef.current, 'state.json'));

    await deleteState(join(tempDirRef.current, 'state.json'));

    const result = await loadState(join(tempDirRef.current, 'state.json'));
    expect(result).toBeUndefined();
  });

  test('deleteState is a no-op when file does not exist', async () => {
    await expect(deleteState(join(tempDirRef.current, 'state.json'))).resolves.toBeUndefined();
  });

  test('getActiveEnvironment returns environment when present', async () => {
    const state: StateFile = {
      version: 1,
      environment: {
        name: 'my-env',
        provider: 'docker',
        network: 'jahia-cli-my-env',
        components: [],
        config: { name: 'my-env', provider: 'docker', components: [] },
        createdAt: '2026-05-02T10:00:00Z',
      },
    };
    await saveState(state, join(tempDirRef.current, 'state.json'));

    const env = await getActiveEnvironment(join(tempDirRef.current, 'state.json'));
    expect(env).toBeDefined();
    expect(env?.name).toBe('my-env');
  });

  test('getActiveEnvironment returns undefined when no state', async () => {
    const env = await getActiveEnvironment(join(tempDirRef.current, 'state.json'));
    expect(env).toBeUndefined();
  });

  test('hasActiveEnvironment returns true when environment exists', async () => {
    const state: StateFile = {
      version: 1,
      environment: {
        name: 'my-env',
        provider: 'docker',
        network: 'jahia-cli-my-env',
        components: [],
        config: { name: 'my-env', provider: 'docker', components: [] },
        createdAt: '2026-05-02T10:00:00Z',
      },
    };
    await saveState(state, join(tempDirRef.current, 'state.json'));

    expect(await hasActiveEnvironment(join(tempDirRef.current, 'state.json'))).toBe(true);
  });

  test('hasActiveEnvironment returns false when no environment', async () => {
    expect(await hasActiveEnvironment(join(tempDirRef.current, 'state.json'))).toBe(false);
  });
});

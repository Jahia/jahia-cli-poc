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
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'jahia-cli-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test('stateFilePath returns correct path for given dir', () => {
    const result = stateFilePath('/some/dir');
    expect(result).toBe('/some/dir/state.json');
  });

  test('loadState returns undefined when no file exists', async () => {
    const result = await loadState(tempDir);
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

    await saveState(state, tempDir);

    const loaded = await loadState(tempDir);
    expect(loaded).toEqual(state);
  });

  test('saveState creates directory if missing', async () => {
    const nestedDir = join(tempDir, 'nested', 'deep');
    const state: StateFile = { version: 1 };

    await saveState(state, nestedDir);

    const content = await readFile(join(nestedDir, 'state.json'), 'utf-8');
    expect(JSON.parse(content)).toEqual(state);
  });

  test('deleteState removes the state file', async () => {
    const state: StateFile = { version: 1 };
    await saveState(state, tempDir);

    await deleteState(tempDir);

    const result = await loadState(tempDir);
    expect(result).toBeUndefined();
  });

  test('deleteState is a no-op when file does not exist', async () => {
    await expect(deleteState(tempDir)).resolves.toBeUndefined();
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
    await saveState(state, tempDir);

    const env = await getActiveEnvironment(tempDir);
    expect(env).toBeDefined();
    expect(env?.name).toBe('my-env');
  });

  test('getActiveEnvironment returns undefined when no state', async () => {
    const env = await getActiveEnvironment(tempDir);
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
    await saveState(state, tempDir);

    expect(await hasActiveEnvironment(tempDir)).toBe(true);
  });

  test('hasActiveEnvironment returns false when no environment', async () => {
    expect(await hasActiveEnvironment(tempDir)).toBe(false);
  });
});

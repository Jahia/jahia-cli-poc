import { describe, expect, test, vi, beforeEach } from 'vitest';

// Mock execFile for inspectContainer
const { mockExecFileAsync } = vi.hoisted(() => ({ mockExecFileAsync: vi.fn() }));

vi.mock('node:child_process', () => {
  const execFile = vi.fn();
  Object.defineProperty(execFile, Symbol.for('nodejs.util.promisify.custom'), {
    value: mockExecFileAsync,
    configurable: true,
    writable: true,
  });
  return { execFile };
});

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

import { persistTestContainer } from '../../../src/commands/tests/run.js';
import type { StateFile } from '../../../src/lib/state/types.js';

beforeEach(() => {
  mockExecFileAsync.mockReset();
});

const makeStateFile = (components: readonly { name: string; containerId: string }[]): StateFile => ({
  version: 1,
  environment: {
    name: 'env-test',
    provider: 'docker',
    network: 'jahia-cli-env-test',
    components: components.map((c) => ({
      name: c.name,
      image: 'some-image',
      tag: 'latest',
      containerId: c.containerId,
    })),
    config: {
      name: 'env-test',
      provider: 'docker',
      components: [{ name: 'jahia' }],
    },
    createdAt: '2026-01-01T00:00:00Z',
  },
});

describe('persistTestContainer', () => {
  const testDir = join(tmpdir(), 'jahia-cli-persist-test');
  const statePath = join(testDir, 'state.json');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  test('adds cypress to state when not already present', async () => {
    const state = makeStateFile([{ name: 'jahia', containerId: 'abc123' }]);
    await writeFile(statePath, JSON.stringify(state));

    mockExecFileAsync.mockResolvedValue({
      stdout: 'true|none|deadbeef1234567890',
      stderr: '',
    });

    await persistTestContainer(
      statePath,
      'jahia-cli-env-test-cypress',
      'jahia-tests',
      'latest',
      ['cypress'],
      [],
    );

    const updated = JSON.parse(await readFile(statePath, 'utf-8')) as StateFile;
    expect(updated.environment?.components).toHaveLength(2);

    const cypress = updated.environment?.components.find((c) => c.name === 'cypress');
    expect(cypress).toBeDefined();
    expect(cypress?.containerId).toBe('deadbeef1234567890');
    expect(cypress?.image).toBe('jahia-tests');
    expect(cypress?.tag).toBe('latest');

    await rm(testDir, { recursive: true, force: true });
  });

  test('upserts existing cypress entry instead of duplicating', async () => {
    const state = makeStateFile([
      { name: 'jahia', containerId: 'abc123' },
      { name: 'cypress', containerId: 'old-id' },
    ]);
    await writeFile(statePath, JSON.stringify(state));

    mockExecFileAsync.mockResolvedValue({
      stdout: 'true|none|newid999',
      stderr: '',
    });

    await persistTestContainer(statePath, 'name', 'img', 'v2', ['cypress'], []);

    const updated = JSON.parse(await readFile(statePath, 'utf-8')) as StateFile;
    expect(updated.environment?.components).toHaveLength(2);

    const cypress = updated.environment?.components.find((c) => c.name === 'cypress');
    expect(cypress?.containerId).toBe('newid999');
    expect(cypress?.tag).toBe('v2');

    await rm(testDir, { recursive: true, force: true });
  });

  test('uses container name as fallback when inspect fails', async () => {
    const state = makeStateFile([{ name: 'jahia', containerId: 'abc123' }]);
    await writeFile(statePath, JSON.stringify(state));

    mockExecFileAsync.mockRejectedValue(new Error('inspect failed'));

    await persistTestContainer(statePath, 'my-container-name', 'img', 'tag', [], []);

    const updated = JSON.parse(await readFile(statePath, 'utf-8')) as StateFile;
    const cypress = updated.environment?.components.find((c) => c.name === 'cypress');
    expect(cypress?.containerId).toBe('my-container-name');

    await rm(testDir, { recursive: true, force: true });
  });

  test('does nothing when state file has no environment', async () => {
    await writeFile(statePath, JSON.stringify({ version: 1 }));

    await persistTestContainer(statePath, 'name', 'img', 'tag', [], []);

    const updated = JSON.parse(await readFile(statePath, 'utf-8')) as StateFile;
    expect(updated.environment).toBeUndefined();

    await rm(testDir, { recursive: true, force: true });
  });

  test('preserves endpoint info', async () => {
    const state = makeStateFile([{ name: 'jahia', containerId: 'abc123' }]);
    await writeFile(statePath, JSON.stringify(state));

    mockExecFileAsync.mockResolvedValue({ stdout: 'true|none|cid123', stderr: '' });

    await persistTestContainer(
      statePath, 'name', 'img', 'tag',
      ['cypress', 'test-runner'],
      [{ container: 8080, host: 9090 }],
    );

    const updated = JSON.parse(await readFile(statePath, 'utf-8')) as StateFile;
    const cypress = updated.environment?.components.find((c) => c.name === 'cypress');
    expect(cypress?.endpoints?.aliases).toEqual(['cypress', 'test-runner']);
    expect(cypress?.endpoints?.ports).toEqual([{ container: 8080, host: 9090 }]);

    await rm(testDir, { recursive: true, force: true });
  });
});

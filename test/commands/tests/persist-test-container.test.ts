import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { describe, expect, test } from 'vitest';

import { persistTestContainer } from '../../../src/lib/tests/persist-test-container.js';
import type { StateFile } from '../../../src/lib/state/types.js';

const createStateDir = async (): Promise<string> => {
  const dir = resolve('.test-artifacts', `persist-test-container-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  return dir;
};

describe('persistTestContainer', () => {
  test('is a no-op when a state file exists', async () => {
    const dir = await createStateDir();
    const statePath = join(dir, 'state.json');
    const state: StateFile = {
      version: 1,
      environment: {
        name: 'env-test',
        provider: 'docker',
        composePath: '/workspace/environment/docker-compose.yml',
        config: {
          name: 'env-test',
          provider: 'docker',
          composePath: '/workspace/environment/docker-compose.yml',
        },
        createdAt: '2026-01-01T00:00:00Z',
      },
    };

    try {
      await writeFile(statePath, JSON.stringify(state), 'utf-8');
      await persistTestContainer(statePath, 'name', 'img', 'tag', ['cypress'], [{ container: 8080, host: 9090 }]);
      const updated = JSON.parse(await readFile(statePath, 'utf-8')) as StateFile;
      expect(updated).toEqual(state);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('resolves even when the state file has no environment', async () => {
    const dir = await createStateDir();
    const statePath = join(dir, 'state.json');

    try {
      await writeFile(statePath, JSON.stringify({ version: 1 }), 'utf-8');
      await expect(
        persistTestContainer(statePath, 'name', 'img', 'tag', [], []),
      ).resolves.toBeUndefined();
      const updated = JSON.parse(await readFile(statePath, 'utf-8')) as StateFile;
      expect(updated).toEqual({ version: 1 });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

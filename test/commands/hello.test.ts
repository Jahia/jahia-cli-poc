import { expect, test, describe } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { formatGreeting } from '../../src/commands/hello.js';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const binPath = resolve(projectRoot, 'bin/dev.js');

const run = (args: string[]): Promise<{ stdout: string; stderr: string }> =>
  execFileAsync(process.execPath, [binPath, ...args]);

describe('formatGreeting', () => {
  test('returns default greeting for world', () => {
    expect(formatGreeting('world', false)).toBe('Hello, world! Welcome to Jahia CLI.');
  });

  test('greets by name', () => {
    expect(formatGreeting('Jahia', false)).toBe('Hello, Jahia! Welcome to Jahia CLI.');
  });

  test('transforms to uppercase', () => {
    expect(formatGreeting('world', true)).toBe('HELLO, WORLD! WELCOME TO JAHIA CLI.');
  });

  test('combines name and uppercase', () => {
    expect(formatGreeting('Jahia', true)).toBe('HELLO, JAHIA! WELCOME TO JAHIA CLI.');
  });
});

describe('hello command (integration)', () => {
  test('runs hello command via CLI', async () => {
    const { stdout } = await run(['hello']);
    expect(stdout).toContain('Hello, world!');
  });

  test('runs hello command with name', async () => {
    const { stdout } = await run(['hello', 'Jahia']);
    expect(stdout).toContain('Hello, Jahia!');
  });

  test('runs hello command with --uppercase', async () => {
    const { stdout } = await run(['hello', '--uppercase']);
    expect(stdout).toContain('HELLO, WORLD!');
  });
});

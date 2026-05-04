import { describe, test, expect } from 'vitest';
import { stateDirFlag } from '../../../src/lib/state/state-dir-flag.js';

describe('stateDirFlag', () => {
  test('is a string flag definition', () => {
    expect(stateDirFlag).toBeDefined();
    expect(stateDirFlag.type).toBe('option');
  });

  test('has env var binding to JAHIA_CLI_STATE_DIR', () => {
    expect(stateDirFlag.env).toBe('JAHIA_CLI_STATE_DIR');
  });

  test('description mentions state.json and default path', () => {
    expect(stateDirFlag.description).toContain('state.json');
    expect(stateDirFlag.description).toContain('~/.jahia-cli/');
  });
});

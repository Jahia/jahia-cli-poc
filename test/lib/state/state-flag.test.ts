import { describe, test, expect } from 'vitest';
import { stateFlag } from '../../../src/lib/state/state-flag.js';

describe('stateFlag', () => {
  test('is a string flag definition', () => {
    expect(stateFlag).toBeDefined();
    expect(stateFlag.type).toBe('option');
  });

  test('has env var binding to JAHIA_CLI_STATE', () => {
    expect(stateFlag.env).toBe('JAHIA_CLI_STATE');
  });

  test('description mentions state JSON path', () => {
    expect(stateFlag.description).toContain('state JSON file');
    expect(stateFlag.description).toContain('~/.jahia-cli/state.json');
  });
});

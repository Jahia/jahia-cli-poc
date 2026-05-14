import { describe, expect, test } from 'vitest';

import { buildScriptPayload } from '../../../src/lib/provisioning/submit-file-action.js';

describe('buildScriptPayload', () => {
  test('builds module payload with installOrUpgradeBundle', () => {
    const payload = buildScriptPayload('module', 'my-module.jar');
    const parsed = JSON.parse(payload) as unknown[];
    expect(parsed).toEqual([{ installOrUpgradeBundle: 'my-module.jar', forceUpdate: true }]);
  });

  test('builds script payload with executeScript', () => {
    const payload = buildScriptPayload('script', 'init.groovy');
    const parsed = JSON.parse(payload) as unknown[];
    expect(parsed).toEqual([{ executeScript: 'init.groovy' }]);
  });

  test('produces valid JSON string', () => {
    const payload = buildScriptPayload('module', 'test.jar');
    const parsed: unknown = JSON.parse(payload);
    expect(parsed).toBeDefined();
  });

  test('handles filenames with special characters', () => {
    const payload = buildScriptPayload('module', 'my-module (1).jar');
    const parsed = JSON.parse(payload) as { installOrUpgradeBundle: string }[];
    expect(parsed[0]?.installOrUpgradeBundle).toBe('my-module (1).jar');
  });
});

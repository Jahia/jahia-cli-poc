import { describe, expect, test } from 'vitest';

import { mergeWorkflowSources } from '../../../src/lib/workflow/merge-workflow-sources.js';

describe('mergeWorkflowSources', () => {
  const globalWorkflows = {
    setup: { steps: [{ run: 'echo setup' }] },
    test: { steps: [{ run: 'echo test' }] },
    cleanup: { default: true as const, steps: [{ run: 'echo cleanup' }] },
  };

  const localWorkflows = {
    main: { default: true as const, steps: [{ run: 'echo main' }] },
    cleanup: { steps: [{ run: 'echo local-cleanup' }] },
  };

  test('returns undefined when both sources are undefined', () => {
    expect(mergeWorkflowSources(undefined, undefined)).toBeUndefined();
  });

  test('returns local workflows when global is undefined', () => {
    const result = mergeWorkflowSources(undefined, localWorkflows);
    expect(result).toBeDefined();
    expect(Object.keys(result?.workflows ?? {})).toEqual(['main', 'cleanup']);
    expect(result?.sources['main']).toBe('config');
    expect(result?.sources['cleanup']).toBe('config');
  });

  test('returns global workflows when local is undefined', () => {
    const result = mergeWorkflowSources(globalWorkflows, undefined);
    expect(result).toBeDefined();
    expect(Object.keys(result?.workflows ?? {})).toEqual(['setup', 'test', 'cleanup']);
    expect(result?.sources['setup']).toBe('workflow-file');
  });

  test('merges global and local with local winning on name collision', () => {
    const result = mergeWorkflowSources(globalWorkflows, localWorkflows);
    expect(result).toBeDefined();
    const wf = result?.workflows ?? {};
    // Local cleanup overrides global cleanup
    expect(wf['cleanup']?.steps[0]).toEqual({ run: 'echo local-cleanup' });
    // Global workflows preserved
    expect(wf['setup']?.steps[0]).toEqual({ run: 'echo setup' });
    expect(wf['test']?.steps[0]).toEqual({ run: 'echo test' });
    // Local main preserved
    expect(wf['main']?.steps[0]).toEqual({ run: 'echo main' });
  });

  test('tracks source attribution correctly on merge', () => {
    const result = mergeWorkflowSources(globalWorkflows, localWorkflows);
    expect(result?.sources['setup']).toBe('workflow-file');
    expect(result?.sources['test']).toBe('workflow-file');
    expect(result?.sources['cleanup']).toBe('config-override');
    expect(result?.sources['main']).toBe('config');
  });

  test('strips global defaults when local has a default', () => {
    const result = mergeWorkflowSources(globalWorkflows, localWorkflows);
    // Global cleanup had default:true but local main also has default:true
    // Global defaults should be stripped
    expect(result?.workflows['cleanup']?.default).toBeUndefined();
    // Local default preserved
    expect(result?.workflows['main']?.default).toBe(true);
  });

  test('preserves global default when no local default exists', () => {
    const localNoDefault = {
      custom: { steps: [{ run: 'echo custom' }] },
    };
    const result = mergeWorkflowSources(globalWorkflows, localNoDefault);
    expect(result?.workflows['cleanup']?.default).toBe(true);
  });
});
